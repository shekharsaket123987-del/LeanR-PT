-- LEANR Phase 3 — 0025: Session Cancellation & Rescheduling Policy.
--
-- Cancel and reschedule previously shared one setting (reschedule_cutoff_hours
-- = 12), enforced identically by both cancel_booking() and reschedule_booking().
-- The policy calls for two different cutoffs: 12h for cancellation, 1h for
-- rescheduling. This adds the new setting, repoints cancel_booking() at it,
-- and repurposes reschedule_cutoff_hours to mean reschedule only.

insert into system_settings (key, value, description) values
  ('cancellation_cutoff_hours', '12', 'Minimum hours before a session start that a client may cancel it.');

update system_settings
set value = '1', description = 'Minimum hours before a session start that a client may reschedule it.'
where key = 'reschedule_cutoff_hours';

create or replace function cancel_booking(
  p_booking_id uuid, p_cancelled_by uuid, p_reason text default null, p_enforce_cutoff boolean default true
)
returns void
language plpgsql
as $$
declare
  b bookings%rowtype;
  cutoff_hours int := get_setting_int('cancellation_cutoff_hours');
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

insert into notification_templates (key, type, title_template, body_template) values
  ('session_cancelled_by_client', 'system', 'Client cancelled a session', '{{client_name}} cancelled their session scheduled for {{session_time}}.'),
  ('session_rescheduled_by_client', 'system', 'Client rescheduled a session', '{{client_name}} moved their session from {{old_time}} to {{new_time}}.');
