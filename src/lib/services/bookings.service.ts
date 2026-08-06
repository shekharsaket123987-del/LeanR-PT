import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { holdSlot, confirmHold } from "./scheduling.service";
import { logTimelineEvent, listClientTimeline } from "./timeline.service";
import { createFromTemplate, notifyAdmins } from "./notifications.service";
import { createZoomMeeting, deleteZoomMeeting } from "./zoom.service";

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

/** Creates the Zoom meeting for a session the first time someone actually
 * needs to join it, rather than at booking-creation time -- bookings get
 * created from several different code paths (initial confirm, recurring
 * generation, cancel-triggered regeneration), and this way none of them
 * need a Zoom-specific hook. Idempotent: returns the existing links
 * unchanged if a meeting was already created for this booking. Returns null
 * (rather than throwing) if the booking isn't visible to the caller or
 * isn't in a joinable state, so callers can render "no session" instead of
 * a hard error. */
export async function ensureZoomMeetingForBooking(
  accessToken: string,
  bookingId: string
): Promise<{ joinUrl: string; startUrl: string } | null> {
  const ctx = await getCallerContext(accessToken);
  const { data: booking, error } = await ctx.client
    .from("bookings")
    .select(
      "id, status, scheduled_start, duration_minutes, zoom_join_url, zoom_start_url, client:client_profiles(profile:profiles(full_name)), coach:coach_profiles(profile:profiles(full_name))"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking || booking.status !== "upcoming") return null;
  if (booking.zoom_join_url && booking.zoom_start_url) {
    return { joinUrl: booking.zoom_join_url, startUrl: booking.zoom_start_url };
  }

  const clientName = (booking as any).client?.profile?.full_name ?? "Client";
  const coachName = (booking as any).coach?.profile?.full_name ?? "Coach";
  const meeting = await createZoomMeeting(`PT Session — ${clientName} & ${coachName}`, booking.scheduled_start, booking.duration_minutes);

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ zoom_meeting_id: meeting.id, zoom_join_url: meeting.joinUrl, zoom_start_url: meeting.startUrl })
    .eq("id", bookingId);
  if (updateError) throw updateError;

  return { joinUrl: meeting.joinUrl, startUrl: meeting.startUrl };
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

/** Bulk attendance rows for a set of bookings -- attendance has no FK
 * PostgREST can embed onto bookings directly, so fetch by booking_id list
 * and merge in the caller (same pattern as listMyWorkoutNotes below). */
export async function listAttendanceForBookings(accessToken: string, bookingIds: string[]) {
  if (bookingIds.length === 0) return [];
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("attendance").select("booking_id, status").in("booking_id", bookingIds);
  if (error) throw error;
  return data;
}

/** Bulk "has notes been submitted" check for a set of bookings -- same
 * merge-separately reasoning as listAttendanceForBookings. */
export async function listWorkoutNotesForBookings(accessToken: string, bookingIds: string[]) {
  if (bookingIds.length === 0) return [];
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("workout_notes").select("booking_id").in("booking_id", bookingIds);
  if (error) throw error;
  return data;
}

/** Flags bookings whose attendance still hasn't been marked 2+ hours after
 * they ended (flag_overdue_attendance(), migration 0032), then notifies each
 * affected coach exactly once per booking -- the RPC only ever returns
 * bookings transitioning from unflagged to flagged, so calling this
 * repeatedly (e.g. on every dashboard load) never re-notifies for the same
 * booking. No cron in this codebase (see mark_missed_bookings()'s own
 * precedent), so this runs opportunistically whenever a coach loads their
 * Today's Tasks view rather than on a schedule. */
export async function sweepOverdueAttendance(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data: newlyOverdue, error } = await ctx.client.rpc("flag_overdue_attendance");
  if (error) throw error;
  if (!newlyOverdue || (newlyOverdue as string[]).length === 0) return;

  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("id, scheduled_start, coach:coach_profiles(profile_id), client:client_profiles(profile:profiles(full_name))")
    .in("id", newlyOverdue as string[]);

  for (const b of (bookings as any[]) ?? []) {
    if (!b.coach?.profile_id) continue;
    await createFromTemplate("attendance_overdue", b.coach.profile_id, {
      client_name: b.client?.profile?.full_name ?? "a client",
      session_time: new Date(b.scheduled_start).toLocaleString(),
    });
  }
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

/** Best-effort: a stale/cancelled Zoom meeting left dangling is a minor
 * annoyance (an unused meeting sitting in the host's Zoom account), not
 * something worth failing a cancel/reschedule over -- so errors here are
 * swallowed after logging, never rethrown. */
async function cleanupZoomMeeting(bookingId: string, zoomMeetingId: string | null) {
  if (!zoomMeetingId) return;
  try {
    await deleteZoomMeeting(zoomMeetingId);
  } catch (err) {
    console.error(`Failed to delete Zoom meeting ${zoomMeetingId} for booking ${bookingId}:`, err);
  }
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ zoom_meeting_id: null, zoom_join_url: null, zoom_start_url: null })
    .eq("id", bookingId);
  if (error) throw error;
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

  await cleanupZoomMeeting(bookingId, (booking as any).zoom_meeting_id ?? null);

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

  // The old meeting's start time is now wrong -- delete it and let
  // ensureZoomMeetingForBooking create a fresh one, lazily, for the new time.
  await cleanupZoomMeeting(bookingId, (booking as any).zoom_meeting_id ?? null);

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

/** coach_profiles.rating had no confirmed write-path from actual booking
 * ratings before this -- likely a stale seed value forever. Recomputed
 * opportunistically right after a new rating is submitted (no cron in this
 * codebase, same "recompute on the write that could have changed it"
 * convention used throughout), from AVG(trainer_rating) -- the
 * trainer-specific dimension, not session quality, same choice made for the
 * dashboard KPIs. Uses supabaseAdmin since a client caller has no RLS grant
 * to update a coach's row. */
async function recomputeCoachRating(coachId: string) {
  const { data: rated, error } = await supabaseAdmin.from("bookings").select("trainer_rating").eq("coach_id", coachId).not("trainer_rating", "is", null);
  if (error) throw error;
  const ratings = (rated ?? []).map((r) => r.trainer_rating as number);
  if (ratings.length === 0) return;

  const avg = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100;
  const { error: updateError } = await supabaseAdmin
    .from("coach_profiles")
    .update({ rating: avg, review_count: ratings.length })
    .eq("id", coachId);
  if (updateError) throw updateError;
}

/** Client rates a completed session (the prototype's "Rate Session" flow).
 * Two dimensions per FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §3.7 -- session
 * quality vs. the trainer specifically -- capped at once per week, mirroring
 * the identical pattern in progressLogs.service.ts::createProgressLog. */
export async function rateBooking(
  accessToken: string,
  bookingId: string,
  input: { qualityRating: number; trainerRating: number; note?: string }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);

  const { data: client, error: clientError } = await ctx.client
    .from("client_profiles")
    .select("id")
    .eq("profile_id", ctx.userId)
    .single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: recent, error: recentError } = await ctx.client
    .from("bookings")
    .select("id")
    .eq("client_id", client.id)
    .gte("rated_at", weekAgo.toISOString())
    .limit(1)
    .maybeSingle();
  if (recentError) throw recentError;
  if (recent) throw new Error("You've already submitted a rating this week -- next rating available in a few days.");

  const { data, error } = await ctx.client
    .from("bookings")
    .update({
      quality_rating: input.qualityRating,
      trainer_rating: input.trainerRating,
      rating_note: input.note ?? null,
      rated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("client_id", client.id)
    .eq("status", "completed")
    .select()
    .single();
  if (error) throw error;

  await recomputeCoachRating(data.coach_id);

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
  } else {
    // Distinct from "session_completed" (logged later, once notes are
    // submitted) -- otherwise presence would be silent in the timeline until
    // a separate action happens to save notes.
    await logTimelineEvent(booking.client_id, "attendance_marked_present", "Attendance marked present", {
      description: remark,
      actorId: ctx.userId,
      metadata: { bookingId },
    });
  }

  // Clears any overdue highlight (migration 0032) now that attendance has
  // been marked at all, regardless of present/absent.
  const { error: clearOverdueError } = await ctx.client.from("bookings").update({ attendance_overdue: false }).eq("id", booking.id);
  if (clearOverdueError) throw clearOverdueError;

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
