"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  createEscalation,
  listEscalationsForClient,
  countUnresolvedEscalationsForClient,
  listEscalationNotesForClient,
} from "@/lib/services/escalations.service";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface MyConcernNoteView {
  note: string;
  createdAt: string;
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
  /** Admin's progress updates while working the case -- what LEANR has
   * done so far, shown to the client even before the case is fully
   * resolved (see escalation_notes_select_own_client RLS). */
  notes: MyConcernNoteView[];
}

export async function listMyConcernsAction(): Promise<ActionResult<MyConcernView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getMyClientProfile(token);
    const [rows, notes]: [any[], any[]] = await Promise.all([
      listEscalationsForClient(token, client.id),
      listEscalationNotesForClient(token, client.id),
    ]);
    const notesByEscalation = new Map<string, MyConcernNoteView[]>();
    for (const n of notes) {
      const list = notesByEscalation.get(n.escalation_id) ?? [];
      list.push({ note: n.note, createdAt: n.created_at });
      notesByEscalation.set(n.escalation_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolutionNotes: r.resolution_notes,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      notes: notesByEscalation.get(r.id) ?? [],
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
