-- LEANR Phase 1 — 0017: Fix has_scheduling_conflict() volatility
--
-- has_scheduling_conflict() (0011) was declared `stable` despite performing
-- a write internally (it calls expire_temporary_bookings(), an UPDATE). This
-- never surfaced before because every existing caller invoked it transitively
-- from inside another (correctly volatile) function -- PostgREST only
-- inspects the volatility of the top-level RPC endpoint to decide whether to
-- open a read-only transaction, so nested calls were unaffected.
--
-- The admin shadow-coach matching feature (scheduling.service.ts's
-- findShadowCoachCandidates) is the first caller to invoke this function
-- directly via .rpc(), which exposed the bug: PostgREST opened a read-only
-- transaction (because the function is declared stable) and the internal
-- UPDATE then failed with "cannot execute UPDATE in a read-only transaction".
--
-- Fix: redeclare as volatile (the default) -- same body, correct label.
create or replace function has_scheduling_conflict(
  p_coach_id uuid, p_slot_start timestamptz, p_duration_minutes int,
  p_exclude_booking_id uuid default null, p_exclude_temp_id uuid default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  slot_range tstzrange := tstzrange(p_slot_start, p_slot_start + (p_duration_minutes || ' minutes')::interval);
begin
  perform expire_temporary_bookings();

  if exists (
    select 1 from bookings
    where coach_id = p_coach_id and status = 'upcoming'
      and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
      and tstzrange(scheduled_start, scheduled_start + (duration_minutes || ' minutes')::interval) && slot_range
  ) then
    return true;
  end if;

  if exists (
    select 1 from temporary_bookings
    where coach_id = p_coach_id and status = 'held'
      and (p_exclude_temp_id is null or id <> p_exclude_temp_id)
      and tstzrange(slot_start, slot_start + (duration_minutes || ' minutes')::interval) && slot_range
  ) then
    return true;
  end if;

  return false;
end;
$$;
