"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listCoachChangeRequests, resolveCoachChangeRequest } from "@/lib/services/coachChange.service";
import { listCoaches } from "@/lib/services/coaches.service";
import { getClientCurrentCoachId } from "@/lib/services/clients.service";

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

    const coaches = (coachRows as any[]).map((c) => ({
      id: c.id,
      name: c.profile?.full_name ?? "Coach",
      specialization: c.specialization ?? null,
    }));
    const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));

    // For still-open requests, the client's coach may have changed (by a
    // separate admin action) since the request was submitted -- resolve the
    // LIVE current coach rather than trusting the snapshot frozen on the
    // request row at submission time, so an admin reviewing this list isn't
    // looking at stale "currently with" info. Resolved requests keep their
    // historical snapshot -- that action already happened against whoever
    // was current back then.
    const requests = await Promise.all(
      (rows as any[]).map(async (r) => {
        let currentCoachId = r.current_coach_id;
        let currentCoachName = r.current_coach?.profile?.full_name ?? "Coach";
        if (r.status === "pending") {
          const liveCoachId = await getClientCurrentCoachId(token, r.client_id);
          if (liveCoachId) {
            currentCoachId = liveCoachId;
            currentCoachName = coachNameById.get(liveCoachId) ?? currentCoachName;
          }
        }
        return {
          id: r.id,
          status: r.status,
          reason: r.reason ?? "",
          submittedDate: r.created_at,
          clientId: r.client_id,
          clientName: r.client?.profile?.full_name ?? "Client",
          clientPhoto: r.client?.profile?.photo_url ?? FALLBACK_PHOTO(r.client_id),
          currentCoachId,
          currentCoachName,
        };
      })
    );

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
