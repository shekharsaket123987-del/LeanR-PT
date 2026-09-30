import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getMyClientProfile, getMyCurrentCoachId } from "./clients.service";
import { createEscalation } from "./escalations.service";
import { insertAIBuddyMessage } from "./aiBuddyMessages.service";

/** Same ISO-week definition as the nudge cron's isoWeek() (ai-buddy-nudges/
 * route.ts) -- the client's "this week" and the cron's dedup_key must agree,
 * or a client could submit right after being asked and the cron would still
 * think it's unanswered next sweep. */
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo}`;
}

const LOW_RATING_THRESHOLD = 2;

export interface WeeklyRatingInput {
  sessionRating: number;
  coachRating: number;
  platformRating: number;
  feedbackText?: string;
}

/** Client submits their weekly rating (in-chat widget, AIBuddyChatClient) --
 * always for the *current* week (one row per client per ISO week, enforced
 * by ai_weekly_ratings' unique constraint). A score of 2 or below on any
 * dimension immediately raises a concern, same "don't wait to be asked"
 * principle as the safety pre-check. */
export async function submitWeeklyRating(
  accessToken: string,
  input: WeeklyRatingInput
): Promise<{ escalationRaised: boolean }> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const [client, coachId] = await Promise.all([getMyClientProfile(accessToken), getMyCurrentCoachId(accessToken)]);
  const clientId = (client as { id: string }).id;
  const week = isoWeek(new Date());

  const { error } = await ctx.client.from("ai_weekly_ratings").insert({
    client_id: clientId,
    coach_id: coachId ?? null,
    week,
    session_rating: input.sessionRating,
    coach_rating: input.coachRating,
    platform_rating: input.platformRating,
    feedback_text: input.feedbackText ?? null,
  });
  if (error) throw error;

  const lowDims: string[] = [];
  if (input.sessionRating <= LOW_RATING_THRESHOLD) lowDims.push("session quality");
  if (input.coachRating <= LOW_RATING_THRESHOLD) lowDims.push("coach");
  if (input.platformRating <= LOW_RATING_THRESHOLD) lowDims.push("platform/app");

  let escalationRaised = false;
  if (lowDims.length > 0) {
    const onlyPlatform = lowDims.length === 1 && lowDims[0] === "platform/app";
    const category = onlyPlatform ? "technical_issue" : "service_feedback";
    const scoresLine = `Scores this week -- session: ${input.sessionRating}/5, coach: ${input.coachRating}/5, platform: ${input.platformRating}/5.`;
    await createEscalation(accessToken, {
      clientId,
      coachId: coachId ?? undefined,
      reason: `Low weekly rating: ${lowDims.join(", ")}`,
      description: `${scoresLine}${input.feedbackText ? ` Client comment: "${input.feedbackText}"` : ""}`,
      category,
      source: "ai_rm",
      level: "L2",
      triggerRule: "R-LOW-WEEKLY-RATING",
      aiSummary: "Client's weekly rating included a score of 2/5 or below on at least one dimension.",
    });
    escalationRaised = true;
  }

  await insertAIBuddyMessage(
    clientId,
    "assistant",
    escalationRaised
      ? "Thanks for the honest feedback -- I've flagged this for the team to look into."
      : "Thanks for the feedback! It genuinely helps."
  );

  return { escalationRaised };
}

/** CoachPerformancePanel's AI RM breakdown -- averages across every weekly
 * rating this coach has been rated in, independent of coach_profiles.rating
 * (which is driven only by the older per-booking trainer_rating). */
export async function getCoachRatingBreakdown(
  coachId: string
): Promise<{ avgCoachRating: number; avgSessionRating: number; ratingCount: number }> {
  const { data, error } = await supabaseAdmin.from("ai_weekly_ratings").select("coach_rating, session_rating").eq("coach_id", coachId);
  if (error) throw error;
  const rows = (data ?? []) as { coach_rating: number; session_rating: number }[];
  if (rows.length === 0) return { avgCoachRating: 0, avgSessionRating: 0, ratingCount: 0 };
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    avgCoachRating: round1(rows.reduce((s, r) => s + r.coach_rating, 0) / rows.length),
    avgSessionRating: round1(rows.reduce((s, r) => s + r.session_rating, 0) / rows.length),
    ratingCount: rows.length,
  };
}

/** Admin dashboard's platform-wide tech/app rating -- the one dimension
 * that has no other home anywhere else in the app. */
export async function getPlatformRatingBreakdown(accessToken: string): Promise<{ avgPlatformRating: number; ratingCount: number }> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("ai_weekly_ratings").select("platform_rating");
  if (error) throw error;
  const rows = (data ?? []) as { platform_rating: number }[];
  if (rows.length === 0) return { avgPlatformRating: 0, ratingCount: 0 };
  return {
    avgPlatformRating: Math.round((rows.reduce((s, r) => s + r.platform_rating, 0) / rows.length) * 10) / 10,
    ratingCount: rows.length,
  };
}

/** Has this client already submitted this week's rating? Used to decide
 * whether the cron should still ask, and whether the chat panel should
 * still show the widget vs. a "already submitted" state. */
export async function hasSubmittedThisWeek(accessToken: string): Promise<boolean> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const client = await getMyClientProfile(accessToken);
  const { data, error } = await ctx.client
    .from("ai_weekly_ratings")
    .select("id")
    .eq("client_id", (client as { id: string }).id)
    .eq("week", isoWeek(new Date()))
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
