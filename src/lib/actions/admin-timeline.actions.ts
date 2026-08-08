"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listClientTimeline, TimelineEventRow } from "@/lib/services/timeline.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function getClientTimelineAction(clientId: string): Promise<ActionResult<TimelineEventRow[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listClientTimeline(token, clientId);
  });
}
