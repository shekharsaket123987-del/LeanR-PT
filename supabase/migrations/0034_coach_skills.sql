-- LEANR — 0034: Coach Skills field (append-only by coach, full edit by admin)
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.2 / §6 item 1: distinct from
-- coach_profiles.secondary_specializations (the descriptive specialization
-- list set at coach creation) -- skills is a separate, coach-growable list.
-- The coach can only ever ADD to it; enforcing that at the DB layer (not
-- just hiding a remove button in the UI) matters because a client could
-- otherwise call the append action directly with an arbitrary payload.

alter table coach_profiles add column skills text[] not null default '{}';

-- Appends exactly one skill, no-ops if already present (no duplicates, no
-- way to remove or replace the array through this function at all) --
-- security definer so the coach-facing action can call it without needing a
-- broader update grant on coach_profiles. Since security definer bypasses
-- RLS entirely, the ownership check below is load-bearing, not decorative:
-- without it any authenticated caller could pass an arbitrary p_coach_id and
-- modify a DIFFERENT coach's skills.
create or replace function append_coach_skill(p_coach_id uuid, p_skill text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from coach_profiles where id = p_coach_id and profile_id = auth.uid()) then
    raise exception 'Not authorized to modify this coach profile' using errcode = 'P0001';
  end if;

  update coach_profiles
  set skills = array_append(skills, p_skill)
  where id = p_coach_id and not (p_skill = any(skills));
end;
$$;
