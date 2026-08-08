"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { createProgressLog, ProgressLogInput } from "@/lib/services/progressLogs.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function logMeasurementAction(clientId: string, input: ProgressLogInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await createProgressLog(token, clientId, input);
    return null;
  });
}
