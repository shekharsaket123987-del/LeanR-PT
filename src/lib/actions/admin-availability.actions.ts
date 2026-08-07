"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getAvailabilityCheck, AvailabilityCheckSlot } from "@/lib/services/scheduling.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export type { AvailabilityCheckSlot };

export async function getAvailabilityCheckAction(date: string): Promise<ActionResult<AvailabilityCheckSlot[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return getAvailabilityCheck(token, date);
  });
}
