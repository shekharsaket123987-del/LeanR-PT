-- LEANR Phase 2 — 0050: Mandatory phone at signup + session-notification templates
--
-- Part 1: handle_new_user() didn't copy phone -- SignupForm.tsx is about to
-- start collecting it and passing it through signUp()'s metadata, same as
-- full_name already is. Extending (not replacing) 0040's definition, same
-- pattern it used on top of 0002.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'client');
begin
  insert into public.profiles (id, role, full_name, phone, photo_url)
  values (
    new.id,
    new_role,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'phone',
    coalesce(
      new.raw_user_meta_data->>'photo_url',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );

  if new_role = 'coach' then
    insert into public.coach_profiles (profile_id) values (new.id);
  elsif new_role = 'client' then
    insert into public.client_profiles (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

-- Part 2: templates for the session-lifecycle events that currently fire no
-- notification at all (booking created, demo booked, schedule/coach
-- changed, attendance present/absent) plus a client-facing reschedule
-- template (the existing 'booking_cancelled'-style ones are coach-facing
-- only). {{sessions_left}}/{{plan_name}} are populated by
-- sessionNotifications.service.ts at send time from the client's active
-- subscription, not stored anywhere -- same interpolation mechanism
-- createFromTemplate() already uses.
insert into notification_templates (key, type, title_template, body_template) values
  ('session_booked_client', 'booking', 'Session booked', 'Your session with {{coach_name}} is confirmed for {{session_time}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('session_booked_coach', 'booking', 'New session booked', '{{client_name}} booked a session with you for {{session_time}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('demo_booked_client', 'booking', 'Demo session booked', 'Your free demo session is confirmed for {{session_time}}.'),
  ('demo_booked_coach', 'booking', 'New demo session booked', '{{client_name}} booked a demo session with you for {{session_time}}.'),
  ('schedule_changed_client', 'system', 'Schedule changed', 'Your recurring schedule with {{coach_name}} has been updated to {{schedule_summary}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('schedule_changed_coach', 'system', 'Client schedule changed', '{{client_name}}''s recurring schedule has been updated to {{schedule_summary}}.'),
  ('coach_changed_client', 'system', 'Coach changed', 'You have been reassigned to {{coach_name}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('coach_changed_coach', 'system', 'Client reassigned', '{{client_name}} has been reassigned to your caseload.'),
  ('attendance_present_client', 'system', 'Session marked present', 'You were marked present for your {{session_time}} session with {{coach_name}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('attendance_present_coach', 'system', 'Client marked present', '{{client_name}} was marked present for the {{session_time}} session.'),
  ('attendance_absent_client', 'system', 'Session marked absent', 'You were marked absent for your {{session_time}} session with {{coach_name}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.'),
  ('attendance_absent_coach', 'system', 'Client marked absent', '{{client_name}} was marked absent for the {{session_time}} session.'),
  ('session_rescheduled_client', 'system', 'Session rescheduled', 'Your session with {{coach_name}} was moved from {{old_session_time}} to {{new_session_time}}. Plan: {{plan_name}} — {{sessions_left}} sessions left.')
on conflict (key) do nothing;
