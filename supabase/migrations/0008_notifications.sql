-- LEANR Phase 1 — 0008: Notification framework
-- Templates + delivered rows. Actual email/push/WhatsApp dispatch is out of
-- scope for Phase 1 — `channels` just tracks delivery status per channel so
-- a future dispatcher can pick up pending rows.

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type notification_type not null,
  title_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  template_key text references notification_templates(key),
  type notification_type not null,
  title text not null,
  message text not null,
  related_entity_type text,
  related_entity_id uuid,
  read boolean not null default false,
  channels jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, read);
create index notifications_created_idx on notifications(created_at desc);

create trigger set_notification_templates_updated_at before update on notification_templates
  for each row execute function set_updated_at();
create trigger set_notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

insert into notification_templates (key, type, title_template, body_template) values
  ('booking_confirmed', 'booking', 'Session booked', 'Your session with {{coach_name}} is confirmed for {{session_time}}.'),
  ('booking_cancelled', 'booking', 'Session cancelled', 'Your session with {{coach_name}} on {{session_time}} has been cancelled.'),
  ('session_reminder', 'reminder', 'Session starting soon', 'Your session with {{coach_name}} starts at {{session_time}}.'),
  ('coach_change_approved', 'system', 'Coach change approved', 'You have been reassigned to {{new_coach_name}}. Your new booking flow will begin shortly.'),
  ('shadow_coach_assigned', 'system', 'Temporary coach assigned', '{{shadow_coach_name}} will cover your sessions with {{primary_coach_name}} from {{starts_on}} to {{ends_on}}.'),
  ('inactivity_warning', 'system', 'We miss you', 'You have not completed a session in {{days_inactive}} days. Book your next session to keep your streak going.'),
  ('assessment_reminder', 'reminder', 'Assessment session reminder', 'Your free assessment session is scheduled for {{session_time}}.'),
  ('admin_alert', 'system', 'Admin alert', '{{alert_message}}');
