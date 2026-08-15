import { getCallerContext } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

export type TimelineEventType =
  | "plan_purchased"
  | "plan_activated"
  | "onboarding_completed"
  | "coach_assigned"
  | "slot_assigned"
  | "session_completed"
  | "session_missed"
  | "attendance_marked_present"
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
  | "plan_completed"
  | "plan_promise_adjusted";

/** Which timeline column an event belongs to -- "internal" is staff/coach/
 * admin/system action on the client's record, "customer" is something the
 * client did themselves (or a record that's fundamentally about the
 * client's own interaction history, e.g. a concern they raised). Fixed per
 * event_type rather than derived from who technically clicked the button,
 * so e.g. an admin backfilling a client's weight on their behalf still
 * renders as a customer-side measurement, not an admin action. */
export type TimelineSide = "internal" | "customer";

/** cancelBooking()/rescheduleBooking() are callable by both staff and the
 * client themselves (bookings.service.ts) -- for these two, the fixed
 * event_type default below is only a fallback for a null/unresolved actor;
 * listClientTimeline() overrides it per-row using the actual actor's role,
 * so a client's own reschedule renders on their side, not staff's. */
export const ACTOR_DEPENDENT_SIDE_TYPES: ReadonlySet<TimelineEventType> = new Set(["session_cancelled", "session_rescheduled"]);

export const TIMELINE_EVENT_SIDE: Record<TimelineEventType, TimelineSide> = {
  plan_purchased: "internal",
  plan_activated: "internal",
  onboarding_completed: "customer",
  coach_assigned: "internal",
  slot_assigned: "internal",
  session_completed: "internal",
  session_missed: "internal",
  attendance_marked_present: "internal",
  session_cancelled: "internal",
  coach_notes_uploaded: "internal",
  weekly_measurements_updated: "customer",
  client_raised_concern: "customer",
  escalation_created: "customer",
  escalation_resolved: "customer",
  pause_started: "internal",
  pause_ended: "internal",
  coach_changed: "internal",
  shadow_coach_assigned: "internal",
  manual_session_added: "internal",
  session_rescheduled: "internal",
  plan_extended: "internal",
  plan_renewed: "internal",
  refund_requested: "internal",
  refund_approved: "internal",
  plan_completed: "internal",
  plan_promise_adjusted: "internal",
};

/** Who/what to show on the card's "Added by" line. "staff" and "customer"
 * come from the actor's own profiles.role; "system" is the fallback for an
 * internal-side event with no actor (an automated transition); "unknown"
 * renders as N/A -- e.g. an admin logging a concern on a client's behalf,
 * where the row deliberately has no actor (see escalations.service.ts). */
export type TimelineActorSource = "staff" | "system" | "customer" | "unknown";

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
  /** Always null today -- client_timeline_events is append-only (no
   * update/delete RLS policy for any role, see migration 0018), so no
   * write path can ever populate this yet. Kept on the row shape so the
   * timeline UI's "Updated At" sub-line is ready the moment an editable
   * event source (e.g. revisable session notes) exists, without another
   * shape change. */
  updated_at: string | null;
  side: TimelineSide;
  actor_source: TimelineActorSource;
  actor_name: string | null;
}

type ActorEmbed = { full_name: string | null; role: "admin" | "coach" | "client" } | null;

/** RLS-scoped read: admin sees any client's timeline, coach sees their
 * linked clients', client sees their own. Resolves each row's actor
 * (for the "Added by" line) and column (internal vs customer) so the
 * two-column timeline UI stays a pure display layer. */
export async function listClientTimeline(accessToken: string, clientId: string): Promise<TimelineEventRow[]> {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("client_timeline_events")
    .select("id, event_type, title, description, metadata, actor_id, created_at, actor:profiles(full_name, role)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data as unknown as (Omit<TimelineEventRow, "updated_at" | "side" | "actor_source" | "actor_name"> & { actor: ActorEmbed })[]).map(
    (row) => {
      const actor = row.actor;
      const isClientActor = actor?.role === "client";
      const side: TimelineSide =
        ACTOR_DEPENDENT_SIDE_TYPES.has(row.event_type) && actor
          ? isClientActor
            ? "customer"
            : "internal"
          : TIMELINE_EVENT_SIDE[row.event_type] ?? "internal";
      const actor_source: TimelineActorSource = actor ? (isClientActor ? "customer" : "staff") : side === "internal" ? "system" : "unknown";
      return {
        id: row.id,
        event_type: row.event_type,
        title: row.title,
        description: row.description,
        metadata: row.metadata,
        actor_id: row.actor_id,
        created_at: row.created_at,
        updated_at: null,
        side,
        actor_source,
        actor_name: actor?.full_name ?? null,
      };
    }
  );
}
