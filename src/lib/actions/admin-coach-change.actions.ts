"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listCoachChangeRequests, resolveCoachChangeRequest } from "@/lib/services/coachChange.service";
import { listCoaches } from "@/lib/services/coaches.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

export interface AdminCoachChangeRequestView {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  submittedDate: string;
  clientId: string;
  clientName: string;
  clientPhoto: string;
  currentCoachId: string;
  currentCoachName: string;
}

export interface AdminCoachOption {
  id: string;
  name: string;
  specialization: string | null;
}

export interface AdminCoachChangeRequestsData {
  requests: AdminCoachChangeRequestView[];
  coaches: AdminCoachOption[];
}

export async function listCoachChangeRequestsAction(): Promise<ActionResult<AdminCoachChangeRequestsData>> {
  return runAction(async () => {
    const token = await requireToken();
    const [rows, coachRows] = await Promise.all([listCoachChangeRequests(token), listCoaches(token)]);

    const requests = (rows as any[]).map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason ?? "",
      submittedDate: r.created_at,
      clientId: r.client_id,
      clientName: r.client?.profile?.full_name ?? "Client",
      clientPhoto: r.client?.profile?.photo_url ?? FALLBACK_PHOTO(r.client_id),
      currentCoachId: r.current_coach_id,
      currentCoachName: r.current_coach?.profile?.full_name ?? "Coach",
    }));

    const coaches = (coachRows as any[]).map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "Coach",
      specialization: c.specialization ?? null,
    }));

    return { requests, coaches };
  });
}

export async function resolveCoachChangeRequestAction(
  requestId: string,
  decision: { approve: boolean; newCoachId?: string }
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await resolveCoachChangeRequest(token, requestId, decision);
    return null;
  });
}
