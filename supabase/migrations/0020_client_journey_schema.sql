-- LEANR Phase 2 — 0020: Schema for the full client self-service journey
-- (marketing/plans -> demo booking -> purchase -> activation -> onboarding
-- -> slot selection -> ongoing self-service). Depends on 0019's enum values.

-- ── client_onboarding ── (one-time initial assessment; client can insert
-- once, only admin can update afterward -- enforced in onboarding.service.ts
-- since RLS can't cleanly express "insert only if no row exists yet")
create table client_onboarding (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references client_profiles(id) on delete cascade,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  medical_conditions text,
  injuries text,
  medications text,
  exercise_restrictions text,
  fitness_goal fitness_goal,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_client_onboarding_updated_at before update on client_onboarding
  for each row execute function set_updated_at();

alter table client_onboarding enable row level security;
create policy client_onboarding_admin_all on client_onboarding for all using (is_admin()) with check (is_admin());
create policy client_onboarding_select_own on client_onboarding for select using (client_id = my_client_id());
create policy client_onboarding_insert_own on client_onboarding for insert with check (client_id = my_client_id());
create policy client_onboarding_select_by_coach on client_onboarding for select using (coach_client_linked(my_coach_id(), client_id));

-- ── subscriptions: activation date, separate from purchase date ──
alter table subscriptions add column activated_at timestamptz;

-- ── coach_profiles: gender (demo-booking preference filter) ──
alter table coach_profiles add column gender text check (gender in ('male', 'female', 'other'));

-- ── escalations: fixed category list (client-facing "Raise a Concern" dropdown) ──
alter table escalations add column category text check (
  category in ('slot_not_available', 'coach_missed_session', 'need_schedule_change', 'payment_issue', 'technical_issue', 'want_coach_change', 'other')
);

-- ── coach_change_requests: feedback form fields ──
alter table coach_change_requests
  add column overall_experience smallint check (overall_experience between 1 and 5),
  add column coach_rating smallint check (coach_rating between 1 and 5),
  add column additional_comments text;
