-- LEANR — 0041: let a client-initiated reschedule optionally move a single
-- booking to a substitute coach (used when the client's desired new time
-- isn't free with their own coach). recurring_slot_id is left untouched, so
-- generate_bookings_from_recurring_slot keeps generating this client's
-- FUTURE occurrences with the original coach -- the substitute only ever
-- covers this one rescheduled booking, with no separate reversion step
-- needed.

create or replace function reschedule_booking(
  p_booking_id uuid, p_new_start timestamptz, p_new_duration_minutes int default null,
  p_enforce_cutoff boolean default true, p_new_coach_id uuid default null
)
returns void
language plpgsql
as $$
declare
  b bookings%rowtype;
  new_duration int;
  target_coach_id uuid;
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
  target_coach_id := coalesce(p_new_coach_id, b.coach_id);

  if not is_slot_within_working_hours(target_coach_id, p_new_start, new_duration) then
    raise exception 'Coach is not available at this time' using errcode = 'P0001';
  end if;
  if has_scheduling_conflict(target_coach_id, p_new_start, new_duration, p_booking_id) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  update bookings
  set scheduled_start = p_new_start, duration_minutes = new_duration, coach_id = target_coach_id
  where id = p_booking_id;
end;
$$;
