-- LEANR Phase 1 — 0011: Scheduling engine functions
-- Called from src/lib/services/scheduling.service.ts and bookings.service.ts.
-- The hard "no double-booking" guarantee lives in the bookings table's
-- exclusion constraint (0005); these functions add the softer checks
-- (working hours, leave, temporary holds) and the multi-step workflows
-- (hold -> confirm, cancel -> regenerate, shadow reassignment).

-- Note on privilege: get_setting_int / expire_temporary_bookings /
-- is_slot_within_working_hours / has_scheduling_conflict are SECURITY DEFINER
-- because they must see system-wide state (every coach's bookings/leave, not
-- just rows the calling client/coach could themselves SELECT under RLS) to
-- answer a true/false fitness question. They leak no row data, only booleans.
-- The workflow functions below them (create_temporary_booking, confirm_booking,
-- cancel_booking, generate_bookings_from_recurring_slot, assign_shadow_coach)
-- stay SECURITY INVOKER so RLS still governs who is actually allowed to
-- create/modify rows.

create or replace function get_setting_int(p_key text)
returns int
language sql stable security definer set search_path = public
as $$
  select (value #>> '{}')::int from system_settings where key = p_key;
$$;

-- Flip stale "held" temporary bookings to "expired" so their slot frees up.
create or replace function expire_temporary_bookings()
returns void
language sql security definer set search_path = public
as $$
  update temporary_bookings
  set status = 'expired'
  where status = 'held' and expires_at < now();
$$;

-- Is the coach actually working during this window (per coach_shifts if one
-- exists for the date, else the recurring coach_availability template), and
-- not on approved leave?
create or replace function is_slot_within_working_hours(
  p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  slot_date date := p_slot_start::date;
  slot_start_time time := p_slot_start::time;
  slot_end_time time := (p_slot_start + (p_duration_minutes || ' minutes')::interval)::time;
  slot_dow int := extract(dow from p_slot_start)::int;
  on_leave boolean;
  covered boolean;
begin
  select exists (
    select 1 from coach_leave
    where coach_id = p_coach_id and status = 'approved'
      and slot_date between starts_on and ends_on
  ) into on_leave;
  if on_leave then
    return false;
  end if;

  select exists (
    select 1 from coach_shifts
    where coach_id = p_coach_id and shift_date = slot_date
      and start_time <= slot_start_time and end_time >= slot_end_time
  ) into covered;
  if covered then
    return true;
  end if;

  -- No explicit shift row for this date: fall back to the recurring template,
  -- but only if there is no shift row at all for the date (an explicit shift
  -- row set means the recurring template was deliberately overridden).
  if exists (select 1 from coach_shifts where coach_id = p_coach_id and shift_date = slot_date) then
    return false;
  end if;

  return exists (
    select 1 from coach_availability
    where coach_id = p_coach_id and day_of_week = slot_dow and is_active
      and start_time <= slot_start_time and end_time >= slot_end_time
  );
end;
$$;

-- Any overlapping upcoming booking or live temporary hold for this coach?
create or replace function has_scheduling_conflict(
  p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int,
  p_exclude_booking_id uuid default null, p_exclude_temp_id uuid default null
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  slot_range tstzrange := tstzrange(p_slot_start, p_slot_start + (p_duration_minutes || ' minutes')::interval);
begin
  perform expire_temporary_bookings();

  if exists (
    select 1 from bookings
    where coach_id = p_coach_id and status = 'upcoming'
      and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
      and tstzrange(scheduled_start, scheduled_start + (duration_minutes || ' minutes')::interval) && slot_range
  ) then
    return true;
  end if;

  if exists (
    select 1 from temporary_bookings
    where coach_id = p_coach_id and status = 'held'
      and (p_exclude_temp_id is null or id <> p_exclude_temp_id)
      and tstzrange(slot_start, slot_start + (duration_minutes || ' minutes')::interval) && slot_range
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- Step 1 of booking: hold a slot for system_settings.temporary_booking_hold_minutes.
create or replace function create_temporary_booking(
  p_client_id uuid, p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  if not is_slot_within_working_hours(p_coach_id, p_slot_start, p_duration_minutes) then
    raise exception 'Coach is not available at this time' using errcode = 'P0001';
  end if;
  if has_scheduling_conflict(p_coach_id, p_slot_start, p_duration_minutes) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  insert into temporary_bookings (client_id, coach_id, slot_start, duration_minutes, expires_at, status)
  values (
    p_client_id, p_coach_id, p_slot_start, p_duration_minutes,
    now() + (get_setting_int('temporary_booking_hold_minutes') || ' minutes')::interval,
    'held'
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Step 2 of booking: promote a held temporary_booking into a real booking.
create or replace function confirm_booking(
  p_temp_booking_id uuid, p_subscription_id uuid default null,
  p_recurring_slot_id uuid default null, p_assessment_session_id uuid default null,
  p_session_type session_type default 'regular'
)
returns uuid
language plpgsql
as $$
declare
  hold temporary_bookings%rowtype;
  new_booking_id uuid;
begin
  select * into hold from temporary_bookings where id = p_temp_booking_id for update;
  if not found or hold.status <> 'held' or hold.expires_at < now() then
    raise exception 'This hold has expired, please pick a slot again' using errcode = 'P0001';
  end if;

  if has_scheduling_conflict(hold.coach_id, hold.slot_start, hold.duration_minutes, null, p_temp_booking_id) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  insert into bookings (
    client_id, coach_id, subscription_id, recurring_slot_id, assessment_session_id,
    scheduled_start, duration_minutes, session_type, status
  ) values (
    hold.client_id, hold.coach_id, p_subscription_id, p_recurring_slot_id, p_assessment_session_id,
    hold.slot_start, hold.duration_minutes, p_session_type, 'upcoming'
  )
  returning id into new_booking_id;

  update temporary_bookings set status = 'confirmed' where id = p_temp_booking_id;

  return new_booking_id;
end;
$$;

-- Generates the next N occurrences of a client's recurring weekly pattern,
-- skipping dates blocked by approved coach leave or an existing conflict.
create or replace function generate_bookings_from_recurring_slot(
  p_recurring_slot_id uuid, p_count int default 1
)
returns setof uuid
language plpgsql
as $$
declare
  slot recurring_slots%rowtype;
  candidate_date date;
  candidate_start timestamptz;
  generated int := 0;
  attempts int := 0;
  new_id uuid;
begin
  select * into slot from recurring_slots where id = p_recurring_slot_id;
  if not found or slot.status <> 'active' then
    return;
  end if;

  candidate_date := current_date + 1;
  while generated < p_count and attempts < 60 loop
    attempts := attempts + 1;
    if extract(dow from candidate_date)::int = slot.day_of_week then
      candidate_start := candidate_date + slot.start_time;
      if not exists (
        select 1 from coach_leave
        where coach_id = slot.coach_id and status = 'approved'
          and candidate_date between starts_on and ends_on
      )
      and not exists (
        select 1 from bookings where recurring_slot_id = p_recurring_slot_id and scheduled_start = candidate_start
      )
      and not has_scheduling_conflict(slot.coach_id, candidate_start, slot.duration_minutes)
      then
        insert into bookings (
          client_id, coach_id, subscription_id, recurring_slot_id,
          scheduled_start, duration_minutes, session_type, status
        ) values (
          slot.client_id, slot.coach_id, slot.subscription_id, p_recurring_slot_id,
          candidate_start, slot.duration_minutes, 'regular', 'upcoming'
        )
        returning id into new_id;

        generated := generated + 1;
        return next new_id;
      end if;
    end if;
    candidate_date := candidate_date + 1;
  end loop;
  return;
end;
$$;

-- Cancels a booking (enforcing the reschedule cutoff unless overridden by an
-- admin) and, if it came from a recurring pattern, regenerates the next
-- occurrence so the client's ongoing slot is recovered rather than lost.
create or replace function cancel_booking(
  p_booking_id uuid, p_cancelled_by uuid, p_reason text default null, p_enforce_cutoff boolean default true
)
returns void
language plpgsql
as $$
declare
  b bookings%rowtype;
  cutoff_hours int := get_setting_int('reschedule_cutoff_hours');
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.status <> 'upcoming' then
    raise exception 'Only upcoming bookings can be cancelled' using errcode = 'P0001';
  end if;

  if p_enforce_cutoff and extract(epoch from (b.scheduled_start - now())) / 3600.0 < cutoff_hours then
    raise exception 'Too close to the session start to cancel (cutoff is % hours)', cutoff_hours using errcode = 'P0001';
  end if;

  update bookings
  set status = 'cancelled', cancelled_by = p_cancelled_by, cancel_reason = p_reason
  where id = p_booking_id;

  if b.recurring_slot_id is not null then
    perform generate_bookings_from_recurring_slot(b.recurring_slot_id, 1);
  end if;
end;
$$;

-- Reschedules a booking in place (same row/id, so workout_notes/attendance
-- FKs stay valid) rather than cancel+recreate, so it deliberately does NOT
-- trigger recurring-slot regeneration the way cancel_booking does.
create or replace function reschedule_booking(
  p_booking_id uuid, p_new_start timestamptz, p_new_duration_minutes int default null,
  p_enforce_cutoff boolean default true
)
returns void
language plpgsql
as $$
declare
  b bookings%rowtype;
  new_duration int;
  cutoff_hours int := get_setting_int('reschedule_cutoff_hours');
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.status <> 'upcoming' then
    raise exception 'Only upcoming bookings can be rescheduled' using errcode = 'P0001';
  end if;

  if p_enforce_cutoff and extract(epoch from (b.scheduled_start - now())) / 3600.0 < cutoff_hours then
    raise exception 'Too close to the session start to reschedule (cutoff is % hours)', cutoff_hours using errcode = 'P0001';
  end if;

  new_duration := coalesce(p_new_duration_minutes, b.duration_minutes);

  if not is_slot_within_working_hours(b.coach_id, p_new_start, new_duration) then
    raise exception 'Coach is not available at this time' using errcode = 'P0001';
  end if;
  if has_scheduling_conflict(b.coach_id, p_new_start, new_duration, p_booking_id) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  update bookings
  set scheduled_start = p_new_start, duration_minutes = new_duration
  where id = p_booking_id;
end;
$$;

-- Reassigns a client's upcoming bookings with their primary coach to a
-- shadow coach for the given date range (e.g. covering approved leave).
create or replace function assign_shadow_coach(
  p_client_id uuid, p_primary_coach_id uuid, p_shadow_coach_id uuid,
  p_starts_on date, p_ends_on date, p_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  assignment_id uuid;
begin
  insert into shadow_coach_assignments (client_id, primary_coach_id, shadow_coach_id, starts_on, ends_on, reason, status)
  values (p_client_id, p_primary_coach_id, p_shadow_coach_id, p_starts_on, p_ends_on, p_reason, 'active')
  returning id into assignment_id;

  update bookings
  set coach_id = p_shadow_coach_id
  where client_id = p_client_id and coach_id = p_primary_coach_id and status = 'upcoming'
    and scheduled_start::date between p_starts_on and p_ends_on;

  return assignment_id;
end;
$$;

-- Maintenance: flip upcoming bookings whose window has fully elapsed to
-- "missed" (nothing else in the system transitions this status automatically).
create or replace function mark_missed_bookings()
returns void
language sql
as $$
  update bookings
  set status = 'missed'
  where status = 'upcoming' and scheduled_start + (duration_minutes || ' minutes')::interval < now();
$$;
