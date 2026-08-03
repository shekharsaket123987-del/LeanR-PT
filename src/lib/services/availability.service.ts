import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { listActiveClientIdsForCoach } from "./clients.service";
import { findShadowCoachCandidates } from "./scheduling.service";
import { assignShadowCoach } from "./coachChange.service";
import { createFromTemplate, notifyAdmins } from "./notifications.service";

export async function getCoachAvailability(accessToken: string, coachId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("coach_availability")
    .select("*")
    .eq("coach_id", coachId)
    .order("day_of_week");
  if (error) throw error;
  return data;
}

export async function getMyAvailability(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");
  return getCoachAvailability(accessToken, coach.id);
}

export async function getMyLeaveRequests(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");
  const { data, error } = await ctx.client
    .from("coach_leave")
    .select("id, starts_on, ends_on, reason, status, created_at")
    .eq("coach_id", coach.id)
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return data;
}

export interface AvailabilityWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/** Replaces the coach's entire weekly template (matches the prototype's
 * "Availability" page, which edits the full week at once). */
export async function setMyAvailability(accessToken: string, windows: AvailabilityWindow[]) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: coach, error: coachError } = await ctx.client
    .from("coach_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { error: deleteError } = await ctx.client.from("coach_availability").delete().eq("coach_id", coach.id);
  if (deleteError) throw deleteError;

  if (windows.length === 0) return [];
  const { data, error } = await ctx.client
    .from("coach_availability")
    .insert(windows.map((w) => ({ ...w, coach_id: coach.id })))
    .select();
  if (error) throw error;
  return data;
}

export async function requestLeave(accessToken: string, input: { starts_on: string; ends_on: string; reason?: string }) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: coach, error: coachError } = await ctx.client
    .from("coach_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("coach_leave")
    .insert({ coach_id: coach.id, ...input, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPendingLeave(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client
    .from("coach_leave")
    .select("*, coach:coach_profiles(profile:profiles(full_name))")
    .eq("status", "pending");
  if (error) throw error;
  return data;
}

/** Admin "block this coach's slot on this date" control. Modeled as a
 * pre-approved single-day coach_leave row rather than new schema —
 * is_slot_within_working_hours() already treats any approved leave day as
 * fully unavailable, so this reuses the same real enforcement the booking
 * flow depends on instead of inventing a parallel "blocked slot" concept. */
export async function createOneDayLeave(accessToken: string, coachId: string, date: string, reason?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin
    .from("coach_leave")
    .insert({ coach_id: coachId, starts_on: date, ends_on: date, reason: reason ?? "Blocked by admin", status: "approved" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface LeaveResolutionSummary {
  leave: { id: string; coachId: string; startsOn: string; endsOn: string; status: string };
  assigned: { clientId: string; clientName: string; shadowCoachId: string; shadowCoachName: string }[];
  unassignedFlagged: { clientId: string; clientName: string }[];
}

/** Approves/rejects the leave request. On approval, automatically finds and
 * assigns a shadow coach for every one of the coach's active clients whose
 * recurring pattern falls within the leave window -- reuses
 * findShadowCoachCandidates() (scheduling.service.ts) and assignShadowCoach()
 * (coachChange.service.ts), both already built and verified; this function
 * is pure orchestration, not new matching logic. Clients with no available
 * shadow coach are flagged via notifyAdmins() for manual intervention rather
 * than left silently uncovered. */
export async function resolveLeave(accessToken: string, leaveId: string, status: "approved" | "rejected"): Promise<LeaveResolutionSummary> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data: leave, error } = await supabaseAdmin.from("coach_leave").update({ status }).eq("id", leaveId).select().single();
  if (error) throw error;

  const { data: coach } = await supabaseAdmin.from("coach_profiles").select("profile_id").eq("id", leave.coach_id).maybeSingle();
  if (coach) {
    await createFromTemplate(status === "approved" ? "leave_approved" : "leave_rejected", coach.profile_id, {
      starts_on: leave.starts_on,
      ends_on: leave.ends_on,
    });
  }

  const summary: LeaveResolutionSummary = {
    leave: { id: leave.id, coachId: leave.coach_id, startsOn: leave.starts_on, endsOn: leave.ends_on, status: leave.status },
    assigned: [],
    unassignedFlagged: [],
  };
  if (status !== "approved") return summary;

  const clientIds = await listActiveClientIdsForCoach(accessToken, leave.coach_id);
  if (clientIds.length === 0) return summary;

  const { data: profiles } = await supabaseAdmin
    .from("client_profiles")
    .select("id, profile:profiles(full_name)")
    .in("id", clientIds);
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.profile?.full_name ?? "Client"]));

  for (const clientId of clientIds) {
    const candidates = await findShadowCoachCandidates(accessToken, {
      clientId,
      primaryCoachId: leave.coach_id,
      startsOn: leave.starts_on,
      endsOn: leave.ends_on,
    });
    const clientName = nameById.get(clientId) ?? "Client";
    if (candidates.length > 0) {
      const top = candidates[0];
      await assignShadowCoach(accessToken, {
        clientId,
        primaryCoachId: leave.coach_id,
        shadowCoachId: top.coachId,
        startsOn: leave.starts_on,
        endsOn: leave.ends_on,
        reason: "Auto-assigned: primary coach on approved leave",
      });
      summary.assigned.push({ clientId, clientName, shadowCoachId: top.coachId, shadowCoachName: top.name });
    } else {
      summary.unassignedFlagged.push({ clientId, clientName });
      await notifyAdmins("admin_alert", {
        alert_message: `No shadow coach available for ${clientName} during coach leave ${leave.starts_on}-${leave.ends_on} -- manual reassignment needed.`,
      });
    }
  }

  return summary;
}
