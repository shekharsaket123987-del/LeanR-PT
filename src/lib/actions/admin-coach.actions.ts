"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { CoachSlotPattern, createCoach, listCoaches, getCoach, updateCoachStatus } from "@/lib/services/coaches.service";
import { listClients, listActiveClientIdsForCoach, reassignClientCoach } from "@/lib/services/clients.service";
import { listAllBookings } from "@/lib/services/bookings.service";
import { createOneDayLeave } from "@/lib/services/availability.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export async function createCoachAction(input: {
  fullName: string;
  email: string;
  password: string;
  employeeCode: string;
  specialization: string;
  skills: string[];
  languages: string[];
  slots: CoachSlotPattern[];
}): Promise<ActionResult<{ coachId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await createCoach(token, input);
    return { coachId };
  });
}

export interface AdminCoachListItem {
  id: string;
  name: string;
  photo: string;
  specialization: string | null;
  status: "active" | "inactive" | "on-leave";
  activeClients: number;
  utilizationPct: number;
  rating: number;
}

export async function listAdminCoachesAction(): Promise<ActionResult<AdminCoachListItem[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listCoaches(token);
    return (rows as any[]).map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "Coach",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      specialization: c.specialization ?? null,
      status: c.status,
      activeClients: c.utilization?.active_clients ?? 0,
      utilizationPct: c.utilization?.utilization_pct ?? 0,
      rating: Number(c.rating ?? 0),
    }));
  });
}

export interface AdminCoachDetailView {
  id: string;
  name: string;
  photo: string;
  specialization: string | null;
  status: "active" | "inactive" | "on-leave";
  rating: number;
  reviewCount: number;
  activeClients: number;
  utilizationPct: number;
  clients: { id: string; name: string; photo: string; packageName: string | null; sessionsRemaining: number | null }[];
  upcomingSessions: { id: string; date: string }[];
}

export async function getAdminCoachDetailAction(coachId: string): Promise<ActionResult<AdminCoachDetailView>> {
  return runAction(async () => {
    const token = await requireToken();
    const [coach, allClients, bookings]: [any, any[], any[]] = await Promise.all([
      getCoach(token, coachId),
      listClients(token),
      listAllBookings(token, { coachId, status: "upcoming" }),
    ]);

    const myClients = allClients.filter((c) => c.activeCoach?.id === coachId);

    return {
      id: coach.id,
      name: coach.profile?.full_name ?? "Coach",
      photo: coach.profile?.photo_url ?? FALLBACK_PHOTO(coach.id),
      specialization: coach.specialization ?? null,
      status: coach.status,
      rating: Number(coach.rating ?? 0),
      reviewCount: coach.review_count ?? 0,
      activeClients: coach.utilization?.active_clients ?? 0,
      utilizationPct: coach.utilization?.utilization_pct ?? 0,
      clients: myClients.map((c) => ({
        id: c.id,
        name: c.profile?.full_name ?? "Client",
        photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
        packageName: c.activeSubscription?.package?.name ?? null,
        sessionsRemaining: c.activeSubscription?.sessionsRemaining ?? null,
      })),
      upcomingSessions: bookings.map((b) => ({ id: b.id, date: b.scheduled_start })),
    };
  });
}

export async function reassignCoachClientsAction(fromCoachId: string, toCoachId: string): Promise<ActionResult<{ reassignedCount: number }>> {
  return runAction(async () => {
    const token = await requireToken();
    const clientIds = await listActiveClientIdsForCoach(token, fromCoachId);
    for (const clientId of clientIds) {
      await reassignClientCoach(token, clientId, fromCoachId, toCoachId);
    }
    return { reassignedCount: clientIds.length };
  });
}

export async function disableCoachAction(coachId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await updateCoachStatus(token, coachId, "inactive");
    return null;
  });
}

export async function blockCoachSlotAction(coachId: string, date: string, reason?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await createOneDayLeave(token, coachId, date, reason);
    return null;
  });
}
