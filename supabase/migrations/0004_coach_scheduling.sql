-- LEANR Phase 1 — 0004: Coach scheduling (availability template, concrete shifts, leave)

create table coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_availability_coach_idx on coach_availability(coach_id);

create table coach_shifts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  source shift_source not null default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, shift_date, start_time)
);
create index coach_shifts_coach_date_idx on coach_shifts(coach_id, shift_date);

create table coach_leave (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  reason text,
  status leave_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_leave_coach_idx on coach_leave(coach_id);
create index coach_leave_status_idx on coach_leave(status);

create trigger set_coach_availability_updated_at before update on coach_availability
  for each row execute function set_updated_at();
create trigger set_coach_shifts_updated_at before update on coach_shifts
  for each row execute function set_updated_at();
create trigger set_coach_leave_updated_at before update on coach_leave
  for each row execute function set_updated_at();
