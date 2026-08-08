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

/** Backs the Admin scheduling view's "Manual Sessions Created" group --
 * there's no dedicated column marking a booking as admin-created, so this
 * derives it from the audit trigger's own INSERT record (fn_audit_trigger(),
 * migration 0009), which already captures the real actor for every
 * bookings row regardless of which code path created it. */
export async function listAdminCreatedBookingIds(accessToken: string): Promise<string[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: admins, error: adminsError } = await ctx.client.from("profiles").select("id").eq("role", "admin");
  if (adminsError) throw adminsError;
  const adminIds = (admins ?? []).map((a) => a.id);
  if (adminIds.length === 0) return [];

  const { data, error } = await ctx.client
    .from("audit_logs")
    .select("entity_id")
    .eq("entity_type", "bookings")
    .eq("action", "INSERT")
    .in("actor_id", adminIds);
  if (error) throw error;
  return (data ?? []).map((r) => r.entity_id).filter((id): id is string => !!id);
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
