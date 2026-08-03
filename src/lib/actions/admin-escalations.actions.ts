"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { createEscalation, resolveEscalation, markEscalationInProgress, listEscalationsForClient } from "@/lib/services/escalations.service";

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
