import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";
import { ClientStatus, CLIENT_STATUS_LABELS, deriveClientStatus } from "@/lib/client-status";

export type { ClientStatus };
export { CLIENT_STATUS_LABELS, deriveClientStatus };

/** Live read of exactly the two signals deriveClientStatus() needs, for a
 * single client -- used to snapshot "before" and "after" a mutation so
 * callers can detect whether the composite status actually changed, without
 * every mutation site re-deriving this by hand. Deliberately a fresh query
 * each time (no caching) since it's only ever called immediately before/
 * after a write, on the admin-only mutation paths (never a list render). */
export async function getClientStatusSnapshot(clientId: string): Promise<ClientStatus> {
  const [{ data: subs, error: subsError }, { data: demo, error: demoError }] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("status").eq("client_id", clientId),
    supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("client_id", clientId)
      .eq("session_type", "assessment")
      .in("status", ["upcoming", "completed", "missed"])
      .limit(1),
  ]);
  if (subsError) throw subsError;
  if (demoError) throw demoError;
  return deriveClientStatus((subs ?? []).map((s) => s.status as string), (demo ?? []).length > 0);
}

/** Logs a `client_status_changed` timeline event iff the composite status
 * actually moved between the caller's "before" snapshot and right now --
 * a no-op otherwise (e.g. renewing while already active). Call this AFTER
 * the mutation has committed, passing the snapshot taken just before it. */
export async function logClientStatusChange(clientId: string, before: ClientStatus, actorId: string | null) {
  const after = await getClientStatusSnapshot(clientId);
  if (after === before) return;
  await logTimelineEvent(clientId, "client_status_changed", `Status changed to ${CLIENT_STATUS_LABELS[after]}`, {
    description: `${CLIENT_STATUS_LABELS[before]} → ${CLIENT_STATUS_LABELS[after]}`,
    actorId,
    metadata: { from: before, to: after },
  });
}
