-- LEANR — 0060: fix escalations_category_check for injury_or_health
--
-- Migration 0059 added 'injury_or_health' to CONCERN_CATEGORIES (the
-- application-level list) so the AI RM's pre-check (aiBuddySafety.service.ts)
-- has a correct category to file L3 concerns under, but missed that
-- `escalations.category` also has a DB-level CHECK constraint independent of
-- that TS list -- any pre-check-triggered concern failed to insert at all
-- (23514 violates check constraint "escalations_category_check"), caught only
-- by an actual end-to-end test. Dropping and recreating with the same name
-- since Postgres has no ALTER CONSTRAINT for check clauses.
alter table escalations drop constraint escalations_category_check;
alter table escalations add constraint escalations_category_check
  check (category = any (array[
    'slot_not_available', 'coach_missed_session', 'need_schedule_change',
    'payment_issue', 'technical_issue', 'want_coach_change', 'injury_or_health', 'other'
  ]));
