"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  getClient,
  listClients,
  reassignClientCoach,
  getClientCurrentCoachId,
  createMigratedClient,
  CreateMigratedClientInput,
} from "@/lib/services/clients.service";
import { getCoach, listCoaches } from "@/lib/services/coaches.service";
import { listBookingsForClient } from "@/lib/services/bookings.service";
import {
  getSubscriptionsForClient,
  pauseSubscription,
  adjustSubscriptionSessions,
  getPauseDaysStatus,
  adjustPauseDaysAllowed,
} from "@/lib/services/subscriptions.service";
import { logRefundRequest } from "@/lib/services/audit.service";
import { listProgressLogsForClient, isMeasurementStale } from "@/lib/services/progressLogs.service";
import { getOnboardingForClient } from "@/lib/services/onboarding.service";
import { listPackages } from "@/lib/services/packages.service";
import { checkAdminSlotAssignment, AdminSlotCheckResult } from "@/lib/services/scheduling.service";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { calculateBmi } from "@/lib/utils";
import { ClientStatus, getClientStatusSnapshot } from "@/lib/services/clientStatus";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface AdminClientListItem {
  id: string;
  clientCode: string;
  name: string;
  photo: string;
  phone: string | null;
  status: ClientStatus;
  packageName: string | null;
  coachName: string | null;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
  slotDays: number[];
  slotStartTime: string | null;
  lastMeasurementAt: string | null;
  measurementsStale: boolean;
}

export async function listAdminClientsAction(): Promise<ActionResult<AdminClientListItem[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listClients(token);
    return (rows as any[]).map((c) => ({
      id: c.id,
      clientCode: c.client_code ?? "",
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      phone: c.profile?.phone ?? null,
      status: c.clientStatus as ClientStatus,
      packageName: c.activeSubscription?.package?.name ?? null,
      coachName: c.activeCoach?.profile?.full_name ?? null,
      sessionsRemaining: c.activeSubscription?.sessionsRemaining ?? null,
      sessionsTotal: c.activeSubscription?.sessions_total ?? null,
      slotDays: c.schedule?.days ?? [],
      slotStartTime: c.schedule?.startTime ?? null,
      lastMeasurementAt: c.lastMeasurementAt ?? null,
      measurementsStale: isMeasurementStale(c.lastMeasurementAt ?? null),
    }));
  });
}

/** Structurally identical to MeasurementChart's own MeasurementPoint --
 * duplicated here rather than imported so this "use server" file never
 * imports from a "use client" component module (same convention as
 * coach-portal.actions.ts). */
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

export interface AdminClientDetailView {
  id: string;
  name: string;
  photo: string;
  email: string;
  phone: string | null;
  status: ClientStatus;
  joinedDate: string;
  goals: string[];
  medicalNotes: string | null;
  demographics: { age: number | null; gender: string | null; heightCm: number | null; weightKg: number | null; bmi: number | null } | null;
  coach: { id: string; name: string; specialization: string | null; photo: string } | null;
  subscription: {
    id: string;
    packageName: string;
    sessionsUsed: number;
    sessionsRemaining: number;
    sessionsTotal: number;
    pauseDaysAllowed: number;
    pauseDaysUsed: number;
  } | null;
  history: { id: string; type: "assessment" | "regular"; status: string; date: string; remarks: string | null; amountPaid: number | null }[];
  progressHistory: MeasurementPoint[];
  lastMeasurementAt: string | null;
  measurementsStale: boolean;
}

export async function getAdminClientDetailAction(clientId: string): Promise<ActionResult<AdminClientDetailView>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getClient(token, clientId);

    const [subs, bookings, authUser, currentCoachId, progressLogs, onboarding, clientStatus]: [
      any[],
      any[],
      any,
      string | null,
      any[],
      any,
      ClientStatus
    ] = await Promise.all([
      getSubscriptionsForClient(token, clientId),
      listBookingsForClient(token, clientId),
      supabaseAdmin.auth.admin.getUserById(client.profile.id),
      getClientCurrentCoachId(token, clientId),
      listProgressLogsForClient(token, clientId),
      getOnboardingForClient(token, clientId),
      getClientStatusSnapshot(clientId),
    ]);

    let coach: AdminClientDetailView["coach"] = null;
    if (currentCoachId) {
      const coachRow: any = await getCoach(token, currentCoachId);
      coach = {
        id: coachRow.id,
        name: coachRow.profile?.full_name ?? "Coach",
        specialization: coachRow.specialization ?? null,
        photo: coachRow.profile?.photo_url ?? FALLBACK_PHOTO(coachRow.id),
      };
    }

    const lastMeasurementAt = (progressLogs as any[]).reduce<string | null>(
      (latest, log) => (!latest || new Date(log.logged_at) > new Date(latest) ? log.logged_at : latest),
      null
    );

    const activeSub: any = (subs as any[]).find((s) => s.status === "active") ?? (subs as any[])[0] ?? null;
    const pauseDays = activeSub ? await getPauseDaysStatus(token, activeSub.id) : null;
    const subscription = activeSub
      ? {
          id: activeSub.id,
          packageName: activeSub.package?.name ?? "Package",
          sessionsUsed: activeSub.usage?.sessions_used ?? 0,
          sessionsRemaining: activeSub.usage?.sessions_remaining ?? 0,
          sessionsTotal: activeSub.sessions_total,
          pauseDaysAllowed: pauseDays?.pauseDaysAllowed ?? 0,
          pauseDaysUsed: pauseDays?.pauseDaysUsed ?? 0,
        }
      : null;

    return {
      id: client.id,
      name: client.profile?.full_name ?? "Client",
      photo: client.profile?.photo_url ?? FALLBACK_PHOTO(client.id),
      email: authUser.data.user?.email ?? "",
      phone: client.profile?.phone ?? null,
      status: clientStatus,
      joinedDate: client.joined_date,
      goals: client.goals ?? [],
      medicalNotes: client.medical_notes,
      demographics: onboarding
        ? {
            age: onboarding.age ?? null,
            gender: onboarding.gender ?? null,
            heightCm: onboarding.height_cm ?? null,
            weightKg: onboarding.weight_kg ?? null,
            bmi: calculateBmi(onboarding.height_cm, onboarding.weight_kg),
          }
        : null,
      coach,
      subscription,
      history: (bookings as any[]).map((b) => ({
        id: b.id,
        type: b.session_type,
        status: b.status,
        date: b.scheduled_start,
        remarks: b.rating_note ?? null,
        amountPaid: b.amount_paid ?? null,
      })),
      progressHistory: (progressLogs as any[])
        .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
        .map((l) => ({
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
      lastMeasurementAt,
      measurementsStale: isMeasurementStale(lastMeasurementAt),
    };
  });
}

export interface AdminCoachOption {
  id: string;
  name: string;
  specialization: string | null;
}

export interface AdminClientSearchResult {
  id: string;
  clientCode: string;
  name: string;
  photo: string;
  phone: string | null;
  status: ClientStatus;
}

/** Admin Universal Search (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §2.1) --
 * admin already has unrestricted RLS read access to every client (no
 * widening needed, unlike the coach-facing version of this feature), so
 * this just reshapes the same listClients() roster already used by the
 * clients list page for a fast client-side name/ID/phone filter, following
 * the identical pattern CoachSearchClient uses. */
export async function searchAdminClientsAction(): Promise<ActionResult<AdminClientSearchResult[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listClients(token);
    return (rows as any[]).map((c) => ({
      id: c.id,
      clientCode: c.client_code ?? "",
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      phone: c.profile?.phone ?? null,
      status: c.clientStatus as ClientStatus,
    }));
  });
}

export async function listAdminCoachOptionsAction(): Promise<ActionResult<AdminCoachOption[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listCoaches(token);
    return (rows as any[]).map((c) => ({ id: c.id, name: c.profile?.full_name ?? "Coach", specialization: c.specialization ?? null }));
  });
}

export async function adjustClientSessionsAction(subscriptionId: string, newTotal: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await adjustSubscriptionSessions(token, subscriptionId, newTotal);
    return null;
  });
}

export async function adjustPauseDaysAction(subscriptionId: string, additionalDays: number): Promise<ActionResult<{ pauseDaysAllowed: number }>> {
  return runAction(async () => {
    const token = await requireToken();
    return adjustPauseDaysAllowed(token, subscriptionId, additionalDays);
  });
}

export async function transferClientCoachAction(
  clientId: string,
  fromCoachId: string,
  toCoachId: string,
  force?: boolean
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await reassignClientCoach(token, clientId, fromCoachId, toCoachId, { force });
    return null;
  });
}

export async function pauseClientSubscriptionAction(subscriptionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await pauseSubscription(token, subscriptionId);
    return null;
  });
}

/** No payment gateway exists in this codebase — this logs the refund request
 * for ops follow-up rather than moving any money. See plan doc's "judgment
 * calls" section. */
export async function logRefundRequestAction(clientId: string, amountRupees: number, reason: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await logRefundRequest(token, clientId, amountRupees, reason);
    return null;
  });
}

export interface AdminPackageOption {
  id: string;
  name: string;
  sessionsCount: number;
  defaultPauseDays: number;
}

/** Plan dropdown for the "Add Client" migration form -- every package tier
 * (not just is_active ones, unlike the public pricing page) since a
 * migrated client may be on a legacy plan that's since been archived from
 * new sales but still needs to exist as a selectable label here. */
export async function listPackageOptionsAction(): Promise<ActionResult<AdminPackageOption[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listPackages(token);
    return (rows as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      sessionsCount: p.sessions_count,
      defaultPauseDays: p.default_pause_days ?? 0,
    }));
  });
}

export async function checkSlotAvailabilityAction(input: {
  coachId: string;
  days: number[];
  timeOfDay: string;
  durationMinutes?: number;
}): Promise<ActionResult<AdminSlotCheckResult>> {
  return runAction(async () => {
    const token = await requireToken();
    return checkAdminSlotAssignment(token, input);
  });
}

export async function createMigratedClientAction(
  input: CreateMigratedClientInput
): Promise<ActionResult<{ clientId: string; clientCode: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    return createMigratedClient(token, input);
  });
}
