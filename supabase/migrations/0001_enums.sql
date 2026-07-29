-- LEANR Phase 1 — 0001: Enum types
-- These reuse the exact status strings already rendered by the frontend's
-- SessionStatusBadge component (src/components/ui/Badge.tsx), so Phase 2
-- (wiring dashboards to real data) needs zero changes to status-rendering code.

create type user_role as enum ('admin', 'coach', 'client');
create type account_status as enum ('active', 'suspended');

create type coach_status as enum ('active', 'inactive', 'on-leave');
create type client_status as enum ('active', 'inactive', 'paused');

create type package_category as enum ('advance', 'addon');
create type subscription_status as enum ('active', 'inactive', 'paused');

create type session_type as enum ('assessment', 'regular');
create type booking_status as enum ('upcoming', 'completed', 'cancelled', 'missed');

create type shift_source as enum ('generated', 'override');
create type leave_status as enum ('pending', 'approved', 'rejected');

create type recurring_slot_status as enum ('active', 'paused', 'cancelled');
create type temporary_booking_status as enum ('held', 'confirmed', 'expired', 'released');
create type assessment_status as enum ('scheduled', 'completed', 'cancelled', 'missed');

create type shadow_assignment_status as enum ('active', 'completed', 'cancelled');
create type coach_change_status as enum ('pending', 'approved', 'rejected');

create type attendance_status as enum ('present', 'absent', 'late');
create type notification_type as enum ('booking', 'reminder', 'feedback', 'system');

-- Shared trigger function: keeps `updated_at` current on every UPDATE.
-- Attached per-table in each migration that creates a table with `updated_at`.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
