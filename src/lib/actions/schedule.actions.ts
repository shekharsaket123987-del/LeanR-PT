"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getMyProfile } from "@/lib/services/profiles.service";
import { getCoach } from "@/lib/services/coaches.service";
import { notifyAdmins } from "@/lib/services/notifications.service";
import {
  PatternKey,
  PatternMatchResult,
  createRecurringSlots,
  getBookingWindow,
  getMyActiveRecurringSlots,
  matchRecurringPattern,
} from "@/lib/services/scheduling.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface ScheduleSetupOptions {
  coach: { id: string; name: string; photo: string; specialization: string } | null;
  startHour: number;
  endHour: number;
  existingSchedule: { dayOfWeek: number; startTime: string }[] | null;
}

export async function getScheduleSetupOptionsAction(): Promise<ActionResult<ScheduleSetupOptions>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);
    const [{ startHour, endHour }, existing] = await Promise.all([getBookingWindow(token), getMyActiveRecurringSlots(token)]);

    let coach: ScheduleSetupOptions["coach"] = null;
    if (coachId) {
      const raw: any = await getCoach(token, coachId);
      coach = {
        id: raw.id,
        name: raw.profile?.full_name ?? "Coach",
        photo: raw.profile?.photo_url ?? `https://i.pravatar.cc/300?u=${raw.id}`,
        specialization: raw.specialization ?? "",
      };
    }

    return {
      coach,
      startHour,
      endHour,
      existingSchedule:
        existing.length > 0 ? existing.map((s: any) => ({ dayOfWeek: s.day_of_week, startTime: s.start_time })) : null,
    };
  });
}

export async function matchScheduleAction(input: {
  pattern: PatternKey;
  preferredTime: string;
  customDays?: number[];
}): Promise<ActionResult<PatternMatchResult | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);
    if (!coachId) throw new Error("No coach is assigned to your account yet — contact support to get started.");
    return matchRecurringPattern(token, { coachId, ...input });
  });
}

export async function confirmScheduleAction(input: { days: number[]; timeOfDay: string }): Promise<ActionResult<{ createdSlotIds: string[] }>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);
    if (!coachId) throw new Error("No coach is assigned to your account yet — contact support to get started.");
    const createdSlotIds = await createRecurringSlots(token, { coachId, days: input.days, timeOfDay: input.timeOfDay });
    return { createdSlotIds };
  });
}

/** Called when the client has tried every option (including their own custom
 * days) and nothing matched — notifies admin to resolve it manually instead
 * of showing a client-facing waitlist. */
export async function reportScheduleUnmatchedAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    const [profile, coachId] = await Promise.all([getMyProfile(token), getMyCurrentCoachId(token)]);
    const coachName = coachId ? ((await getCoach(token, coachId)) as any).profile?.full_name ?? "their coach" : "their coach";
    await notifyAdmins("recurring_schedule_unmatched", {
      client_name: profile.full_name ?? "A client",
      coach_name: coachName,
    });
    return null;
  });
}
