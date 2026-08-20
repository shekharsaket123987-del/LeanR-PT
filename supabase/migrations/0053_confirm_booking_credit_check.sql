-- LEANR — 0053: Enforce remaining session credits at booking time
-- (QA audit finding C3).
--
-- confirmBookingAction (client-portal.actions.ts) only ever checked that an
-- active subscription EXISTS, never that it has sessions left --
-- subscription_usage_view.sessions_remaining only counts *completed*
-- bookings against sessions_total, so a client could keep confirming new
-- 'upcoming' bookings against the same subscription forever with zero
-- enforcement anywhere, client or server. Fixed at the one choke point every
-- regular booking must pass through: confirm_booking() itself (redefined
-- here from its current 0028 body, adding only the credit check below) --
-- this also closes the same gap for any future caller of the RPC, not just
-- today's UI.
--
-- Counts 'upcoming' + 'completed' bookings against the subscription (not
-- just 'completed', unlike the dashboard's subscription_usage_view) since
-- the whole point is to stop a NEW upcoming booking once existing
-- upcoming+completed bookings already exhaust the package -- counting only
-- completed would let unlimited 'upcoming' bookings stack up before this
-- check ever triggered.
--
-- Live-schema check before writing this migration found a STALE 5-argument
-- overload of confirm_booking still present (from before 0028 added
-- p_amount_paid -- CREATE OR REPLACE only replaces an exact signature
-- match, so adding a new parameter created a second overload instead of
-- replacing the first one, and nothing ever dropped the original). Left in
-- place, that old 5-arg version would still be directly callable with none
-- of the credit check below, silently reopening this exact hole -- so drop
-- it explicitly before redefining the 6-arg version.
drop function if exists confirm_booking(uuid, uuid, uuid, uuid, session_type);

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
  sub_sessions_total int;
  sub_sessions_committed int;
begin
  select * into hold from temporary_bookings where id = p_temp_booking_id for update;
  if not found or hold.status <> 'held' or hold.expires_at < now() then
    raise exception 'This hold has expired, please pick a slot again' using errcode = 'P0001';
  end if;

  if has_scheduling_conflict(hold.coach_id, hold.slot_start, hold.duration_minutes, null, p_temp_booking_id) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  if p_subscription_id is not null then
    select sessions_total into sub_sessions_total from subscriptions where id = p_subscription_id for update;
    if not found then
      raise exception 'Subscription not found' using errcode = 'P0001';
    end if;

    select count(*) into sub_sessions_committed
    from bookings
    where subscription_id = p_subscription_id and status in ('upcoming', 'completed');

    if sub_sessions_committed >= sub_sessions_total then
      raise exception 'No sessions remaining on this package' using errcode = 'P0001';
    end if;
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
