"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  createEscalation,
  resolveEscalation,
  markEscalationInProgress,
  listEscalationsForClient,
  listAllEscalations,
  countUnresolvedEscalationsForAdmin,
} from "@/lib/services/escalations.service";
import { listClients } from "@/lib/services/clients.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminEscalationView {
  id: string;
  reason: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved";
  category: string | null;
  raisedByAdmin: boolean;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listEscalationsForClientAction(clientId: string): Promise<ActionResult<AdminEscalationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listEscalationsForClient(token, clientId);
    return (rows as any[]).map((r) => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      category: r.category,
      raisedByAdmin: r.raised_by === null,
      resolutionNotes: r.resolution_notes,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    }));
  });
}

export interface AdminGlobalEscalationView extends AdminEscalationView {
  clientId: string;
  clientCode: string;
  clientName: string;
  packageName: string | null;
}

/** Global escalations queue (§2.7) -- admins previously had to open clients
 * one at a time to see any escalation; this is the cross-client aggregate
 * view, mirroring the coach-side Active/Resolved tab pattern. */
export async function listAllEscalationsAction(): Promise<ActionResult<AdminGlobalEscalationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const [rows, clients]: [any[], any[]] = await Promise.all([listAllEscalations(token), listClients(token)]);
    const clientById = new Map(clients.map((c) => [c.id, c]));

    return rows.map((r) => {
      const client = clientById.get(r.client_id);
      return {
        id: r.id,
        reason: r.reason,
        description: r.description,
        status: r.status,
        category: r.category,
        raisedByAdmin: r.raised_by === null,
        resolutionNotes: r.resolution_notes,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        clientId: r.client_id,
        clientCode: r.client?.client_code ?? "",
        clientName: r.client?.profile?.full_name ?? "Client",
        packageName: client?.activeSubscription?.package?.name ?? null,
      };
    });
  });
}

export async function getUnresolvedEscalationsCountAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const token = await requireToken();
    return countUnresolvedEscalationsForAdmin(token);
  });
}

export async function logEscalationAction(clientId: string, reason: string, description?: string, coachId?: string, category?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await createEscalation(token, { clientId, coachId, reason, description, category });
    return null;
  });
}

export async function markEscalationInProgressAction(escalationId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await markEscalationInProgress(token, escalationId);
    return null;
  });
}

export async function resolveEscalationAction(escalationId: string, resolutionNotes?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await resolveEscalation(token, escalationId, resolutionNotes);
    return null;
  });
}
