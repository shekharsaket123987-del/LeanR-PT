"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  requestCoachChange,
  getMyLatestCoachChangeRequest,
  findCoachChangeOptions,
  completeCoachChange,
} from "@/lib/services/coachChange.service";
import { PatternKey } from "@/lib/services/scheduling.service";
import { getCoachPublicInfo } from "@/lib/services/coaches.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface MyCoachChangeRequestView {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  newCoachId: string | null;
  createdAt: string;
}

export async function getMyCoachChangeRequestAction(): Promise<ActionResult<MyCoachChangeRequestView | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const r: any = await getMyLatestCoachChangeRequest(token);
    if (!r) return null;
    return { id: r.id, status: r.status, reason: r.reason, newCoachId: r.new_coach_id, createdAt: r.created_at };
  });
}

export async function requestCoachChangeAction(input: {
  reason: string;
  overallExperience?: number;
  coachRating?: number;
  additionalComments?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await requestCoachChange(token, input);
    return null;
  });
}

export interface CoachChangeOptionView {
  coachId: string;
  coachName: string;
  days: number[];
  timeOfDay: string;
}

export async function findCoachChangeOptionsAction(
  requestId: string,
  input: { pattern: PatternKey; preferredTime: string; customDays?: number[] }
): Promise<ActionResult<CoachChangeOptionView | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const match = await findCoachChangeOptions(token, requestId, input);
    if (!match) return null;
    // getCoachPublicInfo (not the client's own RLS-scoped read) -- the
    // client has no relationship with this newly-matched coach yet, same
    // reasoning as demoBooking.service.ts's findDemoSlots fix.
    const coach: any = await getCoachPublicInfo(match.coachId);
    return { coachId: match.coachId, coachName: coach.profile?.full_name ?? "Coach", days: match.days, timeOfDay: match.timeOfDay };
  });
}

export async function completeCoachChangeAction(requestId: string, chosenCoachId: string, days: number[], timeOfDay: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await completeCoachChange(token, requestId, chosenCoachId, days, timeOfDay);
    return null;
  });
}
