import { getCallerContext, requireRole } from "./_auth";
import { logTimelineEvent } from "./timeline.service";
import { createFromTemplate } from "./notifications.service";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

/** Internal, role-agnostic lookup (bypasses the admin/coach-only
 * getClientCurrentCoachId in clients.service.ts, which would reject a
 * client-role caller) -- same prefer-active-slot, fall-back-to-latest-
 * booking resolution, used only to address the progress-update notification
 * below. */
async function findCurrentCoachIdForNotification(clientId: string): Promise<string | null> {
  const { data: activeSlot } = await supabaseAdmin
    .from("recurring_slots")
    .select("coach_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeSlot?.coach_id) return activeSlot.coach_id;

  const { data: latestBooking } = await supabaseAdmin
    .from("bookings")
    .select("coach_id")
    .eq("client_id", clientId)
    .order("scheduled_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestBooking?.coach_id ?? null;
}

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

  // Only a genuine client-initiated update notifies the coach -- an admin
  // backfill/correction on the client's behalf isn't "the client updated
  // their progress" per PRD §1's notification list.
  if (ctx.role === "client") {
    const coachId = await findCurrentCoachIdForNotification(targetClientId);
    if (coachId) {
      const [{ data: coach }, { data: client }] = await Promise.all([
        supabaseAdmin.from("coach_profiles").select("profile_id").eq("id", coachId).maybeSingle(),
        supabaseAdmin.from("client_profiles").select("profile:profiles(full_name)").eq("id", targetClientId).maybeSingle(),
      ]);
      if (coach) {
        await createFromTemplate("client_progress_updated", coach.profile_id, {
          client_name: (client as any)?.profile?.full_name ?? "Client",
        });
      }
    }
  }

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
