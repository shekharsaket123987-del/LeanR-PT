-- LEANR Phase 2 — 0018: Client Timeline, Escalations, Coach Performance, richer Session Details
--
-- Adds the schema for three admin-facing features: a permanent client
-- journey timeline, an escalation (client-concern) tracker, and richer
-- session/coach-performance data. All column additions are nullable/additive
-- with sensible defaults — nothing here touches booking_status, the bookings
-- exclusion constraint, or any existing RPC's control flow beyond one
-- explicit addition to reschedule_booking() below.

-- ── escalations ──
create type escalation_status as enum ('open', 'resolved');

create table escalations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid references coach_profiles(id) on delete set null,
  raised_by uuid references profiles(id) on delete set null, -- null = logged by admin on the client's behalf
  reason text not null,
  description text,
  status escalation_status not null default 'open',
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index escalations_client_idx on escalations(client_id);
create index escalations_coach_idx on escalations(coach_id);
create index escalations_status_idx on escalations(status);

create trigger set_escalations_updated_at before update on escalations
  for each row execute function set_updated_at();

alter table bookings add column escalation_id uuid references escalations(id) on delete set null;

-- ── client_timeline_events ── (permanent, append-only — no update/delete policy for any role)
create table client_timeline_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb,
  actor_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index client_timeline_events_client_idx on client_timeline_events(client_id, created_at desc);

-- ── progress_logs: expand to the full measurement set ──
alter table progress_logs
  add column muscle_pct numeric(5,2),
  add column waist numeric(6,2),
  add column chest numeric(6,2),
  add column hip numeric(6,2),
  add column arms numeric(6,2),
  add column thigh numeric(6,2);

-- ── bookings: session-outcome detail + reschedule history ──
-- Deliberately NOT new booking_status values -- these are *why* a booking is
-- missed/cancelled, not new terminal states, so has_scheduling_conflict(),
-- cancel_booking(), and the bookings_no_coach_overlap exclusion constraint
-- (all keyed off status) are untouched.
alter table bookings
  add column no_show_party text check (no_show_party in ('client', 'coach')),
  add column technical_issue boolean not null default false,
  add column coach_on_leave boolean not null default false,
  add column was_rescheduled boolean not null default false,
  add column original_scheduled_start timestamptz;

-- ── coach_profiles: capacity ──
alter table coach_profiles add column max_capacity int not null default 50;

-- ── attendance: per-party join/leave tracking ──
-- Existing status/checked_in_at/checked_out_at stay for backward compat;
-- new columns are what completeBooking() and future join-tracking write to.
alter table attendance
  add column client_joined_at timestamptz,
  add column client_left_at timestamptz,
  add column coach_joined_at timestamptz,
  add column coach_left_at timestamptz;

-- ── RLS ──
alter table escalations enable row level security;
create policy escalations_admin_all on escalations for all using (is_admin()) with check (is_admin());
create policy escalations_select_own_client on escalations for select using (client_id = my_client_id());
create policy escalations_insert_own_client on escalations for insert with check (client_id = my_client_id());
create policy escalations_select_by_coach on escalations for select using (coach_client_linked(my_coach_id(), client_id));

alter table client_timeline_events enable row level security;
create policy timeline_admin_all on client_timeline_events for all using (is_admin()) with check (is_admin());
create policy timeline_select_own_client on client_timeline_events for select using (client_id = my_client_id());
create policy timeline_select_by_coach on client_timeline_events for select using (coach_client_linked(my_coach_id(), client_id));
-- No insert/update/delete policy for client or coach roles -- entries are
-- system-written only, via timeline.service.ts's supabaseAdmin-backed
-- logTimelineEvent(), matching "never allow deletion of records."

-- ── reschedule_booking(): record the original time + that a reschedule happened ──
create or replace function reschedule_booking(
  p_booking_id uuid, p_new_start timestamptz, p_new_duration_minutes int default null,
  p_enforce_cutoff boolean default true
)
returns void
language plpgsql
as $$
declare
  b bookings%rowtype;
  new_duration int;
  cutoff_hours int := get_setting_int('reschedule_cutoff_hours');
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.status <> 'upcoming' then
    raise exception 'Only upcoming bookings can be rescheduled' using errcode = 'P0001';
  end if;

  if p_enforce_cutoff and extract(epoch from (b.scheduled_start - now())) / 3600.0 < cutoff_hours then
    raise exception 'Too close to the session start to reschedule (cutoff is % hours)', cutoff_hours using errcode = 'P0001';
  end if;

  new_duration := coalesce(p_new_duration_minutes, b.duration_minutes);

  if not is_slot_within_working_hours(b.coach_id, p_new_start, new_duration) then
    raise exception 'Coach is not available at this time' using errcode = 'P0001';
  end if;
  if has_scheduling_conflict(b.coach_id, p_new_start, new_duration, p_booking_id) then
    raise exception 'This slot is no longer available' using errcode = 'P0001';
  end if;

  update bookings
  set scheduled_start = p_new_start,
      duration_minutes = new_duration,
      was_rescheduled = true,
      original_scheduled_start = coalesce(original_scheduled_start, b.scheduled_start)
  where id = p_booking_id;
end;
$$;
