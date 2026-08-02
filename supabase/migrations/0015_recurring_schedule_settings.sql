-- LEANR Phase 2 — 0015: Recurring schedule settings + admin alert template
-- Supports the fixed hourly booking grid (no half-hour slots) and the
-- "Set Your Recurring Schedule" flow's admin fallback when no pattern fits.

insert into system_settings (key, value, description) values
  ('booking_window_start_hour', '5', 'Earliest bookable hour of day (24h, IST). No slots exist before this.'),
  ('booking_window_end_hour', '22', 'End of the bookable window (24h, IST) — last slot starts one hour before this.');

insert into notification_templates (key, type, title_template, body_template) values
  ('recurring_schedule_unmatched', 'system',
   'Recurring schedule needs manual matching',
   '{{client_name}} could not be matched to a recurring schedule with {{coach_name}} (tried MWF/TTS/6-day, same-trio pairs, and custom days). Please resolve manually.');
