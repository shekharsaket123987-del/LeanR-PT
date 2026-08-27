-- LEANR — 0055: Reconcile handle_new_user() with production (schema drift)
--
-- Discovered while testing the admin "Add Coach" flow: it was silently
-- creating client accounts instead of coach accounts (no coach_profiles
-- row, role='client'). Root cause was two-fold:
--
-- 1. The live database's handle_new_user() no longer matched migration
--    0051 in this repo -- production had already been patched (outside
--    any migration file committed here) to read the role from
--    `raw_app_meta_data` instead of hardcoding 'client', and to create a
--    coach_profiles row when role='coach'. This migration formalizes that
--    already-live definition so the migration history matches reality --
--    applying it to production is a no-op (create or replace of the exact
--    current function body).
--
-- 2. coaches.service.ts's createCoach() was still passing role via
--    `user_metadata` (a fix in that same file, this migration's sibling
--    commit) -- raw_app_meta_data is populated from admin.createUser()'s
--    separate `app_metadata` option, not `user_metadata`, so the trigger
--    was correctly falling back to 'client' for every admin-provisioned
--    coach, exactly as it should for a public signUp() caller (the
--    security property 0051 was originally trying to enforce), but that
--    also silently broke the legitimate admin-only path with no error
--    surfaced beyond a generic "Unexpected error" in the UI.
--
-- app_metadata (not user_metadata) is the deliberate choice for the role
-- claim: it's a privileged field only settable via the service-role
-- admin API, never by a public unauthenticated signUp() caller, so
-- self-service signup still can't escalate to coach/admin by passing
-- role in its own metadata payload.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role user_role := coalesce((new.raw_app_meta_data->>'role')::user_role, 'client');
begin
  insert into public.profiles (id, role, full_name, phone, photo_url)
  values (
    new.id,
    new_role,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'phone',
    coalesce(
      new.raw_user_meta_data->>'photo_url',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );

  if new_role = 'coach' then
    insert into public.coach_profiles (profile_id) values (new.id);
  elsif new_role = 'client' then
    insert into public.client_profiles (profile_id) values (new.id);
  end if;

  return new;
end;
$$;
