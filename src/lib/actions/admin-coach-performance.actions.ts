"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getCoachPerformance, CoachPerformance } from "@/lib/services/coachPerformance.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function getCoachPerformanceAction(coachId: string): Promise<ActionResult<CoachPerformance>> {
  return runAction(async () => {
    const token = await requireToken();
    return getCoachPerformance(token, coachId);
  });
}
