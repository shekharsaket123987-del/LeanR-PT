import { getCallerContext, requireRole } from "./_auth";
import { logTimelineEvent } from "./timeline.service";

export interface ProgressLogInput {
  weight?: number;
  bodyFatPct?: number;
  musclePct?: number;
  waist?: number;
  chest?: number;
  hip?: number;
  arms?: number;
  thigh?: number;
  notes?: string;
}

/** Admin logs on a client's behalf (clientId required) or a client logs
 * their own (clientId ignored, forced to self) -- mirrors the pattern
 * already used for escalations.service.ts::createEscalation. */
export async function createProgressLog(accessToken: string, clientId: string, input: ProgressLogInput) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "client"]);

  let targetClientId = clientId;
  if (ctx.role === "client") {
    const { data: client, error } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
    if (error || !client) throw error ?? new Error("Client profile not found");
    targetClientId = client.id;

    // Once-per-week rule applies to client self-service only -- admin's
    // "Log Measurement" stays unrestricted for backfill/correction.
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: recent, error: recentError } = await ctx.client
      .from("progress_logs")
      .select("id")
      .eq("client_id", targetClientId)
      .gte("logged_at", weekAgo.toISOString())
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;
    if (recent) throw new Error("You've already submitted a measurement update this week -- next update available in a few days.");
  }

  const { data, error } = await ctx.client
    .from("progress_logs")
    .insert({
      client_id: targetClientId,
      weight: input.weight ?? null,
      body_fat_pct: input.bodyFatPct ?? null,
      muscle_pct: input.musclePct ?? null,
      waist: input.waist ?? null,
      chest: input.chest ?? null,
      hip: input.hip ?? null,
      arms: input.arms ?? null,
      thigh: input.thigh ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await logTimelineEvent(targetClientId, "weekly_measurements_updated", "Weekly measurements updated", {
    actorId: ctx.userId,
    metadata: { progressLogId: data.id },
  });

  return data;
}

export async function listProgressLogsForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("progress_logs").select("*").eq("client_id", clientId).order("logged_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Latest measurement recorded on or before the given date -- backs the
 * admin session-detail page's "Weekly Progress Snapshot". */
export async function getLatestProgressLogBefore(accessToken: string, clientId: string, beforeIso: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("progress_logs")
    .select("*")
    .eq("client_id", clientId)
    .lte("logged_at", beforeIso)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
