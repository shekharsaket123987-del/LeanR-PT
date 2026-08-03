"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { ShadowCoachCandidate, findShadowCoachCandidates } from "@/lib/services/scheduling.service";
import { assignShadowCoach } from "@/lib/services/coachChange.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function findShadowCoachCandidatesAction(
  clientId: string,
  primaryCoachId: string,
  startsOn: string,
  endsOn: string
): Promise<ActionResult<ShadowCoachCandidate[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return findShadowCoachCandidates(token, { clientId, primaryCoachId, startsOn, endsOn });
  });
}

export async function assignShadowCoachAction(input: {
  clientId: string;
  primaryCoachId: string;
  shadowCoachId: string;
  startsOn: string;
  endsOn: string;
  reason?: string;
}): Promise<ActionResult<{ assignmentId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const assignmentId = await assignShadowCoach(token, input);
    return { assignmentId };
  });
}
