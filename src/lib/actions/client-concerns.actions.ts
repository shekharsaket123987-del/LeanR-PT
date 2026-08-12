"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { createEscalation, listEscalationsForClient, countUnresolvedEscalationsForClient } from "@/lib/services/escalations.service";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface MyConcernView {
  id: string;
  category: string | null;
  reason: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved";
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listMyConcernsAction(): Promise<ActionResult<MyConcernView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getMyClientProfile(token);
    const rows = await listEscalationsForClient(token, client.id);
    return (rows as any[]).map((r) => ({
      id: r.id,
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

export async function getMyUnresolvedConcernsCountAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getMyClientProfile(token);
    return countUnresolvedEscalationsForClient(token, client.id);
  });
}

export async function raiseConcernAction(category: string, reason: string, description?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    const [client, coachId]: [any, string | null] = await Promise.all([getMyClientProfile(token), getMyCurrentCoachId(token)]);
    await createEscalation(token, { clientId: client.id, coachId: coachId ?? undefined, reason, description, category });
    return null;
  });
}
