import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { holdSlot, confirmHold, getClientBusyDates, istDateString } from "./scheduling.service";
import { logTimelineEvent, listClientTimeline } from "./timeline.service";
import { createFromTemplate, notifyAdmins } from "./notifications.service";
import { createZoomMeeting, deleteZoomMeeting } from "./zoom.service";
import { ensureConversationForCoachAssignment } from "./chat.service";
import { resolveSessionNotifyContext, notifyClient, notifyCoach, formatSessionTime } from "./sessionNotifications.service";

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

/** How far into the future a client can pick a reschedule date -- deliberately
 * a rolling window rather than "the rest of this calendar week" (the old
 * rule), so a client can see and use their coach's actual full availability
 * instead of whatever happens to be left before Sunday. */
export const RESCHEDULE_WINDOW_DAYS = 30;

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

/** mark_missed_bookings() (migration 0011) is otherwise only ever reached
 * as a side effect of has_scheduling_conflict() -- fine for booking-write
 * paths, but a client/coach who just reads their own list without touching
 * the booking engine (e.g. loading the dashboard) could see a session whose
 * time has already passed still labeled "upcoming" until something else in
 * the app happens to trigger that RPC. Runs via supabaseAdmin since the
 * function isn't security definer and callers here have no UPDATE grant on
 * bookings -- safe to call on every read, it's a no-op once nothing is stale. */
async function sweepMissedBookings() {
  const { error } = await supabaseAdmin.rpc("mark_missed_bookings");
  if (error) throw error;
}

export async function listMyBookingsAsClient(accessToken: string, status?: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  await sweepMissedBookings();
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
  await sweepMissedBookings();
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

/** Same "notify exactly once" sweep as sweepOverdueAttendance() above, for
 * the other half of the post-session workflow: attendance was marked
 * present/late but notes were never submitted. Kept separate rather than
 * merged into the attendance sweep since the two conditions are mutually
 * exclusive (markAttendance() clears attendance_overdue the moment
 * attendance is marked at all) and need different coach-facing copy. */
export async function sweepOverdueNotes(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data: newlyOverdue, error } = await ctx.client.rpc("flag_overdue_notes");
  if (error) throw error;
  if (!newlyOverdue || (newlyOverdue as string[]).length === 0) return;

  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("id, scheduled_start, coach:coach_profiles(profile_id), client:client_profiles(profile:profiles(full_name))")
    .in("id", newlyOverdue as string[]);

  for (const b of (bookings as any[]) ?? []) {
    if (!b.coach?.profile_id) continue;
    await createFromTemplate("notes_overdue", b.coach.profile_id, {
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

  // Safety net alongside createRecurringSlots' own call: guarantees a client
  // sees "My Chats" as soon as ANY session with a coach is booked, not just
  // when a recurring pattern is set up -- covers ad-hoc/one-off bookings and
  // backfills any coach assignment that (like manually-seeded data) never
  // went through createRecurringSlots in the first place. No-ops if the
  // client has no subscription yet or already has this exact conversation.
  await ensureConversationForCoachAssignment(input.clientId, input.coachId);

  if (!input.recurringSlotId) {
    await logTimelineEvent(input.clientId, "manual_session_added", "Session added", {
      description: new Date(input.slotStart).toLocaleString(),
      metadata: { bookingId, coachId: input.coachId },
    });
  }

  const notifyCtx = await resolveSessionNotifyContext(input.clientId, input.coachId);
  const sessionTime = formatSessionTime(input.slotStart);
  if (input.sessionType === "assessment") {
    await notifyClient(notifyCtx, "demo_booked_client", { coach_name: notifyCtx.coachName ?? "your coach", session_time: sessionTime }, "demo_booked");
    await notifyCoach(notifyCtx, "demo_booked_coach", { client_name: notifyCtx.clientName, session_time: sessionTime });
  } else {
    await notifyClient(notifyCtx, "session_booked_client", { coach_name: notifyCtx.coachName ?? "your coach", session_time: sessionTime }, "session_booked");
    await notifyCoach(notifyCtx, "session_booked_coach", { client_name: notifyCtx.clientName, session_time: sessionTime });
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

/** newCoachId, when given, moves this ONE booking to a substitute coach --
 * used when the client's desired new time isn't free with their own coach.
 * recurring_slot_id (and the coach it points at) is untouched, so future
 * auto-generated occurrences keep going to the original coach with no
 * separate reversion step needed (see migration 0041). */
export async function rescheduleBooking(accessToken: string, bookingId: string, newStart: string, newDurationMinutes?: number, newCoachId?: string) {
  const ctx = await getCallerContext(accessToken);
  const enforceCutoff = ctx.role !== "admin";
  const booking = await getBooking(accessToken, bookingId);

  // Forward-window + weekly-limit + no-double-booking-per-day checks are
  // client-only business rules (Admin overrides everything, per policy) --
  // kept in the app layer rather than the RPC, same precedent as the
  // once-per-week progress-log rule.
  if (ctx.role === "client") {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RESCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const newStartDate = new Date(newStart);
    if (newStartDate < now || newStartDate >= windowEnd) {
      throw new Error(`The new session time must fall within the next ${RESCHEDULE_WINDOW_DAYS} days.`);
    }

    const reschedulesThisWeek = await countReschedulesThisWeek(accessToken, (booking as any).client_id);
    if (reschedulesThisWeek >= MAX_RESCHEDULES_PER_WEEK) {
      throw new Error("You have already used your maximum reschedule limit for this week.");
    }

    const busyDates = await getClientBusyDates(accessToken, (booking as any).client_id, bookingId);
    if (busyDates.has(istDateString(newStart))) {
      throw new Error("You already have another session booked on that day.");
    }
  }

  const { error } = await ctx.client.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_new_start: newStart,
    p_new_duration_minutes: newDurationMinutes ?? null,
    p_enforce_cutoff: enforceCutoff,
    p_new_coach_id: newCoachId ?? null,
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
  // Notifications go to whichever coach the session actually ends up with --
  // the substitute, when one was assigned, not the original.
  const targetCoachId = newCoachId ?? (booking as any).coach_id;
  const notifyCtx = await resolveSessionNotifyContext((booking as any).client_id, targetCoachId);
  const oldTime = formatSessionTime((booking as any).scheduled_start);
  const newTime = formatSessionTime(newStart);

  // Client always hears about their own session moving, regardless of who
  // triggered it -- previously nobody told the client at all.
  await notifyClient(
    notifyCtx,
    "session_rescheduled_client",
    { coach_name: notifyCtx.coachName ?? "your coach", old_session_time: oldTime, new_session_time: newTime },
    "session_rescheduled"
  );

  // Only notify the coach when Admin is the one moving the session -- a
  // client rescheduling their own booking doesn't need a "schedule changed
  // by Admin" alert about their own action.
  if (ctx.role === "admin") {
    await notifyCoach(notifyCtx, "admin_changed_schedule", { client_name: clientName, session_time: newTime });
  }

  // Client-initiated reschedule notifies the coach and Admin.
  if (ctx.role === "client") {
    await notifyCoach(notifyCtx, "session_rescheduled_by_client", { client_name: clientName, old_time: oldTime, new_time: newTime });
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

/** Records that the coach actually opened this session (clicked Join,
 * whether that led to the real Zoom meeting or -- when Zoom isn't configured
 * -- the in-app session page). Idempotent: a second call is a silent no-op
 * rather than an error, since the UI can't always tell whether a prior click
 * already recorded it. This is the "joined by coach" half of the gate
 * markAttendance() enforces below. */
export async function markSessionJoined(accessToken: string, bookingId: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { error } = await ctx.client
    .from("bookings")
    .update({ coach_joined_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "upcoming")
    .is("coach_joined_at", null);
  if (error) throw error;
}

/** Step 1 of the coach's session workflow (PRD §6): attendance must be
 * marked before notes can be submitted. Present leaves the booking
 * "upcoming" so submitSessionNotes() can still gate on it below; Absent
 * closes the booking out immediately as a client no-show, no notes phase.
 *
 * Gated on "session completed AND joined by coach" for TODAY's sessions --
 * the exact real-time workflow Today's Tasks/the session page walk the coach
 * through. Backlog bookings from a PREVIOUS day (Pending Tasks) skip the
 * join requirement: by the time they're overdue by a full day, there was
 * never a live join moment to capture, and hard-requiring one would leave
 * those bookings permanently stuck with no way to resolve them. */
export async function markAttendance(
  accessToken: string,
  bookingId: string,
  status: "present" | "absent" | "late",
  remark?: string
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);

  const { data: booking, error: bookingError } = await ctx.client
    .from("bookings")
    .select("id, client_id, coach_id, scheduled_start, duration_minutes, coach_joined_at")
    .eq("id", bookingId)
    .eq("status", "upcoming")
    .single();
  if (bookingError || !booking) throw bookingError ?? new Error("Booking not found, or not upcoming");

  const sessionEnd = new Date(booking.scheduled_start).getTime() + booking.duration_minutes * 60_000;
  if (Date.now() < sessionEnd) {
    throw new Error("Attendance can only be marked after the session has ended.");
  }
  const isToday = new Date(booking.scheduled_start).toDateString() === new Date().toDateString();
  if (isToday && !booking.coach_joined_at) {
    throw new Error("Join the session before marking attendance.");
  }

  const now = new Date().toISOString();
  const { error: attendanceError } = await ctx.client.from("attendance").upsert(
    {
      booking_id: booking.id,
      status,
      checked_in_at: booking.scheduled_start,
      // Present and late both mean the client showed up and the session is
      // still ongoing (not checked out yet) -- only absent closes it immediately.
      checked_out_at: status === "absent" ? now : null,
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

    await logTimelineEvent(booking.client_id, "session_missed", "Session Done", {
      description: `${remark ? `${remark} — ` : ""}Session with Coach ${ctx.fullName ?? "Coach"} — Attendance: Absent.`,
      actorId: ctx.userId,
      metadata: { bookingId, coachName: ctx.fullName ?? null, attendanceStatus: "absent" },
    });
  } else {
    // Late counts as attended, same as present -- covers both here rather
    // than a third branch, since the only thing that changes is the label.
    // Distinct from "session_completed" (logged later, once notes are
    // submitted) -- otherwise presence would be silent in the timeline until
    // a separate action happens to save notes.
    await logTimelineEvent(
      booking.client_id,
      "attendance_marked_present",
      status === "late" ? "Attendance marked present (late)" : "Attendance marked present",
      {
        description: `${remark ? `${remark} — ` : ""}Session with Coach ${ctx.fullName ?? "Coach"} — Attendance: ${status === "late" ? "Present (Late)" : "Present"}.`,
        actorId: ctx.userId,
        metadata: { bookingId, coachName: ctx.fullName ?? null, attendanceStatus: status },
      }
    );
  }

  // Clears any overdue highlight (migration 0032) now that attendance has
  // been marked at all, regardless of present/absent.
  const { error: clearOverdueError } = await ctx.client.from("bookings").update({ attendance_overdue: false }).eq("id", booking.id);
  if (clearOverdueError) throw clearOverdueError;

  const notifyCtx = await resolveSessionNotifyContext(booking.client_id, booking.coach_id);
  const sessionTime = formatSessionTime(booking.scheduled_start);
  const vars = { coach_name: notifyCtx.coachName ?? "your coach", client_name: notifyCtx.clientName, session_time: sessionTime };
  if (status === "absent") {
    await notifyClient(notifyCtx, "attendance_absent_client", vars, "attendance_absent");
    await notifyCoach(notifyCtx, "attendance_absent_coach", vars);
  } else {
    await notifyClient(notifyCtx, "attendance_present_client", vars, "attendance_present");
    await notifyCoach(notifyCtx, "attendance_present_coach", vars);
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
  if (attendance?.status !== "present" && attendance?.status !== "late") {
    throw new Error("Attendance must be marked Present or Late before session notes can be submitted");
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

  const attendanceStatusLabel = attendance.status === "late" ? "Present (Late)" : "Present";
  await logTimelineEvent(booking.client_id, "coach_notes_uploaded", "Session Note Updated", { actorId: ctx.userId, metadata: { bookingId } });
  await logTimelineEvent(booking.client_id, "session_completed", "Session Done", {
    description: `Session with Coach ${ctx.fullName ?? "Coach"} — Attendance: ${attendanceStatusLabel}.`,
    actorId: ctx.userId,
    metadata: { bookingId, coachName: ctx.fullName ?? null, attendanceStatus: attendance.status },
  });

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
