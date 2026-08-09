"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyClientProfile } from "@/lib/services/clients.service";
import { getSubscriptionsForClient } from "@/lib/services/subscriptions.service";
import { SESSIONS_LOW_THRESHOLD } from "@/lib/services/planPurchase.service";
import { createProgressLog, ProgressLogInput } from "@/lib/services/progressLogs.service";
import { RenewalOpportunityRow, listRenewalOpportunities } from "@/lib/services/renewals.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface SessionsLowStatus {
  isLow: boolean;
  sessionsRemaining: number;
}

/** Backs the client portal's low-sessions reminder (SessionsLowGateModal) --
 * "low" mirrors the exact threshold purchaseMyPlan uses to allow a renewal,
 * so "Renew Now" always works the moment the reminder starts appearing. */
export async function getSessionsLowStatusAction(): Promise<ActionResult<SessionsLowStatus>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    const subs = await getSubscriptionsForClient(token, (client as any).id);
    const activeSub = (subs as any[]).find((s) => s.status === "active");
    const remaining: number | null = activeSub?.usage?.sessions_remaining ?? null;
    const isLow = remaining !== null && remaining > 0 && remaining <= SESSIONS_LOW_THRESHOLD;
    return { isLow, sessionsRemaining: remaining ?? 0 };
  });
}

export async function getRenewalOpportunitiesAction(): Promise<ActionResult<RenewalOpportunityRow[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listRenewalOpportunities(token);
  });
}

/** Logs the renewal check-in's fresh baseline measurement -- bypasses the
 * normal once-a-week self-service limit (see createProgressLog's doc
 * comment) since this is tied to the new plan's activation, not the
 * calendar week. Once this exists, checkRenewalStage naturally advances the
 * client past "renewal_checkin" on their next page load -- no separate
 * "stage complete" flag to set. */
export async function submitRenewalCheckinAction(input: ProgressLogInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    const client = await getMyClientProfile(token);
    await createProgressLog(token, (client as any).id, input, { skipWeeklyLimit: true });
    return null;
  });
}
