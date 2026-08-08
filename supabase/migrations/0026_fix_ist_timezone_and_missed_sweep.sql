-- LEANR — 0026: Fix IST/UTC handling in scheduling functions, sweep stale
-- "upcoming" bookings.
--
-- Bug: business hours (coach_availability, recurring_slots.start_time) are
-- authored as India (Asia/Kolkata) wall-clock time, but
-- generate_bookings_from_recurring_slot() combined `date + time` into a
-- timestamptz without ever naming a timezone, so Postgres used the session's
-- timezone (UTC) — i.e. "07:00" was stored as 07:00 UTC instead of 07:00
-- IST (01:30 UTC). Every real IST client then saw their confirmed 7:00 AM
-- session rendered as 12:30 PM (07:00 + 5:30 browser-local offset). Fixed by
-- explicitly converting through `AT TIME ZONE 'Asia/Kolkata'` at both the
-- write side (this function) and the read side (is_slot_within_working_hours,
-- assign_shadow_coach) so the two stay consistent with each other and with
-- the true wall-clock intent.

create or replace function is_slot_within_working_hours(
  p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  slot_local timestamp := p_slot_start at time zone 'Asia/Kolkata';
  slot_date date := slot_local::date;
  slot_start_time time := slot_local::time;
  slot_end_time time := ((p_slot_start + (p_duration_minutes || ' minutes')::interval) at time zone 'Asia/Kolkata')::time;
  slot_dow int := extract(dow from slot_local)::int;
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

-- Same volatility/body as 0017's has_scheduling_conflict, plus a sweep of
-- past-due "upcoming" bookings on every call — this is the one function
-- nearly every scheduling read/write path already calls (directly or via
-- create_temporary_booking/confirm_booking/generate_bookings_from_recurring_slot),
-- so it's the natural chokepoint to keep booking statuses from going stale
-- without needing a separate cron job.
create or replace function has_scheduling_conflict(
  p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int,
  p_exclude_booking_id uuid default null, p_exclude_temp_id uuid default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  slot_range tstzrange := tstzrange(p_slot_start, p_slot_start + (p_duration_minutes || ' minutes')::interval);
begin
  perform expire_temporary_bookings();
  perform mark_missed_bookings();

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
      candidate_start := (candidate_date + slot.start_time) at time zone 'Asia/Kolkata';
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
    and (scheduled_start at time zone 'Asia/Kolkata')::date between p_starts_on and p_ends_on;

  return assignment_id;
end;
$$;
