"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  ShadowAssignmentPlan,
  ShadowAssignmentPlanItem,
  ShadowCoverageGap,
  findShadowCoachCandidates,
  listShadowCoverageGaps,
  planShadowAssignments,
} from "@/lib/services/scheduling.service";
import { assignShadowCoach } from "@/lib/services/coachChange.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function listShadowCoverageGapsAction(): Promise<ActionResult<ShadowCoverageGap[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listShadowCoverageGaps(token);
  });
}

/** Manual assignment for a coach who never applied for leave in the system
 * (the one legitimate manual path per FEATURE_SPEC_PORTAL_ENHANCEMENTS.md
 * §4.2.3) -- shares the exact per-occurrence matching + grouping logic the
 * automatic leave-approval path uses (resolveLeave() in
 * availability.service.ts), just triggered on demand instead of by a leave
 * approval event. Returns a plan for the admin to review before anything is
 * actually assigned. */
export async function previewShadowAssignmentPlanAction(
  clientId: string,
  primaryCoachId: string,
  startsOn: string,
  endsOn: string
): Promise<ActionResult<ShadowAssignmentPlan>> {
  return runAction(async () => {
    const token = await requireToken();
    const occurrences = await findShadowCoachCandidates(token, { clientId, primaryCoachId, startsOn, endsOn });
    return planShadowAssignments(occurrences);
  });
}

/** Executes a previously-previewed plan: one assign_shadow_coach() call per
 * (coach, date-range) group, so different shadow coaches on different days
 * are assigned independently rather than one coach overwriting another's
 * coverage. */
export async function confirmShadowAssignmentPlanAction(input: {
  clientId: string;
  primaryCoachId: string;
  plan: ShadowAssignmentPlanItem[];
  reason?: string;
}): Promise<ActionResult<{ assignmentIds: string[] }>> {
  return runAction(async () => {
    const token = await requireToken();
    const assignmentIds: string[] = [];
    for (const item of input.plan) {
      const assignmentId = await assignShadowCoach(token, {
        clientId: input.clientId,
        primaryCoachId: input.primaryCoachId,
        shadowCoachId: item.shadowCoachId,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        reason: input.reason,
      });
      assignmentIds.push(assignmentId);
    }
    return { assignmentIds };
  });
}
