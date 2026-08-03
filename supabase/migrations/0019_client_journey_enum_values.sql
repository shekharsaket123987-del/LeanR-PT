-- LEANR Phase 2 — 0019: New enum values for the client self-service journey.
-- Split into its own migration because Postgres cannot use a newly-added enum
-- value within the same transaction that added it -- 0020 depends on these.
alter type subscription_status add value 'awaiting_activation';
alter type escalation_status add value 'in_progress';
create type fitness_goal as enum ('fat_loss', 'muscle_gain', 'strength', 'general_fitness', 'rehabilitation');
