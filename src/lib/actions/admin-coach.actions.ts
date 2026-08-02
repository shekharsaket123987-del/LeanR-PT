"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { CoachSlotPattern, createCoach } from "@/lib/services/coaches.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function createCoachAction(input: {
  fullName: string;
  email: string;
  password: string;
  employeeCode: string;
  specialization: string;
  skills: string[];
  languages: string[];
  slots: CoachSlotPattern[];
}): Promise<ActionResult<{ coachId: string }>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await createCoach(token, input);
    return { coachId };
  });
}
