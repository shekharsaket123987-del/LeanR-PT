import { getCallerContext } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

export type TimelineEventType =
  | "plan_purchased"
  | "plan_activated"
  | "coach_assigned"
  | "slot_assigned"
  | "session_completed"
  | "session_missed"
  | "session_cancelled"
  | "coach_notes_uploaded"
  | "weekly_measurements_updated"
  | "client_raised_concern"
  | "escalation_created"
  | "escalation_resolved"
  | "pause_started"
  | "pause_ended"
  | "coach_changed"
  | "shadow_coach_assigned"
  | "manual_session_added"
  | "session_rescheduled"
  | "plan_extended"
  | "plan_renewed"
  | "refund_requested"
  | "refund_approved"
  | "plan_completed";

/** System-level: called internally as a side effect of another service's
 * mutation (booking completed, coach changed, escalation raised, etc), same
 * pattern as notifications.service.ts's createFromTemplate() -- a
 * supabaseAdmin-backed helper, not exposed to any portal directly. Entries
 * are permanent: client_timeline_events has no update/delete RLS policy for
 * any role, so nothing in the app layer can delete history either. */
export async function logTimelineEvent(
  clientId: string,
  eventType: TimelineEventType,
  title: string,
  options?: { description?: string; metadata?: Record<string, unknown>; actorId?: string | null }
) {
  const { error } = await supabaseAdmin.from("client_timeline_events").insert({
    client_id: clientId,
    event_type: eventType,
    title,
    description: options?.description ?? null,
    metadata: options?.metadata ?? null,
    actor_id: options?.actorId ?? null,
  });
  if (error) throw error;
}

export interface TimelineEventRow {
  id: string;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

/** RLS-scoped read: admin sees any client's timeline, coach sees their
 * linked clients', client sees their own. */
export async function listClientTimeline(accessToken: string, clientId: string): Promise<TimelineEventRow[]> {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("client_timeline_events")
    .select("id, event_type, title, description, metadata, actor_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as TimelineEventRow[];
}
