-- LEANR — 0047: track when a coach actually joins a session, so attendance
-- (present/absent/late) can be gated behind "session time has ended AND the
-- coach joined it" for same-day sessions, instead of being markable the
-- instant the booking row exists. See bookings.service.ts::markAttendance
-- and ::markSessionJoined.

alter table bookings add column coach_joined_at timestamptz;
