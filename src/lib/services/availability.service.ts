import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { listActiveClientIdsForCoach } from "./clients.service";
import { findShadowCoachCandidates, istTimeOfDayMinutes, planShadowAssignments } from "./scheduling.service";
import { assignShadowCoach, reassignShadowCoverage } from "./coachChange.service";
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
    .select("id, starts_on, ends_on, reason, status, leave_type, partial_start_time, partial_end_time, created_at")
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

/** Admin-only: replaces a coach's entire weekly template (matches the
 * prototype's "Availability" page, which edits the full week at once).
 * Coaches lost direct write access to coach_availability in migration 0045 —
 * only admin can set working hours now. */
export async function setCoachAvailability(accessToken: string, coachId: string, windows: AvailabilityWindow[]) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { error: deleteError } = await supabaseAdmin.from("coach_availability").delete().eq("coach_id", coachId);
  if (deleteError) throw deleteError;

  if (windows.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("coach_availability")
    .insert(windows.map((w) => ({ ...w, coach_id: coachId })))
    .select();
  if (error) throw error;
  return data;
}

const LEAVE_MIN_NOTICE_HOURS = 24;

export interface RequestLeaveInput {
  starts_on: string;
  ends_on: string;
  reason?: string;
  leaveType?: "full_day" | "partial";
  partialStartTime?: string; // "HH:MM", required when leaveType === "partial"
  partialEndTime?: string; // "HH:MM", required when leaveType === "partial"
}

export async function requestLeave(accessToken: string, input: RequestLeaveInput) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  if (input.ends_on < input.starts_on) {
    throw new Error("End date must be on or after the start date.");
  }

  const leaveType = input.leaveType ?? "full_day";
  if (leaveType === "partial") {
    // Hour-wise leave only blocks specific sessions on ONE day -- a
    // multi-day partial-hours pattern isn't supported (see migration 0031).
    if (input.ends_on !== input.starts_on) {
      throw new Error("Partial-day leave must be a single date.");
    }
    if (!input.partialStartTime || !input.partialEndTime) {
      throw new Error("Partial-day leave requires a start and end time.");
    }
    if (input.partialEndTime <= input.partialStartTime) {
      throw new Error("End time must be after the start time.");
    }
  }

  // Leave days are IST wall-clock dates (see migration 0026); midnight IST on
  // starts_on is 5.5 hours behind that same calendar date at 00:00 UTC. This
  // rule is unconditional -- there is no admin bypass or "emergency leave"
  // fast-track (undocumented absences are handled entirely outside this flow,
  // via the client-profile manual shadow-assignment tool instead).
  const [y, m, d] = input.starts_on.split("-").map(Number);
  const startsOnMidnightIstMs = Date.UTC(y, m - 1, d) - 5.5 * 60 * 60 * 1000;
  const hoursUntilStart = (startsOnMidnightIstMs - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart < LEAVE_MIN_NOTICE_HOURS) {
    throw new Error(`Leave requests require at least ${LEAVE_MIN_NOTICE_HOURS} hours' advance notice.`);
  }

  const { data: coach, error: coachError } = await ctx.client
    .from("coach_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("coach_leave")
    .insert({
      coach_id: coach.id,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      reason: input.reason ?? null,
      status: "pending",
      leave_type: leaveType,
      partial_start_time: leaveType === "partial" ? `${input.partialStartTime}:00` : null,
      partial_end_time: leaveType === "partial" ? `${input.partialEndTime}:00` : null,
    })
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
  assigned: {
    clientId: string;
    clientName: string;
    shadowCoaches: { shadowCoachId: string; shadowCoachName: string; startsOn: string; endsOn: string }[];
  }[];
  unassignedFlagged: { clientId: string; clientName: string; uncoveredDates: string[] }[];
}

/** Approves/rejects the leave request. On approval, automatically finds and
 * assigns shadow coverage for every one of the coach's active clients whose
 * recurring pattern falls within the leave window -- reuses
 * findShadowCoachCandidates() + planShadowAssignments() (scheduling.service.ts)
 * and assignShadowCoach() (coachChange.service.ts), both already built and
 * verified; this function is pure orchestration, not new matching logic.
 * Resolution is per-occurrence, so a single client's leave-window sessions
 * can end up covered by more than one shadow coach (e.g. one coach free
 * Mon/Wed, a different one free Fri) -- each distinct coverage stretch
 * becomes its own entry in shadowCoaches. Occurrences with no available
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

  // Partial-day leave only makes the coach unavailable for a specific time
  // window on starts_on -- sessions outside that window aren't affected and
  // must not be pulled into shadow-coverage consideration at all (otherwise
  // they'd get incorrectly reassigned, or flagged as "uncovered" when the
  // primary coach was never actually unavailable for them).
  let partialWindowMin: { start: number; end: number } | null = null;
  if (leave.leave_type === "partial" && leave.partial_start_time && leave.partial_end_time) {
    const [psH, psM] = leave.partial_start_time.split(":").map(Number);
    const [peH, peM] = leave.partial_end_time.split(":").map(Number);
    partialWindowMin = { start: psH * 60 + psM, end: peH * 60 + peM };
  }

  for (const clientId of clientIds) {
    let occurrences = await findShadowCoachCandidates(accessToken, {
      clientId,
      primaryCoachId: leave.coach_id,
      startsOn: leave.starts_on,
      endsOn: leave.ends_on,
    });
    if (partialWindowMin) {
      occurrences = occurrences.filter((occ) => {
        const occStartMin = istTimeOfDayMinutes(occ.slotStart);
        const occEndMin = occStartMin + occ.durationMinutes;
        return occStartMin < partialWindowMin!.end && occEndMin > partialWindowMin!.start;
      });
    }
    const clientName = nameById.get(clientId) ?? "Client";
    const { assignments, uncoveredDates } = planShadowAssignments(occurrences);

    for (const plan of assignments) {
      await assignShadowCoach(accessToken, {
        clientId,
        primaryCoachId: leave.coach_id,
        shadowCoachId: plan.shadowCoachId,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        reason: "Auto-assigned: primary coach on approved leave",
      });
    }
    if (assignments.length > 0) {
      summary.assigned.push({
        clientId,
        clientName,
        shadowCoaches: assignments.map((a) => ({
          shadowCoachId: a.shadowCoachId,
          shadowCoachName: a.shadowCoachName,
          startsOn: a.startsOn,
          endsOn: a.endsOn,
        })),
      });
    }
    if (uncoveredDates.length > 0) {
      summary.unassignedFlagged.push({ clientId, clientName, uncoveredDates });
      await notifyAdmins("admin_alert", {
        alert_message: `No shadow coach available for ${clientName} on ${uncoveredDates.join(", ")} during coach leave ${leave.starts_on}-${leave.ends_on} -- manual reassignment needed.`,
      });
    }
  }

  // §4.2.5: this coach might ALSO currently be covering OTHER clients as a
  // shadow (for a different primary coach) -- their own approved leave
  // means those sessions need a fresh shadow search too, not just the
  // clients whose primary they actually are (handled above). Scoped to the
  // overlap of [existing shadow assignment] and [this new leave], since
  // outside that overlap the shadow coach is still genuinely available.
  const { data: shadowingRows, error: shadowingError } = await supabaseAdmin
    .from("shadow_coach_assignments")
    .select("client_id, primary_coach_id, starts_on, ends_on")
    .eq("shadow_coach_id", leave.coach_id)
    .eq("status", "active")
    .lte("starts_on", leave.ends_on)
    .gte("ends_on", leave.starts_on);
  if (shadowingError) throw shadowingError;

  for (const row of shadowingRows ?? []) {
    const overlapStart = row.starts_on > leave.starts_on ? row.starts_on : leave.starts_on;
    const overlapEnd = row.ends_on < leave.ends_on ? row.ends_on : leave.ends_on;

    let occurrences = await findShadowCoachCandidates(accessToken, {
      clientId: row.client_id,
      primaryCoachId: row.primary_coach_id,
      startsOn: overlapStart,
      endsOn: overlapEnd,
    });
    if (partialWindowMin) {
      occurrences = occurrences.filter((occ) => {
        const occStartMin = istTimeOfDayMinutes(occ.slotStart);
        const occEndMin = occStartMin + occ.durationMinutes;
        return occStartMin < partialWindowMin!.end && occEndMin > partialWindowMin!.start;
      });
    }

    const { data: clientProfile } = await supabaseAdmin
      .from("client_profiles")
      .select("id, profile:profiles(full_name)")
      .eq("id", row.client_id)
      .maybeSingle();
    const clientName = (clientProfile as any)?.profile?.full_name ?? "Client";
    const { assignments, uncoveredDates } = planShadowAssignments(occurrences);

    for (const plan of assignments) {
      await reassignShadowCoverage(accessToken, {
        clientId: row.client_id,
        oldShadowCoachId: leave.coach_id,
        newShadowCoachId: plan.shadowCoachId,
        primaryCoachId: row.primary_coach_id,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        reason: "Auto-reassigned: shadow coach also went on approved leave",
      });
    }
    if (assignments.length > 0) {
      summary.assigned.push({
        clientId: row.client_id,
        clientName,
        shadowCoaches: assignments.map((a) => ({
          shadowCoachId: a.shadowCoachId,
          shadowCoachName: a.shadowCoachName,
          startsOn: a.startsOn,
          endsOn: a.endsOn,
        })),
      });
    }
    if (uncoveredDates.length > 0) {
      summary.unassignedFlagged.push({ clientId: row.client_id, clientName, uncoveredDates });
      await notifyAdmins("admin_alert", {
        alert_message: `No replacement shadow coach available for ${clientName} on ${uncoveredDates.join(", ")} -- their shadow coach also went on leave during this period, manual reassignment needed.`,
      });
    }
  }

  return summary;
}
