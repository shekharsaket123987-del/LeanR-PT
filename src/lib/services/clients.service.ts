import { getCallerContext, requireRole } from "./_auth";
import { logTimelineEvent } from "./timeline.service";
import { getLatestMeasurementDatesForClients } from "./progressLogs.service";
import { ensureConversationForCoachAssignment } from "./chat.service";
import { resolveSessionNotifyContext, notifyClient, notifyCoach } from "./sessionNotifications.service";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { deriveClientStatus } from "@/lib/client-status";
import { getClientStatusSnapshot, logClientStatusChange } from "./clientStatus";
import { createRecurringSlotsForClient } from "./scheduling.service";

/** Every subscription status a client has ever had, plus whether they've
 * ever taken a demo (session_type = 'assessment') booking -- the two raw
 * signals deriveClientStatus() needs. Shared by listClients/listMyClients/
 * searchAllClients so admin, coach, and global search all compute the exact
 * same composite ClientStatus off the exact same query shape. Uses
 * supabaseAdmin deliberately: subscriptions/bookings RLS is scoped to admin
 * or the assigned coach (unlike the widened client_profiles/profiles RLS
 * from migration 0033), so a coach's global-search read across every
 * client's data would otherwise come back empty for anyone not their own. */
async function getStatusInputsForClients(
  clientIds: string[]
): Promise<{ statusesByClient: Map<string, string[]>; demoClientIds: Set<string> }> {
  if (clientIds.length === 0) return { statusesByClient: new Map(), demoClientIds: new Set() };

  const [{ data: allSubs, error: allSubsError }, { data: demoBookings, error: demoError }] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("client_id, status").in("client_id", clientIds),
    supabaseAdmin
      .from("bookings")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("session_type", "assessment")
      .in("status", ["upcoming", "completed", "missed"]),
  ]);
  if (allSubsError) throw allSubsError;
  if (demoError) throw demoError;

  const statusesByClient = new Map<string, string[]>();
  for (const s of (allSubs ?? []) as any[]) {
    const list = statusesByClient.get(s.client_id) ?? [];
    list.push(s.status);
    statusesByClient.set(s.client_id, list);
  }
  const demoClientIds = new Set((demoBookings ?? []).map((b: any) => b.client_id));

  return { statusesByClient, demoClientIds };
}

/** Admin roster view — merges each client's active subscription (package
 * name + session counts), active recurring coach + schedule, and whether
 * they've EVER had a subscription (any status, not just active -- lets the
 * admin list derive an "Expired" bucket: had a plan before, none active
 * now, distinct from a lead who never purchased at all), same "fetch once,
 * merge in JS" pattern as listMyClients(), since none of these have a
 * PostgREST-embeddable FK relationship to client_profiles. */
export async function listClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone, id)");
  if (error) throw error;

  const clientIds = (data ?? []).map((c) => c.id);
  if (clientIds.length === 0) return [];

  const [
    { data: subs, error: subsError },
    { data: slots, error: slotsError },
    { statusesByClient, demoClientIds },
    lastMeasurementByClient,
  ] = await Promise.all([
    ctx.client
      .from("subscriptions")
      .select("id, client_id, sessions_total, package:package_tiers(name)")
      .in("client_id", clientIds)
      .eq("status", "active"),
    ctx.client
      .from("recurring_slots")
      .select("client_id, coach_id, day_of_week, start_time, coach:coach_profiles(id, profile:profiles(full_name))")
      .in("client_id", clientIds)
      .eq("status", "active"),
    getStatusInputsForClients(clientIds),
    getLatestMeasurementDatesForClients(accessToken, clientIds),
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

  const scheduleByClient = new Map<string, { days: number[]; startTime: string | null }>();
  for (const s of slots ?? []) {
    const existing = scheduleByClient.get(s.client_id) ?? { days: [], startTime: null };
    existing.days.push(s.day_of_week);
    existing.startTime = existing.startTime ?? s.start_time;
    scheduleByClient.set(s.client_id, existing);
  }

  return (data ?? []).map((c) => {
    const statuses = statusesByClient.get(c.id) ?? [];
    return {
      ...c,
      activeSubscription: subById.get(c.id) ?? null,
      activeCoach: coachById.get(c.id) ?? null,
      schedule: scheduleByClient.get(c.id) ?? { days: [], startTime: null },
      hasEverSubscribed: statuses.length > 0,
      clientStatus: deriveClientStatus(statuses, demoClientIds.has(c.id)),
      lastMeasurementAt: lastMeasurementByClient.get(c.id) ?? null,
    };
  });
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
 * is needed here. Also merges each client's recurring-slot schedule (one row
 * per day_of_week under this coach, same "fetch once, merge in JS" pattern
 * as the subscription merge below) — backs the Coach Portal PRD's "My
 * Clients" columns (Assigned Day(s), Assigned Time Slot). */
export async function listMyClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client.from("client_profiles").select("*, profile:profiles(full_name, photo_url, phone)");
  if (error) throw error;

  const clientIds = (data ?? []).map((c) => c.id);
  if (clientIds.length === 0) return [];
  const [{ data: subs, error: subsError }, { data: slots, error: slotsError }, { statusesByClient, demoClientIds }, lastMeasurementByClient] =
    await Promise.all([
      ctx.client
        .from("subscriptions")
        .select("client_id, status, package:package_tiers(name)")
        .in("client_id", clientIds)
        .eq("status", "active"),
      ctx.client
        .from("recurring_slots")
        .select("client_id, day_of_week, start_time")
        .in("client_id", clientIds)
        .eq("status", "active"),
      getStatusInputsForClients(clientIds),
      getLatestMeasurementDatesForClients(accessToken, clientIds),
    ]);
  if (subsError) throw subsError;
  if (slotsError) throw slotsError;
  const subByClient = new Map((subs ?? []).map((s) => [s.client_id, s]));

  const scheduleByClient = new Map<string, { days: number[]; startTime: string | null }>();
  for (const s of slots ?? []) {
    const existing = scheduleByClient.get(s.client_id) ?? { days: [], startTime: null };
    existing.days.push(s.day_of_week);
    existing.startTime = existing.startTime ?? s.start_time;
    scheduleByClient.set(s.client_id, existing);
  }

  return (data ?? []).map((c) => {
    const statuses = statusesByClient.get(c.id) ?? [];
    return {
      ...c,
      activeSubscription: subByClient.get(c.id) ?? null,
      schedule: scheduleByClient.get(c.id) ?? { days: [], startTime: null },
      clientStatus: deriveClientStatus(statuses, demoClientIds.has(c.id)),
      lastMeasurementAt: lastMeasurementByClient.get(c.id) ?? null,
    };
  });
}

/** Coach Global Search (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.5): every
 * client platform-wide, not just this coach's own -- permitted by the
 * widened client_profiles/profiles RLS (migration 0033). Client-side
 * substring filtering on the result matches every other list/search screen
 * in this codebase (AdminClientsListClient, CoachClientsClient, etc.), none
 * of which do a server-side ilike query, so this follows the same
 * convention rather than introducing a new one. Each row is flagged against
 * this coach's own assigned-client set so the UI can distinguish "read-only"
 * from "read + can add notes" per §1.5's Case A/B split. */
export async function searchAllClients(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const [{ data: allClients, error: allError }, myClients] = await Promise.all([
    ctx.client.from("client_profiles").select("id, client_code, status, profile:profiles(full_name, photo_url)"),
    listMyClients(accessToken),
  ]);
  if (allError) throw allError;

  const { statusesByClient, demoClientIds } = await getStatusInputsForClients((allClients ?? []).map((c: any) => c.id));
  const myClientIds = new Set((myClients as any[]).map((c) => c.id));
  return (allClients ?? []).map((c: any) => ({
    ...c,
    clientStatus: deriveClientStatus(statusesByClient.get(c.id) ?? [], demoClientIds.has(c.id)),
    isAssignedToMe: myClientIds.has(c.id),
  }));
}

/** Direct client_profiles lookup for Global Search result detail (§1.5) --
 * the widened RLS (migration 0033) permits any coach to read any client's
 * identity; write access (notes, etc.) stays assignment-scoped everywhere
 * else and is untouched by this. Returns null rather than throwing if the
 * id doesn't exist or genuinely isn't visible, so the caller can surface one
 * clean "not found" error instead of a raw RLS-shaped failure. */
export async function getClientProfileById(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach", "admin"]);
  const { data, error } = await ctx.client
    .from("client_profiles")
    .select("*, profile:profiles(full_name, photo_url)")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Does the new coach's weekly availability template cover every day/time in
 * the client's active recurring pattern? Checked here (not left to the DB)
 * because reassignClientCoach used to blindly repoint recurring_slots.coach_id
 * with no check at all -- an admin could transfer a client with a Mon/Wed/Fri
 * pattern to a coach who's only ever set herself available on Mondays, and
 * the system would silently keep generating Wednesday/Friday bookings that
 * coach never agreed to. Mirrors the day/time-window check already used by
 * scheduling.service.ts's isDayTimeFreeForCoach, minus the collision check
 * (a same-coach double-booking here is caught separately by
 * has_scheduling_conflict when the next occurrence is generated). */
async function findUncoveredDays(
  ctx: Awaited<ReturnType<typeof getCallerContext>>,
  toCoachId: string,
  slots: { day_of_week: number; start_time: string; duration_minutes: number }[]
): Promise<string[]> {
  if (slots.length === 0) return [];
  const { data: availability, error } = await ctx.client
    .from("coach_availability")
    .select("day_of_week, start_time, end_time")
    .eq("coach_id", toCoachId)
    .eq("is_active", true);
  if (error) throw error;

  const byDay = new Map<number, { start_time: string; end_time: string }[]>();
  for (const a of availability ?? []) {
    const list = byDay.get(a.day_of_week) ?? [];
    list.push(a);
    byDay.set(a.day_of_week, list);
  }

  const uncoveredDays: string[] = [];
  for (const slot of slots) {
    const [sh, sm] = slot.start_time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + slot.duration_minutes;
    const windows = byDay.get(slot.day_of_week) ?? [];
    const covered = windows.some((w) => {
      const [wsH, wsM] = w.start_time.split(":").map(Number);
      const [weH, weM] = w.end_time.split(":").map(Number);
      return startMin >= wsH * 60 + wsM && endMin <= weH * 60 + weM;
    });
    if (!covered) uncoveredDays.push(DAY_NAMES[slot.day_of_week]);
  }
  return uncoveredDays;
}

export async function reassignClientCoach(
  accessToken: string,
  clientId: string,
  fromCoachId: string,
  toCoachId: string,
  options?: { force?: boolean }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "client"]);

  if (ctx.role === "client") {
    const { data: own, error: ownError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
    if (ownError || !own || own.id !== clientId) throw new Error("Not your record");
  }

  const { data: activeSlots, error: activeSlotsError } = await ctx.client
    .from("recurring_slots")
    .select("day_of_week, start_time, duration_minutes")
    .eq("client_id", clientId)
    .eq("coach_id", fromCoachId)
    .eq("status", "active");
  if (activeSlotsError) throw activeSlotsError;

  const uncoveredDays = await findUncoveredDays(ctx, toCoachId, activeSlots ?? []);
  if (uncoveredDays.length > 0 && !options?.force) {
    throw new Error(
      `The new coach hasn't set availability for ${uncoveredDays.join(", ")} — the client's existing sessions on ${uncoveredDays.length > 1 ? "those days" : "that day"} would be left uncovered. Update the coach's availability first, or confirm the transfer anyway if you'll fix the schedule separately.`
    );
  }

  const [{ error: slotsError }, { error: bookingsError }] = await Promise.all([
    ctx.client
      .from("recurring_slots")
      .update({ coach_id: toCoachId })
      .eq("client_id", clientId)
      .eq("coach_id", fromCoachId)
      .eq("status", "active"),
    ctx.client
      .from("bookings")
      .update({ coach_id: toCoachId })
      .eq("client_id", clientId)
      .eq("coach_id", fromCoachId)
      .eq("status", "upcoming"),
  ]);
  if (slotsError) throw slotsError;
  if (bookingsError) throw bookingsError;

  // Two separate contexts -- one per coach -- since notifyCoach() addresses
  // a single coach at a time and the old/new coach need different template
  // keys anyway (losing vs. gaining the client).
  const [, , newCoachCtx, oldCoachCtx] = await Promise.all([
    logTimelineEvent(clientId, "coach_changed", "Coach changed", { actorId: ctx.userId, metadata: { fromCoachId, toCoachId } }),
    ensureConversationForCoachAssignment(clientId, toCoachId),
    resolveSessionNotifyContext(clientId, toCoachId),
    resolveSessionNotifyContext(clientId, fromCoachId),
  ]);
  const clientName = newCoachCtx.clientName;

  await Promise.all([
    notifyClient(newCoachCtx, "coach_changed_client", { coach_name: newCoachCtx.coachName ?? "your new coach" }),
    notifyCoach(oldCoachCtx, "client_transferred", { client_name: clientName }),
    notifyCoach(newCoachCtx, "new_client_assigned", { client_name: clientName }),
  ]);
}

/** Admin/coach-facing equivalent of getMyCurrentCoachId, parameterized by
 * clientId instead of the caller's own profile. Same prefer-active-slot,
 * fall-back-to-latest-booking resolution. */
export async function getClientCurrentCoachId(accessToken: string, clientId: string): Promise<string | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);

  const [{ data: activeSlot }, { data: latestBooking }] = await Promise.all([
    ctx.client.from("recurring_slots").select("coach_id").eq("client_id", clientId).eq("status", "active").limit(1).maybeSingle(),
    ctx.client
      .from("bookings")
      .select("coach_id")
      .eq("client_id", clientId)
      .order("scheduled_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return activeSlot?.coach_id ?? latestBooking?.coach_id ?? null;
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

  const [{ data: activeSlot }, { data: latestBooking }] = await Promise.all([
    ctx.client.from("recurring_slots").select("coach_id").eq("client_id", client.id).eq("status", "active").limit(1).maybeSingle(),
    ctx.client
      .from("bookings")
      .select("coach_id")
      .eq("client_id", client.id)
      .order("scheduled_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return activeSlot?.coach_id ?? latestBooking?.coach_id ?? null;
}

/** Coach from an ACTIVE recurring slot only -- unlike getMyCurrentCoachId(),
 * deliberately does NOT fall back to "coach of the most recent booking of
 * any kind", since that fallback conflates a genuine ongoing relationship
 * with a one-off demo/assessment booking. Used wherever "does this client
 * have a real assigned coach" must exclude demo-only clients (see
 * getMyCoachAction's isDemoCoach branch in client-coach.actions.ts). */
export async function getMyRecurringCoachId(accessToken: string): Promise<string | null> {
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
  return activeSlot?.coach_id ?? null;
}

export interface CreateMigratedClientInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  packageId: string;
  /** How many sessions to actually grant in THIS system -- not the
   * client's original plan size. A client migrated mid-plan (e.g.
   * "enrolled in a 24-session package, 2 left") gets sessions_total set to
   * the remaining count (2), never the original size (24): this system has
   * no booking history for the sessions already used elsewhere, and
   * sessions_remaining is always derived as sessions_total minus completed
   * bookings IN this system (subscription_usage_view) -- setting the
   * original size would silently hand them 22 sessions they'd already
   * used. The original size, if given, is preserved only as a note on the
   * timeline event below, for context, never as a number this system
   * counts down from. */
  sessionsRemaining: number;
  /** The client's original plan size before migration, for the timeline
   * note only (see sessionsRemaining) -- purely descriptive. */
  originalPlanSessions?: number;
  pauseDaysAllowed?: number;
  /** Optional immediate weekly schedule assignment -- already validated
   * free via scheduling.service.ts::checkAdminSlotAssignment by the caller
   * before this runs; this function does not re-check, it trusts the
   * admin action layer already confirmed availability. */
  schedule?: { coachId: string; days: number[]; timeOfDay: string; durationMinutes?: number };
}

/** Admin-only bulk-migration entry point: creates a full, ready-to-log-in
 * client account (auth user + profile + client_profiles, all via the same
 * handle_new_user() trigger every other signup path goes through, since
 * 'client' is its default role -- no manual profile-row cleanup needed here,
 * unlike coaches.service.ts::createCoach, which has to undo the trigger's
 * client-shaped default), an active subscription pre-loaded with exactly
 * the sessions the client has left (see CreateMigratedClientInput's doc
 * comment), and optionally an immediate coach + weekly recurring schedule.
 * Built for shifting an existing client roster (e.g. tracked in a
 * spreadsheet) into the platform without losing their place mid-plan. */
export async function createMigratedClient(
  accessToken: string,
  input: CreateMigratedClientInput
): Promise<{ clientId: string; clientCode: string }> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  if (input.sessionsRemaining < 1) throw new Error("Sessions remaining must be at least 1");

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("package_tiers")
    .select("name, default_pause_days")
    .eq("id", input.packageId)
    .single();
  if (pkgError || !pkg) throw pkgError ?? new Error("Package not found");

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, phone: input.phone ?? null },
    app_metadata: { role: "client" },
  });
  if (createError || !created.user) throw createError ?? new Error("Failed to create client account");

  const { data: clientRow, error: clientRowError } = await supabaseAdmin
    .from("client_profiles")
    .select("id, client_code")
    .eq("profile_id", created.user.id)
    .single();
  if (clientRowError || !clientRow) throw clientRowError ?? new Error("Client profile wasn't created");

  const before = await getClientStatusSnapshot(clientRow.id);

  const { data: sub, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      client_id: clientRow.id,
      package_id: input.packageId,
      sessions_total: input.sessionsRemaining,
      pause_days_allowed: input.pauseDaysAllowed ?? pkg.default_pause_days ?? 0,
      status: "active",
    })
    .select("id")
    .single();
  if (subError || !sub) throw subError ?? new Error("Failed to create subscription");

  const migrationDescription = input.originalPlanSessions
    ? `Migrated from the previous system -- originally ${input.originalPlanSessions} sessions, ${input.sessionsRemaining} remaining at migration.`
    : `Migrated from the previous system with ${input.sessionsRemaining} sessions remaining.`;
  await logTimelineEvent(clientRow.id, "plan_purchased", `Migrated onto ${pkg.name}`, {
    description: migrationDescription,
    actorId: ctx.userId,
    metadata: { subscriptionId: sub.id, packageId: input.packageId, sessionsRemaining: input.sessionsRemaining },
  });

  if (input.schedule) {
    await createRecurringSlotsForClient(accessToken, clientRow.id, { ...input.schedule, subscriptionId: sub.id });
  }

  await logClientStatusChange(clientRow.id, before, ctx.userId);

  return { clientId: clientRow.id, clientCode: clientRow.client_code };
}
