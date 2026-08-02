import { getCallerContext, requireRole } from "./_auth";
import { getMyCurrentCoachId } from "./clients.service";

export async function requestCoachChange(accessToken: string, reason: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const currentCoachId = await getMyCurrentCoachId(accessToken);
  if (!currentCoachId) throw new Error("No current coach found for this client");

  const { data, error } = await ctx.client
    .from("coach_change_requests")
    .insert({ client_id: client.id, current_coach_id: currentCoachId, reason, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCoachChangeRequests(accessToken: string, status?: "pending" | "approved" | "rejected") {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  let query = ctx.client
    .from("coach_change_requests")
    .select("*, client:client_profiles(profile:profiles(full_name)), current_coach:coach_profiles!coach_change_requests_current_coach_id_fkey(profile:profiles(full_name))")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Approving (a) records the chosen coach — fixing the prototype bug where
 * this was picked in the UI then silently discarded — and (b) reassigns the
 * client's active recurring pattern (and any already-generated upcoming
 * bookings with the old coach) to the new coach going forward. */
export async function resolveCoachChangeRequest(
  accessToken: string,
  requestId: string,
  decision: { approve: boolean; newCoachId?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  if (decision.approve && !decision.newCoachId) {
    throw new Error("newCoachId is required to approve a coach change");
  }

  const { data: request, error: updateError } = await ctx.client
    .from("coach_change_requests")
    .update({
      status: decision.approve ? "approved" : "rejected",
      new_coach_id: decision.approve ? decision.newCoachId : null,
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (updateError || !request) throw updateError ?? new Error("Request not found");

  if (decision.approve && decision.newCoachId) {
    await ctx.client
      .from("recurring_slots")
      .update({ coach_id: decision.newCoachId })
      .eq("client_id", request.client_id)
      .eq("coach_id", request.current_coach_id)
      .eq("status", "active");

    await ctx.client
      .from("bookings")
      .update({ coach_id: decision.newCoachId })
      .eq("client_id", request.client_id)
      .eq("coach_id", request.current_coach_id)
      .eq("status", "upcoming");
  }

  return request;
}

export async function assignShadowCoach(
  accessToken: string,
  input: { clientId: string; primaryCoachId: string; shadowCoachId: string; startsOn: string; endsOn: string; reason?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.rpc("assign_shadow_coach", {
    p_client_id: input.clientId,
    p_primary_coach_id: input.primaryCoachId,
    p_shadow_coach_id: input.shadowCoachId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
  return data as string; // assignment id
}
