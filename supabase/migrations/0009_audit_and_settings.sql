-- LEANR Phase 1 — 0009: Audit logging + system settings

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs(actor_id);
create index audit_logs_created_idx on audit_logs(created_at desc);

create table system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
create trigger set_system_settings_updated_at before update on system_settings
  for each row execute function set_updated_at();

-- Every rule the codebase audit found hardcoded/duplicated across pages
-- (e.g. client/sessions' 12h cutoff vs. admin/settings' identical-but-disconnected
-- slider) now lives in one place.
insert into system_settings (key, value, description) values
  ('reschedule_cutoff_hours', '12', 'Minimum hours before a session start that a client may reschedule/cancel it.'),
  ('join_window_minutes', '10', 'Minutes before session start that the "Join" button becomes enabled.'),
  ('default_session_duration_minutes', '45', 'Default duration for a regular session.'),
  ('assessment_session_duration_minutes', '60', 'Duration for a first-time assessment session.'),
  ('inactivity_threshold_days', '30', 'Days without a completed session before a client is flagged inactive.'),
  ('temporary_booking_hold_minutes', '10', 'How long a temporary slot hold is reserved before it expires.');

-- Generic audit trigger: captures actor (auth.uid()), action, and a before/after
-- snapshot as jsonb for any table it's attached to. security definer so it can
-- always write to audit_logs regardless of the calling user's own RLS grants.
create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_bookings after insert or update or delete on bookings
  for each row execute function fn_audit_trigger();
create trigger audit_subscriptions after insert or update or delete on subscriptions
  for each row execute function fn_audit_trigger();
create trigger audit_coach_change_requests after insert or update or delete on coach_change_requests
  for each row execute function fn_audit_trigger();
create trigger audit_client_profiles after insert or update or delete on client_profiles
  for each row execute function fn_audit_trigger();
create trigger audit_coach_profiles after insert or update or delete on coach_profiles
  for each row execute function fn_audit_trigger();
