import { getCallerContext, requireRole } from "./_auth";
import { countEscalationsForCoach } from "./escalations.service";

export interface CoachPerformance {
  totalActiveClients: number;
  totalSessionsCompleted: number;
  sessionsScheduledToday: number;
  attendancePct: number;
  clientNoShowPct: number;
  coachNoShowPct: number;
  currentCapacity: number;
  maxCapacity: number;
  availableCapacity: number;
  totalWeeklySessions: number;
  totalMonthlySessions: number;
  avgSessionDurationMinutes: number;
  escalationsRaised: number;
  coachChangeRequestsReceived: number;
  averageRating: number;
}

/** Aggregates the admin coach-detail "Performance" panel. Read-only —
 * nothing here mutates data, it's purely for admin decision-making
 * (workload balancing, coaching-quality review, future assignments). */
export async function getCoachPerformance(accessToken: string, coachId: string): Promise<CoachPerformance> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { data: coach, error: coachError },
    { data: util, error: utilError },
    { count: sessionsScheduledToday },
    { count: totalWeeklySessions },
    { count: totalMonthlySessions },
    { data: completedRows, error: completedError },
    { data: outcomeRows, error: outcomeError },
    { count: coachChangeRequestsReceived },
    escalationsRaised,
  ] = await Promise.all([
    ctx.client.from("coach_profiles").select("max_capacity, rating").eq("id", coachId).single(),
    ctx.client.from("coach_utilization_view").select("active_clients").eq("coach_id", coachId).maybeSingle(),
    ctx.client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .eq("status", "upcoming")
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString()),
    ctx.client.from("bookings").select("id", { count: "exact", head: true }).eq("coach_id", coachId).gte("scheduled_start", weekStart.toISOString()),
    ctx.client.from("bookings").select("id", { count: "exact", head: true }).eq("coach_id", coachId).gte("scheduled_start", monthStart.toISOString()),
    ctx.client.from("bookings").select("id, duration_minutes").eq("coach_id", coachId).eq("status", "completed"),
    ctx.client.from("bookings").select("id, no_show_party").eq("coach_id", coachId).in("status", ["completed", "missed", "cancelled"]),
    ctx.client.from("coach_change_requests").select("id", { count: "exact", head: true }).eq("current_coach_id", coachId),
    countEscalationsForCoach(coachId),
  ]);
  if (coachError) throw coachError;
  if (utilError) throw utilError;
  if (completedError) throw completedError;
  if (outcomeError) throw outcomeError;

  const totalSessionsCompleted = (completedRows ?? []).length;
  const avgSessionDurationMinutes =
    totalSessionsCompleted > 0
      ? Math.round((completedRows as any[]).reduce((s, b) => s + b.duration_minutes, 0) / totalSessionsCompleted)
      : 0;

  const outcomes = (outcomeRows ?? []) as { no_show_party: string | null }[];
  const totalOutcomes = outcomes.length;
  const clientNoShowPct = totalOutcomes > 0 ? Math.round((outcomes.filter((o) => o.no_show_party === "client").length / totalOutcomes) * 100) : 0;
  const coachNoShowPct = totalOutcomes > 0 ? Math.round((outcomes.filter((o) => o.no_show_party === "coach").length / totalOutcomes) * 100) : 0;

  // attendance rows only exist for completed bookings (completeBooking()
  // inserts one) -- attendance % here is "of the sessions that were
  // completed, how many have a 'present' attendance record" rather than a
  // theoretical join/no-join rate, since there's no real video-call
  // join/leave instrumentation in this codebase yet.
  const completedBookingIds = (completedRows ?? []).map((b: any) => b.id);
  let attendancePct = 0;
  if (completedBookingIds.length > 0) {
    const { data: attendanceRows, error: attendanceError } = await ctx.client
      .from("attendance")
      .select("status")
      .in("booking_id", completedBookingIds);
    if (attendanceError) throw attendanceError;
    const attendance = (attendanceRows ?? []) as { status: string }[];
    attendancePct = Math.round((attendance.filter((a) => a.status === "present").length / completedBookingIds.length) * 100);
  }

  const currentCapacity = util?.active_clients ?? 0;
  const maxCapacity = coach?.max_capacity ?? 50;

  return {
    totalActiveClients: currentCapacity,
    totalSessionsCompleted,
    sessionsScheduledToday: sessionsScheduledToday ?? 0,
    attendancePct,
    clientNoShowPct,
    coachNoShowPct,
    currentCapacity,
    maxCapacity,
    availableCapacity: Math.max(0, maxCapacity - currentCapacity),
    totalWeeklySessions: totalWeeklySessions ?? 0,
    totalMonthlySessions: totalMonthlySessions ?? 0,
    avgSessionDurationMinutes,
    escalationsRaised,
    coachChangeRequestsReceived: coachChangeRequestsReceived ?? 0,
    averageRating: Number(coach?.rating ?? 0),
  };
}
