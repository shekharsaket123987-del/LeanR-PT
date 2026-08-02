-- LEANR Phase 1 — 0002: Identity (profiles, coach_profiles, client_profiles)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null default '',
  phone text,
  photo_url text,
  account_status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

create table coach_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  specialization text,
  secondary_specializations text[] not null default '{}',
  years_experience int not null default 0,
  bio text,
  certifications text[] not null default '{}',
  languages text[] not null default '{}',
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  review_count int not null default 0,
  status coach_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_profiles_status_idx on coach_profiles(status);

create table client_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  medical_notes text,
  equipment text[] not null default '{}',
  goals text[] not null default '{}',
  joined_date date not null default current_date,
  status client_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_profiles_status_idx on client_profiles(status);

create trigger set_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger set_coach_profiles_updated_at before update on coach_profiles
  for each row execute function set_updated_at();
create trigger set_client_profiles_updated_at before update on client_profiles
  for each row execute function set_updated_at();

-- Auto-provision a profile (+ role-specific row) whenever a new auth.users
-- row is created. Role is read from the user's metadata, so set it when
-- creating the account: Dashboard -> Authentication -> Add user -> User
-- Metadata -> {"role": "coach", "full_name": "Jane Doe"}. Defaults to "client"
-- if not provided.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'client');
begin
  insert into public.profiles (id, role, full_name, photo_url)
  values (
    new.id,
    new_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'photo_url'
  );

  if new_role = 'coach' then
    insert into public.coach_profiles (profile_id) values (new.id);
  elsif new_role = 'client' then
    insert into public.client_profiles (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
