import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

/** Only whole-hour slots exist platform-wide (5am, 6am, ... up to the last
 * hour before close) — no half-hour or odd-aligned start times. Bounds are
 * admin-configurable via system_settings (booking_window_start_hour/end_hour)
 * rather than hardcoded, per the existing business-rules convention. */
export async function getBookingWindow(accessToken: string): Promise<{ startHour: number; endHour: number }> {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("system_settings")
    .select("key, value")
    .in("key", ["booking_window_start_hour", "booking_window_end_hour"]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key, r.value as number]));
  return {
    startHour: map.get("booking_window_start_hour") ?? 5,
    endHour: map.get("booking_window_end_hour") ?? 22,
  };
}

export function hourlyGrid(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) slots.push(`${String(h).padStart(2, "0")}:00`);
  return slots;
}

/** Free windows for a coach between two dates, restricted to the hourly grid,
 * accounting for their availability template, leave, and existing bookings/
 * held temporary bookings. Read-only — the actual conflict-safe reservation
 * happens in holdSlot/confirmHold via the DB functions in migration 0011,
 * which re-check everything server-side (this is advisory for the UI). */
export async function getOpenSlots(
  accessToken: string,
  coachId: string,
  fromDate: string, // YYYY-MM-DD
  toDate: string, // YYYY-MM-DD
  durationMinutes: number
): Promise<OpenSlot[]> {
  const ctx = await getCallerContext(accessToken);
  const { startHour, endHour } = await getBookingWindow(accessToken);
  const grid = hourlyGrid(startHour, endHour);

  const [{ data: availability, error: availError }, { data: leave, error: leaveError }, { data: booked, error: bookedError }] =
    await Promise.all([
      ctx.client.from("coach_availability").select("day_of_week, start_time, end_time").eq("coach_id", coachId).eq("is_active", true),
      ctx.client.from("coach_leave").select("starts_on, ends_on").eq("coach_id", coachId).eq("status", "approved"),
      ctx.client
        .from("bookings")
        .select("scheduled_start, duration_minutes")
        .eq("coach_id", coachId)
        .eq("status", "upcoming")
        .gte("scheduled_start", `${fromDate}T00:00:00Z`)
        .lte("scheduled_start", `${toDate}T23:59:59Z`),
    ]);
  if (availError) throw availError;
  if (leaveError) throw leaveError;
  if (bookedError) throw bookedError;

  const byDayOfWeek = new Map<number, { start_time: string; end_time: string }[]>();
  for (const a of availability ?? []) {
    const list = byDayOfWeek.get(a.day_of_week) ?? [];
    list.push(a);
    byDayOfWeek.set(a.day_of_week, list);
  }
  const leaveDates = (leave ?? []).map((l) => ({ starts: new Date(l.starts_on), ends: new Date(l.ends_on) }));
  const busy = (booked ?? []).map((b) => {
    const start = new Date(b.scheduled_start);
    return { start, end: new Date(start.getTime() + b.duration_minutes * 60_000) };
  });

  const fitsWithinWindow = (h: number, m: number, windows: { start_time: string; end_time: string }[]) =>
    windows.some((w) => {
      const [wsH, wsM] = w.start_time.split(":").map(Number);
      const [weH, weM] = w.end_time.split(":").map(Number);
      return h * 60 + m >= wsH * 60 + wsM && h * 60 + m + durationMinutes <= weH * 60 + weM;
    });

  const slots: OpenSlot[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    const onLeave = leaveDates.some((l) => cursor >= l.starts && cursor <= l.ends);
    const windows = byDayOfWeek.get(dow) ?? [];
    if (!onLeave && windows.length > 0) {
      for (const slotTime of grid) {
        const [h, m] = slotTime.split(":").map(Number);
        if (!fitsWithinWindow(h, m, windows)) continue;
        const slotStart = new Date(cursor);
        slotStart.setUTCHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        const overlapsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
        if (!overlapsBusy) slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

/** The signed-in client's own active recurring slots, if any — used to avoid
 * offering the pattern-setup screen a second time once one exists. */
export async function getMyActiveRecurringSlots(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client
    .from("recurring_slots")
    .select("id, day_of_week, start_time, duration_minutes")
    .eq("client_id", client.id)
    .eq("status", "active")
    .order("day_of_week");
  if (error) throw error;
  return data;
}

export async function holdSlot(accessToken: string, input: { clientId: string; coachId: string; slotStart: string; durationMinutes: number }) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.rpc("create_temporary_booking", {
    p_client_id: input.clientId,
    p_coach_id: input.coachId,
    p_slot_start: input.slotStart,
    p_duration_minutes: input.durationMinutes,
  });
  if (error) throw error;
  return data as string; // temporary_booking id
}

export async function confirmHold(
  accessToken: string,
  input: {
    tempBookingId: string;
    subscriptionId?: string;
    recurringSlotId?: string;
    assessmentSessionId?: string;
    sessionType?: "regular" | "assessment";
  }
) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.rpc("confirm_booking", {
    p_temp_booking_id: input.tempBookingId,
    p_subscription_id: input.subscriptionId ?? null,
    p_recurring_slot_id: input.recurringSlotId ?? null,
    p_assessment_session_id: input.assessmentSessionId ?? null,
    p_session_type: input.sessionType ?? "regular",
  });
  if (error) throw error;
  return data as string; // booking id
}

// ── Recurring pattern matching (Screen 1: "Set Your Recurring Schedule") ──

export const DAY_GROUPS = {
  mwf: [1, 3, 5], // Mon, Wed, Fri
  tts: [2, 4, 6], // Tue, Thu, Sat
  sixday: [1, 2, 3, 4, 5, 6], // Mon–Sat, Sunday always off
} as const;

// Same-trio pairs only — not all 21 possible day combinations.
const PAIRS_MWF = [
  [1, 3],
  [1, 5],
  [3, 5],
];
const PAIRS_TTS = [
  [2, 4],
  [2, 6],
  [4, 6],
];

export type PatternKey = "mwf" | "tts" | "sixday" | "custom";

export interface PatternMatchResult {
  days: number[];
  timeOfDay: string; // "06:00"
  patternUsed: PatternKey | "pair";
  exact: boolean; // false if we had to offer a different time/pairing than requested
}

/** Is this coach free for a NEW recurring reservation on this day/time?
 * Checks the weekly availability template AND collides against other
 * clients' existing active recurring_slots — has_scheduling_conflict() only
 * checks real bookings/holds, not other not-yet-generated recurring
 * reservations, so without this check two clients could both "reserve" the
 * same coach/day/time and only find out later when generation silently
 * skips one of them. Leave is deliberately NOT checked here — leave is
 * temporary and already handled per-occurrence by
 * generate_bookings_from_recurring_slot; it shouldn't block a permanent
 * pattern from being set up.
 *
 * Deliberately uses supabaseAdmin, not the caller's RLS-scoped client:
 * recurring_slots RLS only lets a client see their OWN rows
 * (recurring_slots_select_own), so a different client's collision check
 * would silently see zero rows and report "free" even when it isn't. This
 * mirrors has_scheduling_conflict()'s own security-definer rationale — it's
 * a system-wide true/false fitness question, not a caller-scoped read, and
 * it leaks no row data back to the caller, only a boolean. */
async function isDayTimeFreeForCoach(coachId: string, dayOfWeek: number, timeOfDay: string, durationMinutes: number): Promise<boolean> {
  const [h, m] = timeOfDay.split(":").map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + durationMinutes;

  const { data: windows, error: availError } = await supabaseAdmin
    .from("coach_availability")
    .select("start_time, end_time")
    .eq("coach_id", coachId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);
  if (availError) throw availError;
  const withinTemplate = (windows ?? []).some((w) => {
    const [wsH, wsM] = w.start_time.split(":").map(Number);
    const [weH, weM] = w.end_time.split(":").map(Number);
    return startMin >= wsH * 60 + wsM && endMin <= weH * 60 + weM;
  });
  if (!withinTemplate) return false;

  const { data: collisions, error: collisionError } = await supabaseAdmin
    .from("recurring_slots")
    .select("id")
    .eq("coach_id", coachId)
    .eq("day_of_week", dayOfWeek)
    .eq("start_time", `${timeOfDay}:00`)
    .eq("status", "active")
    .limit(1);
  if (collisionError) throw collisionError;
  return (collisions ?? []).length === 0;
}

async function patternFreeAt(coachId: string, days: number[], timeOfDay: string, durationMinutes: number): Promise<boolean> {
  for (const day of days) {
    if (!(await isDayTimeFreeForCoach(coachId, day, timeOfDay, durationMinutes))) return false;
  }
  return true;
}

export interface CoachMatchResult {
  coachId: string;
  days: number[];
  timeOfDay: string;
}

/** First-time coach assignment: a client with no coach yet picks a day/time
 * pattern, and this searches every active coach for one who is genuinely
 * free for the WHOLE pattern (reusing the same collision-safe check used
 * for an already-assigned client's own schedule setup). No pattern/pair
 * fallback here — the client asked for an exact day/time, so this either
 * finds a real match or reports none, per the agreed scope (matching is on
 * day/time availability only; skill/language stay descriptive persona
 * fields for now, not filter criteria). Ties are broken by lowest
 * utilization, so load spreads across the coach pool rather than always
 * landing on the first one found. */
export async function findAvailableCoach(
  accessToken: string,
  input: { pattern: PatternKey; preferredTime: string; customDays?: number[]; durationMinutes?: number; excludeCoachId?: string }
): Promise<CoachMatchResult | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const durationMinutes = input.durationMinutes ?? 60;

  let days: number[];
  if (input.pattern === "custom") {
    if (!input.customDays || input.customDays.length < 2 || input.customDays.length > 5) {
      throw new Error("Custom schedule needs between 2 and 5 days");
    }
    days = input.customDays;
  } else {
    days = [...DAY_GROUPS[input.pattern]];
  }

  let coachQuery = ctx.client.from("coach_profiles").select("id").eq("status", "active");
  if (input.excludeCoachId) coachQuery = coachQuery.neq("id", input.excludeCoachId);
  const { data: coaches, error: coachesError } = await coachQuery;
  if (coachesError) throw coachesError;
  if (!coaches || coaches.length === 0) return null;

  const { data: util, error: utilError } = await ctx.client
    .from("coach_utilization_view")
    .select("coach_id, utilization_pct")
    .in(
      "coach_id",
      coaches.map((c) => c.id)
    );
  if (utilError) throw utilError;
  const utilByCoach = new Map((util ?? []).map((u) => [u.coach_id, u.utilization_pct]));

  const sorted = [...coaches].sort((a, b) => (utilByCoach.get(a.id) ?? 0) - (utilByCoach.get(b.id) ?? 0));

  for (const coach of sorted) {
    if (await patternFreeAt(coach.id, days, input.preferredTime, durationMinutes)) {
      return { coachId: coach.id, days, timeOfDay: input.preferredTime };
    }
  }
  return null;
}

/** Walks: requested pattern @ requested time -> requested pattern @ any grid
 * time -> same-trio pairs (both trios if pattern was "sixday") @ requested
 * time -> same-trio pairs @ any grid time. Returns null if nothing fits —
 * the caller should then either let the client try "custom" days, or (if
 * custom was already what was tried) notify admin. */
export async function matchRecurringPattern(
  accessToken: string,
  input: {
    coachId: string;
    pattern: PatternKey;
    preferredTime: string;
    customDays?: number[];
    durationMinutes?: number;
  }
): Promise<PatternMatchResult | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const durationMinutes = input.durationMinutes ?? 60;
  const { startHour, endHour } = await getBookingWindow(accessToken);
  const grid = hourlyGrid(startHour, endHour);

  if (input.pattern === "custom") {
    if (!input.customDays || input.customDays.length < 2 || input.customDays.length > 5) {
      throw new Error("Custom schedule needs between 2 and 5 days");
    }
    if (await patternFreeAt(input.coachId, input.customDays, input.preferredTime, durationMinutes)) {
      return { days: input.customDays, timeOfDay: input.preferredTime, patternUsed: "custom", exact: true };
    }
    for (const t of grid) {
      if (t === input.preferredTime) continue;
      if (await patternFreeAt(input.coachId, input.customDays, t, durationMinutes)) {
        return { days: input.customDays, timeOfDay: t, patternUsed: "custom", exact: false };
      }
    }
    return null;
  }

  const days = [...DAY_GROUPS[input.pattern]];

  if (await patternFreeAt(input.coachId, days, input.preferredTime, durationMinutes)) {
    return { days, timeOfDay: input.preferredTime, patternUsed: input.pattern, exact: true };
  }
  for (const t of grid) {
    if (t === input.preferredTime) continue;
    if (await patternFreeAt(input.coachId, days, t, durationMinutes)) {
      return { days, timeOfDay: t, patternUsed: input.pattern, exact: false };
    }
  }

  const pairsToTry = input.pattern === "tts" ? PAIRS_TTS : input.pattern === "mwf" ? PAIRS_MWF : [...PAIRS_MWF, ...PAIRS_TTS];
  for (const pair of pairsToTry) {
    if (await patternFreeAt(input.coachId, pair, input.preferredTime, durationMinutes)) {
      return { days: pair, timeOfDay: input.preferredTime, patternUsed: "pair", exact: false };
    }
  }
  for (const pair of pairsToTry) {
    for (const t of grid) {
      if (t === input.preferredTime) continue;
      if (await patternFreeAt(input.coachId, pair, t, durationMinutes)) {
        return { days: pair, timeOfDay: t, patternUsed: "pair", exact: false };
      }
    }
  }

  return null;
}

export interface ShadowCoachCandidate {
  coachId: string;
  name: string;
  specialization: string | null;
  utilizationPct: number;
}

/** Finds coaches who can stand in for a client's PRIMARY coach across every
 * occurrence of the client's existing recurring pattern within [startsOn,
 * endsOn]. Unlike findAvailableCoach() (which searches a fresh pattern and
 * deliberately skips leave, per its own doc comment), this checks an
 * EXISTING pattern and must exclude leave — the whole point is standing in
 * while the primary coach is unavailable. Reuses the same DB functions the
 * real booking flow depends on (is_slot_within_working_hours already checks
 * coach_leave + coach_shifts + coach_availability in one call;
 * has_scheduling_conflict checks real bookings/holds) rather than
 * re-implementing that logic here. Ranked by utilization ascending, same
 * tie-break as findAvailableCoach. */
export async function findShadowCoachCandidates(
  accessToken: string,
  input: { clientId: string; primaryCoachId: string; startsOn: string; endsOn: string }
): Promise<ShadowCoachCandidate[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: slots, error: slotsError } = await ctx.client
    .from("recurring_slots")
    .select("day_of_week, start_time, duration_minutes")
    .eq("client_id", input.clientId)
    .eq("coach_id", input.primaryCoachId)
    .eq("status", "active");
  if (slotsError) throw slotsError;
  if (!slots || slots.length === 0) return [];

  const start = new Date(`${input.startsOn}T00:00:00Z`);
  const end = new Date(`${input.endsOn}T00:00:00Z`);
  if (end < start) throw new Error("End date must be on or after start date");

  const occurrences: { slotStart: string; durationMinutes: number }[] = [];
  for (const slot of slots) {
    const [h, m] = slot.start_time.split(":").map(Number);
    const cursor = new Date(start);
    while (cursor <= end) {
      if (cursor.getUTCDay() === slot.day_of_week) {
        const slotStart = new Date(cursor);
        slotStart.setUTCHours(h, m, 0, 0);
        occurrences.push({ slotStart: slotStart.toISOString(), durationMinutes: slot.duration_minutes });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  if (occurrences.length === 0) return [];

  const { data: coaches, error: coachesError } = await ctx.client
    .from("coach_profiles")
    .select("id, specialization, profile:profiles(full_name)")
    .eq("status", "active")
    .neq("id", input.primaryCoachId);
  if (coachesError) throw coachesError;
  if (!coaches || coaches.length === 0) return [];

  const { data: util, error: utilError } = await ctx.client
    .from("coach_utilization_view")
    .select("coach_id, utilization_pct")
    .in(
      "coach_id",
      coaches.map((c: any) => c.id)
    );
  if (utilError) throw utilError;
  const utilByCoach = new Map((util ?? []).map((u) => [u.coach_id, u.utilization_pct]));

  const candidates: ShadowCoachCandidate[] = [];
  for (const coach of coaches as any[]) {
    let free = true;
    for (const occ of occurrences) {
      const [{ data: withinHours, error: hoursError }, { data: hasConflict, error: conflictError }] = await Promise.all([
        ctx.client.rpc("is_slot_within_working_hours", {
          p_coach_id: coach.id,
          p_slot_start: occ.slotStart,
          p_duration_minutes: occ.durationMinutes,
        }),
        ctx.client.rpc("has_scheduling_conflict", {
          p_coach_id: coach.id,
          p_slot_start: occ.slotStart,
          p_duration_minutes: occ.durationMinutes,
        }),
      ]);
      if (hoursError) throw hoursError;
      if (conflictError) throw conflictError;
      if (!withinHours || hasConflict) {
        free = false;
        break;
      }
    }
    if (free) {
      candidates.push({
        coachId: coach.id,
        name: coach.profile?.full_name ?? "Coach",
        specialization: coach.specialization ?? null,
        utilizationPct: utilByCoach.get(coach.id) ?? 0,
      });
    }
  }

  return candidates.sort((a, b) => a.utilizationPct - b.utilizationPct);
}

/** Client-initiated "change my schedule, same coach" -- unlike
 * createRecurringSlots() (which only ADDS slots, used for first-time setup),
 * this replaces the client's current active pattern: deactivates the old
 * recurring_slots rows, cancels their still-upcoming generated bookings
 * (freeing the coach's calendar), then matches + creates the new pattern
 * with the same coach. No reschedule-cutoff applies here since this is the
 * client's own choice, not an admin/coach action on an existing booking. */
export async function changeMyRecurringSchedule(
  accessToken: string,
  input: { pattern: PatternKey; preferredTime: string; customDays?: number[]; durationMinutes?: number }
): Promise<PatternMatchResult | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: activeSlots, error: slotsError } = await ctx.client
    .from("recurring_slots")
    .select("id, coach_id")
    .eq("client_id", client.id)
    .eq("status", "active");
  if (slotsError) throw slotsError;
  if (!activeSlots || activeSlots.length === 0) throw new Error("No active recurring schedule to change -- set one up first.");
  const coachId = activeSlots[0].coach_id;

  const match = await matchRecurringPattern(accessToken, { coachId, pattern: input.pattern, preferredTime: input.preferredTime, customDays: input.customDays, durationMinutes: input.durationMinutes });
  if (!match) return null;

  const slotIds = activeSlots.map((s) => s.id);
  const { error: deactivateError } = await ctx.client.from("recurring_slots").update({ status: "cancelled" }).in("id", slotIds);
  if (deactivateError) throw deactivateError;

  const { error: cancelBookingsError } = await ctx.client
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: "Client changed their recurring schedule" })
    .in("recurring_slot_id", slotIds)
    .eq("status", "upcoming");
  if (cancelBookingsError) throw cancelBookingsError;

  await createRecurringSlots(accessToken, { coachId, days: match.days, timeOfDay: match.timeOfDay, durationMinutes: input.durationMinutes });

  await logTimelineEvent(client.id, "session_rescheduled", "Recurring schedule changed", {
    description: `${match.days.join(",")} at ${match.timeOfDay}`,
    actorId: ctx.userId,
  });

  return match;
}

/** Creates one recurring_slots row per day in the matched pattern, and
 * generates the first few upcoming occurrences of each via the existing
 * (previously orphaned) generate_bookings_from_recurring_slot DB function. */
export async function createRecurringSlots(
  accessToken: string,
  input: { coachId: string; days: number[]; timeOfDay: string; durationMinutes?: number; subscriptionId?: string }
): Promise<string[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data: priorSlot } = await ctx.client.from("recurring_slots").select("id").eq("client_id", client.id).eq("status", "active").limit(1).maybeSingle();
  const isFirstCoach = !priorSlot;

  const durationMinutes = input.durationMinutes ?? 60;
  const createdIds: string[] = [];
  for (const day of input.days) {
    const { data: slot, error: slotError } = await ctx.client
      .from("recurring_slots")
      .insert({
        client_id: client.id,
        coach_id: input.coachId,
        subscription_id: input.subscriptionId ?? null,
        day_of_week: day,
        start_time: `${input.timeOfDay}:00`,
        duration_minutes: durationMinutes,
        status: "active",
      })
      .select("id")
      .single();
    if (slotError || !slot) throw slotError ?? new Error("Failed to create recurring slot");
    createdIds.push(slot.id);

    const { error: genError } = await ctx.client.rpc("generate_bookings_from_recurring_slot", {
      p_recurring_slot_id: slot.id,
      p_count: 4,
    });
    if (genError) throw genError;
  }

  if (isFirstCoach) {
    await logTimelineEvent(client.id, "coach_assigned", "Coach assigned", { actorId: ctx.userId, metadata: { coachId: input.coachId } });
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  await logTimelineEvent(client.id, "slot_assigned", "Recurring schedule set", {
    description: `${input.days.map((d) => dayNames[d]).join("/")} at ${input.timeOfDay}`,
    actorId: ctx.userId,
    metadata: { coachId: input.coachId, days: input.days, timeOfDay: input.timeOfDay },
  });

  return createdIds;
}
