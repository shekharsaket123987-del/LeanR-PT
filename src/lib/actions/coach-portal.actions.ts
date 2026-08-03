"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyProfile } from "@/lib/services/profiles.service";
import { listMyClients } from "@/lib/services/clients.service";
import { getMyCoachProfile } from "@/lib/services/coaches.service";
import {
  AvailabilityWindow,
  getMyAvailability,
  getMyLeaveRequests,
  requestLeave,
  setMyAvailability,
} from "@/lib/services/availability.service";
import { listEscalationsForCoach } from "@/lib/services/escalations.service";
import { getMyCoachPerformance, CoachPerformance } from "@/lib/services/coachPerformance.service";
import { listMyShadowAssignments } from "@/lib/services/coachChange.service";
import { getOnboardingForClient } from "@/lib/services/onboarding.service";
import { getSubscriptionsForClient } from "@/lib/services/subscriptions.service";
import { listProgressLogsForClient } from "@/lib/services/progressLogs.service";
import { listClientTimeline, TimelineEventRow } from "@/lib/services/timeline.service";
import {
  getAttendanceForBooking,
  getBooking,
  getWorkoutNoteForBooking,
  listMyBookingsAsCoach,
  listWorkoutNotesForClient,
  markAttendance,
  submitSessionNotes,
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
  };
}

export interface CoachDashboardData {
  firstName: string;
  utilization: number;
  thisWeekCount: number;
  completedCount: number;
  missedCount: number;
  todaySessions: CoachSessionView[];
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
    const todaySessions = (bookings as any[])
      .filter((b) => new Date(b.scheduled_start).toDateString() === today && b.status === "upcoming")
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
      .map(toCoachSessionView);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeekCount = (bookings as any[]).filter((b) => new Date(b.scheduled_start) >= startOfWeek).length;
    const completedCount = (bookings as any[]).filter((b) => b.status === "completed").length;
    const missedCount = (bookings as any[]).filter((b) => b.status === "missed").length;

    return {
      firstName: profile.full_name?.split(" ")[0] ?? "there",
      utilization,
      thisWeekCount,
      completedCount,
      missedCount,
      todaySessions,
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
  status: "active" | "paused" | "completed" | "waiting_to_start";
}

/** client_profiles.status only has active/inactive/paused -- "Completed" and
 * "Waiting to Start" (PRD §3 status list) are derived display states, not
 * new enum values: inactive reads as "Completed" from the coach's view (no
 * separate plan-completion concept exists yet), and an active client with no
 * bookings at all under this coach yet reads as "Waiting to Start". */
function deriveClientStatus(rawStatus: string, hasAnyBooking: boolean): CoachClientView["status"] {
  if (rawStatus === "paused") return "paused";
  if (rawStatus === "inactive") return "completed";
  return hasAnyBooking ? "active" : "waiting_to_start";
}

export async function getCoachClientsAction(): Promise<ActionResult<CoachClientView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [clients, bookings] = await Promise.all([listMyClients(token), listMyBookingsAsCoach(token)]);

    const completedByClient = new Map<string, number>();
    const hasBookingByClient = new Set<string>();
    for (const b of bookings as any[]) {
      const cid = b.client?.id;
      if (!cid) continue;
      hasBookingByClient.add(cid);
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
      status: deriveClientStatus(c.status, hasBookingByClient.has(c.id)),
    }));
  });
}

export interface ClientDemographics {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
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

export interface CoachClientDetail extends CoachClientView {
  history: { id: string; date: string; rating: number | null; notes: string | null }[];
  demographics: ClientDemographics | null;
  sessionSummary: SessionSummaryView;
  weeklyProgress: MeasurementComparison[];
  timeline: TimelineEventRow[];
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
    const client: any = (clients as any[]).find((c) => c.id === clientId);
    if (!client) throw new Error("Client not found, or not assigned to you");

    const [onboarding, subscriptions, progressLogs, timeline]: [any, any[], any[], any[]] = await Promise.all([
      getOnboardingForClient(token, clientId),
      getSubscriptionsForClient(token, clientId),
      listProgressLogsForClient(token, clientId),
      listClientTimeline(token, clientId),
    ]);

    const notesByBooking = new Map((notes as any[]).map((n) => [n.booking_id, n.notes as string]));
    const clientBookings = (bookings as any[]).filter((b) => b.client?.id === clientId);
    const history = clientBookings
      .filter((b) => b.status === "completed")
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
      .map((b) => ({ id: b.id, date: b.scheduled_start, rating: b.rating ?? null, notes: notesByBooking.get(b.id) ?? null }));

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
      status: deriveClientStatus(client.status, clientBookings.length > 0),
      history,
      demographics: onboarding
        ? {
            age: onboarding.age ?? null,
            gender: onboarding.gender ?? null,
            heightCm: onboarding.height_cm ?? null,
            weightKg: onboarding.weight_kg ?? null,
            fitnessGoal: onboarding.fitness_goal ?? null,
          }
        : null,
      sessionSummary,
      weeklyProgress,
      timeline: timeline as TimelineEventRow[],
    };
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
  client: { id: string; name: string; photo: string; goals: string[]; medicalNotes: string | null; equipment: string[] } | null;
  previousNotes: { date: string; notes: string | null }[];
  attendanceStatus: "present" | "absent" | "late" | null;
  notes: SessionNotesView | null;
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

    return {
      id: booking.id,
      status: booking.status,
      type: booking.session_type,
      date: booking.scheduled_start,
      client: clientDetail,
      previousNotes,
      attendanceStatus: attendance?.status ?? null,
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

export async function markAttendanceAction(bookingId: string, status: "present" | "absent", remark?: string): Promise<ActionResult<null>> {
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

export async function saveAvailabilityAction(windows: AvailabilityWindow[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await setMyAvailability(token, windows);
    return null;
  });
}

export async function requestLeaveAction(input: { starts_on: string; ends_on: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await requestLeave(token, input);
    return null;
  });
}

export interface CoachEscalationView {
  id: string;
  clientId: string;
  clientName: string;
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
    const coachProfile: any = await getMyCoachProfile(token);
    const rows = await listEscalationsForCoach(token, coachProfile.id);
    return (rows as any[]).map((r) => ({
      id: r.id,
      clientId: r.client?.id ?? r.client_id,
      clientName: r.client?.profile?.full_name ?? "Client",
      category: r.category,
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolutionNotes: r.resolution_notes,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    }));
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
