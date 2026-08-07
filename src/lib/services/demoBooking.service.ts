import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getBookingWindow, hourlyGrid, istWallClockToInstant } from "./scheduling.service";
import { createBooking } from "./bookings.service";

export interface DemoSlotOption {
  coachId: string;
  coachName: string;
  coachPhoto: string;
  slotStart: string; // ISO
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

/** Demo (assessment) booking search: unlike findAvailableCoach() (which
 * matches a recurring WEEKLY PATTERN for an already-committing client),
 * this searches every active coach for open slots on a SINGLE date --
 * the client has no coach yet and no plan, just wants to try a session.
 * Reuses the same is_slot_within_working_hours/has_scheduling_conflict RPCs
 * the real booking engine depends on, rather than re-deriving availability. */
export async function findDemoSlots(
  accessToken: string,
  input: { date: string; preferredTime?: string; genderPreference?: "male" | "female" | "other"; durationMinutes?: number }
): Promise<DemoSlotOption[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const durationMinutes = input.durationMinutes ?? 60;

  // Uses supabaseAdmin deliberately, same rationale as coaches.service.ts's
  // getCoachPublicInfo(): this client has no relationship (booking/recurring
  // slot) with any of these coaches yet, so profiles_select_linked_as_client
  // RLS would otherwise silently null out every coach's name/photo.
  let coachQuery = supabaseAdmin.from("coach_profiles").select("id, specialization, profile:profiles(full_name, photo_url)").eq("status", "active");
  if (input.genderPreference) coachQuery = coachQuery.eq("gender", input.genderPreference);
  const { data: coaches, error: coachesError } = await coachQuery;
  if (coachesError) throw coachesError;
  if (!coaches || coaches.length === 0) return [];

  // Same RLS reasoning as above -- coach_utilization_view inner-joins
  // profiles, so a client with no relationship to these coaches would get
  // rows silently dropped rather than just missing a name.
  const { data: util, error: utilError } = await supabaseAdmin
    .from("coach_utilization_view")
    .select("coach_id, utilization_pct")
    .in(
      "coach_id",
      coaches.map((c: any) => c.id)
    );
  if (utilError) throw utilError;
  const utilByCoach = new Map((util ?? []).map((u) => [u.coach_id, Number(u.utilization_pct)]));

  const { startHour, endHour } = await getBookingWindow(accessToken);
  const grid = hourlyGrid(startHour, endHour);
  const timesToTry = input.preferredTime ? [input.preferredTime, ...grid.filter((t) => t !== input.preferredTime)] : grid;

  const sortedCoaches = [...coaches].sort((a: any, b: any) => (utilByCoach.get(a.id) ?? 0) - (utilByCoach.get(b.id) ?? 0));

  const options: DemoSlotOption[] = [];
  for (const time of timesToTry) {
    const slotStart = istWallClockToInstant(input.date, time);
    if (slotStart.getTime() <= Date.now()) continue;

    for (const coach of sortedCoaches as any[]) {
      const [{ data: withinHours, error: hoursError }, { data: hasConflict, error: conflictError }] = await Promise.all([
        ctx.client.rpc("is_slot_within_working_hours", { p_coach_id: coach.id, p_slot_start: slotStart.toISOString(), p_duration_minutes: durationMinutes }),
        ctx.client.rpc("has_scheduling_conflict", { p_coach_id: coach.id, p_slot_start: slotStart.toISOString(), p_duration_minutes: durationMinutes }),
      ]);
      if (hoursError) throw hoursError;
      if (conflictError) throw conflictError;
      if (withinHours && !hasConflict) {
        options.push({
          coachId: coach.id,
          coachName: coach.profile?.full_name ?? "Coach",
          coachPhoto: coach.profile?.photo_url ?? FALLBACK_PHOTO(coach.id),
          slotStart: slotStart.toISOString(),
        });
      }
    }
    if (options.length >= 20) break;
  }

  return options.slice(0, 20);
}

/** Confirms a demo booking -- reuses the same hold-then-confirm booking path
 * every other session type goes through (createBooking -> holdSlot/confirmHold),
 * with sessionType: 'assessment' so it's re-checked server-side for conflicts
 * exactly like a regular booking would be. The demo itself is free (no
 * payment collected -- see bookDemoSessionAction in client-journey.actions.ts,
 * which calls this directly with no Razorpay step); DEMO_SESSION_FEE still
 * exists for the dormant Razorpay demo-payment path in payments.service.ts,
 * left intact but unused by this flow in case a paid-demo model is wanted
 * again later. */
export async function confirmDemoBooking(accessToken: string, coachId: string, slotStart: string, durationMinutes = 60) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (error || !client) throw error ?? new Error("Client profile not found");

  return createBooking(accessToken, {
    clientId: client.id,
    coachId,
    slotStart,
    durationMinutes,
    sessionType: "assessment",
    amountPaid: 0,
  });
}

export interface DemoSessionSummary {
  bookingId: string;
  coachId: string;
  coachName: string;
  coachPhoto: string;
  slotStart: string;
  status: "upcoming" | "completed" | "missed";
}

/** The client journey state machine's only signal of "has this client ever
 * demoed" -- deliberately a live read of `bookings` (session_type =
 * 'assessment'), not a new tracking column/table, matching this codebase's
 * existing preference for derived state over duplicated state that can
 * drift (see subscription_usage_view, pause_days_used). Returns the most
 * recent demo booking regardless of outcome; cancelled demos are excluded
 * so a client who cancelled reads as never having demoed, free to book
 * again. */
export async function getMyLatestDemoSession(accessToken: string): Promise<DemoSessionSummary | null> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (error || !client) throw error ?? new Error("Client profile not found");

  const { data, error: bookingsError } = await ctx.client
    .from("bookings")
    .select("id, scheduled_start, status, coach:coach_profiles(id, profile:profiles(full_name, photo_url))")
    .eq("client_id", client.id)
    .eq("session_type", "assessment")
    .in("status", ["upcoming", "completed", "missed"])
    .order("scheduled_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bookingsError) throw bookingsError;
  if (!data) return null;

  const coach = (data as any).coach;
  return {
    bookingId: data.id,
    coachId: coach?.id ?? "",
    coachName: coach?.profile?.full_name ?? "Coach",
    coachPhoto: coach?.profile?.photo_url ?? FALLBACK_PHOTO(data.id),
    slotStart: data.scheduled_start,
    status: data.status as "upcoming" | "completed" | "missed",
  };
}
