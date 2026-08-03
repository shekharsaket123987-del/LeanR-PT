-- LEANR Phase 3 — 0021: Structured session notes for the attendance-gated
-- coach workflow (Coach Portal PRD §6-8). Additive only -- `notes` stays as
-- the "Session Summary" field (repurposed in code, not renamed here) so no
-- existing row needs a backfill. No booking_status/attendance_status enum
-- changes and no touch to the bookings exclusion constraint.

alter table workout_notes
  add column exercises_performed text,
  add column performance_rating text check (performance_rating in ('excellent', 'good', 'average', 'needs_improvement')),
  add column improvements text[] not null default '{}',
  add column additional_remarks text;
