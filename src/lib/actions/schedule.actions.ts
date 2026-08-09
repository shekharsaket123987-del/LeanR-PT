"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getMyCurrentCoachId } from "@/lib/services/clients.service";
import { getMyProfile } from "@/lib/services/profiles.service";
import { getCoach, getCoachPublicInfo } from "@/lib/services/coaches.service";
import { notifyAdmins } from "@/lib/services/notifications.service";
import {
  PatternKey,
  PatternMatchResult,
  changeMyRecurringSchedule,
  createRecurringSlots,
  findAvailableCoach,
  getBookingWindow,
  getMyActiveRecurringSlots,
  keepRenewalSchedule,
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

export interface ScheduleMatchResult extends PatternMatchResult {
  /** Present only when this client had no coach yet and one was just
   * matched by day/time availability — the UI shows who they were paired
   * with, and confirmScheduleAction must be told this exact coach. */
  newCoach?: { id: string; name: string };
}

/** "same": stick with the client's current coach (its own alt-time/pair
 * fallback ladder). "new": require a DIFFERENT coach, exact pattern/time
 * only (mirrors coachChange.service.ts::findCoachChangeOptions's use of the
 * same excludeCoachId knob). "no_preference": try the current coach first
 * (maximizes continuity), then widen to the whole active roster if that
 * comes up empty. Irrelevant/ignored for first-time setup (no current coach
 * to prefer). */
export type CoachPreference = "same" | "new" | "no_preference";

export async function matchScheduleAction(input: {
  pattern: PatternKey;
  preferredTime: string;
  customDays?: number[];
  coachPreference?: CoachPreference;
  /** Only meaningful alongside coachPreference "new" -- the renewal flow's
   * Male/Female/Other/No Preference choice, reusing the demo-booking gender
   * filter. Ignored otherwise. */
  genderPreference?: "male" | "female" | "other";
}): Promise<ActionResult<ScheduleMatchResult | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = await getMyCurrentCoachId(token);

    if (coachId) {
      const preference = input.coachPreference ?? "same";

      if (preference === "new") {
        const match = await findAvailableCoach(token, { ...input, excludeCoachId: coachId, genderPreference: input.genderPreference });
        if (!match) return null;
        const coach: any = await getCoachPublicInfo(match.coachId);
        return { days: match.days, timeOfDay: match.timeOfDay, patternUsed: input.pattern, exact: true, newCoach: { id: match.coachId, name: coach.profile?.full_name ?? "Coach" } };
      }

      const sameCoachMatch = await matchRecurringPattern(token, { coachId, ...input });
      if (sameCoachMatch || preference === "same") return sameCoachMatch;

      // no_preference and the current coach has nothing free: widen to the
      // whole active roster rather than reporting "no match" outright.
      const anyMatch = await findAvailableCoach(token, input);
      if (!anyMatch) return null;
      const coach: any = await getCoachPublicInfo(anyMatch.coachId);
      return { days: anyMatch.days, timeOfDay: anyMatch.timeOfDay, patternUsed: input.pattern, exact: true, newCoach: { id: anyMatch.coachId, name: coach.profile?.full_name ?? "Coach" } };
    }

    // First-time assignment: no coach yet, so search the whole active roster.
    const match = await findAvailableCoach(token, input);
    if (!match) return null;
    const coach: any = await getCoachPublicInfo(match.coachId);
    return {
      days: match.days,
      timeOfDay: match.timeOfDay,
      patternUsed: input.pattern,
      exact: true,
      newCoach: { id: match.coachId, name: coach.profile?.full_name ?? "Coach" },
    };
  });
}

export async function confirmScheduleAction(input: { days: number[]; timeOfDay: string; coachId?: string }): Promise<ActionResult<{ createdSlotIds: string[] }>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = input.coachId ?? (await getMyCurrentCoachId(token));
    if (!coachId) throw new Error("No coach is assigned to your account yet — contact support to get started.");
    const createdSlotIds = await createRecurringSlots(token, { coachId, days: input.days, timeOfDay: input.timeOfDay });
    return { createdSlotIds };
  });
}

/** Client already has a coach + active pattern and wants a different
 * day/time (and possibly a different coach, per matchScheduleAction's
 * coachPreference) -- unlike confirmScheduleAction (first-time setup, only
 * adds slots), this replaces the existing pattern. coachId is the coach
 * already resolved by the preceding matchScheduleAction call; falls back to
 * the client's current coach if omitted (the "Same Trainer" case never
 * bothers passing one explicitly). */
export async function changeScheduleAction(input: {
  days: number[];
  timeOfDay: string;
  coachId?: string;
  /** Only ever set by the renewal-scheduling flow -- bills the new pattern
   * against the renewed plan instead of leaving it unattached. */
  subscriptionId?: string;
}): Promise<ActionResult<{ createdSlotIds: string[] }>> {
  return runAction(async () => {
    const token = await requireToken();
    const coachId = input.coachId ?? (await getMyCurrentCoachId(token));
    if (!coachId) throw new Error("No coach is assigned to your account yet — contact support to get started.");
    return changeMyRecurringSchedule(token, { coachId, days: input.days, timeOfDay: input.timeOfDay, subscriptionId: input.subscriptionId });
  });
}

/** Renewal's "keep as-is" shortcut -- carries the client's current coach and
 * schedule over onto the newly-activated subscription with zero disruption. */
export async function keepRenewalScheduleAction(subscriptionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await keepRenewalSchedule(token, subscriptionId);
    return null;
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
