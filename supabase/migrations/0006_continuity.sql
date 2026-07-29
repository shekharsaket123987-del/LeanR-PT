-- LEANR Phase 1 — 0006: Coach continuity (shadow coaching, coach-change requests)

create table shadow_coach_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  primary_coach_id uuid not null references coach_profiles(id) on delete cascade,
  shadow_coach_id uuid not null references coach_profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  reason text,
  status shadow_assignment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shadow_coach_differs_from_primary check (shadow_coach_id <> primary_coach_id)
);
create index shadow_assignments_client_idx on shadow_coach_assignments(client_id);
create index shadow_assignments_status_idx on shadow_coach_assignments(status);

-- Same concept as the prototype's coach-change flow, plus the two fields the
-- codebase audit found missing: the prototype's "Approve" action picks a new
-- coach in the UI but never persists it anywhere (CoachChangeRequest has no
-- newCoachId field) and its "Reject" button has no handler at all.
create table coach_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  current_coach_id uuid not null references coach_profiles(id) on delete cascade,
  new_coach_id uuid references coach_profiles(id) on delete set null,
  reason text,
  status coach_change_status not null default 'pending',
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_change_requests_client_idx on coach_change_requests(client_id);
create index coach_change_requests_status_idx on coach_change_requests(status);

create trigger set_shadow_assignments_updated_at before update on shadow_coach_assignments
  for each row execute function set_updated_at();
create trigger set_coach_change_requests_updated_at before update on coach_change_requests
  for each row execute function set_updated_at();
