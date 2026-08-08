"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, fail, ok, runAction } from "./action-result";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getCoach } from "@/lib/services/coaches.service";
import { getOpenSlots } from "@/lib/services/scheduling.service";
import { getSubscriptionsForClient, getPauseDaysStatus } from "@/lib/services/subscriptions.service";
import { listMySales } from "@/lib/services/sales.service";
import { getAllSettings } from "@/lib/services/settings.service";
import { getMeasurementStatus } from "@/lib/services/progressLogs.service";
import {
  cancelBooking,
  countReschedulesThisWeek,
  createBooking,
  endOfWeekUTC,
  ensureZoomMeetingForBooking,
  getBooking,
  listMyBookingsAsClient,
  listMyWorkoutNotes,
  MAX_RESCHEDULES_PER_WEEK,
  rateBooking,
  rescheduleBooking,
} from "@/lib/services/bookings.service";

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

function toSessionView(row: any, notesByBooking: Map<string, string>): SessionView {
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
  };
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
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
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
    const bookings = await listMyBookingsAsClient(token);
    const notes = await listMyWorkoutNotes(token);
    const notesByBooking = new Map(notes.map((n: any) => [n.booking_id, n.notes as string]));

    const upcoming = bookings.filter((b: any) => b.status === "upcoming").sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
    const completed = bookings.filter((b: any) => b.status === "completed");

    let nextSession: SessionView | null = null;
    if (upcoming[0]) {
      nextSession = toSessionView(upcoming[0], notesByBooking);
      // Enrich with fuller coach display data than the booking list embed carries.
      if (nextSession.coach) {
        const fullCoach = toCoachView(await getCoach(token, nextSession.coach.id));
        if (fullCoach) nextSession.coach = fullCoach;
      }
      nextSession.zoomJoinUrl = await tryEnsureZoomJoinUrl(token, nextSession.id);
    }

    const subscriptions = await getSubscriptionsForClient(token, client.id);
    const activeSub = (subscriptions as any[]).find((s) => s.status === "active") ?? null;

    const journeyStart = new Date(activeSub?.started_at ?? (client as any).joined_date);
    const journeyDay = Math.max(1, Math.floor((Date.now() - journeyStart.getTime()) / 86_400_000) + 1);

    return {
      firstName: (client as any).profile?.full_name?.split(" ")[0] ?? "there",
      packageName: activeSub?.package?.name ?? null,
      sessionsTotal: activeSub?.sessions_total ?? 0,
      sessionsUsed: activeSub?.usage?.sessions_used ?? 0,
      sessionsRemaining: activeSub?.usage?.sessions_remaining ?? 0,
      streakWeeks: computeStreakWeeks(completed.map((b: any) => b.scheduled_start)),
      completedCount: completed.length,
      journeyDay,
      nextSession,
      recentCompleted: completed
        .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
        .slice(0, 3)
        .map((b: any) => toSessionView(b, notesByBooking)),
    };
  });
}

export async function getClientSessionsAction(): Promise<ActionResult<SessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [bookings, notes] = await Promise.all([listMyBookingsAsClient(token), listMyWorkoutNotes(token)]);
    const notesByBooking = new Map(notes.map((n: any) => [n.booking_id, n.notes as string]));
    return (bookings as any[]).map((b) => toSessionView(b, notesByBooking));
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

    const from = new Date();
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const rawSlots = await getOpenSlots(token, coachId, fmt(from), fmt(to), durationMinutes);
    const now = Date.now();
    const slots = rawSlots.filter((s) => new Date(s.start).getTime() > now).slice(0, 20);

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
    const weekEnd = endOfWeekUTC(now);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const rawSlots = await getOpenSlots(token, coach.id, fmt(now), fmt(weekEnd), booking.duration_minutes);
    const nowMs = now.getTime();
    const weekEndMs = weekEnd.getTime();
    const slots = rawSlots.filter((s) => {
      const startMs = new Date(s.start).getTime();
      return startMs > nowMs && startMs < weekEndMs;
    });

    return {
      coach,
      durationMinutes: booking.duration_minutes,
      slots,
      reschedulesUsedThisWeek: usedThisWeek,
      reschedulesRemaining: remaining,
      cutoffHours,
    };
  });
}

export async function rescheduleSessionAction(bookingId: string, newStart: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rescheduleBooking(token, bookingId, newStart);
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
  packageName: string | null;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  pauseDaysAllowed: number;
  pauseDaysUsed: number;
  payments: { saleDate: string; packageName: string; amount: number }[];
}

/** Subscription & Payments tab (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §3.11) --
 * session tracking already existed on the dashboard; this adds the two
 * pieces that didn't: pause-days remaining (getPauseDaysStatus, RLS-scoped
 * so it works unmodified for a client caller) and a payment ledger
 * (sales_view via listMySales, same view the admin sales list uses). */
export async function getMySubscriptionAction(): Promise<ActionResult<MySubscriptionView>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const [subscriptions, sales] = await Promise.all([getSubscriptionsForClient(token, client.id), listMySales(token)]);

    const activeSub: any = (subscriptions as any[]).find((s) => s.status === "active") ?? null;
    const pauseDays = activeSub ? await getPauseDaysStatus(token, activeSub.id) : null;

    return {
      packageName: activeSub?.package?.name ?? null,
      sessionsTotal: activeSub?.sessions_total ?? 0,
      sessionsUsed: activeSub?.usage?.sessions_used ?? 0,
      sessionsRemaining: activeSub?.usage?.sessions_remaining ?? 0,
      pauseDaysAllowed: pauseDays?.pauseDaysAllowed ?? 0,
      pauseDaysUsed: pauseDays?.pauseDaysUsed ?? 0,
      payments: (sales as any[])
        .map((s) => ({ saleDate: s.sale_date, packageName: s.package_name, amount: Number(s.amount ?? 0) }))
        .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()),
    };
  });
}
