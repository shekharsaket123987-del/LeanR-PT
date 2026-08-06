-- LEANR — 0037: Zoom meeting links on bookings
--
-- The "Join" button across the app has always been a styled no-op (this is
-- a design/UX prototype per the README) -- this is the first piece of
-- making a session actually joinable, via Zoom. Links are created lazily
-- (see bookings.service.ts::ensureZoomMeetingForBooking), not at booking
-- creation time, so this doesn't need to hook into every SQL code path that
-- can create a booking row (initial confirm, recurring generation,
-- cancel-triggered regeneration all create rows without a per-row TS
-- touch point) -- a session gets its Zoom meeting the first time someone
-- actually needs to join it.

alter table bookings
  add column zoom_meeting_id text,
  add column zoom_join_url text,
  add column zoom_start_url text;
