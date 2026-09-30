import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { deriveClientStatus, ClientStatus } from "@/lib/client-status";
import { isMeasurementStale } from "@/lib/services/progressLogs.service";
import { insertAIBuddyMessage } from "@/lib/services/aiBuddyMessages.service";
import { notifyUser } from "@/lib/services/notifications.service";
import { isoWeek } from "@/lib/services/aiWeeklyRatings.service";

export const dynamic = "force-dynamic";

/** Which statuses are "engaged enough" to nudge -- not_paid (never even
 * booked a demo) and expired clients are excluded, same reasoning
 * client-status.ts documents for each bucket. */
const NUDGEABLE_STATUSES: ReadonlySet<ClientStatus> = new Set(["demo", "created", "active", "paused"]);

const NUDGE_COPY: Record<"missed_session" | "inactivity" | "measurement_stale" | "weekly_feedback", string> = {
  missed_session:
    "Hey, I noticed you missed a session -- no worries, it happens. Want to get back on track? I can help you understand your options, or you can raise a concern if something got in the way.",
  inactivity: "It's been a quiet week on your plan. A small step today keeps the momentum going -- how are you feeling about your goals?",
  measurement_stale: "Quick nudge: your measurements are due for an update. Logging them helps your coach (and me!) actually see your progress.",
  weekly_feedback: "Got a minute? I'd love your honest rating on this week -- your session, your coach, and the app itself. It helps us actually fix things.",
};

/** Daily sweep: finds clients who missed a session, went quiet, or are
 * overdue on measurements, and leaves them a proactive AI Relationship Manager
 * message + notification -- at most once per trigger per period, enforced
 * by ai_buddy_nudges' unique constraint via the upsert/ignoreDuplicates
 * pattern below rather than app-level locking. Deterministic copy, not an
 * LLM call, to keep a platform-wide sweep cheap and avoid burning API spend
 * on a cron. Same CRON_SECRET bearer-auth pattern as session-reminders. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const week = isoWeek(now);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: allSubs, error: subsError }, { data: demoBookings, error: demoError }, { data: clientRows, error: clientsError }] =
    await Promise.all([
      supabaseAdmin.from("subscriptions").select("client_id, status"),
      supabaseAdmin.from("bookings").select("client_id").eq("session_type", "assessment").in("status", ["upcoming", "completed", "missed"]),
      supabaseAdmin.from("client_profiles").select("id, profile_id"),
    ]);
  if (subsError || demoError || clientsError) {
    return NextResponse.json({ error: (subsError ?? demoError ?? clientsError)?.message }, { status: 500 });
  }

  const statusesByClient = new Map<string, string[]>();
  for (const s of allSubs ?? []) {
    const list = statusesByClient.get(s.client_id) ?? [];
    list.push(s.status);
    statusesByClient.set(s.client_id, list);
  }
  const demoClientIds = new Set((demoBookings ?? []).map((b) => b.client_id));
  const profileByClient = new Map((clientRows ?? []).map((c) => [c.id, c.profile_id]));

  const eligibleClientIds = (clientRows ?? [])
    .map((c) => c.id)
    .filter((id) => NUDGEABLE_STATUSES.has(deriveClientStatus(statusesByClient.get(id) ?? [], demoClientIds.has(id))));
  const activeOrPausedIds = new Set(
    (clientRows ?? [])
      .map((c) => c.id)
      .filter((id) => ["active", "paused"].includes(deriveClientStatus(statusesByClient.get(id) ?? [], demoClientIds.has(id))))
  );

  let triggered = 0;

  // -- missed_session: any missed booking in the last 24h.
  const { data: missedBookings } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id")
    .eq("status", "missed")
    .gte("scheduled_start", dayAgo)
    .in("client_id", eligibleClientIds.length > 0 ? eligibleClientIds : ["00000000-0000-0000-0000-000000000000"]);
  if (missedBookings && missedBookings.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("ai_buddy_nudges")
      .upsert(
        missedBookings.map((b) => ({ client_id: b.client_id, trigger_type: "missed_session", dedup_key: b.id })),
        { onConflict: "client_id,trigger_type,dedup_key", ignoreDuplicates: true }
      )
      .select("client_id");
    for (const row of inserted ?? []) {
      await fireNudge(row.client_id, "missed_session", profileByClient.get(row.client_id));
      triggered++;
    }
  }

  // -- inactivity: active/paused client, no completed session in 7 days.
  const { data: recentCompleted } = await supabaseAdmin
    .from("bookings")
    .select("client_id")
    .eq("status", "completed")
    .gte("scheduled_start", weekAgo);
  const recentlyActiveIds = new Set((recentCompleted ?? []).map((b) => b.client_id));
  const inactiveIds = [...activeOrPausedIds].filter((id) => !recentlyActiveIds.has(id));
  if (inactiveIds.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("ai_buddy_nudges")
      .upsert(
        inactiveIds.map((id) => ({ client_id: id, trigger_type: "inactivity", dedup_key: week })),
        { onConflict: "client_id,trigger_type,dedup_key", ignoreDuplicates: true }
      )
      .select("client_id");
    for (const row of inserted ?? []) {
      await fireNudge(row.client_id, "inactivity", profileByClient.get(row.client_id));
      triggered++;
    }
  }

  // -- measurement_stale: eligible client, no recent enough progress_logs row.
  const { data: measurements } = await supabaseAdmin
    .from("progress_logs")
    .select("client_id, logged_at")
    .in("client_id", eligibleClientIds.length > 0 ? eligibleClientIds : ["00000000-0000-0000-0000-000000000000"])
    .order("logged_at", { ascending: false });
  const lastLoggedByClient = new Map<string, string>();
  for (const m of measurements ?? []) {
    if (!lastLoggedByClient.has(m.client_id)) lastLoggedByClient.set(m.client_id, m.logged_at);
  }
  const staleIds = eligibleClientIds.filter((id) => isMeasurementStale(lastLoggedByClient.get(id) ?? null));
  if (staleIds.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("ai_buddy_nudges")
      .upsert(
        staleIds.map((id) => ({ client_id: id, trigger_type: "measurement_stale", dedup_key: week })),
        { onConflict: "client_id,trigger_type,dedup_key", ignoreDuplicates: true }
      )
      .select("client_id");
    for (const row of inserted ?? []) {
      await fireNudge(row.client_id, "measurement_stale", profileByClient.get(row.client_id));
      triggered++;
    }
  }

  // -- weekly_feedback: active/paused client who hasn't already submitted
  // this week's rating (checked directly, not just deduped by nudge history
  // -- a client who rated unprompted, e.g. right after a bad session,
  // shouldn't also get asked again).
  const { data: ratedThisWeek } = await supabaseAdmin.from("ai_weekly_ratings").select("client_id").eq("week", week);
  const ratedIds = new Set((ratedThisWeek ?? []).map((r) => r.client_id));
  const feedbackTargetIds = [...activeOrPausedIds].filter((id) => !ratedIds.has(id));
  if (feedbackTargetIds.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("ai_buddy_nudges")
      .upsert(
        feedbackTargetIds.map((id) => ({ client_id: id, trigger_type: "weekly_feedback", dedup_key: week })),
        { onConflict: "client_id,trigger_type,dedup_key", ignoreDuplicates: true }
      )
      .select("client_id");
    for (const row of inserted ?? []) {
      await fireNudge(row.client_id, "weekly_feedback", profileByClient.get(row.client_id));
      triggered++;
    }
  }

  return NextResponse.json({ ok: true, eligibleClients: eligibleClientIds.length, triggered });
}

async function fireNudge(
  clientId: string,
  trigger: "missed_session" | "inactivity" | "measurement_stale" | "weekly_feedback",
  profileId?: string
) {
  try {
    await insertAIBuddyMessage(clientId, "assistant", NUDGE_COPY[trigger], null, { ratingRequest: trigger === "weekly_feedback" });
    if (profileId) await notifyUser(profileId, `ai_buddy_nudge_${trigger}`);
  } catch (err) {
    console.error(`[ai-buddy-nudges] failed for client ${clientId} (${trigger}):`, err instanceof Error ? err.message : err);
  }
}
