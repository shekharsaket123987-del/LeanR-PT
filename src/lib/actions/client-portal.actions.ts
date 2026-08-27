"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, fail, ok, runAction } from "./action-result";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getCoach, listCoaches } from "@/lib/services/coaches.service";
import {
  earliestBookableDateIST,
  findSubstituteCoachCandidates,
  getBookingWindow,
  getClientBusyDates,
  getOpenSlots,
  isSlotFreeForCoach,
  istDateString,
  istWallClockToInstant,
  SubstituteCoachCandidate,
} from "@/lib/services/scheduling.service";
import { getSubscriptionsForClient, getPauseDaysStatus, pauseSubscription, resumeSubscription } from "@/lib/services/subscriptions.service";
import { listMySales } from "@/lib/services/sales.service";
import { getAllSettings } from "@/lib/services/settings.service";
import { getMeasurementStatus } from "@/lib/services/progressLogs.service";
import {
  cancelBooking,
  countReschedulesThisWeek,
  createBooking,
  ensureZoomMeetingForBooking,
  getBooking,
  listMyBookingsAsClient,
  listMyWorkoutNotes,
  MAX_RESCHEDULES_PER_WEEK,
  RESCHEDULE_WINDOW_DAYS,
  rateBooking,
  rescheduleBooking,
} from "@/lib/services/bookings.service";
import { listMyShadowAssignmentsAsClient } from "@/lib/services/coachChange.service";

/** Swallows Zoom errors (most commonly: not configured yet) so a missing
 * Zoom setup never breaks the dashboard -- Join is additive on top of a
 * working "next session" card, not a dependency of it. */
async function tryEnsureZoomJoinUrl(token: string, bookingId: string): Promise<string | null> {
  try {
    const meeting = await ensureZoomMeetingForBooking(token, bookingId);
    return meeting?.joinUrl ?? null;
  } catch {
    return null;
  }
}

export interface CoachView {
  id: string;
  name: string;
  photo: string;
  specialization: string;
  rating: number;
}

export interface SessionView {
  id: string;
  coach: CoachView | null;
  date: string; // ISO scheduled_start
  durationMinutes: number;
  type: "assessment" | "regular";
  status: "upcoming" | "completed" | "cancelled" | "missed";
  qualityRating: number | null;
  trainerRating: number | null;
  ratingNote: string | null;
  coachNotes: string | null;
  wasRescheduled: boolean;
  originalDate: string | null;
  amountPaid: number | null;
  /** Only ever populated on the dashboard's nextSession -- other SessionView
   * call sites (session list, recentCompleted) have no use for a join link,
   * so this stays null there rather than paying for a Zoom call per row. */
  zoomJoinUrl: string | null;
  /** True when `coach` on this specific session is a temporary shadow
   * covering for the client's usual coach (an active shadow_coach_assignments
   * row matching this session's coach and date) -- without this a shadow
   * coach's name on a booking looks like a silent permanent coach change. */
  isShadowCoach: boolean;
  /** The regular/primary coach being covered, only set when isShadowCoach. */
  primaryCoachName: string | null;
}

interface ShadowAssignmentLite {
  shadowCoachId: string;
  startsOn: string;
  endsOn: string;
  primaryCoachName: string;
}

function findShadowCoverage(coachId: string | undefined, sessionDateIST: string, assignments: ShadowAssignmentLite[]): ShadowAssignmentLite | null {
  if (!coachId) return null;
  return assignments.find((a) => a.shadowCoachId === coachId && sessionDateIST >= a.startsOn && sessionDateIST <= a.endsOn) ?? null;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

function toCoachView(raw: any): CoachView | null {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.profile?.full_name ?? "Coach",
    photo: raw.profile?.photo_url ?? FALLBACK_PHOTO(raw.id),
    specialization: raw.specialization ?? "",
    rating: raw.rating ?? 0,
  };
}

function toSessionView(row: any, notesByBooking: Map<string, string>, shadowAssignments: ShadowAssignmentLite[] = []): SessionView {
  const shadowMatch = row.coach ? findShadowCoverage(row.coach.id, istDateString(row.scheduled_start), shadowAssignments) : null;
  return {
    id: row.id,
    coach: row.coach
      ? {
          id: row.coach.id,
          name: row.coach.profile?.full_name ?? "Coach",
          photo: row.coach.profile?.photo_url ?? FALLBACK_PHOTO(row.coach.id),
          specialization: "",
          rating: 0,
        }
      : null,
    date: row.scheduled_start,
    durationMinutes: row.duration_minutes,
    type: row.session_type,
    status: row.status,
    qualityRating: row.quality_rating ?? null,
    trainerRating: row.trainer_rating ?? null,
    ratingNote: row.rating_note ?? null,
    coachNotes: notesByBooking.get(row.id) ?? null,
    wasRescheduled: row.was_rescheduled ?? false,
    originalDate: row.original_scheduled_start ?? null,
    amountPaid: row.amount_paid ?? null,
    zoomJoinUrl: null,
    isShadowCoach: !!shadowMatch,
    primaryCoachName: shadowMatch?.primaryCoachName ?? null,
  };
}

async function loadMyShadowAssignments(token: string): Promise<ShadowAssignmentLite[]> {
  const rows = await listMyShadowAssignmentsAsClient(token);
  return (rows as any[]).map((r) => ({
    shadowCoachId: r.shadow_coach_id,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    primaryCoachName: r.primary_coach?.profile?.full_name ?? "your usual coach",
  }));
}

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

function weekKey(d: Date): number {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const mondayOffset = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - mondayOffset);
  return copy.getTime();
}

/** Consecutive weeks (including this one) with at least one completed
 * session — a display-only stat, not a stored/enforced value. */
function computeStreakWeeks(completedDates: string[]): number {
  const weeks = new Set(completedDates.map((d) => weekKey(new Date(d))));
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  let cursor = weekKey(new Date());
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= weekMs;
  }
  return streak;
}

export interface ClientDashboardData {
  firstName: string;
  packageName: string | null;
  subscriptionStatus: "active" | "paused" | null;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  pauseDaysAllowed: number;
  pauseDaysUsed: number;
  streakWeeks: number;
  completedCount: number;
  /** "Day N of your journey" (§3.3) -- 1-indexed days since the active
   * subscription started, falling back to account creation if no
   * subscription is active yet. */
  journeyDay: number;
  nextSession: SessionView | null;
  recentCompleted: SessionView[];
}

export async function getClientDashboardAction(): Promise<ActionResult<ClientDashboardData>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const [bookings, notes, shadowAssignments] = await Promise.all([
      listMyBookingsAsClient(token),
      listMyWorkoutNotes(token),
      loadMyShadowAssignments(token),
    ]);
    const notesByBooking = new Map(notes.map((n: any) => [n.booking_id, n.notes as string]));

    const upcoming = bookings.filter((b: any) => b.status === "upcoming").sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
    const completed = bookings.filter((b: any) => b.status === "completed");

    let nextSession: SessionView | null = null;
    if (upcoming[0]) {
      nextSession = toSessionView(upcoming[0], notesByBooking, shadowAssignments);
      // Enrich with fuller coach display data than the booking list embed carries.
      if (nextSession.coach) {
        const fullCoach = toCoachView(await getCoach(token, nextSession.coach.id));
        if (fullCoach) nextSession.coach = fullCoach;
      }
      nextSession.zoomJoinUrl = await tryEnsureZoomJoinUrl(token, nextSession.id);
    }

    // Matches "active" OR "paused" -- a currently-paused plan is still the
    // client's live plan; filtering to "active" only meant a paused
    // client's dashboard showed "No active package" and 0 sessions instead
    // of their own (paused) plan's real numbers.
    const subscriptions = await getSubscriptionsForClient(token, client.id);
    const liveSub = (subscriptions as any[]).find((s) => s.status === "active" || s.status === "paused") ?? null;
    const pauseDays = liveSub ? await getPauseDaysStatus(token, liveSub.id) : null;

    const journeyStart = new Date(liveSub?.started_at ?? (client as any).joined_date);
    const journeyDay = Math.max(1, Math.floor((Date.now() - journeyStart.getTime()) / 86_400_000) + 1);

    return {
      firstName: (client as any).profile?.full_name?.split(" ")[0] ?? "there",
      packageName: liveSub?.package?.name ?? null,
      subscriptionStatus: liveSub?.status ?? null,
      sessionsTotal: liveSub?.sessions_total ?? 0,
      sessionsUsed: liveSub?.usage?.sessions_used ?? 0,
      sessionsRemaining: liveSub?.usage?.sessions_remaining ?? 0,
      pauseDaysAllowed: pauseDays?.pauseDaysAllowed ?? 0,
      pauseDaysUsed: pauseDays?.pauseDaysUsed ?? 0,
      streakWeeks: computeStreakWeeks(completed.map((b: any) => b.scheduled_start)),
      completedCount: completed.length,
      journeyDay,
      nextSession,
      recentCompleted: completed
        .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
        .slice(0, 3)
        .map((b: any) => toSessionView(b, notesByBooking, shadowAssignments)),
    };
  });
}

export async function getClientSessionsAction(): Promise<ActionResult<SessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [bookings, notes, shadowAssignments] = await Promise.all([
      listMyBookingsAsClient(token),
      listMyWorkoutNotes(token),
      loadMyShadowAssignments(token),
    ]);
    const notesByBooking = new Map(notes.map((n: any) => [n.booking_id, n.notes as string]));
    return (bookings as any[]).map((b) => toSessionView(b, notesByBooking, shadowAssignments));
  });
}

export async function cancelSessionAction(bookingId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await cancelBooking(token, bookingId);
    return null;
  });
}

export async function rateSessionAction(
  bookingId: string,
  qualityRating: number,
  trainerRating: number,
  note?: string
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rateBooking(token, bookingId, { qualityRating, trainerRating, note });
    return null;
  });
}

export interface BookingOptions {
  coach: CoachView;
  isFirstSession: boolean;
  sessionType: "assessment" | "regular";
  durationMinutes: number;
  slots: { start: string; end: string }[];
}

export async function getBookingOptionsAction(): Promise<ActionResult<BookingOptions>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);
    if (!coachId) {
      throw new Error("No coach is assigned to your account yet — contact support to get started.");
    }
    const coach = toCoachView(await getCoach(token, coachId));
    if (!coach) throw new Error("Assigned coach not found");

    const bookings = await listMyBookingsAsClient(token);
    const isFirstSession = bookings.length === 0;
    const sessionType: "assessment" | "regular" = isFirstSession ? "assessment" : "regular";
    const durationMinutes = isFirstSession ? 60 : 45;

    // Same-day booking is never offered -- the earliest selectable slot is
    // always tomorrow (IST), regardless of how many hours are left today.
    const fromDateStr = earliestBookableDateIST();
    const to = new Date(`${fromDateStr}T00:00:00Z`);
    to.setUTCDate(to.getUTCDate() + 14);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const rawSlots = await getOpenSlots(token, coachId, fromDateStr, fmt(to), durationMinutes);
    const slots = rawSlots.slice(0, 20);

    return { coach, isFirstSession, sessionType, durationMinutes, slots };
  });
}

export async function confirmBookingAction(input: {
  slotStart: string;
  durationMinutes: number;
  sessionType: "assessment" | "regular";
}): Promise<ActionResult<{ bookingId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);

    const { isStale } = await getMeasurementStatus(token, client.id);
    if (isStale) {
      throw new Error("Please update your measurements before booking a session.");
    }

    const coachId = await getMyCurrentCoachId(token);
    if (!coachId) throw new Error("No coach is assigned to your account yet — contact support to get started.");

    let subscriptionId: string | undefined;
    if (input.sessionType === "regular") {
      const subscriptions = await getSubscriptionsForClient(token, client.id);
      const activeSub = (subscriptions as any[]).find((s) => s.status === "active");
      if (!activeSub) throw new Error("No active subscription found — a package must be purchased before booking a regular session.");
      subscriptionId = activeSub.id;
    }

    const bookingId = await createBooking(token, {
      clientId: client.id,
      coachId,
      slotStart: input.slotStart,
      durationMinutes: input.durationMinutes,
      subscriptionId,
      sessionType: input.sessionType,
    });

    return { bookingId };
  });
}

export interface RescheduleOptions {
  coach: CoachView;
  durationMinutes: number;
  slots: { start: string; end: string }[];
  reschedulesUsedThisWeek: number;
  reschedulesRemaining: number;
  cutoffHours: number;
  /** Booking-window hours, so the "specific date & time" input only ever
   * offers the whole-hour times the platform actually schedules on. */
  startHour: number;
  endHour: number;
}

export async function getRescheduleOptionsAction(bookingId: string): Promise<ActionResult<RescheduleOptions>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const booking: any = await getBooking(token, bookingId);
    if (booking.client?.id !== client.id) throw new Error("Not your session");
    if (booking.status !== "upcoming") throw new Error("Only upcoming sessions can be rescheduled");

    const settings = await getAllSettings(token);
    const cutoffHours = Number(settings.find((s) => s.key === "reschedule_cutoff_hours")?.value ?? 1);
    const hoursUntil = (new Date(booking.scheduled_start).getTime() - Date.now()) / 3600000;
    if (hoursUntil < cutoffHours) {
      throw new Error(`Too close to the session start to reschedule (cutoff is ${cutoffHours} hour${cutoffHours === 1 ? "" : "s"}).`);
    }

    const usedThisWeek = await countReschedulesThisWeek(token, client.id);
    const remaining = Math.max(0, MAX_RESCHEDULES_PER_WEEK - usedThisWeek);
    if (remaining <= 0) {
      throw new Error("You have already used your maximum reschedule limit for this week.");
    }

    const coach = toCoachView(booking.coach);
    if (!coach) throw new Error("Coach not found");

    const now = new Date();
    const windowEnd = new Date(now.getTime() + RESCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const [rawSlots, busyDates, { startHour, endHour }] = await Promise.all([
      getOpenSlots(token, coach.id, fmt(now), fmt(windowEnd), booking.duration_minutes),
      getClientBusyDates(token, client.id, bookingId),
      getBookingWindow(token),
    ]);
    const nowMs = now.getTime();
    const windowEndMs = windowEnd.getTime();
    const slots = rawSlots.filter((s) => {
      const startMs = new Date(s.start).getTime();
      if (startMs <= nowMs || startMs >= windowEndMs) return false;
      return !busyDates.has(istDateString(s.start));
    });

    return {
      coach,
      durationMinutes: booking.duration_minutes,
      slots,
      reschedulesUsedThisWeek: usedThisWeek,
      reschedulesRemaining: remaining,
      cutoffHours,
      startHour,
      endHour,
    };
  });
}

export interface CoachClosestSlot {
  coachId: string;
  coachName: string;
  isOwnCoach: boolean;
  start: string;
  end: string;
}

/** Backs the RescheduleModal's "Fastest Available" list -- rather than the
 * client guessing a date/time and checking it one at a time (the old
 * checkRescheduleTimeAction-only flow), this proactively finds each active
 * coach's own SOONEST open slot in the reschedule window and hands back the
 * whole list sorted earliest-first, so "closest available with my coach" vs
 * "closest available with someone else" is visible at a glance. Reuses
 * getOpenSlots() per coach -- same source of truth getRescheduleOptionsAction
 * already uses for the own-coach grid, just run once per active coach. */
export async function getClosestSlotsPerCoachAction(bookingId: string): Promise<ActionResult<CoachClosestSlot[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const booking: any = await getBooking(token, bookingId);
    if (booking.client?.id !== client.id) throw new Error("Not your session");
    if (booking.status !== "upcoming") throw new Error("Only upcoming sessions can be rescheduled");

    const now = new Date();
    const windowEnd = new Date(now.getTime() + RESCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const nowMs = now.getTime();
    const windowEndMs = windowEnd.getTime();

    const [allCoaches, busyDates] = await Promise.all([listCoaches(token), getClientBusyDates(token, client.id, bookingId)]);
    const activeCoaches = (allCoaches as any[]).filter((c) => c.status === "active");

    const results = await Promise.all(
      activeCoaches.map(async (c): Promise<CoachClosestSlot | null> => {
        const rawSlots = await getOpenSlots(token, c.id, fmt(now), fmt(windowEnd), booking.duration_minutes);
        const nextFree = rawSlots.find((s) => {
          const startMs = new Date(s.start).getTime();
          if (startMs <= nowMs || startMs >= windowEndMs) return false;
          return !busyDates.has(istDateString(s.start));
        });
        if (!nextFree) return null;
        return {
          coachId: c.id,
          coachName: c.profile?.full_name ?? "Coach",
          isOwnCoach: c.id === booking.coach_id,
          start: nextFree.start,
          end: nextFree.end,
        };
      })
    );

    return results.filter((r): r is CoachClosestSlot => r !== null).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  });
}

export async function rescheduleSessionAction(bookingId: string, newStart: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rescheduleBooking(token, bookingId, newStart);
    return null;
  });
}

export interface RescheduleTimeCheck {
  /** Resolved ISO instant for the requested IST date+time -- handed back so
   * the client only ever sends the exact instant this check ran against to
   * rescheduleSessionAction/rescheduleSessionToSubstituteAction, rather than
   * re-deriving it (and risking drift) from the raw date/time inputs twice. */
  desiredStart: string;
  available: boolean;
  /** Populated only when `available` is false -- other coaches free at this
   * exact instant, so the client can assign one just for this one session. */
  candidates: SubstituteCoachCandidate[];
}

/** Backs the RescheduleModal's "prefer a specific date & time?" input --
 * used when the client wants a slot that isn't already in the pre-computed
 * open-slots grid (e.g. it's not free with their own coach). desiredDate/
 * desiredTime are IST wall-clock ("YYYY-MM-DD"/"HH:MM"), same convention as
 * every other booking-time input in the app. */
export async function checkRescheduleTimeAction(bookingId: string, desiredDate: string, desiredTime: string): Promise<ActionResult<RescheduleTimeCheck>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const booking: any = await getBooking(token, bookingId);
    if (booking.client?.id !== client.id) throw new Error("Not your session");
    if (booking.status !== "upcoming") throw new Error("Only upcoming sessions can be rescheduled");

    const desiredStart = istWallClockToInstant(desiredDate, desiredTime).toISOString();
    if (new Date(desiredStart).getTime() <= Date.now()) {
      throw new Error("Pick a time in the future.");
    }
    const busyDates = await getClientBusyDates(token, client.id, bookingId);
    if (busyDates.has(istDateString(desiredStart))) {
      throw new Error("You already have another session booked on that day.");
    }

    const freeWithOwnCoach = await isSlotFreeForCoach(token, booking.coach_id, desiredStart, booking.duration_minutes);
    if (freeWithOwnCoach) return { desiredStart, available: true, candidates: [] };

    const candidates = await findSubstituteCoachCandidates(token, {
      excludeCoachId: booking.coach_id,
      slotStart: desiredStart,
      durationMinutes: booking.duration_minutes,
    });
    return { desiredStart, available: false, candidates };
  });
}

/** Commits the one-off substitute-coach fallback from checkRescheduleTimeAction
 * -- moves just this booking, leaving the client's recurring pattern (and
 * therefore every future occurrence) pointed at their original coach. */
export async function rescheduleSessionToSubstituteAction(bookingId: string, newStart: string, substituteCoachId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rescheduleBooking(token, bookingId, newStart, undefined, substituteCoachId);
    return null;
  });
}

export interface SchedulingRules {
  cancellationCutoffHours: number;
  rescheduleCutoffHours: number;
  reschedulesUsedThisWeek: number;
  reschedulesRemaining: number;
}

/** Backs the "Cancellable until.../Reschedulable until..." and "X of 2 used
 * this week" display on My Sessions (Cancellation Policy PRD §6) -- a
 * lightweight companion to getClientSessionsAction() rather than folded into
 * it, so the sessions list's return shape doesn't change for existing callers. */
export async function getSchedulingRulesAction(): Promise<ActionResult<SchedulingRules>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const settings = await getAllSettings(token);
    const cancellationCutoffHours = Number(settings.find((s) => s.key === "cancellation_cutoff_hours")?.value ?? 12);
    const rescheduleCutoffHours = Number(settings.find((s) => s.key === "reschedule_cutoff_hours")?.value ?? 1);
    const reschedulesUsedThisWeek = await countReschedulesThisWeek(token, client.id);
    return {
      cancellationCutoffHours,
      rescheduleCutoffHours,
      reschedulesUsedThisWeek,
      reschedulesRemaining: Math.max(0, MAX_RESCHEDULES_PER_WEEK - reschedulesUsedThisWeek),
    };
  });
}

export interface MySubscriptionView {
  subscriptionId: string | null;
  status: "active" | "paused" | null;
  packageName: string | null;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  pauseDaysAllowed: number;
  pauseDaysUsed: number;
  payments: { saleDate: string; packageName: string; amount: number }[];
}

/** Subscription & Payments tab (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §3.11) --
 * session tracking already existed on the dashboard; this adds the pieces
 * that didn't: pause-days remaining (getPauseDaysStatus, RLS-scoped so it
 * works unmodified for a client caller), a payment ledger (sales_view via
 * listMySales, same view the admin sales list uses), and enough (status,
 * subscriptionId) for the portal to render its own Pause/Resume control.
 * Matches "active" OR "paused" -- a currently-paused plan is still the
 * client's live plan, not nothing; filtering to "active" only (as this used
 * to) meant a paused client saw "No active plan" instead of their own
 * paused one. */
export async function getMySubscriptionAction(): Promise<ActionResult<MySubscriptionView>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const [subscriptions, sales] = await Promise.all([getSubscriptionsForClient(token, client.id), listMySales(token)]);

    const liveSub: any = (subscriptions as any[]).find((s) => s.status === "active" || s.status === "paused") ?? null;
    const pauseDays = liveSub ? await getPauseDaysStatus(token, liveSub.id) : null;

    return {
      subscriptionId: liveSub?.id ?? null,
      status: liveSub?.status ?? null,
      packageName: liveSub?.package?.name ?? null,
      sessionsTotal: liveSub?.sessions_total ?? 0,
      sessionsUsed: liveSub?.usage?.sessions_used ?? 0,
      sessionsRemaining: liveSub?.usage?.sessions_remaining ?? 0,
      pauseDaysAllowed: pauseDays?.pauseDaysAllowed ?? 0,
      pauseDaysUsed: pauseDays?.pauseDaysUsed ?? 0,
      payments: (sales as any[])
        .map((s) => ({ saleDate: s.sale_date, packageName: s.package_name, amount: Number(s.amount ?? 0) }))
        .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()),
    };
  });
}

export async function pauseMySubscriptionAction(subscriptionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await pauseSubscription(token, subscriptionId);
    return null;
  });
}

export async function resumeMySubscriptionAction(subscriptionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await resumeSubscription(token, subscriptionId);
    return null;
  });
}
