-- LEANR — 0057: Close two more email gaps found auditing the migration
-- wizard's schedule assignment and the coach-change-request flow.
--
-- createRecurringSlots (and its admin-migration counterpart,
-- createRecurringSlotsForClient) sent no notification at all when a
-- client's first weekly schedule/coach was set -- only changeMyRecurringSchedule
-- (an EXISTING schedule being changed) emailed anyone. And
-- resolveCoachChangeRequest never told the client the outcome unless the
-- admin picked a new coach in the same step (which routes through
-- reassignClientCoach, already emailing) -- a rejection, or an approval
-- that still needs the client to pick a coach themselves, went out silently.

insert into notification_templates (key, type, title_template, body_template) values
  ('schedule_assigned_client', 'booking', 'Weekly schedule confirmed', 'Your weekly schedule with {{coach_name}} is set: {{schedule_summary}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('schedule_assigned_coach', 'booking', 'New client schedule assigned', '{{client_name}} has been scheduled with you: {{schedule_summary}}.'),
  ('coach_change_request_approved_client', 'system', 'Coach change approved', 'Your coach change request has been approved -- choose your new coach and schedule to finish.'),
  ('coach_change_request_rejected_client', 'system', 'Coach change request declined', 'Your coach change request wasn''t approved. Reach out to support if you''d like to discuss it.')
on conflict (key) do nothing;
