import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getMyCurrentCoachId, reassignClientCoach } from "./clients.service";
import { logTimelineEvent } from "./timeline.service";
import { findAvailableCoach, createRecurringSlots, PatternKey } from "./scheduling.service";
import { createFromTemplate } from "./notifications.service";

export async function requestCoachChange(
  accessToken: string,
  input: { reason: string; overallExperience?: number; coachRating?: number; additionalComments?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const currentCoachId = await getMyCurrentCoachId(accessToken);
  if (!currentCoachId) throw new Error("No current coach found for this client");

  const { data, error } = await ctx.client
    .from("coach_change_requests")
    .insert({
      client_id: client.id,
      current_coach_id: currentCoachId,
      reason: input.reason,
      overall_experience: input.overallExperience ?? null,
      coach_rating: input.coachRating ?? null,
      additional_comments: input.additionalComments ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Client-facing: their own most recent request, whatever state it's in --
 * RLS's coach_change_select_own already scopes this to their own rows. */
export async function getMyLatestCoachChangeRequest(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client
    .from("coach_change_requests")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCoachChangeRequests(accessToken: string, status?: "pending" | "approved" | "rejected") {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  let query = ctx.client
    .from("coach_change_requests")
    .select(
      "*, client:client_profiles(profile:profiles(full_name, photo_url)), current_coach:coach_profiles!coach_change_requests_current_coach_id_fkey(profile:profiles(full_name))"
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Approving either (a) reassigns immediately if the admin picked a coach
 * directly -- the original fast path, fixing the prototype bug where the
 * picked coach was silently discarded -- or (b) if newCoachId is omitted,
 * just flips the request to 'approved' and leaves the client to pick their
 * new day/time (system searches available coaches) via
 * findCoachChangeOptions()/completeCoachChange() below. Rejecting never
 * takes newCoachId. */
export async function resolveCoachChangeRequest(
  accessToken: string,
  requestId: string,
  decision: { approve: boolean; newCoachId?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: request, error: updateError } = await ctx.client
    .from("coach_change_requests")
    .update({
      status: decision.approve ? "approved" : "rejected",
      new_coach_id: decision.approve ? decision.newCoachId ?? null : null,
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (updateError || !request) throw updateError ?? new Error("Request not found");

  if (decision.approve && decision.newCoachId) {
    await reassignClientCoach(accessToken, request.client_id, request.current_coach_id, decision.newCoachId);
  }

  return request;
}

/** Client-facing search, once their request is approved but no coach was
 * picked directly: reuses findAvailableCoach's whole-pattern availability
 * check, scoped to exclude the client's current coach (the whole point of
 * the request) via excludeCoachId. */
export async function findCoachChangeOptions(
  accessToken: string,
  requestId: string,
  input: { pattern: PatternKey; preferredTime: string; customDays?: number[]; durationMinutes?: number }
) {
  const ctx = await getCallerContext(accessToken);
  const { data: request, error } = await ctx.client.from("coach_change_requests").select("current_coach_id, status").eq("id", requestId).single();
  if (error || !request) throw error ?? new Error("Request not found");
  if (request.status !== "approved") throw new Error("This request has not been approved yet.");

  return findAvailableCoach(accessToken, { ...input, excludeCoachId: request.current_coach_id });
}

/** Finalizes a client-driven coach change: unlike the admin fast path
 * (reassignClientCoach, which keeps the SAME day/time and just repoints
 * coach_id), the client here has chosen a whole new day/time pattern -- so
 * the old recurring_slots (and their still-upcoming bookings) must be
 * retired rather than repointed, mirroring changeMyRecurringSchedule's
 * retire-then-recreate approach, or the client would end up with both the
 * old AND new patterns active at once. */
export async function completeCoachChange(
  accessToken: string,
  requestId: string,
  chosenCoachId: string,
  days: number[],
  timeOfDay: string,
  durationMinutes?: number
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: request, error } = await ctx.client.from("coach_change_requests").select("*").eq("id", requestId).single();
  if (error || !request) throw error ?? new Error("Request not found");
  if (request.status !== "approved") throw new Error("This request has not been approved yet.");
  if (request.new_coach_id) throw new Error("This request has already been completed.");

  const { data: activeSlots, error: slotsError } = await ctx.client
    .from("recurring_slots")
    .select("id")
    .eq("client_id", request.client_id)
    .eq("coach_id", request.current_coach_id)
    .eq("status", "active");
  if (slotsError) throw slotsError;

  if (activeSlots && activeSlots.length > 0) {
    const slotIds = activeSlots.map((s) => s.id);
    const { error: deactivateError } = await ctx.client.from("recurring_slots").update({ status: "cancelled" }).in("id", slotIds);
    if (deactivateError) throw deactivateError;

    const { error: cancelBookingsError } = await ctx.client
      .from("bookings")
      .update({ status: "cancelled", cancel_reason: "Client changed coaches" })
      .in("recurring_slot_id", slotIds)
      .eq("status", "upcoming");
    if (cancelBookingsError) throw cancelBookingsError;
  }

  await createRecurringSlots(accessToken, { coachId: chosenCoachId, days, timeOfDay, durationMinutes });
  await logTimelineEvent(request.client_id, "coach_changed", "Coach changed", {
    actorId: ctx.userId,
    metadata: { fromCoachId: request.current_coach_id, toCoachId: chosenCoachId },
  });

  const { error: finalizeError } = await supabaseAdmin.from("coach_change_requests").update({ new_coach_id: chosenCoachId }).eq("id", requestId);
  if (finalizeError) throw finalizeError;
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

  await logTimelineEvent(input.clientId, "shadow_coach_assigned", "Shadow coach assigned", {
    description: input.reason,
    actorId: ctx.userId,
    metadata: { primaryCoachId: input.primaryCoachId, shadowCoachId: input.shadowCoachId, startsOn: input.startsOn, endsOn: input.endsOn },
  });

  const [{ data: client }, { data: shadowCoach }, { data: primaryCoach }] = await Promise.all([
    supabaseAdmin.from("client_profiles").select("profile_id, profile:profiles(full_name)").eq("id", input.clientId).maybeSingle(),
    supabaseAdmin.from("coach_profiles").select("profile_id, profile:profiles(full_name)").eq("id", input.shadowCoachId).maybeSingle(),
    supabaseAdmin.from("coach_profiles").select("profile:profiles(full_name)").eq("id", input.primaryCoachId).maybeSingle(),
  ]);
  const primaryCoachName = (primaryCoach as any)?.profile?.full_name ?? "your coach";
  if (client) {
    await createFromTemplate("shadow_coach_assigned", (client as any).profile_id, {
      shadow_coach_name: (shadowCoach as any)?.profile?.full_name ?? "A coach",
      primary_coach_name: primaryCoachName,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    });
  }
  if (shadowCoach) {
    await createFromTemplate("shadow_assignment_for_coach", (shadowCoach as any).profile_id, {
      client_name: (client as any)?.profile?.full_name ?? "a client",
      primary_coach_name: primaryCoachName,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    });
  }

  return data as string; // assignment id
}

/** §4.2.5: re-covers sessions when the SHADOW coach (not the primary) goes
 * on leave themselves. Distinct RPC from assignShadowCoach() because that
 * one matches bookings by `coach_id = primaryCoachId` -- these bookings
 * already moved to the outgoing shadow, so this matches on their id
 * instead and marks the superseded assignment 'cancelled'. Notification
 * copy reuses the same templates assignShadowCoach() sends (from the
 * client's perspective this reads identically: a shadow coach was
 * assigned), the outgoing shadow isn't notified here since their own leave
 * approval already told them. */
export async function reassignShadowCoverage(
  accessToken: string,
  input: {
    clientId: string;
    oldShadowCoachId: string;
    newShadowCoachId: string;
    primaryCoachId: string;
    startsOn: string;
    endsOn: string;
    reason?: string;
  }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.rpc("reassign_shadow_coverage", {
    p_client_id: input.clientId,
    p_old_shadow_coach_id: input.oldShadowCoachId,
    p_new_shadow_coach_id: input.newShadowCoachId,
    p_primary_coach_id: input.primaryCoachId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;

  await logTimelineEvent(input.clientId, "shadow_coach_assigned", "Shadow coach reassigned", {
    description: input.reason,
    actorId: ctx.userId,
    metadata: { primaryCoachId: input.primaryCoachId, oldShadowCoachId: input.oldShadowCoachId, newShadowCoachId: input.newShadowCoachId },
  });

  const [{ data: client }, { data: newShadowCoach }, { data: primaryCoach }] = await Promise.all([
    supabaseAdmin.from("client_profiles").select("profile_id, profile:profiles(full_name)").eq("id", input.clientId).maybeSingle(),
    supabaseAdmin.from("coach_profiles").select("profile_id, profile:profiles(full_name)").eq("id", input.newShadowCoachId).maybeSingle(),
    supabaseAdmin.from("coach_profiles").select("profile:profiles(full_name)").eq("id", input.primaryCoachId).maybeSingle(),
  ]);
  const primaryCoachName = (primaryCoach as any)?.profile?.full_name ?? "your coach";
  if (client) {
    await createFromTemplate("shadow_coach_assigned", (client as any).profile_id, {
      shadow_coach_name: (newShadowCoach as any)?.profile?.full_name ?? "A coach",
      primary_coach_name: primaryCoachName,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    });
  }
  if (newShadowCoach) {
    await createFromTemplate("shadow_assignment_for_coach", (newShadowCoach as any).profile_id, {
      client_name: (client as any)?.profile?.full_name ?? "a client",
      primary_coach_name: primaryCoachName,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    });
  }

  return data as string; // assignment id
}

/** Shadow assignments where the caller is the *shadow* coach — backs the
 * coach's Activity Timeline ("Shadow Session Conducted"/assigned entries).
 * RLS (shadow_select_participant) already scopes this to the caller. */
export async function listMyShadowAssignments(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("shadow_coach_assignments")
    .select("id, client:client_profiles(id, profile:profiles(full_name)), primary_coach:coach_profiles!primary_coach_id(profile:profiles(full_name)), starts_on, ends_on, status, created_at")
    .eq("shadow_coach_id", coach.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Shadow assignments where the caller is the CLIENT being covered -- backs
 * the "shadow coach assigned" per-session badge on My Sessions (a shadow
 * coach's name alone on a booking looks like a permanent coach change
 * unless the client can see it's temporary cover for their usual coach).
 * RLS (shadow_select_participant) already scopes this to the caller. */
export async function listMyShadowAssignmentsAsClient(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client
    .from("shadow_coach_assignments")
    .select("id, shadow_coach_id, primary_coach:coach_profiles!primary_coach_id(profile:profiles(full_name)), starts_on, ends_on, status")
    .eq("client_id", client.id)
    .eq("status", "active");
  if (error) throw error;
  return data;
}

/** Platform-wide shadow assignments -- backs the Admin scheduling view's
 * "Shadow Sessions" group (unlike listMyShadowAssignments, not scoped to
 * the caller). */
export async function listAllShadowAssignments(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data, error } = await ctx.client
    .from("shadow_coach_assignments")
    .select(
      "id, client:client_profiles(id, profile:profiles(full_name)), primary_coach:coach_profiles!primary_coach_id(profile:profiles(full_name)), shadow_coach:coach_profiles!shadow_coach_id(profile:profiles(full_name)), starts_on, ends_on, status, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
