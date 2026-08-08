import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";
import { DAY_GROUPS, PAIRS_MWF, PAIRS_TTS } from "@/lib/constants/scheduling";

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

/** Business hours (coach_availability, package rules, the schedule-setup UI)
 * are all defined as India wall-clock time. Every instant we hand to the DB
 * (bookings.scheduled_start, temporary_bookings.slot_start) must be the
 * correct UTC instant for that IST wall-clock time -- NOT the UTC clock
 * reading of the same digits. Use this instead of `Date#setUTCHours` whenever
 * turning a "YYYY-MM-DD" + "HH:MM" business-local pair into an instant. */
export function istWallClockToInstant(dateStr: string, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
}

/** Inverse of istWallClockToInstant's time-of-day: minutes since IST
 * midnight for a given UTC instant. IST has no DST, so a fixed +5:30 shift
 * of the UTC reading is exact. */
export function istTimeOfDayMinutes(iso: string): number {
  const istMs = new Date(iso).getTime() + 5.5 * 60 * 60 * 1000;
  const d = new Date(istMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Inverse of istWallClockToInstant's date: the IST calendar date
 * ("YYYY-MM-DD") for a given UTC instant -- NOT the same as slicing the raw
 * ISO string, which reads the UTC calendar date and can be a day off near
 * midnight IST (00:30 IST is 19:00 UTC the previous day). */
export function istDateString(iso: string): string {
  const istMs = new Date(iso).getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
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
      ctx.client
        .from("coach_leave")
        .select("starts_on, ends_on, leave_type, partial_start_time, partial_end_time")
        .eq("coach_id", coachId)
        .eq("status", "approved"),
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
  // Full-day leave blocks the entire date, same as before. Partial-day leave
  // (migration 0031) only blocks its own time window on ONE date, tracked
  // separately so the rest of that day stays bookable.
  const fullDayLeave = (leave ?? [])
    .filter((l: any) => l.leave_type !== "partial")
    .map((l) => ({ starts: new Date(l.starts_on), ends: new Date(l.ends_on) }));
  const partialLeaveByDate = new Map<string, { startMin: number; endMin: number }[]>();
  for (const l of (leave ?? []) as any[]) {
    if (l.leave_type !== "partial" || !l.partial_start_time || !l.partial_end_time) continue;
    const [psH, psM] = l.partial_start_time.split(":").map(Number);
    const [peH, peM] = l.partial_end_time.split(":").map(Number);
    const list = partialLeaveByDate.get(l.starts_on) ?? [];
    list.push({ startMin: psH * 60 + psM, endMin: peH * 60 + peM });
    partialLeaveByDate.set(l.starts_on, list);
  }
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
    const dateStr = cursor.toISOString().slice(0, 10);
    const onFullDayLeave = fullDayLeave.some((l) => cursor >= l.starts && cursor <= l.ends);
    const partialWindows = partialLeaveByDate.get(dateStr) ?? [];
    const windows = byDayOfWeek.get(dow) ?? [];
    if (!onFullDayLeave && windows.length > 0) {
      for (const slotTime of grid) {
        const [h, m] = slotTime.split(":").map(Number);
        if (!fitsWithinWindow(h, m, windows)) continue;
        const slotStartMin = h * 60 + m;
        const slotEndMin = slotStartMin + durationMinutes;
        const overlapsPartialLeave = partialWindows.some((w) => slotStartMin < w.endMin && slotEndMin > w.startMin);
        if (overlapsPartialLeave) continue;
        const slotStart = istWallClockToInstant(dateStr, slotTime);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        const overlapsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
        if (!overlapsBusy) slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

export interface CoachCalendarSlot {
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM"
  status: "open" | "booked" | "unavailable";
  booking: {
    id: string;
    clientId: string;
    clientName: string;
    status: "upcoming" | "completed" | "cancelled" | "missed";
    wasRescheduled: boolean;
  } | null;
}

/** Admin coach-detail "7-day slot calendar" (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md
 * §2.3): every grid slot in the coach's own working hours from today through
 * today+6, labeled open/booked/unavailable. Deliberately NOT reusing
 * getOpenSlots() as-is -- that function only ever returns the open subset;
 * this needs every slot including booked/blocked ones, with which client
 * holds it and whether it was rescheduled. Shares the same availability +
 * leave (full-day/partial, migration 0031) handling as getOpenSlots() so the
 * two stay consistent with each other. */
export async function getCoachWeekCalendar(accessToken: string, coachId: string, fromDate: string, toDate: string): Promise<CoachCalendarSlot[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { startHour, endHour } = await getBookingWindow(accessToken);
  const grid = hourlyGrid(startHour, endHour);

  const [{ data: availability, error: availError }, { data: leave, error: leaveError }, { data: booked, error: bookedError }] =
    await Promise.all([
      ctx.client.from("coach_availability").select("day_of_week, start_time, end_time").eq("coach_id", coachId).eq("is_active", true),
      ctx.client
        .from("coach_leave")
        .select("starts_on, ends_on, leave_type, partial_start_time, partial_end_time")
        .eq("coach_id", coachId)
        .eq("status", "approved"),
      ctx.client
        .from("bookings")
        .select("id, scheduled_start, duration_minutes, status, was_rescheduled, client:client_profiles(id, profile:profiles(full_name))")
        .eq("coach_id", coachId)
        .neq("status", "cancelled")
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
  const fullDayLeave = (leave ?? [])
    .filter((l: any) => l.leave_type !== "partial")
    .map((l) => ({ starts: new Date(l.starts_on), ends: new Date(l.ends_on) }));
  const partialLeaveByDate = new Map<string, { startMin: number; endMin: number }[]>();
  for (const l of (leave ?? []) as any[]) {
    if (l.leave_type !== "partial" || !l.partial_start_time || !l.partial_end_time) continue;
    const [psH, psM] = l.partial_start_time.split(":").map(Number);
    const [peH, peM] = l.partial_end_time.split(":").map(Number);
    const list = partialLeaveByDate.get(l.starts_on) ?? [];
    list.push({ startMin: psH * 60 + psM, endMin: peH * 60 + peM });
    partialLeaveByDate.set(l.starts_on, list);
  }

  const bookingByInstant = new Map<string, (typeof booked)[number]>();
  for (const b of (booked ?? []) as any[]) bookingByInstant.set(new Date(b.scheduled_start).toISOString(), b);

  const fitsWithinWindow = (h: number, m: number, windows: { start_time: string; end_time: string }[]) =>
    windows.some((w) => {
      const [wsH, wsM] = w.start_time.split(":").map(Number);
      const [weH, weM] = w.end_time.split(":").map(Number);
      return h * 60 + m >= wsH * 60 + wsM && h * 60 + m < weH * 60 + weM;
    });

  const slots: CoachCalendarSlot[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dow = cursor.getUTCDay();
    const windows = byDayOfWeek.get(dow) ?? [];
    const onFullDayLeave = fullDayLeave.some((l) => cursor >= l.starts && cursor <= l.ends);
    const partialWindows = partialLeaveByDate.get(dateStr) ?? [];

    for (const slotTime of grid) {
      const [h, m] = slotTime.split(":").map(Number);
      if (!fitsWithinWindow(h, m, windows)) continue; // outside working hours entirely -- not part of the grid

      const slotStart = istWallClockToInstant(dateStr, slotTime);
      const bookingRow = bookingByInstant.get(slotStart.toISOString()) as any;

      if (bookingRow) {
        slots.push({
          date: dateStr,
          time: slotTime,
          status: "booked",
          booking: {
            id: bookingRow.id,
            clientId: bookingRow.client?.id ?? "",
            clientName: bookingRow.client?.profile?.full_name ?? "Client",
            status: bookingRow.status,
            wasRescheduled: bookingRow.was_rescheduled ?? false,
          },
        });
        continue;
      }

      const slotStartMin = h * 60 + m;
      const overlapsPartialLeave = partialWindows.some((w) => slotStartMin < w.endMin && slotStartMin >= w.startMin);
      if (onFullDayLeave || overlapsPartialLeave) {
        slots.push({ date: dateStr, time: slotTime, status: "unavailable", booking: null });
        continue;
      }

      slots.push({ date: dateStr, time: slotTime, status: "open", booking: null });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}

export interface AvailabilityCheckSlot {
  date: string;
  time: string;
  coachId: string;
  coachName: string;
  status: "booked" | "free";
  booking: { id: string; clientId: string; clientCode: string; clientName: string } | null;
  /** Only set for a free slot that WAS booked and got cancelled -- pulled
   * from bookings.cancelled_by/cancel_reason (migration 0005/0011), not a
   * new column. Null for a slot that was simply never booked at all. */
  freeReason: string | null;
}

/** Admin-wide "Availability Check": every working-hour slot across every
 * active coach for one day, chronological, labeled booked/free. Cross-coach
 * sibling of getCoachWeekCalendar() above (same open-hours/leave logic,
 * batched across coaches in 4 queries total instead of one coach at a time),
 * plus the one thing that function doesn't need: for a free slot, whether it
 * was cancelled and by whom, so admin isn't just told "free" with no
 * context. Coach-leave-blocked slots are deliberately excluded entirely
 * (not folded into "free") -- they aren't a real booking opportunity, and
 * showing them as free would be misleading for an admin using this to find
 * open capacity. */
export async function getAvailabilityCheck(accessToken: string, date: string): Promise<AvailabilityCheckSlot[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { startHour, endHour } = await getBookingWindow(accessToken);
  const grid = hourlyGrid(startHour, endHour);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

  const { data: coaches, error: coachesError } = await ctx.client
    .from("coach_profiles")
    .select("id, profile:profiles(full_name)")
    .eq("status", "active");
  if (coachesError) throw coachesError;
  if (!coaches || coaches.length === 0) return [];
  const coachIds = (coaches as any[]).map((c) => c.id);
  const coachNameById = new Map((coaches as any[]).map((c) => [c.id, c.profile?.full_name ?? "Coach"]));

  const [
    { data: availability, error: availError },
    { data: leave, error: leaveError },
    { data: activeBookings, error: activeError },
    { data: cancelledBookings, error: cancelledError },
  ] = await Promise.all([
    ctx.client.from("coach_availability").select("coach_id, start_time, end_time").in("coach_id", coachIds).eq("day_of_week", dow).eq("is_active", true),
    ctx.client
      .from("coach_leave")
      .select("coach_id, starts_on, ends_on, leave_type, partial_start_time, partial_end_time")
      .in("coach_id", coachIds)
      .eq("status", "approved")
      .lte("starts_on", date)
      .gte("ends_on", date),
    ctx.client
      .from("bookings")
      .select("id, coach_id, scheduled_start, client:client_profiles(id, client_code, profile:profiles(full_name))")
      .in("coach_id", coachIds)
      .neq("status", "cancelled")
      .gte("scheduled_start", `${date}T00:00:00Z`)
      .lte("scheduled_start", `${date}T23:59:59Z`),
    ctx.client
      .from("bookings")
      .select("coach_id, scheduled_start, cancel_reason, canceller:profiles!cancelled_by(full_name)")
      .in("coach_id", coachIds)
      .eq("status", "cancelled")
      .gte("scheduled_start", `${date}T00:00:00Z`)
      .lte("scheduled_start", `${date}T23:59:59Z`),
  ]);
  if (availError) throw availError;
  if (leaveError) throw leaveError;
  if (activeError) throw activeError;
  if (cancelledError) throw cancelledError;

  const availByCoach = new Map<string, { start_time: string; end_time: string }[]>();
  for (const a of (availability ?? []) as any[]) {
    const list = availByCoach.get(a.coach_id) ?? [];
    list.push(a);
    availByCoach.set(a.coach_id, list);
  }

  const fullDayLeaveCoaches = new Set<string>();
  const partialLeaveByCoach = new Map<string, { startMin: number; endMin: number }[]>();
  for (const l of (leave ?? []) as any[]) {
    if (l.leave_type !== "partial") {
      fullDayLeaveCoaches.add(l.coach_id);
    } else if (l.partial_start_time && l.partial_end_time) {
      const [psH, psM] = l.partial_start_time.split(":").map(Number);
      const [peH, peM] = l.partial_end_time.split(":").map(Number);
      const list = partialLeaveByCoach.get(l.coach_id) ?? [];
      list.push({ startMin: psH * 60 + psM, endMin: peH * 60 + peM });
      partialLeaveByCoach.set(l.coach_id, list);
    }
  }

  const keyOf = (coachId: string, iso: string) => `${coachId}|${iso}`;
  const bookingByKey = new Map<string, any>();
  for (const b of (activeBookings ?? []) as any[]) bookingByKey.set(keyOf(b.coach_id, new Date(b.scheduled_start).toISOString()), b);
  const cancelledByKey = new Map<string, any>();
  for (const b of (cancelledBookings ?? []) as any[]) cancelledByKey.set(keyOf(b.coach_id, new Date(b.scheduled_start).toISOString()), b);

  const fitsWithinWindow = (h: number, m: number, windows: { start_time: string; end_time: string }[]) =>
    windows.some((w) => {
      const [wsH, wsM] = w.start_time.split(":").map(Number);
      const [weH, weM] = w.end_time.split(":").map(Number);
      return h * 60 + m >= wsH * 60 + wsM && h * 60 + m < weH * 60 + weM;
    });

  const toISTTimeString = (iso: string): string => {
    const min = istTimeOfDayMinutes(iso);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  };

  const slots: AvailabilityCheckSlot[] = [];
  for (const coach of coaches as any[]) {
    const windows = availByCoach.get(coach.id) ?? [];
    const onFullDayLeave = fullDayLeaveCoaches.has(coach.id);
    const partialWindows = partialLeaveByCoach.get(coach.id) ?? [];
    const coachName = coachNameById.get(coach.id) ?? "Coach";

    // The booking engine only ever creates whole-hour slots going forward
    // (see getBookingWindow's own doc comment) -- but real rows in this
    // table aren't guaranteed to respect that (older data, manual/seed
    // inserts). A booking is ground truth: it must show up here even if its
    // time doesn't land on the standard grid, so the grid is widened with
    // any actual booking/cancellation time for this coach on this date,
    // rather than silently skipping whatever doesn't fit the hourly grid.
    const actualTimes = new Set<string>();
    for (const b of (activeBookings ?? []) as any[]) if (b.coach_id === coach.id) actualTimes.add(toISTTimeString(b.scheduled_start));
    for (const b of (cancelledBookings ?? []) as any[]) if (b.coach_id === coach.id) actualTimes.add(toISTTimeString(b.scheduled_start));

    const candidateTimes = new Set<string>(grid);
    for (const t of actualTimes) candidateTimes.add(t);

    for (const slotTime of Array.from(candidateTimes).sort()) {
      const [h, m] = slotTime.split(":").map(Number);
      const isRealSlot = actualTimes.has(slotTime);

      // Synthetic (grid-only) slots are filtered by working hours/leave --
      // a real booking's own time always shows regardless, since it's
      // ground truth, not a hypothetical opportunity to book.
      if (!isRealSlot) {
        if (!fitsWithinWindow(h, m, windows)) continue;
        const slotStartMin = h * 60 + m;
        const overlapsPartialLeave = partialWindows.some((w) => slotStartMin < w.endMin && slotStartMin >= w.startMin);
        if (onFullDayLeave || overlapsPartialLeave) continue; // excluded, not "free" -- see doc comment above
      }

      const slotStart = istWallClockToInstant(date, slotTime);
      const key = keyOf(coach.id, slotStart.toISOString());
      const bookingRow = bookingByKey.get(key);

      if (bookingRow) {
        slots.push({
          date,
          time: slotTime,
          coachId: coach.id,
          coachName,
          status: "booked",
          booking: {
            id: bookingRow.id,
            clientId: bookingRow.client?.id ?? "",
            clientCode: bookingRow.client?.client_code ?? "",
            clientName: bookingRow.client?.profile?.full_name ?? "Client",
          },
          freeReason: null,
        });
        continue;
      }

      const cancelledRow = cancelledByKey.get(key);
      slots.push({
        date,
        time: slotTime,
        coachId: coach.id,
        coachName,
        status: "free",
        booking: null,
        freeReason: cancelledRow
          ? `Cancelled by ${cancelledRow.canceller?.full_name ?? "someone"}${cancelledRow.cancel_reason ? ` — "${cancelledRow.cancel_reason}"` : ""}`
          : null,
      });
    }
  }

  return slots.sort((a, b) => a.time.localeCompare(b.time) || a.coachName.localeCompare(b.coachName));
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
    amountPaid?: number;
  }
) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.rpc("confirm_booking", {
    p_temp_booking_id: input.tempBookingId,
    p_subscription_id: input.subscriptionId ?? null,
    p_recurring_slot_id: input.recurringSlotId ?? null,
    p_assessment_session_id: input.assessmentSessionId ?? null,
    p_session_type: input.sessionType ?? "regular",
    p_amount_paid: input.amountPaid ?? null,
  });
  if (error) throw error;
  return data as string; // booking id
}

// ── Recurring pattern matching (Screen 1: "Set Your Recurring Schedule") ──
// DAY_GROUPS/PAIRS_MWF/PAIRS_TTS now live in lib/constants/scheduling.ts so
// ScheduleSetupClient.tsx ("use client") can import the same values without
// pulling this server-only module into the browser bundle.

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
    if (input.customDays.includes(0)) {
      throw new Error("Sunday is a holiday and isn't available for scheduling.");
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
    if (input.customDays.includes(0)) {
      throw new Error("Sunday is a holiday and isn't available for scheduling.");
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
  score: number;
}

export interface ShadowOccurrence {
  slotStart: string; // ISO instant of this specific session occurrence
  durationMinutes: number;
  candidates: ShadowCoachCandidate[]; // ranked best-first, [] if none free
}

/** Weighted compatibility score for a shadow-coach candidate, relative to
 * the primary coach being covered for (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md
 * §4.2.2). Kept as a single function so the weighting can be tuned in one
 * place rather than a hardcoded priority ladder. Utilization was the only
 * signal scored before this change; specialization/language/rating are
 * genuinely new inputs here, not new schema -- all already exist on
 * coach_profiles. */
function scoreShadowCandidate(
  candidate: {
    specialization: string | null;
    secondarySpecializations: string[];
    languages: string[];
    rating: number;
    utilizationPct: number;
  },
  primary: { specialization: string | null; languages: string[] }
): number {
  let score = 0;

  if (primary.specialization && candidate.specialization === primary.specialization) score += 40;
  else if (primary.specialization && candidate.secondarySpecializations.includes(primary.specialization)) score += 20;

  const sharedLanguages = candidate.languages.filter((l) => primary.languages.includes(l)).length;
  score += Math.min(sharedLanguages, 3) * 10; // up to 30

  score += candidate.rating * 6; // 0-5 -> 0-30

  score += (100 - candidate.utilizationPct) * 0.2; // 0-100 -> 0-20, lower utilization scores higher

  return Math.round(score * 10) / 10;
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
 * re-implementing that logic here.
 *
 * Resolved PER OCCURRENCE, not once for the whole date range -- a coach free
 * on 3 of 5 sessions is a real candidate for those 3. Different shadow
 * coaches covering different days for the same client during one leave
 * period is the correct, expected outcome, not an edge case to prevent (see
 * planShadowAssignments below, which turns this per-occurrence resolution
 * into the minimal set of actual assignment calls). Each occurrence's
 * candidates are ranked by weighted score (scoreShadowCandidate), not
 * utilization alone. */
export async function findShadowCoachCandidates(
  accessToken: string,
  input: { clientId: string; primaryCoachId: string; startsOn: string; endsOn: string }
): Promise<ShadowOccurrence[]> {
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
    const cursor = new Date(start);
    while (cursor <= end) {
      if (cursor.getUTCDay() === slot.day_of_week) {
        const slotStart = istWallClockToInstant(cursor.toISOString().slice(0, 10), slot.start_time.slice(0, 5));
        occurrences.push({ slotStart: slotStart.toISOString(), durationMinutes: slot.duration_minutes });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  if (occurrences.length === 0) return [];
  occurrences.sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime());

  const { data: primary, error: primaryError } = await ctx.client
    .from("coach_profiles")
    .select("specialization, languages")
    .eq("id", input.primaryCoachId)
    .maybeSingle();
  if (primaryError) throw primaryError;
  const primaryProfile = {
    specialization: (primary as any)?.specialization ?? null,
    languages: ((primary as any)?.languages as string[] | null) ?? [],
  };

  const { data: coaches, error: coachesError } = await ctx.client
    .from("coach_profiles")
    .select("id, specialization, secondary_specializations, languages, rating, profile:profiles(full_name)")
    .eq("status", "active")
    .neq("id", input.primaryCoachId);
  if (coachesError) throw coachesError;
  if (!coaches || coaches.length === 0) return occurrences.map((occ) => ({ ...occ, candidates: [] }));

  const { data: util, error: utilError } = await ctx.client
    .from("coach_utilization_view")
    .select("coach_id, utilization_pct")
    .in(
      "coach_id",
      coaches.map((c: any) => c.id)
    );
  if (utilError) throw utilError;
  const utilByCoach = new Map((util ?? []).map((u) => [u.coach_id, u.utilization_pct]));

  const occurrenceCandidates: ShadowCoachCandidate[][] = occurrences.map(() => []);

  await Promise.all(
    (coaches as any[]).map(async (coach) => {
      const freePerOccurrence = await Promise.all(
        occurrences.map(async (occ) => {
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
          return Boolean(withinHours) && !hasConflict;
        })
      );

      const utilizationPct = utilByCoach.get(coach.id) ?? 0;
      const candidate: ShadowCoachCandidate = {
        coachId: coach.id,
        name: coach.profile?.full_name ?? "Coach",
        specialization: coach.specialization ?? null,
        utilizationPct,
        score: scoreShadowCandidate(
          {
            specialization: coach.specialization ?? null,
            secondarySpecializations: (coach.secondary_specializations as string[] | null) ?? [],
            languages: (coach.languages as string[] | null) ?? [],
            rating: Number(coach.rating ?? 0),
            utilizationPct,
          },
          primaryProfile
        ),
      };

      freePerOccurrence.forEach((free, i) => {
        if (free) occurrenceCandidates[i].push(candidate);
      });
    })
  );

  return occurrences.map((occ, i) => ({
    ...occ,
    candidates: occurrenceCandidates[i].sort((a, b) => b.score - a.score),
  }));
}

export interface ShadowAssignmentPlanItem {
  shadowCoachId: string;
  shadowCoachName: string;
  startsOn: string; // date, inclusive
  endsOn: string; // date, inclusive
}

export interface ShadowAssignmentPlan {
  assignments: ShadowAssignmentPlanItem[];
  uncoveredDates: string[]; // occurrence dates with zero free candidates
}

/** Turns per-occurrence candidate resolution into the minimal set of actual
 * assign_shadow_coach() calls: picks the top-scored candidate for each
 * occurrence, then groups consecutive occurrences (in date order) assigned
 * to the SAME coach into a single date-range assignment -- so a leave
 * covered entirely by one coach still produces one shadow_coach_assignments
 * row, not one per session. A different coach on an intervening occurrence
 * starts a new group; grouping by list adjacency (not calendar-day
 * adjacency) is safe because assign_shadow_coach() only ever touches this
 * client's OWN existing bookings within the given range, so a range that
 * happens to span an "off day" the client has no session on is a no-op for
 * that day, not a hazard. Used by both the automatic leave-approval path
 * and the manual admin "Assign Shadow Coach" tool, so both share the same
 * grouping/ranking logic. */
export function planShadowAssignments(occurrences: ShadowOccurrence[]): ShadowAssignmentPlan {
  const uncoveredDates: string[] = [];
  const assignments: ShadowAssignmentPlanItem[] = [];
  // Tracks the coach covering the occurrence immediately prior, so an
  // uncovered gap always forces a new group -- otherwise a later occurrence
  // assigned back to the same coach as before the gap would extend the date
  // range OVER the uncovered day, and assign_shadow_coach()'s date-range
  // update would then incorrectly reassign that booking too, to a coach
  // already confirmed not free for it.
  let lastCoachId: string | null = null;

  for (const occ of occurrences) {
    const date = occ.slotStart.slice(0, 10);
    const top = occ.candidates[0];
    if (!top) {
      uncoveredDates.push(date);
      lastCoachId = null;
      continue;
    }
    const last = assignments[assignments.length - 1];
    if (last && lastCoachId === top.coachId) {
      last.endsOn = date;
    } else {
      assignments.push({ shadowCoachId: top.coachId, shadowCoachName: top.name, startsOn: date, endsOn: date });
    }
    lastCoachId = top.coachId;
  }

  return { assignments, uncoveredDates };
}

export interface ShadowCoverageGap {
  bookingId: string;
  scheduledStart: string;
  clientId: string;
  clientName: string;
  clientCode: string | null;
  coachId: string;
  coachName: string;
  leaveId: string;
  leaveReason: string | null;
  leaveStartsOn: string;
  leaveEndsOn: string;
}

/** Persistent "Shadow Coach Required" admin queue (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md
 * §4.2.4). Deliberately derived live from existing data rather than a new
 * table: a booking is a coverage gap if its coach currently has approved
 * leave covering that exact occurrence (respecting partial-day time windows,
 * migration 0031) and the booking is STILL assigned to that same coach --
 * i.e. no shadow coach was ever found or manually assigned for it. Resolving
 * it (via the same "Assign Shadow Coach" tool used for undocumented
 * absences, §4.2.3) changes bookings.coach_id away from the primary coach,
 * so the row disappears from this list on the next read with nothing extra
 * to keep in sync. Replaces the transient "just approved" summary card as
 * the durable place this stays visible. */
export async function listShadowCoverageGaps(accessToken: string): Promise<ShadowCoverageGap[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const { data: leaves, error: leavesError } = await ctx.client
    .from("coach_leave")
    .select("id, coach_id, starts_on, ends_on, reason, leave_type, partial_start_time, partial_end_time")
    .eq("status", "approved")
    .gte("ends_on", todayIso);
  if (leavesError) throw leavesError;
  if (!leaves || leaves.length === 0) return [];

  const coachIds = [...new Set((leaves as any[]).map((l) => l.coach_id))];
  const { data: bookings, error: bookingsError } = await ctx.client
    .from("bookings")
    .select(
      "id, scheduled_start, duration_minutes, coach_id, client:client_profiles(id, client_code, profile:profiles(full_name)), coach:coach_profiles(profile:profiles(full_name))"
    )
    .in("coach_id", coachIds)
    .eq("status", "upcoming")
    .gt("scheduled_start", now.toISOString());
  if (bookingsError) throw bookingsError;

  const gaps = new Map<string, ShadowCoverageGap>();
  for (const leave of leaves as any[]) {
    let windowMin: { start: number; end: number } | null = null;
    if (leave.leave_type === "partial" && leave.partial_start_time && leave.partial_end_time) {
      const [psH, psM] = leave.partial_start_time.split(":").map(Number);
      const [peH, peM] = leave.partial_end_time.split(":").map(Number);
      windowMin = { start: psH * 60 + psM, end: peH * 60 + peM };
    }

    for (const booking of (bookings as any[]).filter((b) => b.coach_id === leave.coach_id)) {
      if (gaps.has(booking.id)) continue; // already matched by an earlier (overlapping) leave row

      const bookingDate = istDateString(booking.scheduled_start);
      if (bookingDate < leave.starts_on || bookingDate > leave.ends_on) continue;

      if (windowMin) {
        const startMin = istTimeOfDayMinutes(booking.scheduled_start);
        const endMin = startMin + booking.duration_minutes;
        if (!(startMin < windowMin.end && endMin > windowMin.start)) continue;
      }

      gaps.set(booking.id, {
        bookingId: booking.id,
        scheduledStart: booking.scheduled_start,
        clientId: booking.client?.id ?? "",
        clientName: booking.client?.profile?.full_name ?? "Client",
        clientCode: booking.client?.client_code ?? null,
        coachId: leave.coach_id,
        coachName: booking.coach?.profile?.full_name ?? "Coach",
        leaveId: leave.id,
        leaveReason: leave.reason,
        leaveStartsOn: leave.starts_on,
        leaveEndsOn: leave.ends_on,
      });
    }
  }

  return [...gaps.values()].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
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
