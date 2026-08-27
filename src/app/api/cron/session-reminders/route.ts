import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { resolveSessionNotifyContext, notifyClient, notifyCoach, formatSessionTime } from "@/lib/services/sessionNotifications.service";

// Must run fresh on every invocation -- reading request.headers (rather than
// next/headers' headers()) doesn't auto-opt into dynamic rendering, so
// without this Next.js would statically render the response once at build
// time and serve that frozen result to every future cron trigger.
export const dynamic = "force-dynamic";

/** Vercel Cron (see vercel.json's "crons" entry) hits this on a schedule to
 * email both the client and coach ~6 hours before a session starts, with a
 * join link. Time-based, unlike every other notification in this app,
 * which fires off a user action -- nothing else needed a scheduled job
 * before this.
 *
 * The query window is +/-15 min around the 6h mark so a 15-30 min cron
 * interval can't miss a booking that falls between two runs; the actual
 * no-duplicate guard is bookings.reminder_sent_at (migration 0056), not the
 * window -- a booking only ever gets processed once regardless of how many
 * cron runs its scheduled_start falls within the window for.
 *
 * Auth: if CRON_SECRET is set (Vercel sets this automatically as the
 * Authorization bearer token for its own Cron Jobs once the env var
 * exists), any other caller is rejected. Without it, this endpoint would be
 * a public trigger for arbitrary email sends. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now + 5.75 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 6.25 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id, coach_id, scheduled_start, zoom_join_url, zoom_start_url")
    .eq("status", "upcoming")
    .is("reminder_sent_at", null)
    .gte("scheduled_start", windowStart)
    .lte("scheduled_start", windowEnd);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const b of (bookings ?? []) as any[]) {
    try {
      const ctx = await resolveSessionNotifyContext(b.client_id, b.coach_id);
      const sessionTime = formatSessionTime(b.scheduled_start);
      const clientJoinLine = b.zoom_join_url ? `Join here: ${b.zoom_join_url}` : "You'll be able to join from your dashboard when it's time.";
      const coachJoinLine = b.zoom_start_url ? `Start the meeting: ${b.zoom_start_url}` : "You'll be able to start it from your dashboard when it's time.";
      await Promise.all([
        notifyClient(ctx, "session_reminder_client", { coach_name: ctx.coachName ?? "your coach", session_time: sessionTime, join_line: clientJoinLine }),
        notifyCoach(ctx, "session_reminder_coach", { client_name: ctx.clientName, session_time: sessionTime, join_line: coachJoinLine }),
      ]);
      await supabaseAdmin.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
      sent++;
    } catch (err) {
      // One booking's failure (a bad row, a transient email error) must
      // never stop the rest of the sweep from processing.
      console.error(`[session-reminders] failed for booking ${b.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, checked: bookings?.length ?? 0, sent });
}
