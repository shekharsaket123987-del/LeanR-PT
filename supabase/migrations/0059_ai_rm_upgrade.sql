-- LEANR — 0059: AI Relationship Manager upgrade
--
-- Promotes the AI Health Buddy v1 (migration 0058) toward the fuller AI
-- Relationship Manager PRD (docs/AI_RM_prd.md): admin-configurable timeline
-- tiers instead of the hardcoded allowlist in aiBuddyContext.service.ts,
-- AI-sourced escalation metadata + dedupe support (PRD §11.2), short-lived
-- memory notes (§10.1), a structured per-turn audit trail (§8.2 FR-15) and a
-- kill switch (§15). No existing table is renamed -- ai_buddy_* stays as the
-- storage layer; only user-facing copy changes to "AI Relationship Manager".

-- ── timeline_event_tiers: admin-editable replacement for the hardcoded
-- AI_BUDDY_ALLOWED_EVENT_TYPES set. 'A' = shareable fact, 'B' = background
-- only (shapes tone, never quoted verbatim), 'C' = never sent to the AI. A
-- new event_type with no row here is treated as 'C' by the context builder,
-- same default-deny behaviour the PRD requires ("new event types default to
-- Tier C until an admin assigns a tier"). ──
create table timeline_event_tiers (
  event_type text primary key,
  tier text not null check (tier in ('A', 'B', 'C')),
  updated_at timestamptz not null default now()
);

create trigger set_timeline_event_tiers_updated_at before update on timeline_event_tiers
  for each row execute function set_updated_at();

alter table timeline_event_tiers enable row level security;
create policy timeline_event_tiers_admin_all on timeline_event_tiers for all using (is_admin()) with check (is_admin());
-- Every authenticated role can read this -- it's what decides what the AI
-- may say about a client, not sensitive itself.
create policy timeline_event_tiers_select_authenticated on timeline_event_tiers for select using (auth.role() = 'authenticated');

-- Backfill: the 16 types aiBuddyContext.service.ts already exposed stay 'A'.
-- Six more get promoted to 'A' here because they're plainly client-facing
-- schedule/coach/concern facts per the PRD §7 event table (slot_assigned,
-- client_raised_concern, escalation_created, escalation_resolved,
-- shadow_coach_assigned, manual_session_added) -- previously excluded only
-- because the original allowlist was written before this table existed, not
-- because they're sensitive. coach_notes_uploaded is the PRD's canonical
-- Tier B example (shapes tone, never quoted). Everything else defaults to
-- 'C', matching current behaviour exactly for those types.
insert into timeline_event_tiers (event_type, tier) values
  ('plan_purchased', 'A'),
  ('plan_activated', 'A'),
  ('onboarding_completed', 'A'),
  ('coach_assigned', 'A'),
  ('slot_assigned', 'A'),
  ('session_completed', 'A'),
  ('session_missed', 'A'),
  ('session_cancelled', 'A'),
  ('session_rescheduled', 'A'),
  ('weekly_measurements_updated', 'A'),
  ('client_raised_concern', 'A'),
  ('escalation_created', 'A'),
  ('escalation_resolved', 'A'),
  ('pause_started', 'A'),
  ('pause_ended', 'A'),
  ('coach_changed', 'A'),
  ('shadow_coach_assigned', 'A'),
  ('manual_session_added', 'A'),
  ('plan_extended', 'A'),
  ('plan_renewed', 'A'),
  ('plan_completed', 'A'),
  ('client_status_changed', 'A'),
  ('coach_notes_uploaded', 'B'),
  ('attendance_marked_present', 'C'),
  ('refund_requested', 'C'),
  ('refund_approved', 'C'),
  ('plan_promise_adjusted', 'C');

-- ── escalations: AI-sourced metadata (PRD §11.2) ──
alter table escalations
  add column source text not null default 'client' check (source in ('client', 'ai_rm')),
  add column level text check (level in ('L0', 'L1', 'L2', 'L3')),
  add column trigger_rule text,
  add column ai_summary text,
  add column ai_chat_message_id uuid references ai_buddy_messages(id) on delete set null;
create index escalations_source_idx on escalations(source);

-- ── ai_memory_notes: things the client said, not the AI's guesses (PRD
-- §10.1) -- "running a 10K in Dec", "travelling 12-18 Oct". Default 60-day
-- expiry per the PRD; save_memory_note() can pass an earlier expires_at when
-- the client names a specific date. ──
create table ai_memory_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  content text not null,
  source_message_id uuid references ai_buddy_messages(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now()
);
create index ai_memory_notes_client_idx on ai_memory_notes(client_id, expires_at);

alter table ai_memory_notes enable row level security;
create policy ai_memory_notes_admin_all on ai_memory_notes for all using (is_admin()) with check (is_admin());
create policy ai_memory_notes_select_own on ai_memory_notes for select using (client_id = my_client_id());
-- "Forget that" (PRD §10.1) -- the client can delete their own note directly
-- from the chat; insert stays system-written only (insertMemoryNote() via
-- supabaseAdmin), so there's deliberately no client insert policy here.
create policy ai_memory_notes_delete_own on ai_memory_notes for delete using (client_id = my_client_id());

-- ── ai_audit_log: one row per assistant turn -- what it read, decided and
-- did, independent of the transcript text itself (PRD §8.2 FR-15, §13.1
-- layers 2/4). System-written only, same as ai_buddy_messages. ──
create table ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  message_id uuid references ai_buddy_messages(id) on delete set null,
  level text check (level in ('L0', 'L1', 'L2', 'L3')),
  pre_check_triggered boolean not null default false,
  post_check_blocked boolean not null default false,
  concern_id uuid references escalations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_audit_log_client_idx on ai_audit_log(client_id, created_at);

alter table ai_audit_log enable row level security;
create policy ai_audit_log_admin_all on ai_audit_log for all using (is_admin()) with check (is_admin());

-- ── ai_kill_switch: null client_id = platform-wide pause (PRD §15 "one
-- toggle in AI settings pauses the AI globally or for one client"). The two
-- partial unique indexes cap it at one global row and one row per client, so
-- "is the AI paused" is always a single unambiguous lookup rather than a
-- pile of history rows to reconcile. ──
create table ai_kill_switch (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references client_profiles(id) on delete cascade,
  active boolean not null default true,
  reason text,
  set_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index ai_kill_switch_global_idx on ai_kill_switch((client_id is null)) where client_id is null;
create unique index ai_kill_switch_client_idx on ai_kill_switch(client_id) where client_id is not null;

alter table ai_kill_switch enable row level security;
create policy ai_kill_switch_admin_all on ai_kill_switch for all using (is_admin()) with check (is_admin());

-- ── User-facing rename: "AI Health Buddy" -> "AI Relationship Manager"
-- (docs/AI_RM_prd.md). Storage tables (ai_buddy_*) keep their names --
-- only copy the client actually reads changes. ──
update notification_templates set
  title_template = 'Your AI Relationship Manager checked in',
  body_template = 'You missed a session -- your AI Relationship Manager has a note for you.'
where key = 'ai_buddy_nudge_missed_session';
update notification_templates set
  title_template = 'Your AI Relationship Manager checked in',
  body_template = 'It''s been a quiet week -- your AI Relationship Manager left you a message.'
where key = 'ai_buddy_nudge_inactivity';
update notification_templates set
  title_template = 'Your AI Relationship Manager checked in',
  body_template = 'Time for a quick measurement update -- your AI Relationship Manager has a reminder.'
where key = 'ai_buddy_nudge_measurement_stale';
