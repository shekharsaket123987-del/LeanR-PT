"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { CoachSlotPattern, createCoach, listCoaches, getCoach, updateCoach, updateCoachSkills, updateCoachStatus } from "@/lib/services/coaches.service";
import { CoachCalendarSlot, getCoachWeekCalendar } from "@/lib/services/scheduling.service";
import { listClients, listActiveClientIdsForCoach, reassignClientCoach } from "@/lib/services/clients.service";
import { createOneDayLeave, getCoachAvailability, setCoachAvailability, AvailabilityWindow } from "@/lib/services/availability.service";

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
  yearsExperience: number;
  bio: string;
  secondarySpecializations: string[];
  languages: string[];
  status: "active" | "inactive" | "on-leave";
  rating: number;
  reviewCount: number;
  skills: string[];
  activeClients: number;
  utilizationPct: number;
  clients: { id: string; name: string; photo: string; packageName: string | null; sessionsRemaining: number | null }[];
}

export async function getAdminCoachDetailAction(coachId: string): Promise<ActionResult<AdminCoachDetailView>> {
  return runAction(async () => {
    const token = await requireToken();
    const [coach, allClients]: [any, any[]] = await Promise.all([getCoach(token, coachId), listClients(token)]);

    const myClients = allClients.filter((c) => c.activeCoach?.id === coachId);

    return {
      id: coach.id,
      name: coach.profile?.full_name ?? "Coach",
      photo: coach.profile?.photo_url ?? FALLBACK_PHOTO(coach.id),
      specialization: coach.specialization ?? null,
      yearsExperience: coach.years_experience ?? 0,
      bio: coach.bio ?? "",
      secondarySpecializations: coach.secondary_specializations ?? [],
      languages: coach.languages ?? [],
      status: coach.status,
      rating: Number(coach.rating ?? 0),
      reviewCount: coach.review_count ?? 0,
      skills: coach.skills ?? [],
      activeClients: coach.utilization?.active_clients ?? 0,
      utilizationPct: coach.utilization?.utilization_pct ?? 0,
      clients: myClients.map((c) => ({
        id: c.id,
        name: c.profile?.full_name ?? "Client",
        photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
        packageName: c.activeSubscription?.package?.name ?? null,
        sessionsRemaining: c.activeSubscription?.sessionsRemaining ?? null,
      })),
    };
  });
}

export interface ReassignCoachClientsResult {
  reassignedCount: number;
  failed: { clientId: string; clientName: string; reason: string }[];
}

/** One client blocked by uncovered days (the new coach doesn't work that
 * client's existing slot days) used to abort the entire bulk reassignment --
 * every client after the failure was silently left on the old coach with no
 * indication which ones. Now each client is attempted independently, so a
 * single failure doesn't block the rest, and the caller gets back exactly
 * which clients still need manual attention and why. */
export async function reassignCoachClientsAction(fromCoachId: string, toCoachId: string): Promise<ActionResult<ReassignCoachClientsResult>> {
  return runAction(async () => {
    const token = await requireToken();
    const [clientIds, allClients]: [string[], any[]] = await Promise.all([
      listActiveClientIdsForCoach(token, fromCoachId),
      listClients(token),
    ]);
    const nameById = new Map(allClients.map((c) => [c.id, c.profile?.full_name ?? "Client"]));

    const failed: ReassignCoachClientsResult["failed"] = [];
    let reassignedCount = 0;
    for (const clientId of clientIds) {
      try {
        await reassignClientCoach(token, clientId, fromCoachId, toCoachId);
        reassignedCount++;
      } catch (err) {
        failed.push({
          clientId,
          clientName: nameById.get(clientId) ?? "Client",
          reason: err instanceof Error ? err.message : "Reassignment failed",
        });
      }
    }
    return { reassignedCount, failed };
  });
}

export async function getCoachWeekCalendarAction(coachId: string): Promise<ActionResult<CoachCalendarSlot[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const today = new Date();
    const fromDate = today.toISOString().slice(0, 10);
    const toDateObj = new Date(today);
    toDateObj.setDate(toDateObj.getDate() + 6);
    const toDate = toDateObj.toISOString().slice(0, 10);
    return getCoachWeekCalendar(token, coachId, fromDate, toDate);
  });
}

export async function updateCoachAction(
  coachId: string,
  patch: {
    fullName?: string;
    specialization?: string;
    yearsExperience?: number;
    bio?: string;
    secondarySpecializations?: string[];
    languages?: string[];
  }
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await updateCoach(token, coachId, patch);
    return null;
  });
}

export async function updateCoachSkillsAction(coachId: string, skills: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await updateCoachSkills(token, coachId, skills);
    return null;
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

export async function getCoachAvailabilityForAdminAction(coachId: string): Promise<ActionResult<AvailabilityWindow[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const windows = await getCoachAvailability(token, coachId);
    return windows as unknown as AvailabilityWindow[];
  });
}

export async function setCoachAvailabilityAction(coachId: string, windows: AvailabilityWindow[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await setCoachAvailability(token, coachId, windows);
    return null;
  });
}
