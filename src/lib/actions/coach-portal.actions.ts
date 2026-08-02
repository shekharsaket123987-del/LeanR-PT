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
import { completeBooking, getBooking, listMyBookingsAsCoach, listWorkoutNotesForClient } from "@/lib/services/bookings.service";

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
  name: string;
  photo: string;
  email: string;
  goals: string[];
  medicalNotes: string | null;
  equipment: string[];
  joinedDate: string;
  packageName: string | null;
}

export async function getCoachClientsAction(): Promise<ActionResult<CoachClientView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const clients = await listMyClients(token);
    return (clients as any[]).map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      email: "",
      goals: c.goals ?? [],
      medicalNotes: c.medical_notes,
      equipment: c.equipment ?? [],
      joinedDate: c.joined_date,
      packageName: c.activeSubscription?.package?.name ?? null,
    }));
  });
}

export interface CoachClientDetail extends CoachClientView {
  history: { id: string; date: string; rating: number | null; notes: string | null }[];
}

export async function getCoachClientDetailAction(clientId: string): Promise<ActionResult<CoachClientDetail>> {
  return runAction(async () => {
    const token = await requireToken();
    const [clients, bookings, notes] = await Promise.all([listMyClients(token), listMyBookingsAsCoach(token), listWorkoutNotesForClient(token, clientId)]);
    const client: any = (clients as any[]).find((c) => c.id === clientId);
    if (!client) throw new Error("Client not found, or not assigned to you");

    const notesByBooking = new Map((notes as any[]).map((n) => [n.booking_id, n.notes as string]));
    const history = (bookings as any[])
      .filter((b) => b.client?.id === clientId && b.status === "completed")
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
      .map((b) => ({ id: b.id, date: b.scheduled_start, rating: b.rating ?? null, notes: notesByBooking.get(b.id) ?? null }));

    return {
      id: client.id,
      name: client.profile?.full_name ?? "Client",
      photo: client.profile?.photo_url ?? FALLBACK_PHOTO(client.id),
      email: "",
      goals: client.goals ?? [],
      medicalNotes: client.medical_notes,
      equipment: client.equipment ?? [],
      joinedDate: client.joined_date,
      packageName: client.activeSubscription?.package?.name ?? null,
      history,
    };
  });
}

export interface CoachSessionDetail {
  id: string;
  status: "upcoming" | "completed" | "cancelled" | "missed";
  type: "assessment" | "regular";
  date: string;
  client: { id: string; name: string; photo: string; goals: string[]; medicalNotes: string | null; equipment: string[] } | null;
  previousNotes: { date: string; notes: string | null }[];
}

export async function getCoachSessionDetailAction(bookingId: string): Promise<ActionResult<CoachSessionDetail>> {
  return runAction(async () => {
    const token = await requireToken();
    const booking: any = await getBooking(token, bookingId);
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
    };
  });
}

export async function completeSessionAction(bookingId: string, input: { notes?: string; homework?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await completeBooking(token, bookingId, input);
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
