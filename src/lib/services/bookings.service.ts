import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { holdSlot, confirmHold } from "./scheduling.service";
import { logTimelineEvent, listClientTimeline } from "./timeline.service";
import { createFromTemplate, notifyAdmins } from "./notifications.service";

/** Monday 00:00 UTC of the week containing `d` — same convention as
 * computeStreakWeeks() in client-portal.actions.ts, duplicated here rather
 * than imported since services shouldn't depend on the action layer. */
export function startOfWeekUTC(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const mondayOffset = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - mondayOffset);
  return copy;
}
export function endOfWeekUTC(d: Date): Date {
  const end = startOfWeekUTC(d);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

export const MAX_RESCHEDULES_PER_WEEK = 2;

/** How many times this client has already rescheduled a session during the
 * current calendar week (Monday-start) -- shared by rescheduleBooking()'s
 * enforcement and the client-facing "X of 2 used this week" display. */
export async function countReschedulesThisWeek(accessToken: string, clientId: string): Promise<number> {
  const now = new Date();
  const weekStart = startOfWeekUTC(now);
  const weekEnd = endOfWeekUTC(now);
  const timeline = await listClientTimeline(accessToken, clientId);
  return timeline.filter((t) => {
    if (t.event_type !== "session_rescheduled") return false;
    const at = new Date(t.created_at);
    return at >= weekStart && at < weekEnd;
  }).length;
}

const BOOKING_SELECT =
  "*, client:client_profiles(id, profile:profiles(full_name, photo_url)), coach:coach_profiles(id, employee_code, profile:profiles(full_name, photo_url))";

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

/** Coach Dashboard "Cancelled Sessions" section (PRD §3) -- embeds who
 * cancelled it (role, not just the profiles.id) so the UI can label
 * "Cancelled by Client" vs "Cancelled by Admin". */
export async function listCancelledBookingsForCoach(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("bookings")
    .select("*, client:client_profiles(id, client_code, profile:profiles(full_name, photo_url)), cancelled_by_profile:profiles!cancelled_by(role)")
    .eq("coach_id", coach.id)
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Coach Dashboard "Rescheduled Sessions" section (PRD §3). */
export async function listRescheduledBookingsForCoach(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("bookings")
    .select("*, client:client_profiles(id, client_code, profile:profiles(full_name, photo_url))")
    .eq("coach_id", coach.id)
    .eq("was_rescheduled", true)
    .order("scheduled_start", { ascending: false });
  if (error) throw error;
  return data;
}

/** Admin/coach view of one client's full booking history (not scoped to the
 * caller's own bookings, unlike listMyBookingsAsClient/AsCoach). */
export async function listBookingsForClient(accessToken: string, clientId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin", "coach"]);
  const { data, error } = await ctx.client
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("client_id", clientId)
    .order("scheduled_start", { ascending: false });
  if (error) throw error;
  return data;
}

/** Platform-wide booking list for the admin sessions master view — unlike
 * listMyBookingsAsClient/AsCoach, not scoped to the caller. */
export async function listAllBookings(accessToken: string, filters?: { coachId?: string; status?: string }) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  let query = ctx.client.from("bookings").select(BOOKING_SELECT).order("scheduled_start", { ascending: false });
  if (filters?.coachId) query = query.eq("coach_id", filters.coachId);
  if (filters?.status) query = query.eq("status", filters.status);
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

/** Session-detail lookups -- one row each, admin/coach/linked-client visible
 * per the existing attendance/workout_notes RLS policies. */
export async function getAttendanceForBooking(accessToken: string, bookingId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("attendance").select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWorkoutNoteForBooking(accessToken: string, bookingId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("workout_notes").select("*").eq("booking_id", bookingId).maybeSingle();
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
    amountPaid?: number;
  }
) {
  const tempId = await holdSlot(accessToken, input);
  const bookingId = await confirmHold(accessToken, {
    tempBookingId: tempId,
    subscriptionId: input.subscriptionId,
    recurringSlotId: input.recurringSlotId,
    sessionType: input.sessionType,
    amountPaid: input.amountPaid,
  });

  if (!input.recurringSlotId) {
    await logTimelineEvent(input.clientId, "manual_session_added", "Session added", {
      description: new Date(input.slotStart).toLocaleString(),
      metadata: { bookingId, coachId: input.coachId },
    });
  }

  return bookingId;
}

export async function cancelBooking(accessToken: string, bookingId: string, reason?: string) {
  const ctx = await getCallerContext(accessToken);
  const enforceCutoff = ctx.role !== "admin";
  const booking = await getBooking(accessToken, bookingId);
  const { error } = await ctx.client.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_cancelled_by: ctx.userId,
    p_reason: reason ?? null,
    p_enforce_cutoff: enforceCutoff,
  });
  if (error) throw error;

  await logTimelineEvent((booking as any).client_id, "session_cancelled", "Session cancelled", {
    description: reason,
    actorId: ctx.userId,
    metadata: { bookingId },
  });

  if (ctx.role === "client") {
    const clientName = (booking as any).client?.profile?.full_name ?? "Client";
    const sessionTime = new Date((booking as any).scheduled_start).toLocaleString();
    const { data: coach } = await supabaseAdmin
      .from("coach_profiles")
      .select("profile_id")
      .eq("id", (booking as any).coach_id)
      .maybeSingle();
    if (coach) {
      await createFromTemplate("session_cancelled_by_client", coach.profile_id, {
        client_name: clientName,
        session_time: sessionTime,
      });
    }
    await notifyAdmins("admin_alert", {
      alert_message: `${clientName} cancelled their session scheduled for ${sessionTime}.`,
    });
  }
}

export async function rescheduleBooking(accessToken: string, bookingId: string, newStart: string, newDurationMinutes?: number) {
  const ctx = await getCallerContext(accessToken);
  const enforceCutoff = ctx.role !== "admin";
  const booking = await getBooking(accessToken, bookingId);

  // Weekly-limit + same-week checks are client-only business rules (Admin
  // overrides everything, per policy) -- kept in the app layer rather than
  // the RPC, same precedent as the once-per-week progress-log rule.
  if (ctx.role === "client") {
    const now = new Date();
    const weekEnd = endOfWeekUTC(now);
    const newStartDate = new Date(newStart);
    if (newStartDate < now || newStartDate >= weekEnd) {
      throw new Error("The new session time must fall within the remainder of this calendar week.");
    }

    const reschedulesThisWeek = await countReschedulesThisWeek(accessToken, (booking as any).client_id);
    if (reschedulesThisWeek >= MAX_RESCHEDULES_PER_WEEK) {
      throw new Error("You have already used your maximum reschedule limit for this week.");
    }
  }

  const { error } = await ctx.client.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_new_start: newStart,
    p_new_duration_minutes: newDurationMinutes ?? null,
    p_enforce_cutoff: enforceCutoff,
  });
  if (error) throw error;

  await logTimelineEvent((booking as any).client_id, "session_rescheduled", "Session rescheduled", {
    description: `${new Date((booking as any).scheduled_start).toLocaleString()} → ${new Date(newStart).toLocaleString()}`,
    actorId: ctx.userId,
    metadata: { bookingId },
  });

  const clientName = (booking as any).client?.profile?.full_name ?? "Client";

  // Only notify the coach when Admin is the one moving the session -- a
  // client rescheduling their own booking doesn't need a "schedule changed
  // by Admin" alert about their own action.
  if (ctx.role === "admin") {
    const { data: coach } = await supabaseAdmin
      .from("coach_profiles")
      .select("profile_id")
      .eq("id", (booking as any).coach_id)
      .maybeSingle();
    if (coach) {
      await createFromTemplate("admin_changed_schedule", coach.profile_id, {
        client_name: clientName,
        session_time: new Date(newStart).toLocaleString(),
      });
    }
  }

  // Client-initiated reschedule notifies the coach and Admin.
  if (ctx.role === "client") {
    const { data: coach } = await supabaseAdmin
      .from("coach_profiles")
      .select("profile_id")
      .eq("id", (booking as any).coach_id)
      .maybeSingle();
    const oldTime = new Date((booking as any).scheduled_start).toLocaleString();
    const newTime = new Date(newStart).toLocaleString();
    if (coach) {
      await createFromTemplate("session_rescheduled_by_client", coach.profile_id, {
        client_name: clientName,
        old_time: oldTime,
        new_time: newTime,
      });
    }
    await notifyAdmins("admin_alert", {
      alert_message: `${clientName} rescheduled their session from ${oldTime} to ${newTime}.`,
    });
  }
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

/** Step 1 of the coach's session workflow (PRD §6): attendance must be
 * marked before notes can be submitted. Present leaves the booking
 * "upcoming" so submitSessionNotes() can still gate on it below; Absent
 * closes the booking out immediately as a client no-show, no notes phase. */
export async function markAttendance(
  accessToken: string,
  bookingId: string,
  status: "present" | "absent",
  remark?: string
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: booking, error: bookingError } = await ctx.client
    .from("bookings")
    .select("id, client_id, coach_id, scheduled_start")
    .eq("id", bookingId)
    .eq("status", "upcoming")
    .single();
  if (bookingError || !booking) throw bookingError ?? new Error("Booking not found, or not upcoming");

  const now = new Date().toISOString();
  const { error: attendanceError } = await ctx.client.from("attendance").upsert(
    {
      booking_id: booking.id,
      status,
      checked_in_at: booking.scheduled_start,
      checked_out_at: status === "present" ? null : now,
      marked_by: ctx.userId,
    },
    { onConflict: "booking_id" }
  );
  if (attendanceError) throw attendanceError;

  if (status === "absent") {
    const { error: updateError } = await ctx.client
      .from("bookings")
      .update({ status: "missed", no_show_party: "client" })
      .eq("id", booking.id);
    if (updateError) throw updateError;

    await logTimelineEvent(booking.client_id, "session_missed", "Client absent", {
      description: remark,
      actorId: ctx.userId,
      metadata: { bookingId },
    });
  }

  return booking;
}

/** Step 2: only reachable once markAttendance() has recorded "present" for
 * this booking (checked server-side, not just gated in the UI) — mandatory
 * per PRD §7. Submitting closes the session out as completed. */
export async function submitSessionNotes(
  accessToken: string,
  bookingId: string,
  input: {
    summary?: string;
    exercisesPerformed?: string;
    performance?: "excellent" | "good" | "average" | "needs_improvement";
    improvements?: string[];
    homework?: string;
    additionalRemarks?: string;
  }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: booking, error: bookingError } = await ctx.client
    .from("bookings")
    .select("id, client_id, coach_id")
    .eq("id", bookingId)
    .eq("status", "upcoming")
    .single();
  if (bookingError || !booking) throw bookingError ?? new Error("Booking not found, or already completed");

  const { data: attendance, error: attendanceError } = await ctx.client
    .from("attendance")
    .select("status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (attendanceError) throw attendanceError;
  if (attendance?.status !== "present") {
    throw new Error("Attendance must be marked Present before session notes can be submitted");
  }

  const { error: notesError } = await ctx.client.from("workout_notes").insert({
    booking_id: booking.id,
    client_id: booking.client_id,
    coach_id: booking.coach_id,
    notes: input.summary ?? null,
    exercises_performed: input.exercisesPerformed ?? null,
    performance_rating: input.performance ?? null,
    improvements: input.improvements ?? [],
    homework: input.homework ?? null,
    additional_remarks: input.additionalRemarks ?? null,
  });
  if (notesError) throw notesError;

  const { error: completeError } = await ctx.client.from("bookings").update({ status: "completed" }).eq("id", booking.id);
  if (completeError) throw completeError;

  await logTimelineEvent(booking.client_id, "coach_notes_uploaded", "Coach notes added", { actorId: ctx.userId, metadata: { bookingId } });
  await logTimelineEvent(booking.client_id, "session_completed", "Session completed", { actorId: ctx.userId, metadata: { bookingId } });

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
