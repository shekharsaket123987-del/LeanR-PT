-- LEANR Phase 3 — 0024: Coach-facing notification templates (Coach Portal
-- PRD §1 "Notifications" list). The notification pipe itself already exists
-- (notification_templates + createFromTemplate()) but was only ever wired
-- for notifyAdmins() alerts -- none of these coach-facing events fired a
-- real notification before this migration + the accompanying call-site
-- wiring in the service layer.

insert into notification_templates (key, type, title_template, body_template) values
  ('leave_approved', 'system', 'Leave approved', 'Your leave request for {{starts_on}} to {{ends_on}} has been approved.'),
  ('leave_rejected', 'system', 'Leave rejected', 'Your leave request for {{starts_on}} to {{ends_on}} has been rejected.'),
  ('new_client_assigned', 'system', 'New client assigned', '{{client_name}} has been assigned to you as their coach.'),
  ('client_transferred', 'system', 'Client transferred', '{{client_name}} has been transferred to another coach.'),
  ('escalation_raised_to_coach', 'system', 'Client raised a concern', '{{client_name}} raised a concern: {{reason}}.'),
  ('client_progress_updated', 'system', 'Client updated their progress', '{{client_name}} logged new weekly measurements.'),
  ('admin_changed_schedule', 'reminder', 'Session rescheduled by Admin', 'Your session with {{client_name}} was moved to {{session_time}}.'),
  ('shadow_assignment_for_coach', 'system', 'Shadow session assigned', 'You''ve been assigned as shadow coach for {{client_name}}, covering {{primary_coach_name}} from {{starts_on}} to {{ends_on}}.');
