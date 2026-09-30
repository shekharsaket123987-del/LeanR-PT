import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";
import { notifyUser } from "./notifications.service";

const ESCALATION_SELECT =
  "*, client:client_profiles(id, client_code, profile:profiles(full_name, photo_url)), coach:coach_profiles(id, profile:profiles(full_name))";

const LEVEL_ORDER = ["L0", "L1", "L2", "L3"] as const;
type Level = (typeof LEVEL_ORDER)[number];
function bumpLevel(level: Level): Level {
  const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1];
  return next ?? level;
}
const DEDUPE_WINDOW_DAYS = 14;

/** Client raising their own concern (client portal), admin logging one on
 * the client's behalf during a support call, or the AI RM raising one for
 * the client (source='ai_rm', see aiBuddyChat.service.ts's raise_concern
 * tool and the pre-check L3 path in the chat route) -- raisedBy is omitted
 * for the admin and AI RM cases, which the timeline event and UI both
 * reflect the same way ("logged on the client's behalf").
 *
 * Dedupe (PRD §11.3) applies only to source='ai_rm' -- a human client
 * manually raising a second, genuinely separate concern in the same
 * category should always get its own ticket; it's specifically the AI
 * re-raising the same thing that must fold into the existing one. When it
 * applies: an open/in_progress escalation in the same category for this
 * client, raised within the last 14 days, gets a progress note appended
 * instead of a duplicate row; if the *same* trigger_rule fires again within
 * that window, the existing escalation's level is bumped one step instead
 * of silently repeating. */
export async function createEscalation(
  accessToken: string,
  input: {
    clientId: string;
    coachId?: string;
    reason: string;
    description?: string;
    category?: string;
    source?: "client" | "ai_rm";
    level?: Level;
    triggerRule?: string;
    aiSummary?: string;
    aiChatMessageId?: string;
  }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "client"]);
  const raisedBy = ctx.role === "client" && input.source !== "ai_rm" ? ctx.userId : null;
  const source = input.source ?? "client";

  if (input.category && source === "ai_rm") {
    const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("escalations")
      .select("id, level, trigger_rule, ai_summary")
      .eq("client_id", input.clientId)
      .eq("category", input.category)
      .neq("status", "resolved")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      // escalation_notes is gated by enforce_escalation_note_call_gate (DB
      // trigger, migration 0049) -- no row can go in there until an admin
      // has confirmed they called the client, which is correct for that
      // channel (it's specifically "what admin did about it," client-
      // visible as such) but wrong for an AI-authored repeat-report. Folding
      // the repeat into ai_summary instead avoids the gate and keeps
      // escalation_notes meaning what it already means everywhere else in
      // the app.
      const sameTrigger = input.triggerRule && existing.trigger_rule === input.triggerRule;
      const updates: Record<string, unknown> = {
        ai_summary: `${existing.ai_summary ? existing.ai_summary + "\n" : ""}Repeated: ${input.reason}${input.description ? ` -- ${input.description}` : ""}`,
      };
      if (sameTrigger && existing.level) updates.level = bumpLevel(existing.level as Level);
      const { error: updateError } = await supabaseAdmin.from("escalations").update(updates).eq("id", existing.id);
      if (updateError) throw updateError;
      const { data: updated, error: fetchError } = await supabaseAdmin.from("escalations").select().eq("id", existing.id).single();
      if (fetchError) throw fetchError;
      return updated;
    }
  }

  const { data, error } = await ctx.client
    .from("escalations")
    .insert({
      client_id: input.clientId,
      coach_id: input.coachId ?? null,
      raised_by: raisedBy,
      reason: input.reason,
      description: input.description ?? null,
      category: input.category ?? null,
      status: "open",
      source,
      level: input.level ?? null,
      trigger_rule: input.triggerRule ?? null,
      ai_summary: input.aiSummary ?? null,
      ai_chat_message_id: input.aiChatMessageId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Timeline log and the coach/client lookups are all independent of each
  // other -- none consumes another's result.
  const [, coachResult, clientResult] = await Promise.all([
    logTimelineEvent(input.clientId, "client_raised_concern", input.reason, {
      description: input.description,
      actorId: raisedBy,
      metadata: { escalationId: data.id },
    }),
    input.coachId
      ? supabaseAdmin.from("coach_profiles").select("profile_id").eq("id", input.coachId).maybeSingle()
      : Promise.resolve({ data: null }),
    input.coachId
      ? supabaseAdmin.from("client_profiles").select("profile:profiles(full_name)").eq("id", input.clientId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (input.coachId && coachResult.data) {
    await notifyUser((coachResult.data as any).profile_id, "escalation_raised_to_coach", {
      client_name: (clientResult.data as any)?.profile?.full_name ?? "Client",
      reason: input.reason,
    });
  }

  return data;
}

/** Every status change (in_progress, resolved) requires the admin to have
 * already confirmed a phone call with the client -- reflects the business
 * rule that an escalation can't be worked without first talking to the
 * client, not just enforced as a UI hint. */
async function requireCalledClient(escalationId: string) {
  const { data, error } = await supabaseAdmin.from("escalations").select("called_client_at").eq("id", escalationId).single();
  if (error) throw error;
  if (!data.called_client_at) {
    throw new Error("Call the client and discuss the issue before updating this escalation.");
  }
}

/** First step of the resolution workflow -- records that the admin has
 * called and discussed the issue with the client. Nothing else on the
 * escalation (issue type, fault, status) can be changed until this is set;
 * see requireCalledClient(). */
export async function confirmCalledClient(accessToken: string, escalationId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin
    .from("escalations")
    .update({ called_client_at: new Date().toISOString(), called_by: ctx.userId })
    .eq("id", escalationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Admin's own classification/summary of the case -- distinct from the
 * client's original category/reason/description, which stay untouched as
 * the client's original report. Saveable repeatedly while a case is being
 * worked, independent of the final status change. */
export async function updateEscalationDetails(
  accessToken: string,
  escalationId: string,
  input: { issueType?: string; fault?: string; adminSummary?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  await requireCalledClient(escalationId);

  const { data, error } = await supabaseAdmin
    .from("escalations")
    .update({
      admin_issue_type: input.issueType ?? null,
      fault: input.fault ?? null,
      admin_summary: input.adminSummary ?? null,
    })
    .eq("id", escalationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Only admin can update/close a ticket, per business rule -- coaches can
 * see escalations linked to their clients (read-only) but not change status. */
export async function markEscalationInProgress(accessToken: string, escalationId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  await requireCalledClient(escalationId);
  const { data, error } = await supabaseAdmin.from("escalations").update({ status: "in_progress" }).eq("id", escalationId).select().single();
  if (error) throw error;
  return data;
}

export async function resolveEscalation(accessToken: string, escalationId: string, resolutionNotes?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  await requireCalledClient(escalationId);

  const { data, error } = await supabaseAdmin
    .from("escalations")
    .update({ status: "resolved", resolved_by: ctx.userId, resolved_at: new Date().toISOString(), resolution_notes: resolutionNotes ?? null })
    .eq("id", escalationId)
    .select("*, client:client_profiles(profile_id)")
    .single();
  if (error) throw error;

  await logTimelineEvent(data.client_id, "escalation_resolved", "Escalation resolved", {
    description: resolutionNotes,
    actorId: ctx.userId,
    metadata: { escalationId },
  });

  const clientProfileId = (data as any).client?.profile_id;
  if (clientProfileId) {
    await notifyUser(clientProfileId, "escalation_resolved_client", {
      reason: data.reason,
      resolution_line: resolutionNotes ? ` ${resolutionNotes}` : "",
    });
  }

  return data;
}

/** Progress-notes trail -- for cases that take days and coordination across
 * teams to close. Client-visible (escalation_notes_select_own_client RLS),
 * so this doubles as the "what did admin do about it" update the client
 * sees, separate from resolution_notes which is only the final closing
 * summary. */
export async function addEscalationNote(accessToken: string, escalationId: string, note: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  await requireCalledClient(escalationId);

  const { data, error } = await supabaseAdmin
    .from("escalation_notes")
    .insert({ escalation_id: escalationId, author_id: ctx.userId, note })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listEscalationNotes(accessToken: string, escalationId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("escalation_notes")
    .select("*, author:profiles(full_name)")
    .eq("escalation_id", escalationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** Batch fetch for the client concerns list -- one query for all of the
 * client's escalations' notes rather than N+1 per concern card. */
export async function listEscalationNotesForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("escalation_notes")
    .select("*, escalation:escalations!inner(client_id)")
    .eq("escalation.client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getEscalation(accessToken: string, escalationId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("escalations").select(ESCALATION_SELECT).eq("id", escalationId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEscalationsForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("escalations")
    .select(ESCALATION_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Coach's read-only view of escalations linked to their clients — PRD
 * "Client Escalations (Read Only)": no update/resolve capability is exposed
 * here, matching escalations_select_by_coach RLS (select-only for coaches). */
export async function listEscalationsForCoach(accessToken: string, coachId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("escalations")
    .select(ESCALATION_SELECT)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Global admin escalations queue (§2.7) -- every escalation platform-wide,
 * unfiltered by status; the admin page applies its own Active/Resolved tabs
 * client-side (same pattern as the coach-side equivalent), rather than this
 * function only ever returning 'open' like listOpenEscalations() does. */
export async function listAllEscalations(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("escalations").select(ESCALATION_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listOpenEscalations(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client
    .from("escalations")
    .select(ESCALATION_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Backs the coach-performance "Escalations Raised" metric. */
export async function countEscalationsForCoach(coachId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from("escalations").select("id", { count: "exact", head: true }).eq("coach_id", coachId);
  if (error) throw error;
  return count ?? 0;
}

/** Backs the sidebar's unresolved-escalations badge, one per portal.
 * "Unresolved" is open or in_progress -- anything not yet resolved -- which
 * matches the Active tab filter the coach/admin escalations list pages
 * already use, so the badge count and what "Active" shows never disagree. */
export async function countUnresolvedEscalationsForClient(accessToken: string, clientId: string): Promise<number> {
  const ctx = await getCallerContext(accessToken);
  const { count, error } = await ctx.client
    .from("escalations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .neq("status", "resolved");
  if (error) throw error;
  return count ?? 0;
}

export async function countUnresolvedEscalationsForCoach(accessToken: string, coachId: string): Promise<number> {
  const ctx = await getCallerContext(accessToken);
  const { count, error } = await ctx.client
    .from("escalations")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coachId)
    .neq("status", "resolved");
  if (error) throw error;
  return count ?? 0;
}

export async function countUnresolvedEscalationsForAdmin(accessToken: string): Promise<number> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { count, error } = await supabaseAdmin
    .from("escalations")
    .select("id", { count: "exact", head: true })
    .neq("status", "resolved");
  if (error) throw error;
  return count ?? 0;
}
