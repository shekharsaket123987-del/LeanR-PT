import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { holdSlot, confirmHold } from "./scheduling.service";

const BOOKING_SELECT = "*, client:client_profiles(id, profile:profiles(full_name, photo_url)), coach:coach_profiles(id, profile:profiles(full_name, photo_url))";

export async function listMyBookingsAsClient(accessToken: string, status?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  let query = ctx.client.from("bookings").select(BOOKING_SELECT).eq("client_id", client.id).order("scheduled_start", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listMyBookingsAsCoach(accessToken: string, status?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  let query = ctx.client.from("bookings").select(BOOKING_SELECT).eq("coach_id", coach.id).order("scheduled_start", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getBooking(accessToken: string, bookingId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("bookings").select(BOOKING_SELECT).eq("id", bookingId).single();
  if (error) throw error;
  return data;
}

/** Convenience wrapper for immediate booking (hold then confirm back-to-back)
 * — used when the UI doesn't need a separate "reviewing your pick" step. */
export async function createBooking(
  accessToken: string,
  input: {
    clientId: string;
    coachId: string;
    slotStart: string;
    durationMinutes: number;
    subscriptionId?: string;
    recurringSlotId?: string;
    sessionType?: "regular" | "assessment";
  }
) {
  const tempId = await holdSlot(accessToken, input);
  return confirmHold(accessToken, {
    tempBookingId: tempId,
    subscriptionId: input.subscriptionId,
    recurringSlotId: input.recurringSlotId,
    sessionType: input.sessionType,
  });
}

export async function cancelBooking(accessToken: string, bookingId: string, reason?: string) {
  const ctx = await getCallerContext(accessToken);
  const enforceCutoff = ctx.role !== "admin";
  const { error } = await ctx.client.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_cancelled_by: ctx.userId,
    p_reason: reason ?? null,
    p_enforce_cutoff: enforceCutoff,
  });
  if (error) throw error;
}

export async function rescheduleBooking(accessToken: string, bookingId: string, newStart: string, newDurationMinutes?: number) {
  const ctx = await getCallerContext(accessToken);
  const enforceCutoff = ctx.role !== "admin";
  const { error } = await ctx.client.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_new_start: newStart,
    p_new_duration_minutes: newDurationMinutes ?? null,
    p_enforce_cutoff: enforceCutoff,
  });
  if (error) throw error;
}

/** Client rates a completed session (the prototype's "Rate Session" flow). */
export async function rateBooking(accessToken: string, bookingId: string, rating: number, feedback?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("bookings")
    .update({ rating, client_feedback: feedback ?? null })
    .eq("id", bookingId)
    .eq("status", "completed")
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Coach ends a live session: marks it completed and logs structured notes
 * (the prototype's "Mark Completed" action, which today doesn't persist). */
export async function completeBooking(accessToken: string, bookingId: string, input: { notes?: string; homework?: string }) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: booking, error: bookingError } = await ctx.client
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .eq("status", "upcoming")
    .select("id, client_id, coach_id, duration_minutes, scheduled_start")
    .single();
  if (bookingError || !booking) throw bookingError ?? new Error("Booking not found");

  if (input.notes || input.homework) {
    const { error: notesError } = await ctx.client.from("workout_notes").insert({
      booking_id: booking.id,
      client_id: booking.client_id,
      coach_id: booking.coach_id,
      notes: input.notes ?? null,
      homework: input.homework ?? null,
    });
    if (notesError) throw notesError;
  }

  const { error: attendanceError } = await ctx.client.from("attendance").insert({
    booking_id: booking.id,
    status: "present",
    checked_in_at: booking.scheduled_start,
    checked_out_at: new Date().toISOString(),
    marked_by: ctx.userId,
  });
  if (attendanceError) throw attendanceError;

  return booking;
}

/** workout_notes has no FK PostgREST can embed onto bookings (see
 * subscriptions.service.ts for the same merge-separately pattern) — fetch
 * this client's notes once and merge by booking_id in the caller. */
export async function listMyWorkoutNotes(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client.from("workout_notes").select("booking_id, notes").eq("client_id", client.id);
  if (error) throw error;
  return data;
}

/** A coach's own notes for one client (excludes other coaches' notes for
 * shared clients, if any, via RLS's workout_notes_manage_own_coach policy). */
export async function listWorkoutNotesForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client
    .from("workout_notes")
    .select("booking_id, notes, homework, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Public entry point for the "book a free assessment" flow — the prospect
 * has no account yet, so this uses the admin client directly rather than an
 * access token. Only creates a lead record; no privileged data is exposed. */
export async function createAssessmentBooking(input: {
  prospectName: string;
  prospectEmail?: string;
  prospectPhone?: string;
  assignedCoachId: string;
  scheduledStart: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("assessment_sessions")
    .insert({
      prospect_name: input.prospectName,
      prospect_email: input.prospectEmail ?? null,
      prospect_phone: input.prospectPhone ?? null,
      assigned_coach_id: input.assignedCoachId,
      scheduled_start: input.scheduledStart,
      status: "scheduled",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
