-- LEANR Phase 1 — 0010: Reporting views
-- Real, always-consistent equivalents of mock-data.ts's hand-typed numbers
-- (utilizationByCoach, revenueTrend, bookingsByHour, and Client.sessionsUsed/
-- sessionsRemaining, which the codebase audit found could silently drift from
-- the actual bookings/sessions array in the prototype).
--
-- `security_invoker = true` on every view here is deliberate: by default a
-- Postgres view runs with its OWNER's privileges for RLS purposes, and views
-- created via the SQL Editor are owned by a role that bypasses RLS — meaning
-- without this option, ANY authenticated user querying these views directly
-- would see every row regardless of the policies in 0012. security_invoker
-- makes the view apply RLS as the actual calling user instead. revenue_trend_view
-- and bookings_by_hour_view are still intended for admin dashboard use — a
-- non-admin querying them will simply get an aggregate over the rows they can
-- already see, not an error.

create view subscription_usage_view with (security_invoker = true) as
select
  s.id as subscription_id,
  s.client_id,
  s.sessions_total,
  count(b.id) filter (where b.status = 'completed') as sessions_used,
  s.sessions_total - count(b.id) filter (where b.status = 'completed') as sessions_remaining
from subscriptions s
left join bookings b on b.subscription_id = s.id
group by s.id;

create view coach_utilization_view with (security_invoker = true) as
select
  cp.id as coach_id,
  p.full_name as coach_name,
  coalesce(active.active_clients, 0) as active_clients,
  coalesce(round(100.0 * util.booked_minutes / nullif(avail.available_minutes, 0)), 0) as utilization_pct
from coach_profiles cp
join profiles p on p.id = cp.profile_id
left join lateral (
  select count(distinct b.client_id) as active_clients
  from bookings b
  where b.coach_id = cp.id and b.status = 'upcoming'
) active on true
left join lateral (
  select sum(b.duration_minutes) as booked_minutes
  from bookings b
  where b.coach_id = cp.id
    and b.status in ('upcoming', 'completed')
    and b.scheduled_start >= date_trunc('week', now())
    and b.scheduled_start < date_trunc('week', now()) + interval '7 days'
) util on true
left join lateral (
  select sum(extract(epoch from (ca.end_time - ca.start_time)) / 60) as available_minutes
  from coach_availability ca
  where ca.coach_id = cp.id and ca.is_active
) avail on true;

create view revenue_trend_view with (security_invoker = true) as
select
  months.month,
  coalesce(rev.revenue, 0) as revenue,
  coalesce(sess.sessions, 0) as sessions
from (
  select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as month
) months
left join (
  select date_trunc('month', s.started_at) as month, sum(pt.price) as revenue
  from subscriptions s
  join package_tiers pt on pt.id = s.package_id
  group by 1
) rev on rev.month = months.month
left join (
  select date_trunc('month', b.scheduled_start) as month, count(*) as sessions
  from bookings b
  where b.status = 'completed'
  group by 1
) sess on sess.month = months.month
order by months.month;

create view bookings_by_hour_view with (security_invoker = true) as
select
  extract(hour from scheduled_start)::int as hour_of_day,
  count(*) as bookings
from bookings
where status in ('upcoming', 'completed')
group by 1
order by 1;

-- Clients with no completed booking within system_settings.inactivity_threshold_days.
create view inactive_clients_view with (security_invoker = true) as
select
  cpf.id as client_id,
  p.full_name,
  max(b.scheduled_start) filter (where b.status = 'completed') as last_completed_session
from client_profiles cpf
join profiles p on p.id = cpf.profile_id
left join bookings b on b.client_id = cpf.id
group by cpf.id, p.full_name
having max(b.scheduled_start) filter (where b.status = 'completed') is null
    or max(b.scheduled_start) filter (where b.status = 'completed') <
       now() - ((select (value #>> '{}')::int from system_settings where key = 'inactivity_threshold_days') * interval '1 day');
