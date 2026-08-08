"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listPendingLeave, resolveLeave, LeaveResolutionSummary } from "@/lib/services/availability.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminLeaveRequestView {
  id: string;
  coachId: string;
  coachName: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
  submittedAt: string;
  leaveType: "full_day" | "partial";
  partialStartTime: string | null;
  partialEndTime: string | null;
}

export async function listPendingLeaveAction(): Promise<ActionResult<AdminLeaveRequestView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listPendingLeave(token);
    return (rows as any[]).map((r) => ({
      id: r.id,
      coachId: r.coach_id,
      coachName: r.coach?.profile?.full_name ?? "Coach",
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      reason: r.reason,
      submittedAt: r.created_at,
      leaveType: r.leave_type ?? "full_day",
      partialStartTime: r.partial_start_time,
      partialEndTime: r.partial_end_time,
    }));
  });
}

export async function resolveLeaveAction(leaveId: string, status: "approved" | "rejected"): Promise<ActionResult<LeaveResolutionSummary>> {
  return runAction(async () => {
    const token = await requireToken();
    return resolveLeave(token, leaveId, status);
  });
}
