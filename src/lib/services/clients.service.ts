import { getCallerContext, requireRole } from "./_auth";
import { logTimelineEvent } from "./timeline.service";

/** Admin roster view — merges each client's active subscription (package
 * name + session counts) and active recurring coach, same "fetch once,
 * merge in JS" pattern as listMyClients(), since neither has a PostgREST-
 * embeddable FK relationship to client_profiles. */
export async function listClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone, id)");
  if (error) throw error;

  const clientIds = (data ?? []).map((c) => c.id);
  if (clientIds.length === 0) return [];

  const [{ data: subs, error: subsError }, { data: slots, error: slotsError }] = await Promise.all([
    ctx.client
      .from("subscriptions")
      .select("id, client_id, sessions_total, package:package_tiers(name)")
      .in("client_id", clientIds)
      .eq("status", "active"),
    ctx.client
      .from("recurring_slots")
      .select("client_id, coach_id, coach:coach_profiles(id, profile:profiles(full_name))")
      .in("client_id", clientIds)
      .eq("status", "active"),
  ]);
  if (subsError) throw subsError;
  if (slotsError) throw slotsError;

  const subIds = (subs ?? []).map((s) => s.id);
  const { data: usage, error: usageError } =
    subIds.length > 0
      ? await ctx.client.from("subscription_usage_view").select("subscription_id, sessions_remaining").in("subscription_id", subIds)
      : { data: [], error: null };
  if (usageError) throw usageError;
  const remainingBySub = new Map((usage ?? []).map((u) => [u.subscription_id, u.sessions_remaining]));

  const subById = new Map((subs ?? []).map((s) => [s.client_id, { ...s, sessionsRemaining: remainingBySub.get(s.id) ?? null }]));
  const coachById = new Map((slots ?? []).map((s) => [s.client_id, s.coach]));

  return (data ?? []).map((c) => ({
    ...c,
    activeSubscription: subById.get(c.id) ?? null,
    activeCoach: coachById.get(c.id) ?? null,
  }));
}

export async function getClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone, id)")
    .eq("id", clientId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyClientProfile(
  accessToken: string,
  patch: Partial<{ medical_notes: string; equipment: string[]; goals: string[] }>
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .update(patch)
    .eq("profile_id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** All clients linked to the signed-in coach via a booking or recurring
 * slot — RLS (coach_client_linked) already scopes this, so no explicit join
 * is needed here. */
export async function listMyClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client.from("client_profiles").select("*, profile:profiles(full_name, photo_url, phone)");
  if (error) throw error;

  const clientIds = (data ?? []).map((c) => c.id);
  if (clientIds.length === 0) return [];
  const { data: subs, error: subsError } = await ctx.client
    .from("subscriptions")
    .select("client_id, status, package:package_tiers(name)")
    .in("client_id", clientIds)
    .eq("status", "active");
  if (subsError) throw subsError;
  const subByClient = new Map((subs ?? []).map((s) => [s.client_id, s]));

  return (data ?? []).map((c) => ({ ...c, activeSubscription: subByClient.get(c.id) ?? null }));
}

export async function getMyClientProfile(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)")
    .eq("profile_id", ctx.userId)
    .single();
  if (error) throw error;
  return data;
}

/** Distinct client IDs with an active recurring slot under this coach —
 * backs the admin "Reassign Clients" bulk action on the coach detail page. */
export async function listActiveClientIdsForCoach(accessToken: string, coachId: string): Promise<string[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("recurring_slots").select("client_id").eq("coach_id", coachId).eq("status", "active");
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.client_id))];
}

/** Moves a client's active recurring slots + upcoming bookings from one coach
 * to another. Shared by coachChange.service.ts (per-client approved request)
 * and the admin client-detail "Transfer to Another Coach" control. */
export async function reassignClientCoach(accessToken: string, clientId: string, fromCoachId: string, toCoachId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "client"]);

  if (ctx.role === "client") {
    const { data: own, error: ownError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
    if (ownError || !own || own.id !== clientId) throw new Error("Not your record");
  }

  const { error: slotsError } = await ctx.client
    .from("recurring_slots")
    .update({ coach_id: toCoachId })
    .eq("client_id", clientId)
    .eq("coach_id", fromCoachId)
    .eq("status", "active");
  if (slotsError) throw slotsError;

  const { error: bookingsError } = await ctx.client
    .from("bookings")
    .update({ coach_id: toCoachId })
    .eq("client_id", clientId)
    .eq("coach_id", fromCoachId)
    .eq("status", "upcoming");
  if (bookingsError) throw bookingsError;

  await logTimelineEvent(clientId, "coach_changed", "Coach changed", { actorId: ctx.userId, metadata: { fromCoachId, toCoachId } });
}

/** Admin/coach-facing equivalent of getMyCurrentCoachId, parameterized by
 * clientId instead of the caller's own profile. Same prefer-active-slot,
 * fall-back-to-latest-booking resolution. */
export async function getClientCurrentCoachId(accessToken: string, clientId: string): Promise<string | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);

  const { data: activeSlot } = await ctx.client
    .from("recurring_slots")
    .select("coach_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeSlot?.coach_id) return activeSlot.coach_id;

  const { data: latestBooking } = await ctx.client
    .from("bookings")
    .select("coach_id")
    .eq("client_id", clientId)
    .order("scheduled_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestBooking?.coach_id ?? null;
}

/** Resolves the client's current coach: prefers an active recurring slot,
 * falls back to their most recent booking. Returns null if neither exists
 * (a brand-new client with no coach assigned yet — assignment isn't
 * automated in Phase 1, see docs/BUSINESS_OPERATIONS_SPEC.md §8). Shared by
 * coachChange.service.ts so the lookup lives in exactly one place. */
export async function getMyCurrentCoachId(accessToken: string): Promise<string | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client
    .from("client_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: activeSlot } = await ctx.client
    .from("recurring_slots")
    .select("coach_id")
    .eq("client_id", client.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeSlot?.coach_id) return activeSlot.coach_id;

  const { data: latestBooking } = await ctx.client
    .from("bookings")
    .select("coach_id")
    .eq("client_id", client.id)
    .order("scheduled_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestBooking?.coach_id ?? null;
}
