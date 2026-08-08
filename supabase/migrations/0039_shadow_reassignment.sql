-- LEANR — 0039: Re-covering a shadow coach's own leave
--
-- §4.2.5: if a coach currently covering someone as a SHADOW then goes on
-- leave themselves, the sessions they were covering need a fresh shadow
-- search too -- nothing did this before. assign_shadow_coach() always
-- matches bookings by `coach_id = p_primary_coach_id`, which is wrong here:
-- these bookings are no longer assigned to the primary, they're assigned to
-- the outgoing shadow. This mirrors assign_shadow_coach() exactly except it
-- matches on the outgoing shadow's id instead, and marks the shadow
-- assignment(s) being superseded as 'cancelled' rather than leaving them
-- looking still-active once their coverage has actually moved on.

create or replace function reassign_shadow_coverage(
  p_client_id uuid, p_old_shadow_coach_id uuid, p_new_shadow_coach_id uuid, p_primary_coach_id uuid,
  p_starts_on date, p_ends_on date, p_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  assignment_id uuid;
begin
  update shadow_coach_assignments
  set status = 'cancelled'
  where client_id = p_client_id and shadow_coach_id = p_old_shadow_coach_id and status = 'active'
    and starts_on <= p_ends_on and ends_on >= p_starts_on;

  insert into shadow_coach_assignments (client_id, primary_coach_id, shadow_coach_id, starts_on, ends_on, reason, status)
  values (p_client_id, p_primary_coach_id, p_new_shadow_coach_id, p_starts_on, p_ends_on, p_reason, 'active')
  returning id into assignment_id;

  update bookings
  set coach_id = p_new_shadow_coach_id
  where client_id = p_client_id and coach_id = p_old_shadow_coach_id and status = 'upcoming'
    and (scheduled_start at time zone 'Asia/Kolkata')::date between p_starts_on and p_ends_on;

  return assignment_id;
end;
$$;
