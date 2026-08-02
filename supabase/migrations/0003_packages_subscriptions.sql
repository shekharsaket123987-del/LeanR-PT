-- LEANR Phase 1 — 0003: Commerce (package_tiers, subscriptions)

create table package_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category package_category not null,
  sessions_count int not null check (sessions_count > 0),
  price numeric(10,2) not null check (price >= 0),
  original_price numeric(10,2),
  features text[] not null default '{}',
  highlighted boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  package_id uuid not null references package_tiers(id),
  sessions_total int not null check (sessions_total > 0),
  status subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  resumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_client_idx on subscriptions(client_id);
create index subscriptions_status_idx on subscriptions(status);

create trigger set_package_tiers_updated_at before update on package_tiers
  for each row execute function set_updated_at();
create trigger set_subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();
