import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";
import { createFromTemplate } from "./notifications.service";

const ESCALATION_SELECT =
  "*, client:client_profiles(id, client_code, profile:profiles(full_name, photo_url)), coach:coach_profiles(id, profile:profiles(full_name))";

/** Client raising their own concern (client portal, once built) or admin
 * logging one on the client's behalf during a support call -- raisedBy is
 * omitted for the admin case, which the timeline event and UI both reflect. */
export async function createEscalation(
  accessToken: string,
  input: { clientId: string; coachId?: string; reason: string; description?: string; category?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "client"]);
  const raisedBy = ctx.role === "client" ? ctx.userId : null;

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
    await createFromTemplate("escalation_raised_to_coach", (coachResult.data as any).profile_id, {
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
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(data.client_id, "escalation_resolved", "Escalation resolved", {
    description: resolutionNotes,
    actorId: ctx.userId,
    metadata: { escalationId },
  });

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
