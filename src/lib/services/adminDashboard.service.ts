import { getCallerContext, requireRole } from "./_auth";
import { listRenewalOpportunities } from "./renewals.service";

export interface AdminDashboardMetrics {
  totalClients: number;
  activePTClients: number;
  sessionsBookedToday: number;
  sessionsCancelledToday: number;
  trainerUtilization: number;
  peakBookingHour: string;
  emptySlotCount: number;
  revenueThisMonth: number;
  avgSessionsPerClient: number;
  activeCoachesCount: number;
  avgCoachRating: number;
  /** Completed sessions per day, trailing 30-day window. */
  avgSessionsPerDay: number;
  /** Live snapshot, not calendar-month-anchored: of every client currently
   * flagged in Renewal Opportunities (low-on-sessions or expired) right now,
   * what % have already bought a renewal. Null (not 0%) when nobody is
   * currently flagged at all, so the UI can distinguish "no data" from
   * "zero conversions." */
  renewalOpportunityCount: number;
  renewalRatePct: number | null;
}

export interface AdminDashboardData {
  metrics: AdminDashboardMetrics;
  revenueTrend: { month: string; revenue: number; sessions: number }[];
  bookingsByHour: { hour: string; bookings: number }[];
  utilizationByCoach: { name: string; utilization: number }[];
}

/** Raw month/revenue/sessions rows for the admin Revenue Report CSV — same
 * view as getAdminDashboard()'s chart data, but unformatted (ISO month,
 * not "Jan"), since a CSV consumer wants precision, not display. */
export async function getRevenueTrendRaw(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("revenue_trend_view").select("month, revenue, sessions").order("month");
  if (error) throw error;
  return data as { month: string; revenue: number; sessions: number }[];
}

function formatHour(hour24: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${period}`;
}

/** Admin overview KPIs — real equivalents of mock-data.ts's adminMetrics/
 * revenueTrend/bookingsByHour/utilizationByCoach, sourced from the reporting
 * views in supabase/migrations/0010_views.sql plus direct counts for the
 * numbers those views don't cover (today's booking/cancellation counts). */
export async function getAdminDashboard(accessToken: string): Promise<AdminDashboardData> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayDow = now.getDay();

  const [
    { count: totalClients },
    { count: activePTClients },
    { count: sessionsBookedToday },
    { count: sessionsCancelledToday },
    { data: utilRows, error: utilError },
    { data: revenueRows, error: revenueError },
    { data: hourRows, error: hourError },
    { data: usageRows, error: usageError },
    { data: todayAvailability, error: availError },
    { data: durationSetting, error: durationError },
    { count: activeCoachesCount },
    { data: activeCoachRatings, error: ratingsError },
    { count: completedLast30Days },
  ] = await Promise.all([
    ctx.client.from("client_profiles").select("id", { count: "exact", head: true }),
    ctx.client.from("client_profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    ctx.client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString())
      .in("status", ["upcoming", "completed"]),
    ctx.client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString())
      .eq("status", "cancelled"),
    ctx.client.from("coach_utilization_view").select("coach_id, coach_name, utilization_pct"),
    ctx.client.from("revenue_trend_view").select("month, revenue, sessions"),
    ctx.client.from("bookings_by_hour_view").select("hour_of_day, bookings"),
    ctx.client.from("subscription_usage_view").select("sessions_used"),
    ctx.client.from("coach_availability").select("start_time, end_time").eq("day_of_week", todayDow).eq("is_active", true),
    ctx.client.from("system_settings").select("value").eq("key", "default_session_duration_minutes").single(),
    ctx.client.from("coach_profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    ctx.client.from("coach_profiles").select("rating").eq("status", "active"),
    ctx.client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("scheduled_start", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (utilError) throw utilError;
  if (revenueError) throw revenueError;
  if (hourError) throw hourError;
  if (usageError) throw usageError;
  if (availError) throw availError;
  if (durationError) throw durationError;
  if (ratingsError) throw ratingsError;

  const renewalOpportunities = await listRenewalOpportunities(accessToken);
  const renewalOpportunityCount = renewalOpportunities.length;
  const renewalRatePct =
    renewalOpportunityCount > 0
      ? Math.round((renewalOpportunities.filter((o) => o.converted).length / renewalOpportunityCount) * 100)
      : null;

  const avgCoachRating =
    (activeCoachRatings ?? []).length > 0
      ? Math.round((activeCoachRatings!.reduce((s, c: any) => s + Number(c.rating ?? 0), 0) / activeCoachRatings!.length) * 10) / 10
      : 0;
  const avgSessionsPerDay = Math.round(((completedLast30Days ?? 0) / 30) * 10) / 10;

  // coach_utilization_view.utilization_pct and revenue_trend_view.revenue are
  // Postgres `numeric` columns — depending on the client, numeric can come
  // back as a string rather than a JS number (to avoid float precision
  // loss). `-` coerces either way, but `+`/reduce-sum does string
  // concatenation on strings, so every value here is explicitly Number()'d
  // before arithmetic rather than trusted to already be numeric.
  const util = (utilRows ?? []).map((u: any) => ({ ...u, utilization_pct: Number(u.utilization_pct) })) as {
    coach_id: string;
    coach_name: string;
    utilization_pct: number;
  }[];
  const trainerUtilization = util.length > 0 ? Math.round(util.reduce((s, u) => s + u.utilization_pct, 0) / util.length) : 0;

  const hours = (hourRows ?? []).map((h: any) => ({ ...h, bookings: Number(h.bookings) })) as { hour_of_day: number; bookings: number }[];
  const peak = hours.reduce((best, h) => (h.bookings > (best?.bookings ?? -1) ? h : best), null as (typeof hours)[number] | null);
  const peakBookingHour = peak ? formatHour(peak.hour_of_day) : "—";

  const revenue = (revenueRows ?? []).map((r: any) => ({ ...r, revenue: Number(r.revenue), sessions: Number(r.sessions) })) as {
    month: string;
    revenue: number;
    sessions: number;
  }[];
  const revenueThisMonth = revenue.length > 0 ? revenue[revenue.length - 1].revenue : 0;

  const usage = (usageRows ?? []).map((u: any) => ({ sessions_used: Number(u.sessions_used) })) as { sessions_used: number }[];
  const avgSessionsPerClient = usage.length > 0 ? Math.round((usage.reduce((s, u) => s + u.sessions_used, 0) / usage.length) * 10) / 10 : 0;

  const defaultDurationMinutes = Number((durationSetting?.value as unknown) ?? 45) || 45;
  const availableMinutesToday = (todayAvailability ?? []).reduce((sum, w: any) => {
    const [sh, sm] = String(w.start_time).split(":").map(Number);
    const [eh, em] = String(w.end_time).split(":").map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  const totalSlotsToday = Math.floor(availableMinutesToday / defaultDurationMinutes);
  const emptySlotCount = Math.max(0, totalSlotsToday - (sessionsBookedToday ?? 0));

  return {
    metrics: {
      totalClients: totalClients ?? 0,
      activePTClients: activePTClients ?? 0,
      sessionsBookedToday: sessionsBookedToday ?? 0,
      sessionsCancelledToday: sessionsCancelledToday ?? 0,
      trainerUtilization,
      peakBookingHour,
      emptySlotCount,
      revenueThisMonth,
      avgSessionsPerClient,
      activeCoachesCount: activeCoachesCount ?? 0,
      avgCoachRating,
      avgSessionsPerDay,
      renewalOpportunityCount,
      renewalRatePct,
    },
    revenueTrend: revenue.map((r) => ({
      month: new Date(r.month).toLocaleDateString("en-US", { month: "short" }),
      revenue: r.revenue,
      sessions: r.sessions,
    })),
    bookingsByHour: hours.map((h) => ({ hour: formatHour(h.hour_of_day), bookings: h.bookings })),
    utilizationByCoach: util
      .sort((a, b) => b.utilization_pct - a.utilization_pct)
      .map((u) => ({ name: u.coach_name?.split(" ")[0] ?? "Coach", utilization: u.utilization_pct })),
  };
}
