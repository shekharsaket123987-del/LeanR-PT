import { getCallerContext } from "./_auth";

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

/** Free windows for a coach between two dates, of at least durationMinutes,
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

  const slots: OpenSlot[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    const onLeave = leaveDates.some((l) => cursor >= l.starts && cursor <= l.ends);
    if (!onLeave) {
      for (const window of byDayOfWeek.get(dow) ?? []) {
        let [h, m] = window.start_time.split(":").map(Number);
        const [endH, endM] = window.end_time.split(":").map(Number);
        while (h * 60 + m + durationMinutes <= endH * 60 + endM) {
          const slotStart = new Date(cursor);
          slotStart.setUTCHours(h, m, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
          const overlapsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
          if (!overlapsBusy) slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
          m += durationMinutes;
          if (m >= 60) {
            h += Math.floor(m / 60);
            m = m % 60;
          }
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
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
