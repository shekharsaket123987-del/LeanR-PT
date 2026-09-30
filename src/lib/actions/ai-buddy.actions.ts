"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listMyAIBuddyMessages, AIBuddyMessageRow } from "@/lib/services/aiBuddyMessages.service";
import { submitWeeklyRating, WeeklyRatingInput } from "@/lib/services/aiWeeklyRatings.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export type { AIBuddyMessageRow };

/** History load only -- sending a message goes through POST /api/ai-buddy/chat
 * directly from the client component, since a Server Action can't stream a
 * response body back. */
export async function getAIBuddyHistoryAction(): Promise<ActionResult<AIBuddyMessageRow[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listMyAIBuddyMessages(token);
  });
}

/** Submits the client's response to a weekly rating_request card in the AI
 * RM chat -- a plain form submit, unlike sending a chat message, so a
 * Server Action (not a streamed route) is the right fit here. */
export async function submitWeeklyRatingAction(input: WeeklyRatingInput): Promise<ActionResult<{ escalationRaised: boolean }>> {
  return runAction(async () => {
    const token = await requireToken();
    return submitWeeklyRating(token, input);
  });
}
