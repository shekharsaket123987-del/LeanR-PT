-- LEANR — 0048: 2-hour session-notes-overdue sweep
--
-- Mirrors 0032's attendance-overdue sweep, for the other half of the coach's
-- post-session workflow: attendance was marked present/late (so the client
-- did show up), but notes were never submitted. Kept as a separate flag/
-- function/template from attendance_overdue rather than folding into it,
-- since the two are mutually exclusive by construction (markAttendance()
-- already clears attendance_overdue the moment attendance is marked at
-- all) and the coach-facing message ("mark attendance" vs. "add notes") is
-- different enough to need its own copy.

alter table bookings add column notes_overdue boolean not null default false;

-- Only bookings that just transitioned from not-overdue to overdue, same
-- "notify exactly once" shape as flag_overdue_attendance().
create or replace function flag_overdue_notes()
returns setof uuid
language sql
as $$
  update bookings
  set notes_overdue = true
  where status = 'upcoming'
    and notes_overdue = false
    and now() > scheduled_start + (duration_minutes || ' minutes')::interval + interval '2 hours'
    and exists (select 1 from attendance where attendance.booking_id = bookings.id and attendance.status in ('present', 'late'))
    and not exists (select 1 from workout_notes where workout_notes.booking_id = bookings.id)
  returning id;
$$;

insert into notification_templates (key, type, title_template, body_template) values
  ('notes_overdue', 'reminder', 'Session notes still pending', 'Session notes for {{client_name}} on {{session_time}} still need to be submitted.');
