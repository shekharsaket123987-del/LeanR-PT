import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

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
    .select("id, starts_on, ends_on, reason, status")
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

/** Approves/rejects the leave request only. Does NOT assign a shadow coach —
 * that's a separate admin action via coachChange.service.ts's
 * assignShadowCoach(), which must be called explicitly afterward if affected
 * upcoming bookings need covering. */
export async function resolveLeave(accessToken: string, leaveId: string, status: "approved" | "rejected") {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin.from("coach_leave").update({ status }).eq("id", leaveId).select().single();
  if (error) throw error;
  return data;
}
