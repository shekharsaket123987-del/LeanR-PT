"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { calculateBmi } from "@/lib/utils";
import { getMyProfile } from "@/lib/services/profiles.service";
import { getClientProfileById, listMyClients, searchAllClients } from "@/lib/services/clients.service";
import { getMyCoachProfile } from "@/lib/services/coaches.service";
import {
  AvailabilityWindow,
  getMyAvailability,
  getMyLeaveRequests,
  requestLeave,
  RequestLeaveInput,
} from "@/lib/services/availability.service";
import { listEscalationsForCoach, countUnresolvedEscalationsForCoach } from "@/lib/services/escalations.service";
import { getMyCoachPerformance, CoachPerformance } from "@/lib/services/coachPerformance.service";
import { listMyShadowAssignments } from "@/lib/services/coachChange.service";
import { getOnboardingForClient } from "@/lib/services/onboarding.service";
import { getSubscriptionsForClient } from "@/lib/services/subscriptions.service";
import { ClientStatus, getClientStatusSnapshot } from "@/lib/services/clientStatus";
import { listProgressLogsForClient, isMeasurementStale } from "@/lib/services/progressLogs.service";
import { listClientTimeline, TimelineEventRow } from "@/lib/services/timeline.service";
import {
  ensureZoomMeetingForBooking,
  getAttendanceForBooking,
  getBooking,
  getWorkoutNoteForBooking,
  listAttendanceForBookings,
  listCancelledBookingsForCoach,
  listMyBookingsAsCoach,
  listRescheduledBookingsForCoach,
  listWorkoutNotesForBookings,
  listWorkoutNotesForClient,
  markAttendance,
  markSessionJoined,
  submitSessionNotes,
  sweepOverdueAttendance,
  sweepOverdueNotes,
} from "@/lib/services/bookings.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface CoachSessionView {
  id: string;
  client: { id: string; name: string; photo: string } | null;
  date: string;
  durationMinutes: number;
  type: "assessment" | "regular";
  status: "upcoming" | "completed" | "cancelled" | "missed";
  amountPaid: number | null;
}

function toCoachSessionView(row: any): CoachSessionView {
  return {
    id: row.id,
    client: row.client
      ? { id: row.client.id, name: row.client.profile?.full_name ?? "Client", photo: row.client.profile?.photo_url ?? FALLBACK_PHOTO(row.client.id) }
      : null,
    date: row.scheduled_start,
    durationMinutes: row.duration_minutes,
    type: row.session_type,
    status: row.status,
    amountPaid: row.amount_paid ?? null,
  };
}

export interface CoachDashboardData {
  firstName: string;
  utilization: number;
  todayCount: number;
  thisWeekCount: number;
  completedCount: number;
  missedCount: number;
  /** AVG(trainer_rating) across the coach's own rated bookings -- the
   * trainer-specific dimension, not session quality (§1.1's recommended
   * choice once §3.7 split the two). */
  avgRating: number;
  activeEscalationsCount: number;
  recentClients: { id: string; name: string; photo: string; sessionsRemaining: number | null }[];
}

export async function getCoachDashboardAction(): Promise<ActionResult<CoachDashboardData>> {
  return runAction(async () => {
    const token = await requireToken();
    const [profile, coachProfile, bookings, clients] = await Promise.all([
      getMyProfile(token),
      getMyCoachProfile(token),
      listMyBookingsAsCoach(token),
      listMyClients(token),
    ]);
    const utilization = (coachProfile as any).utilization?.utilization_pct ?? 0;

    const today = new Date().toDateString();
    const todayCount = (bookings as any[]).filter((b) => new Date(b.scheduled_start).toDateString() === today && b.status === "upcoming").length;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeekCount = (bookings as any[]).filter((b) => new Date(b.scheduled_start) >= startOfWeek).length;
    const completedCount = (bookings as any[]).filter((b) => b.status === "completed").length;
    const missedCount = (bookings as any[]).filter((b) => b.status === "missed").length;

    const ratedBookings = (bookings as any[]).filter((b) => b.trainer_rating != null);
    const avgRating =
      ratedBookings.length > 0 ? Math.round((ratedBookings.reduce((s, b) => s + b.trainer_rating, 0) / ratedBookings.length) * 10) / 10 : 0;

    const escalations = await listEscalationsForCoach(token, (coachProfile as any).id);
    const activeEscalationsCount = (escalations as any[]).filter((e) => e.status !== "resolved").length;

    return {
      firstName: profile.full_name?.split(" ")[0] ?? "there",
      utilization,
      todayCount,
      thisWeekCount,
      completedCount,
      missedCount,
      avgRating,
      activeEscalationsCount,
      recentClients: (clients as any[]).slice(0, 3).map((c) => ({
        id: c.id,
        name: c.profile?.full_name ?? "Client",
        photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
        sessionsRemaining: null,
      })),
    };
  });
}

export async function getCoachScheduleAction(): Promise<ActionResult<CoachSessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const bookings = await listMyBookingsAsCoach(token);
    return (bookings as any[]).filter((b) => b.status === "upcoming" || b.status === "completed").map(toCoachSessionView);
  });
}

interface CoachRosterBase {
  bookingId: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  clientPhoto: string;
  packageName: string | null;
  scheduledStart: string;
  durationMinutes: number;
  /** True if this booking's client isn't normally this coach's own -- they're
   * covering as a shadow coach (§4.2.7's optional, low-priority badge; cheap
   * once shadow_coach_assignments already exists). */
  isShadowSession: boolean;
  /** Set the moment the coach clicks Join -- the "joined by coach" half of
   * the attendance gate (bookings.service.ts::markAttendance). Null until then. */
  coachJoinedAt: string | null;
}

/** Active shadow_coach_assignments for the caller, as a (clientId, dateStr) ->
 * boolean checker -- built once per action call and reused across every
 * booking being mapped, rather than a query per row. */
async function buildShadowSessionChecker(token: string) {
  const assignments = await listMyShadowAssignments(token);
  const active = (assignments as any[]).filter((a) => a.status === "active");
  return (clientId: string, scheduledStart: string) => {
    const dateStr = scheduledStart.slice(0, 10);
    return active.some((a) => a.client?.id === clientId && dateStr >= a.starts_on && dateStr <= a.ends_on);
  };
}

/** Shared "booking row + matching client row -> display shape" merge, used
 * by both Today's Tasks and the Upcoming (3-day) widget -- clients.service.ts's
 * listMyClients() is the source of client_code/activeSubscription, which
 * listMyBookingsAsCoach()'s own client embed doesn't carry. */
function toCoachRosterBase(
  booking: any,
  clientById: Map<string, any>,
  isShadowSession: (clientId: string, scheduledStart: string) => boolean = () => false
): CoachRosterBase {
  const client = clientById.get(booking.client?.id);
  const clientId = booking.client?.id ?? "";
  return {
    bookingId: booking.id,
    clientId,
    clientCode: client?.client_code ?? "",
    clientName: booking.client?.profile?.full_name ?? "Client",
    clientPhoto: booking.client?.profile?.photo_url ?? FALLBACK_PHOTO(booking.client?.id ?? booking.id),
    packageName: client?.activeSubscription?.package?.name ?? null,
    scheduledStart: booking.scheduled_start,
    durationMinutes: booking.duration_minutes,
    isShadowSession: isShadowSession(clientId, booking.scheduled_start),
    coachJoinedAt: booking.coach_joined_at ?? null,
  };
}

export interface CoachTodayTaskView extends CoachRosterBase {
  attendanceStatus: "present" | "absent" | "late" | null;
  notesSubmitted: boolean;
  overdue: boolean;
  /** True once flag_overdue_notes() has flagged this booking: attendance was
   * marked present/late but notes still weren't submitted 2+ hours after the
   * session ended. Distinct from `overdue` (which is attendance-only, and by
   * construction never true at the same time as this -- see
   * bookings.service.ts::sweepOverdueNotes). */
  notesOverdue: boolean;
  /** Host-privilege Zoom link, created lazily the first time a session
   * still needing attendance is loaded here. Null if Zoom isn't configured
   * yet (ensureZoomMeetingForBooking's error is swallowed, not thrown, so a
   * missing Zoom setup never breaks this widget) or the session is already
   * closed out. */
  zoomStartUrl: string | null;
}

/** Swallows Zoom errors (most commonly: not configured yet) rather than
 * letting one booking's Zoom failure break the whole widget it's called
 * from -- Join is a nice-to-have on top of a working dashboard, not a
 * dependency of it. */
async function tryEnsureZoomStartUrl(token: string, bookingId: string): Promise<string | null> {
  try {
    const meeting = await ensureZoomMeetingForBooking(token, bookingId);
    return meeting?.startUrl ?? null;
  } catch {
    return null;
  }
}

/** Today's Tasks widget (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.3): every one
 * of the coach's own sessions scheduled today that's still "upcoming" --
 * status only flips to completed/missed once notes are submitted or
 * attendance is marked absent, so this naturally covers both "hasn't
 * happened yet" (join countdown) and "happened, still needs
 * attendance/notes" rows without a separate query for each. Also runs the
 * 2-hour overdue sweep on load so the highlight/notification stay current. */
export async function getCoachTodayTasksAction(): Promise<ActionResult<CoachTodayTaskView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    await Promise.all([sweepOverdueAttendance(token), sweepOverdueNotes(token)]);

    const [bookings, clients, isShadowSession] = await Promise.all([
      listMyBookingsAsCoach(token),
      listMyClients(token),
      buildShadowSessionChecker(token),
    ]);
    const today = new Date().toDateString();
    const todays = (bookings as any[])
      .filter((b) => b.status === "upcoming" && new Date(b.scheduled_start).toDateString() === today)
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    const bookingIds = todays.map((b) => b.id);
    const [attendanceRows, noteRows] = await Promise.all([
      listAttendanceForBookings(token, bookingIds),
      listWorkoutNotesForBookings(token, bookingIds),
    ]);
    const attendanceByBooking = new Map((attendanceRows as any[]).map((a) => [a.booking_id, a.status]));
    const notesSubmittedSet = new Set((noteRows as any[]).map((n) => n.booking_id));
    const clientById = new Map((clients as any[]).map((c) => [c.id, c]));

    // Only sessions without attendance marked yet can still be "joined" --
    // once attendance is in, the row is about notes, not the call.
    const zoomStartUrlByBooking = new Map(
      await Promise.all(
        todays
          .filter((b) => !attendanceByBooking.has(b.id))
          .map(async (b) => [b.id, await tryEnsureZoomStartUrl(token, b.id)] as const)
      )
    );

    return todays.map((b) => ({
      ...toCoachRosterBase(b, clientById, isShadowSession),
      attendanceStatus: attendanceByBooking.get(b.id) ?? null,
      notesSubmitted: notesSubmittedSet.has(b.id),
      overdue: b.attendance_overdue ?? false,
      notesOverdue: b.notes_overdue ?? false,
      zoomStartUrl: zoomStartUrlByBooking.get(b.id) ?? null,
    }));
  });
}

export type CoachUpcomingView = CoachRosterBase;

/** Upcoming Sessions widget (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.4): the
 * next 3 days, deliberately excluding today (Today's Tasks already covers
 * that, including the same-day join countdown). Reuses the exact same
 * booking+client data getCoachScheduleAction/getCoachTodayTasksAction
 * already fetch -- just a different date filter and no attendance fields. */
export async function getCoachUpcoming3DaysAction(): Promise<ActionResult<CoachUpcomingView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [bookings, clients, isShadowSession] = await Promise.all([
      listMyBookingsAsCoach(token),
      listMyClients(token),
      buildShadowSessionChecker(token),
    ]);

    const startOfTomorrow = new Date();
    startOfTomorrow.setHours(0, 0, 0, 0);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const endOfWindow = new Date(startOfTomorrow);
    endOfWindow.setDate(endOfWindow.getDate() + 3);

    const upcoming = (bookings as any[])
      .filter((b) => {
        if (b.status !== "upcoming") return false;
        const start = new Date(b.scheduled_start);
        return start >= startOfTomorrow && start < endOfWindow;
      })
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    const clientById = new Map((clients as any[]).map((c) => [c.id, c]));
    return upcoming.map((b) => toCoachRosterBase(b, clientById, isShadowSession));
  });
}

/** Pending Tasks widget (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.6): past
 * sessions from ANY day (not just today -- Today's Tasks already covers
 * today's own backlog) still missing attendance or notes. A pure derived
 * query, re-run on every load rather than backed by a stored "pending" flag
 * -- status === 'upcoming' with scheduled_start already in the past is
 * *exactly* "attendance IS NULL OR (present AND notes missing)" by
 * construction: markAttendance('absent') flips status to 'missed'
 * immediately, and submitSessionNotes() (which requires attendance=present)
 * flips it to 'completed', so a booking can only still be 'upcoming' past
 * its own end time if one of those two hasn't happened yet. A row
 * disappears the moment both are saved because it stops matching this same
 * filter, with nothing separate to fall out of sync. */
export async function getCoachPendingTasksAction(): Promise<ActionResult<CoachTodayTaskView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    await Promise.all([sweepOverdueAttendance(token), sweepOverdueNotes(token)]);

    const [bookings, clients, isShadowSession] = await Promise.all([
      listMyBookingsAsCoach(token),
      listMyClients(token),
      buildShadowSessionChecker(token),
    ]);
    const now = Date.now();
    const overdueBookings = (bookings as any[])
      .filter((b) => b.status === "upcoming" && new Date(b.scheduled_start).getTime() < now)
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    const bookingIds = overdueBookings.map((b) => b.id);
    const [attendanceRows, noteRows] = await Promise.all([
      listAttendanceForBookings(token, bookingIds),
      listWorkoutNotesForBookings(token, bookingIds),
    ]);
    const attendanceByBooking = new Map((attendanceRows as any[]).map((a) => [a.booking_id, a.status]));
    const notesSubmittedSet = new Set((noteRows as any[]).map((n) => n.booking_id));
    const clientById = new Map((clients as any[]).map((c) => [c.id, c]));

    return overdueBookings.map((b) => ({
      ...toCoachRosterBase(b, clientById, isShadowSession),
      attendanceStatus: attendanceByBooking.get(b.id) ?? null,
      notesSubmitted: notesSubmittedSet.has(b.id),
      overdue: b.attendance_overdue ?? false,
      notesOverdue: b.notes_overdue ?? false,
      // These sessions are already in the past -- there's nothing to join.
      zoomStartUrl: null,
    }));
  });
}

export interface CoachClientView {
  id: string;
  clientCode: string;
  name: string;
  photo: string;
  email: string;
  goals: string[];
  medicalNotes: string | null;
  equipment: string[];
  joinedDate: string;
  packageName: string | null;
  days: number[];
  startTime: string | null;
  sessionsCompleted: number;
  sessionsPurchased: number;
  status: ClientStatus;
  lastMeasurementAt: string | null;
  measurementsStale: boolean;
}

export async function getCoachClientsAction(): Promise<ActionResult<CoachClientView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [clients, bookings] = await Promise.all([listMyClients(token), listMyBookingsAsCoach(token)]);

    const completedByClient = new Map<string, number>();
    for (const b of bookings as any[]) {
      const cid = b.client?.id;
      if (!cid) continue;
      if (b.status === "completed") completedByClient.set(cid, (completedByClient.get(cid) ?? 0) + 1);
    }

    return (clients as any[]).map((c) => ({
      id: c.id,
      clientCode: c.client_code ?? "",
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      email: "",
      goals: c.goals ?? [],
      medicalNotes: c.medical_notes,
      equipment: c.equipment ?? [],
      joinedDate: c.joined_date,
      packageName: c.activeSubscription?.package?.name ?? null,
      days: c.schedule?.days ?? [],
      startTime: c.schedule?.startTime ?? null,
      sessionsCompleted: completedByClient.get(c.id) ?? 0,
      sessionsPurchased: c.activeSubscription?.sessions_total ?? 0,
      status: c.clientStatus as ClientStatus,
      lastMeasurementAt: c.lastMeasurementAt ?? null,
      measurementsStale: isMeasurementStale(c.lastMeasurementAt ?? null),
    }));
  });
}

export interface ClientDemographics {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  fitnessGoal: string | null;
}

export interface SessionSummaryView {
  purchased: number;
  completed: number;
  remaining: number;
  upcoming: number;
}

export interface MeasurementComparison {
  label: string;
  start: number | null;
  current: number | null;
  diff: number | null;
}

/** Structurally identical to MeasurementChart's own MeasurementPoint --
 * duplicated here rather than imported so this "use server" file never
 * imports from a "use client" component module. */
export interface MeasurementPoint {
  loggedAt: string;
  weight: number | null;
  bodyFatPct: number | null;
  musclePct: number | null;
  waist: number | null;
  chest: number | null;
  hip: number | null;
  arms: number | null;
  thigh: number | null;
}

export interface CoachClientDetail extends CoachClientView {
  history: { id: string; date: string; qualityRating: number | null; trainerRating: number | null; notes: string | null }[];
  demographics: ClientDemographics | null;
  sessionSummary: SessionSummaryView;
  weeklyProgress: MeasurementComparison[];
  /** Full history for the shared MeasurementChart component (§5.3) -- reuses
   * the exact same chart used on the client's own Progress page (§3.9)
   * rather than a second implementation. */
  progressHistory: MeasurementPoint[];
  timeline: TimelineEventRow[];
  /** false when reached via Global Search (§1.5) rather than this coach's
   * own client list -- read-only in that case; billing/progress/session
   * fields are blank not because the data doesn't exist but because those
   * tables' RLS deliberately stays assignment-scoped (only client_profiles/
   * profiles/timeline were widened, migration 0033). */
  isAssignedToMe: boolean;
}

const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "body_fat_pct", label: "Fat %" },
  { key: "muscle_pct", label: "Muscle %" },
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "hip", label: "Hip" },
  { key: "arms", label: "Arms" },
  { key: "thigh", label: "Thigh" },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function getCoachClientDetailAction(clientId: string): Promise<ActionResult<CoachClientDetail>> {
  return runAction(async () => {
    const token = await requireToken();
    const [clients, bookings, notes] = await Promise.all([listMyClients(token), listMyBookingsAsCoach(token), listWorkoutNotesForClient(token, clientId)]);
    let client: any = (clients as any[]).find((c) => c.id === clientId);
    const isAssignedToMe = !!client;
    if (!client) {
      // Not one of my assigned clients -- fall back to the direct lookup
      // Global Search (§1.5) needs, now permitted by the widened RLS.
      client = await getClientProfileById(token, clientId);
    }
    if (!client) throw new Error("Client not found");

    const [onboarding, subscriptions, progressLogs, timeline, clientStatus]: [any, any[], any[], any[], ClientStatus] = await Promise.all([
      getOnboardingForClient(token, clientId),
      getSubscriptionsForClient(token, clientId),
      listProgressLogsForClient(token, clientId),
      listClientTimeline(token, clientId),
      getClientStatusSnapshot(clientId),
    ]);

    const notesByBooking = new Map((notes as any[]).map((n) => [n.booking_id, n.notes as string]));
    const clientBookings = (bookings as any[]).filter((b) => b.client?.id === clientId);
    const history = clientBookings
      .filter((b) => b.status === "completed")
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
      .map((b) => ({
        id: b.id,
        date: b.scheduled_start,
        qualityRating: b.quality_rating ?? null,
        trainerRating: b.trainer_rating ?? null,
        notes: notesByBooking.get(b.id) ?? null,
      }));

    const activeSub = subscriptions.find((s) => s.status === "active") ?? null;
    const sessionSummary: SessionSummaryView = {
      purchased: activeSub?.sessions_total ?? 0,
      completed: clientBookings.filter((b) => b.status === "completed").length,
      remaining: activeSub?.usage?.sessions_remaining ?? 0,
      upcoming: clientBookings.filter((b) => b.status === "upcoming").length,
    };

    const sortedLogs = [...progressLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    const dayOne = sortedLogs[0] ?? null;
    const latest = sortedLogs[sortedLogs.length - 1] ?? null;
    const weeklyProgress: MeasurementComparison[] = MEASUREMENT_FIELDS.map(({ key, label }) => {
      const start = dayOne?.[key] ?? null;
      const current = latest?.[key] ?? null;
      return {
        label,
        start,
        current,
        diff: start != null && current != null ? round1(current - start) : null,
      };
    });

    return {
      id: client.id,
      clientCode: client.client_code ?? "",
      name: client.profile?.full_name ?? "Client",
      photo: client.profile?.photo_url ?? FALLBACK_PHOTO(client.id),
      email: "",
      goals: client.goals ?? [],
      medicalNotes: client.medical_notes,
      equipment: client.equipment ?? [],
      joinedDate: client.joined_date,
      packageName: client.activeSubscription?.package?.name ?? null,
      days: client.schedule?.days ?? [],
      startTime: client.schedule?.startTime ?? null,
      sessionsCompleted: sessionSummary.completed,
      sessionsPurchased: sessionSummary.purchased,
      status: clientStatus,
      history,
      demographics: onboarding
        ? {
            age: onboarding.age ?? null,
            gender: onboarding.gender ?? null,
            heightCm: onboarding.height_cm ?? null,
            weightKg: onboarding.weight_kg ?? null,
            bmi: calculateBmi(onboarding.height_cm, onboarding.weight_kg),
            fitnessGoal: onboarding.fitness_goal ?? null,
          }
        : null,
      sessionSummary,
      weeklyProgress,
      progressHistory: sortedLogs.map((l: any) => ({
        loggedAt: l.logged_at,
        weight: l.weight,
        bodyFatPct: l.body_fat_pct,
        musclePct: l.muscle_pct,
        waist: l.waist,
        chest: l.chest,
        hip: l.hip,
        arms: l.arms,
        thigh: l.thigh,
      })),
      timeline: timeline as TimelineEventRow[],
      lastMeasurementAt: latest?.logged_at ?? null,
      measurementsStale: isMeasurementStale(latest?.logged_at ?? null),
      isAssignedToMe,
    };
  });
}

export interface ClientSearchResultView {
  id: string;
  clientCode: string;
  name: string;
  photo: string;
  status: ClientStatus;
  isAssignedToMe: boolean;
}

/** Global Search widget (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.5). */
export async function searchAllClientsAction(): Promise<ActionResult<ClientSearchResultView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const clients = await searchAllClients(token);
    return (clients as any[]).map((c) => ({
      id: c.id,
      clientCode: c.client_code ?? "",
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      status: c.clientStatus as ClientStatus,
      isAssignedToMe: c.isAssignedToMe,
    }));
  });
}

export interface SessionNotesView {
  summary: string | null;
  exercisesPerformed: string | null;
  performance: "excellent" | "good" | "average" | "needs_improvement" | null;
  improvements: string[];
  homework: string | null;
  additionalRemarks: string | null;
}

export interface CoachSessionDetail {
  id: string;
  status: "upcoming" | "completed" | "cancelled" | "missed";
  type: "assessment" | "regular";
  date: string;
  durationMinutes: number;
  amountPaid: number | null;
  client: { id: string; name: string; photo: string; goals: string[]; medicalNotes: string | null; equipment: string[] } | null;
  previousNotes: { date: string; notes: string | null }[];
  attendanceStatus: "present" | "absent" | "late" | null;
  notes: SessionNotesView | null;
  zoomStartUrl: string | null;
  /** Set once the coach clicks Join -- see CoachRosterBase.coachJoinedAt. */
  coachJoinedAt: string | null;
}

export async function getCoachSessionDetailAction(bookingId: string): Promise<ActionResult<CoachSessionDetail>> {
  return runAction(async () => {
    const token = await requireToken();
    const [booking, attendance, notesRow]: [any, any, any] = await Promise.all([
      getBooking(token, bookingId),
      getAttendanceForBooking(token, bookingId),
      getWorkoutNoteForBooking(token, bookingId),
    ]);
    const clientId = booking.client?.id;

    let clientDetail: CoachSessionDetail["client"] = null;
    let previousNotes: CoachSessionDetail["previousNotes"] = [];
    if (clientId) {
      const [clients, notes] = await Promise.all([listMyClients(token), listWorkoutNotesForClient(token, clientId)]);
      const client: any = (clients as any[]).find((c) => c.id === clientId);
      if (client) {
        clientDetail = {
          id: client.id,
          name: client.profile?.full_name ?? "Client",
          photo: client.profile?.photo_url ?? FALLBACK_PHOTO(client.id),
          goals: client.goals ?? [],
          medicalNotes: client.medical_notes,
          equipment: client.equipment ?? [],
        };
      }
      previousNotes = (notes as any[])
        .filter((n) => n.booking_id !== bookingId)
        .slice(0, 3)
        .map((n) => ({ date: n.created_at, notes: n.notes }));
    }

    const zoomStartUrl = booking.status === "upcoming" ? await tryEnsureZoomStartUrl(token, bookingId) : null;

    return {
      id: booking.id,
      status: booking.status,
      type: booking.session_type,
      date: booking.scheduled_start,
      durationMinutes: booking.duration_minutes,
      amountPaid: booking.amount_paid ?? null,
      client: clientDetail,
      previousNotes,
      attendanceStatus: attendance?.status ?? null,
      zoomStartUrl,
      coachJoinedAt: booking.coach_joined_at ?? null,
      notes: notesRow
        ? {
            summary: notesRow.notes,
            exercisesPerformed: notesRow.exercises_performed,
            performance: notesRow.performance_rating,
            improvements: notesRow.improvements ?? [],
            homework: notesRow.homework,
            additionalRemarks: notesRow.additional_remarks,
          }
        : null,
    };
  });
}

export async function markSessionJoinedAction(bookingId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await markSessionJoined(token, bookingId);
    return null;
  });
}

export async function markAttendanceAction(bookingId: string, status: "present" | "absent" | "late", remark?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await markAttendance(token, bookingId, status, remark);
    return null;
  });
}

export async function submitSessionNotesAction(
  bookingId: string,
  input: {
    summary?: string;
    exercisesPerformed?: string;
    performance?: "excellent" | "good" | "average" | "needs_improvement";
    improvements?: string[];
    homework?: string;
    additionalRemarks?: string;
  }
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await submitSessionNotes(token, bookingId, input);
    return null;
  });
}

export async function getCoachAvailabilityAction(): Promise<ActionResult<{ windows: AvailabilityWindow[]; leave: any[] }>> {
  return runAction(async () => {
    const token = await requireToken();
    const [windows, leave] = await Promise.all([getMyAvailability(token), getMyLeaveRequests(token)]);
    return { windows: windows as unknown as AvailabilityWindow[], leave };
  });
}

export async function requestLeaveAction(input: RequestLeaveInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await requestLeave(token, input);
    return null;
  });
}

export interface CoachEscalationView {
  id: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  packageName: string | null;
  category: string | null;
  reason: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved";
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** PRD §9 "Client Escalations (Read Only)" -- intentionally has no
 * corresponding update/resolve action anywhere in this file; only Admin can
 * change escalation status (see admin-clients.actions.ts / escalations.service.ts). */
export async function getCoachEscalationsAction(): Promise<ActionResult<CoachEscalationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [coachProfile, clients]: [any, any[]] = await Promise.all([getMyCoachProfile(token), listMyClients(token)]);
    const rows = await listEscalationsForCoach(token, coachProfile.id);
    const clientById = new Map(clients.map((c) => [c.id, c]));

    return (rows as any[]).map((r) => {
      const clientId = r.client?.id ?? r.client_id;
      return {
        id: r.id,
        clientId,
        clientCode: r.client?.client_code ?? "",
        clientName: r.client?.profile?.full_name ?? "Client",
        packageName: clientById.get(clientId)?.activeSubscription?.package?.name ?? null,
        category: r.category,
        reason: r.reason,
        description: r.description,
        status: r.status,
        resolutionNotes: r.resolution_notes,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
      };
    });
  });
}

export async function getMyUnresolvedEscalationsCountAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachProfile: any = await getMyCoachProfile(token);
    return countUnresolvedEscalationsForCoach(token, coachProfile.id);
  });
}

export async function getMyPerformanceAction(): Promise<ActionResult<CoachPerformance>> {
  return runAction(async () => {
    const token = await requireToken();
    return getMyCoachPerformance(token);
  });
}

export interface CoachActivityItem {
  date: string;
  title: string;
  type: "session_completed" | "session_missed" | "leave_submitted" | "leave_approved" | "leave_rejected" | "shadow_assigned";
}

/** PRD §14 "Activity Timeline" -- the coach's own activity feed, distinct
 * from a client's journey timeline. Derived by merging existing signals
 * (no dedicated table -- see plan design decision #4), most recent first. */
export async function getMyActivityAction(): Promise<ActionResult<CoachActivityItem[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [bookings, leave, shadowAssignments] = await Promise.all([
      listMyBookingsAsCoach(token),
      getMyLeaveRequests(token),
      listMyShadowAssignments(token),
    ]);

    const items: CoachActivityItem[] = [];

    for (const b of bookings as any[]) {
      const clientName = b.client?.profile?.full_name ?? "Client";
      if (b.status === "completed") {
        items.push({ date: b.scheduled_start, title: `Session completed — ${clientName}`, type: "session_completed" });
      } else if (b.status === "missed") {
        items.push({ date: b.scheduled_start, title: `Client absent — ${clientName}`, type: "session_missed" });
      }
    }

    for (const l of leave as any[]) {
      const label = l.status === "approved" ? "Leave approved" : l.status === "rejected" ? "Leave rejected" : "Leave request submitted";
      const type = l.status === "approved" ? "leave_approved" : l.status === "rejected" ? "leave_rejected" : "leave_submitted";
      items.push({ date: l.created_at ?? l.starts_on, title: label, type });
    }

    for (const s of shadowAssignments as any[]) {
      const clientName = s.client?.profile?.full_name ?? "Client";
      const primaryCoachName = s.primary_coach?.profile?.full_name ?? "primary coach";
      items.push({
        date: s.created_at,
        title: `Shadow coach assigned for ${clientName} (covering ${primaryCoachName}, ${s.starts_on} – ${s.ends_on})`,
        type: "shadow_assigned",
      });
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
  });
}

export interface CoachCancelledSessionView {
  id: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  sessionDate: string;
  cancelledAt: string;
  cancelledByRole: "client" | "admin" | "coach" | null;
  reason: string | null;
}

/** Cancellation Policy PRD §3 "Cancelled Sessions" -- cancelled_by_profile.role
 * distinguishes "Cancelled by Client" from "Cancelled by Admin"; updated_at
 * doubles as "Cancellation Time" since a cancelled booking is terminal (no
 * further updates happen to it). */
export async function getCoachCancelledSessionsAction(): Promise<ActionResult<CoachCancelledSessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listCancelledBookingsForCoach(token);
    return (rows as any[]).map((b) => ({
      id: b.id,
      clientId: b.client?.id ?? b.client_id,
      clientCode: b.client?.client_code ?? "",
      clientName: b.client?.profile?.full_name ?? "Client",
      sessionDate: b.scheduled_start,
      cancelledAt: b.updated_at,
      cancelledByRole: b.cancelled_by_profile?.role ?? null,
      reason: b.cancel_reason,
    }));
  });
}

export interface CoachRescheduledSessionView {
  id: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  originalDate: string;
  newDate: string;
}

/** Cancellation Policy PRD §3 "Rescheduled Sessions". */
export async function getCoachRescheduledSessionsAction(): Promise<ActionResult<CoachRescheduledSessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listRescheduledBookingsForCoach(token);
    return (rows as any[]).map((b) => ({
      id: b.id,
      clientId: b.client?.id ?? b.client_id,
      clientCode: b.client?.client_code ?? "",
      clientName: b.client?.profile?.full_name ?? "Client",
      originalDate: b.original_scheduled_start,
      newDate: b.scheduled_start,
    }));
  });
}
