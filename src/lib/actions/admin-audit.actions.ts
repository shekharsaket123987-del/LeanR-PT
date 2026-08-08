"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listAuditLogs } from "@/lib/services/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

function summarize(action: string, oldData: any, newData: any): string {
  if (action === "INSERT") return "Created";
  if (action === "DELETE") return "Deleted";
  if (oldData && newData) {
    const changedKeys = Object.keys(newData).filter((k) => JSON.stringify(newData[k]) !== JSON.stringify(oldData[k]));
    const interesting = changedKeys.filter((k) => !["updated_at"].includes(k)).slice(0, 3);
    if (interesting.length === 0) return "Updated";
    return interesting.map((k) => `${k}: ${JSON.stringify(oldData[k])} → ${JSON.stringify(newData[k])}`).join(", ");
  }
  return "Updated";
}

/** Cancellation Policy PRD §8 "Activity Log" -- the data has existed since
 * migration 0009 (fn_audit_trigger auto-logs every insert/update/delete on
 * bookings/subscriptions/coach_change_requests/client_profiles/coach_profiles),
 * this is the first UI to read it. */
export async function getAuditLogAction(entityType?: string): Promise<ActionResult<AuditLogEntry[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listAuditLogs(token, entityType ? { entityType } : undefined);

    const actorIds = [...new Set((rows as any[]).map((r) => r.actor_id).filter(Boolean))];
    const actorNameById = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", actorIds);
      for (const a of actors ?? []) actorNameById.set(a.id, a.full_name);
    }

    return (rows as any[]).map((r) => ({
      id: r.id,
      actorName: r.actor_id ? actorNameById.get(r.actor_id) ?? "Unknown" : "System",
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: summarize(r.action, r.old_data, r.new_data),
      createdAt: r.created_at,
    }));
  });
}
