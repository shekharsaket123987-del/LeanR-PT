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

  await logTimelineEvent(input.clientId, "client_raised_concern", input.reason, {
    description: input.description,
    actorId: raisedBy,
    metadata: { escalationId: data.id },
  });

  if (input.coachId) {
    const { data: coach } = await supabaseAdmin.from("coach_profiles").select("profile_id").eq("id", input.coachId).maybeSingle();
    const { data: client } = await supabaseAdmin.from("client_profiles").select("profile:profiles(full_name)").eq("id", input.clientId).maybeSingle();
    if (coach) {
      await createFromTemplate("escalation_raised_to_coach", coach.profile_id, {
        client_name: (client as any)?.profile?.full_name ?? "Client",
        reason: input.reason,
      });
    }
  }

  return data;
}

/** Only admin can update/close a ticket, per business rule -- coaches can
 * see escalations linked to their clients (read-only) but not change status. */
export async function markEscalationInProgress(accessToken: string, escalationId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin.from("escalations").update({ status: "in_progress" }).eq("id", escalationId).select().single();
  if (error) throw error;
  return data;
}

export async function resolveEscalation(accessToken: string, escalationId: string, resolutionNotes?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

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
