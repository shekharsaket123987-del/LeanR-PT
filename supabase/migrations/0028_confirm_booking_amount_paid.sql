-- LEANR — 0028: Let confirm_booking() record what was actually charged
-- (paired with 0027's bookings.amount_paid column).
create or replace function confirm_booking(
  p_temp_booking_id uuid, p_subscription_id uuid default null,
  p_recurring_slot_id uuid default null, p_assessment_session_id uuid default null,
  p_session_type session_type default 'regular', p_amount_paid numeric default null
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
    scheduled_start, duration_minutes, session_type, status, amount_paid
  ) values (
    hold.client_id, hold.coach_id, p_subscription_id, p_recurring_slot_id, p_assessment_session_id,
    hold.slot_start, hold.duration_minutes, p_session_type, 'upcoming', p_amount_paid
  )
  returning id into new_booking_id;

  update temporary_bookings set status = 'confirmed' where id = p_temp_booking_id;

  return new_booking_id;
end;
$$;
