"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, fail, ok, runAction } from "./action-result";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getCoach } from "@/lib/services/coaches.service";
import { getOpenSlots } from "@/lib/services/scheduling.service";
import { getSubscriptionsForClient } from "@/lib/services/subscriptions.service";
import {
  cancelBooking,
  createBooking,
  listMyBookingsAsClient,
  listMyWorkoutNotes,
  rateBooking,
} from "@/lib/services/bookings.service";

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
  rating: number | null;
  feedback: string | null;
  coachNotes: string | null;
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
    rating: row.rating ?? null,
    feedback: row.client_feedback ?? null,
    coachNotes: notesByBooking.get(row.id) ?? null,
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
    }

    const subscriptions = await getSubscriptionsForClient(token, client.id);
    const activeSub = (subscriptions as any[]).find((s) => s.status === "active") ?? null;

    return {
      firstName: (client as any).profile?.full_name?.split(" ")[0] ?? "there",
      packageName: activeSub?.package?.name ?? null,
      sessionsTotal: activeSub?.sessions_total ?? 0,
      sessionsUsed: activeSub?.usage?.sessions_used ?? 0,
      sessionsRemaining: activeSub?.usage?.sessions_remaining ?? 0,
      streakWeeks: computeStreakWeeks(completed.map((b: any) => b.scheduled_start)),
      completedCount: completed.length,
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

export async function rateSessionAction(bookingId: string, rating: number, feedback?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rateBooking(token, bookingId, rating, feedback);
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
