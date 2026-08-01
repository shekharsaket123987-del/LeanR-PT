-- LEANR Phase 1 — 0007: Coaching content (attendance, workout_notes, progress_logs)

create table attendance (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  status attendance_status not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Structured replacement for the prototype's free-text Session.remarks field.
create table workout_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id) on delete cascade,
  notes text,
  homework text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_notes_client_idx on workout_notes(client_id);
create index workout_notes_coach_idx on workout_notes(coach_id);

-- Periodic client metrics, decoupled from any single booking (feeds progress charts).
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight numeric(6,2),
  body_fat_pct numeric(5,2),
  streak_count int,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index progress_logs_client_idx on progress_logs(client_id, logged_at desc);

create trigger set_attendance_updated_at before update on attendance
  for each row execute function set_updated_at();
create trigger set_workout_notes_updated_at before update on workout_notes
  for each row execute function set_updated_at();
create trigger set_progress_logs_updated_at before update on progress_logs
  for each row execute function set_updated_at();
