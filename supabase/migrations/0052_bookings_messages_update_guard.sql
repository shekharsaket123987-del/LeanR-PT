-- LEANR — 0052: Close the RLS column-scope gap on bookings/messages
-- (QA audit finding C2).
--
-- bookings_update_own_client / bookings_update_own_coach (0012) restrict
-- WHICH ROW a client/coach may update (must be theirs) but not WHICH
-- COLUMNS. Postgres has no column-level RLS, and this project never added
-- column-level GRANTs, so with Supabase's default table-wide grants to
-- `authenticated`, any client/coach could PATCH their own booking row
-- directly via PostgREST and rewrite status/scheduled_start/coach_id/
-- amount_paid/cancelled_by — bypassing every cutoff, conflict, and
-- working-hours check that only the app's SECURITY INVOKER RPCs
-- (confirm_booking/cancel_booking/reschedule_booking) currently enforce.
-- Same shape on messages_mark_read (0044), which only intends to let a
-- participant patch read_at but doesn't stop them rewriting the OTHER
-- party's body/attachment_url.
--
-- Fix: BEFORE UPDATE triggers that re-validate the same business rules the
-- RPCs already enforce, for any caller who isn't admin or the trusted
-- service-role (auth.uid() is null for supabaseAdmin/service-role calls,
-- which this codebase already treats as privileged everywhere else — see
-- cleanupZoomMeeting, mark_missed_bookings). Legitimate app flows verified
-- against this trigger before writing it: rateBooking() only ever touches
-- quality_rating/trainer_rating/rating_note/rated_at on an already-completed
-- row; markSessionJoined()/the overdue-clear update only touch
-- coach_joined_at/attendance_overdue; markAttendance()'s absent branch moves
-- upcoming -> missed; submitSessionNotes() moves upcoming -> completed;
-- cancel_booking/reschedule_booking move status/scheduled_start/duration/
-- coach_id on an upcoming row. All of these remain allowed below; only
-- direct, unvalidated column writes are newly blocked.

create or replace function enforce_bookings_update_business_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  cutoff_hours int;
begin
  -- Admin (RLS bookings_admin_all already grants full access) and the
  -- service-role client (no user JWT, auth.uid() is null — used only for
  -- system-internal writes like Zoom cleanup and the missed-booking sweep)
  -- are exempt; every other real business rule below is enforced for both
  -- client- and coach-initiated updates.
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  -- These columns must never move via a client/coach-initiated update,
  -- regardless of which other columns are also changing in the same call.
  if new.client_id is distinct from old.client_id
    or new.subscription_id is distinct from old.subscription_id
    or new.recurring_slot_id is distinct from old.recurring_slot_id
    or new.assessment_session_id is distinct from old.assessment_session_id
    or new.session_type is distinct from old.session_type
    or new.amount_paid is distinct from old.amount_paid
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Not permitted to modify this field' using errcode = 'P0001';
  end if;

  -- Status transitions: only out of 'upcoming', only into the values the
  -- app itself ever sets, each with the same guard the RPC/service layer
  -- already applies today.
  if new.status is distinct from old.status then
    if old.status <> 'upcoming' then
      raise exception 'This booking can no longer be modified' using errcode = 'P0001';
    end if;

    if new.status = 'cancelled' then
      cutoff_hours := get_setting_int('reschedule_cutoff_hours');
      if extract(epoch from (old.scheduled_start - now())) / 3600.0 < cutoff_hours then
        raise exception 'Too close to the session start to cancel (cutoff is % hours)', cutoff_hours using errcode = 'P0001';
      end if;
      if new.cancelled_by is distinct from auth.uid() then
        raise exception 'cancelled_by must be the acting user' using errcode = 'P0001';
      end if;
    elsif new.status = 'completed' then
      if my_coach_id() is null or old.coach_id <> my_coach_id() then
        raise exception 'Only the assigned coach may complete this session' using errcode = 'P0001';
      end if;
    elsif new.status = 'missed' then
      if my_coach_id() is null or old.coach_id <> my_coach_id() then
        raise exception 'Only the assigned coach may record a missed session' using errcode = 'P0001';
      end if;
    else
      raise exception 'Invalid status transition' using errcode = 'P0001';
    end if;
  elsif old.status <> 'upcoming' and (
    new.scheduled_start is distinct from old.scheduled_start
    or new.duration_minutes is distinct from old.duration_minutes
    or new.coach_id is distinct from old.coach_id
  ) then
    -- Time/coach can't move on a booking that isn't upcoming, even without
    -- an accompanying status change.
    raise exception 'This booking can no longer be modified' using errcode = 'P0001';
  end if;

  -- Reschedule (time and/or coach change) on a still-upcoming row: re-run
  -- the exact same fitness checks create_temporary_booking/reschedule_booking
  -- already run, so a direct PATCH can't skip them.
  if old.status = 'upcoming' and (
    new.scheduled_start is distinct from old.scheduled_start
    or new.duration_minutes is distinct from old.duration_minutes
    or new.coach_id is distinct from old.coach_id
  ) then
    if not is_slot_within_working_hours(new.coach_id, new.scheduled_start, new.duration_minutes) then
      raise exception 'Coach is not available at this time' using errcode = 'P0001';
    end if;
    if has_scheduling_conflict(new.coach_id, new.scheduled_start, new.duration_minutes, old.id) then
      raise exception 'This slot is no longer available' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_update_rules on bookings;
create trigger bookings_enforce_update_rules before update on bookings
  for each row execute function enforce_bookings_update_business_rules();

-- Same column-scope gap on messages: messages_mark_read (0044) lets a
-- participant update a message from the OTHER party (by design, to set
-- read_at) but never restricted them to read_at alone.
create or replace function enforce_messages_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.body is distinct from old.body
    or new.attachment_url is distinct from old.attachment_url
    or new.sender_role is distinct from old.sender_role
    or new.sender_profile_id is distinct from old.sender_profile_id
    or new.conversation_id is distinct from old.conversation_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only read_at may be updated on an existing message' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_update_guard on messages;
create trigger messages_enforce_update_guard before update on messages
  for each row execute function enforce_messages_update_guard();
