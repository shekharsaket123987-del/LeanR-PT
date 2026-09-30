-- LEANR — 0058: AI Health Buddy
--
-- Client-portal AI companion, available pre-payment (demo-only clients) all
-- the way through an active plan. Two tables:
--   - ai_buddy_messages: the chat transcript, one row per turn. Append-only
--     and system-written only (no client/coach insert policy) -- same
--     pattern as client_timeline_events (migration 0018) -- because writes
--     go through the chat route handler (which builds the context server-
--     side and calls Anthropic) and the nudge cron, never a direct client
--     insert like the client-coach `messages` table (migration 0042).
--   - ai_buddy_nudges: a pure dedup ledger for the proactive-nudge cron so a
--     missed session or a quiet week never generates more than one nudge.
--     No client-facing policy needed -- its only visible effect is the
--     ai_buddy_messages row + notification it triggers alongside it.

create table ai_buddy_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Present when the assistant thinks this needs a human instead of guessing
  -- -- {category, reason, description}, same shape raiseConcernAction()
  -- already takes. The client confirms before anything is actually filed
  -- (see AIBuddyChatClient.tsx) -- this column is a proposal, not a ticket.
  concern_proposal jsonb,
  created_at timestamptz not null default now()
);
create index ai_buddy_messages_client_idx on ai_buddy_messages(client_id, created_at);

alter table ai_buddy_messages enable row level security;
create policy ai_buddy_messages_admin_all on ai_buddy_messages for all using (is_admin()) with check (is_admin());
create policy ai_buddy_messages_select_own on ai_buddy_messages for select using (client_id = my_client_id());

create table ai_buddy_nudges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('missed_session', 'inactivity', 'measurement_stale')),
  -- Booking id for missed_session, an ISO-week string ("2026-W14") for the
  -- other two -- whatever makes a given trigger fire at most once per
  -- period, enforced by the unique constraint below rather than in app code.
  dedup_key text not null,
  created_at timestamptz not null default now(),
  unique (client_id, trigger_type, dedup_key)
);
alter table ai_buddy_nudges enable row level security;
create policy ai_buddy_nudges_admin_all on ai_buddy_nudges for all using (is_admin()) with check (is_admin());

insert into notification_templates (key, type, title_template, body_template) values
  ('ai_buddy_nudge_missed_session', 'system', 'Your AI Health Buddy checked in', 'You missed a session -- your AI Health Buddy has a note for you.'),
  ('ai_buddy_nudge_inactivity', 'system', 'Your AI Health Buddy checked in', 'It''s been a quiet week -- your AI Health Buddy left you a message.'),
  ('ai_buddy_nudge_measurement_stale', 'system', 'Your AI Health Buddy checked in', 'Time for a quick measurement update -- your AI Health Buddy has a reminder.')
on conflict (key) do nothing;
