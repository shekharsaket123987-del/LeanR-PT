-- LEANR — 0061: AI RM weekly rating + proactive daily greeting
--
-- Two additions to the AI Relationship Manager:
--   1. A weekly in-chat ask for three ratings (session / coach / platform),
--      independent of the existing per-booking session rating
--      (bookings.quality_rating/trainer_rating, migration 0030) which stays
--      unchanged. A low score on any dimension immediately raises a concern,
--      same as the safety pre-check does for pain/injury.
--   2. A once-per-day proactive greeting when the client opens the chat,
--      deduped by calendar date so reopening the panel repeatedly the same
--      day doesn't re-greet.

-- ── ai_buddy_nudges: extend the trigger_type enum for the new weekly ask ──
alter table ai_buddy_nudges drop constraint ai_buddy_nudges_trigger_type_check;
alter table ai_buddy_nudges add constraint ai_buddy_nudges_trigger_type_check
  check (trigger_type in ('missed_session', 'inactivity', 'measurement_stale', 'weekly_feedback'));

-- ── ai_buddy_messages: marks an assistant turn that's asking for the weekly
-- rating, so the chat panel renders the rating widget under that bubble
-- instead of plain text. ──
alter table ai_buddy_messages add column rating_request boolean not null default false;

-- ── ai_weekly_ratings: client-submitted, same trust level as a session
-- rating (client_id = my_client_id() insert, not system-written like
-- ai_buddy_messages) -- this is the client's own input, not the AI's. ──
create table ai_weekly_ratings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  -- Captured at submission time (the client's coach then), not looked up
  -- live later -- a coach change shouldn't rewrite history of who a past
  -- rating was actually about.
  coach_id uuid references coach_profiles(id) on delete set null,
  week text not null,
  session_rating smallint not null check (session_rating between 1 and 5),
  coach_rating smallint not null check (coach_rating between 1 and 5),
  platform_rating smallint not null check (platform_rating between 1 and 5),
  feedback_text text,
  created_at timestamptz not null default now(),
  unique (client_id, week)
);
create index ai_weekly_ratings_coach_idx on ai_weekly_ratings(coach_id);

alter table ai_weekly_ratings enable row level security;
create policy ai_weekly_ratings_admin_all on ai_weekly_ratings for all using (is_admin()) with check (is_admin());
create policy ai_weekly_ratings_select_own on ai_weekly_ratings for select using (client_id = my_client_id());
create policy ai_weekly_ratings_insert_own on ai_weekly_ratings for insert with check (client_id = my_client_id());
-- Coaches see their own aggregate (CoachPerformancePanel) -- read-only,
-- same trust level as escalations_select_by_coach.
create policy ai_weekly_ratings_select_by_coach on ai_weekly_ratings for select using (coach_id = my_coach_id());

-- ── ai_greetings: pure dedup ledger, one row per client per calendar date
-- -- mirrors ai_buddy_nudges' role but keyed by date instead of a cron
-- trigger, since the greeting fires on page-open, not a scheduled sweep. ──
create table ai_greetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  greeted_date date not null,
  created_at timestamptz not null default now(),
  unique (client_id, greeted_date)
);
alter table ai_greetings enable row level security;
create policy ai_greetings_admin_all on ai_greetings for all using (is_admin()) with check (is_admin());
create policy ai_greetings_select_own on ai_greetings for select using (client_id = my_client_id());

-- ── New concern category for a low weekly rating that isn't specifically a
-- platform/technical complaint (that case keeps using 'technical_issue'). ──
alter table escalations drop constraint escalations_category_check;
alter table escalations add constraint escalations_category_check
  check (category = any (array[
    'slot_not_available', 'coach_missed_session', 'need_schedule_change', 'payment_issue',
    'technical_issue', 'want_coach_change', 'injury_or_health', 'service_feedback', 'other'
  ]));

insert into notification_templates (key, type, title_template, body_template) values
  ('ai_buddy_nudge_weekly_feedback', 'system', 'Quick check-in from your AI Relationship Manager', 'Got a minute? Your AI Relationship Manager would like your weekly feedback.')
on conflict (key) do nothing;
