-- LEANR — 0031: Partial-day (hour-wise) coach leave
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.9 item 1: coach_leave only ever
-- blocked a whole calendar day. Adds leave_type (full_day/partial) plus, for
-- partial, the specific time window that's actually unavailable on
-- starts_on -- everything else that day stays bookable. Partial leave is
-- scoped to a single day (starts_on = ends_on); a multi-day partial-hours
-- pattern is out of scope, matching the "hour-wise" framing in the spec.

create type leave_type as enum ('full_day', 'partial');

alter table coach_leave
  add column leave_type leave_type not null default 'full_day',
  add column partial_start_time time,
  add column partial_end_time time,
  add constraint coach_leave_partial_bounds check (
    (leave_type = 'full_day' and partial_start_time is null and partial_end_time is null)
    or (leave_type = 'partial' and partial_start_time is not null and partial_end_time is not null and partial_end_time > partial_start_time)
  ),
  add constraint coach_leave_partial_single_day check (
    leave_type = 'full_day' or starts_on = ends_on
  );

-- Re-point every function that reasons about coach_leave so a partial-leave
-- day only blocks its own time window, not the whole day. full_day rows
-- behave exactly as before (partial_start_time/end_time are null for them).

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
      and (
        leave_type = 'full_day'
        or (slot_start_time < partial_end_time and slot_end_time > partial_start_time)
      )
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
  candidate_end_time time;
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
      candidate_end_time := (slot.start_time + (slot.duration_minutes || ' minutes')::interval)::time;
      if not exists (
        select 1 from coach_leave
        where coach_id = slot.coach_id and status = 'approved'
          and candidate_date between starts_on and ends_on
          and (
            leave_type = 'full_day'
            or (slot.start_time < partial_end_time and candidate_end_time > partial_start_time)
          )
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
