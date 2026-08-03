"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getClient, listClients, reassignClientCoach, getClientCurrentCoachId } from "@/lib/services/clients.service";
import { getCoach, listCoaches } from "@/lib/services/coaches.service";
import { listBookingsForClient } from "@/lib/services/bookings.service";
import { getSubscriptionsForClient, pauseSubscription, adjustSubscriptionSessions } from "@/lib/services/subscriptions.service";
import { logRefundRequest } from "@/lib/services/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface AdminClientListItem {
  id: string;
  name: string;
  photo: string;
  phone: string | null;
  status: "active" | "inactive" | "paused";
  packageName: string | null;
  coachName: string | null;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
}

export async function listAdminClientsAction(): Promise<ActionResult<AdminClientListItem[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listClients(token);
    return (rows as any[]).map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "Client",
      photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
      phone: c.profile?.phone ?? null,
      status: c.status,
      packageName: c.activeSubscription?.package?.name ?? null,
      coachName: c.activeCoach?.profile?.full_name ?? null,
      sessionsRemaining: c.activeSubscription?.sessionsRemaining ?? null,
      sessionsTotal: c.activeSubscription?.sessions_total ?? null,
    }));
  });
}

export interface AdminClientDetailView {
  id: string;
  name: string;
  photo: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | "paused";
  joinedDate: string;
  goals: string[];
  medicalNotes: string | null;
  coach: { id: string; name: string; specialization: string | null; photo: string } | null;
  subscription: { id: string; packageName: string; sessionsUsed: number; sessionsRemaining: number; sessionsTotal: number } | null;
  history: { id: string; type: "assessment" | "regular"; status: string; date: string; remarks: string | null }[];
}

export async function getAdminClientDetailAction(clientId: string): Promise<ActionResult<AdminClientDetailView>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getClient(token, clientId);

    const [subs, bookings, authUser, currentCoachId] = await Promise.all([
      getSubscriptionsForClient(token, clientId),
      listBookingsForClient(token, clientId),
      supabaseAdmin.auth.admin.getUserById(client.profile.id),
      getClientCurrentCoachId(token, clientId),
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

    const activeSub: any = (subs as any[]).find((s) => s.status === "active") ?? (subs as any[])[0] ?? null;
    const subscription = activeSub
      ? {
          id: activeSub.id,
          packageName: activeSub.package?.name ?? "Package",
          sessionsUsed: activeSub.usage?.sessions_used ?? 0,
          sessionsRemaining: activeSub.usage?.sessions_remaining ?? 0,
          sessionsTotal: activeSub.sessions_total,
        }
      : null;

    return {
      id: client.id,
      name: client.profile?.full_name ?? "Client",
      photo: client.profile?.photo_url ?? FALLBACK_PHOTO(client.id),
      email: authUser.data.user?.email ?? "",
      phone: client.profile?.phone ?? null,
      status: client.status,
      joinedDate: client.joined_date,
      goals: client.goals ?? [],
      medicalNotes: client.medical_notes,
      coach,
      subscription,
      history: (bookings as any[]).map((b) => ({
        id: b.id,
        type: b.session_type,
        status: b.status,
        date: b.scheduled_start,
        remarks: b.client_feedback ?? null,
      })),
    };
  });
}

export interface AdminCoachOption {
  id: string;
  name: string;
  specialization: string | null;
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

export async function transferClientCoachAction(clientId: string, fromCoachId: string, toCoachId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await reassignClientCoach(token, clientId, fromCoachId, toCoachId);
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
