-- LEANR — 0032: 2-hour attendance-overdue sweep
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.3: if a coach hasn't marked
-- attendance within 2 hours of a session's scheduled end, flag it so the
-- coach's Today's Tasks view can highlight it and a notification goes out.
-- Mirrors the mark_missed_bookings() convention already used in this
-- codebase (0011/0026): a plain SQL sweep with no cron infrastructure,
-- invoked opportunistically -- here, from the coach dashboard/Today's Tasks
-- action (bookings.service.ts::sweepOverdueAttendance) rather than embedded
-- in has_scheduling_conflict(), since the caller needs to know WHICH
-- bookings just became overdue in order to notify exactly once per booking.

alter table bookings add column attendance_overdue boolean not null default false;

-- Returns only the bookings that just transitioned from not-overdue to
-- overdue (the where clause excludes already-flagged rows), so the caller
-- can notify exactly once per booking rather than every time this runs.
create or replace function flag_overdue_attendance()
returns setof uuid
language sql
as $$
  update bookings
  set attendance_overdue = true
  where status = 'upcoming'
    and attendance_overdue = false
    and now() > scheduled_start + (duration_minutes || ' minutes')::interval + interval '2 hours'
    and not exists (select 1 from attendance where attendance.booking_id = bookings.id)
  returning id;
$$;

insert into notification_templates (key, type, title_template, body_template) values
  ('attendance_overdue', 'reminder', 'Attendance still not marked', 'Your session with {{client_name}} on {{session_time}} still needs attendance marked.');
