-- LEANR — 0056: Close email-notification gaps + 6-hour session reminder
--
-- Several real events (plan purchased/activated, subscription paused/
-- resumed, a session cancelled by staff rather than the client, a coach's
-- leave affecting a client's upcoming sessions, an escalation getting
-- resolved) currently write no notification at all, or write an in-app
-- bell row via createFromTemplate() but never actually email anyone
-- (sessionNotifications.service.ts's notifyClient/notifyCoach wrappers are
-- what add the email step, and these call sites bypassed them). New
-- template keys only for genuinely new copy; existing keys
-- (shadow_coach_assigned, shadow_assignment_for_coach,
-- session_cancelled_by_client, escalation_raised_to_coach) get emailed too,
-- but that's a call-site change in the app layer, not a schema change.

alter table bookings add column reminder_sent_at timestamptz;

insert into notification_templates (key, type, title_template, body_template) values
  ('session_reminder_client', 'reminder', 'Your session is in 6 hours', 'Your session with {{coach_name}} is coming up at {{session_time}}. {{join_line}}'),
  ('session_reminder_coach', 'reminder', 'Upcoming session in 6 hours', 'Your session with {{client_name}} is coming up at {{session_time}}. {{join_line}}'),
  ('plan_purchased_client', 'system', 'Plan purchased', 'You''ve purchased {{plan_name}} ({{sessions_left}} sessions). We''ll email you once it''s ready to start.'),
  ('plan_activated_client', 'system', 'Plan activated', 'Your {{plan_name}} plan is now active, starting {{start_date}}.'),
  ('subscription_paused_client', 'system', 'Plan paused', 'Your {{plan_name}} plan has been paused. You won''t be able to book new sessions until it''s resumed.'),
  ('subscription_paused_coach', 'system', 'Client plan paused', '{{client_name}}''s plan has been paused.'),
  ('subscription_resumed_client', 'system', 'Plan resumed', 'Your {{plan_name}} plan has been resumed -- you can book sessions again.'),
  ('subscription_resumed_coach', 'system', 'Client plan resumed', '{{client_name}}''s plan has been resumed.'),
  ('session_cancelled_client', 'system', 'Session cancelled', 'Your session with {{coach_name}} on {{session_time}} has been cancelled.{{reason_line}}'),
  ('coach_on_leave_client', 'system', 'Your coach is on leave', '{{coach_name}} will be on leave from {{starts_on}} to {{ends_on}}. We''ll make sure your sessions during this time are covered.'),
  ('escalation_resolved_client', 'system', 'Your concern has been resolved', 'Your concern "{{reason}}" has been marked resolved.{{resolution_line}}')
on conflict (key) do nothing;
