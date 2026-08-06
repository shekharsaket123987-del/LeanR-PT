-- LEANR — 0030: Split session rating into quality/trainer dimensions
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §3.7 calls for two rating dimensions
-- (how the session itself went vs. the trainer specifically) instead of one
-- combined value, each with an optional free-text note, plus a once-per-week
-- submission cap identical to the existing progress_logs pattern (enforced
-- at the app layer using rated_at, mirrored in bookings.service.ts).
--
-- The old `rating`/`client_feedback` columns are superseded here but left in
-- place -- nothing else in the schema (no view/trigger) depends on them, and
-- this project's migrations have so far been strictly additive. Backfilled
-- below for continuity; safe to drop in a later migration once the
-- application-layer switch is verified in production.

alter table bookings
  add column quality_rating smallint check (quality_rating between 1 and 5),
  add column trainer_rating smallint check (trainer_rating between 1 and 5),
  add column rating_note text,
  add column rated_at timestamptz;

update bookings
set quality_rating = rating,
    trainer_rating = rating,
    rating_note = client_feedback,
    rated_at = updated_at
where rating is not null;
