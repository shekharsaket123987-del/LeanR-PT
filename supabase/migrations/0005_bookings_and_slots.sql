-- LEANR Phase 1 — 0005: Bookings & slots
-- (recurring_slots, temporary_bookings, assessment_sessions, bookings)

create extension if not exists btree_gist;

-- Postgres marks `timestamptz + interval` STABLE, not IMMUTABLE, because an
-- interval can carry day/month components whose length depends on timezone/
-- DST — so it can't be used directly inside an index expression (which is
-- what an exclusion constraint compiles to, see bookings_no_coach_overlap
-- below). Here the interval is always a plain number of minutes, which *is*
-- timezone-independent, so wrapping it in a function we explicitly declare
-- IMMUTABLE is correct, not just a workaround.
create or replace function booking_end_time(start_ts timestamptz, duration_min int)
returns timestamptz
language sql immutable
as $$
  select start_ts + (duration_min * interval '1 minute');
$$;

create table recurring_slots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes int not null default 45 check (duration_minutes > 0),
  status recurring_slot_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_slots_client_idx on recurring_slots(client_id);
create index recurring_slots_coach_idx on recurring_slots(coach_id);

create table temporary_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  slot_start timestamptz not null,
  duration_minutes int not null default 45 check (duration_minutes > 0),
  expires_at timestamptz not null,
  status temporary_booking_status not null default 'held',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index temporary_bookings_coach_idx on temporary_bookings(coach_id, status);
create index temporary_bookings_expires_idx on temporary_bookings(expires_at) where status = 'held';

create table assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  prospect_name text not null,
  prospect_email text,
  prospect_phone text,
  assigned_coach_id uuid references coach_profiles(id) on delete set null,
  scheduled_start timestamptz not null,
  status assessment_status not null default 'scheduled',
  converted_client_id uuid references client_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessment_sessions_coach_idx on assessment_sessions(assigned_coach_id);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  recurring_slot_id uuid references recurring_slots(id) on delete set null,
  assessment_session_id uuid references assessment_sessions(id) on delete set null,
  scheduled_start timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  session_type session_type not null default 'regular',
  status booking_status not null default 'upcoming',
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  rating smallint check (rating between 1 and 5),
  client_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Hard DB-level guarantee (not just app logic) that a coach can never have
  -- two overlapping "upcoming" bookings — this is the Capacity Validation /
  -- Conflict Detection rule enforced at the strongest possible layer.
  constraint bookings_no_coach_overlap exclude using gist (
    coach_id with =,
    tstzrange(scheduled_start, booking_end_time(scheduled_start, duration_minutes)) with &&
  ) where (status = 'upcoming')
);
create index bookings_client_idx on bookings(client_id);
create index bookings_coach_idx on bookings(coach_id);
create index bookings_status_idx on bookings(status);
create index bookings_scheduled_start_idx on bookings(scheduled_start);

create trigger set_recurring_slots_updated_at before update on recurring_slots
  for each row execute function set_updated_at();
create trigger set_temporary_bookings_updated_at before update on temporary_bookings
  for each row execute function set_updated_at();
create trigger set_assessment_sessions_updated_at before update on assessment_sessions
  for each row execute function set_updated_at();
create trigger set_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();
