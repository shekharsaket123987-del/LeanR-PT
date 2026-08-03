import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { logTimelineEvent } from "./timeline.service";

export async function listAuditLogs(accessToken: string, filter?: { entityType?: string; entityId?: string }) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  let query = ctx.client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter?.entityType) query = query.eq("entity_type", filter.entityType);
  if (filter?.entityId) query = query.eq("entity_id", filter.entityId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** No payment gateway exists in this codebase (deliberate Phase 1 boundary,
 * see docs/business-rules.md) — this logs a refund request for ops
 * follow-up rather than moving any money. Backs the admin client-detail
 * "Log Refund Request" control. */
export async function logRefundRequest(accessToken: string, clientId: string, amountRupees: number, reason: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  await writeAuditLog(ctx.userId, "refund_requested", "client_profiles", clientId, { amountRupees, reason });
  await logTimelineEvent(clientId, "refund_requested", `Refund requested: ₹${amountRupees}`, { description: reason, actorId: ctx.userId });
}

/** Most auditing happens automatically via the fn_audit_trigger() DB trigger
 * (migration 0009) on bookings/subscriptions/coach_change_requests/
 * client_profiles/coach_profiles. Use this only for actions that aren't a
 * simple row diff on those tables, e.g. login events. */
export async function writeAuditLog(actorId: string | null, action: string, entityType: string, entityId: string | null, meta?: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    new_data: meta ?? null,
  });
  if (error) throw error;
}
