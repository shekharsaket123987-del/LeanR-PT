-- LEANR — 0040: Restore role-aware provisioning without reopening the
-- privilege-escalation hole that 20260820091132_fix_signup_role_escalation
-- correctly patched.
--
-- That migration hardcoded handle_new_user() to role='client' because it
-- read the role from raw_user_meta_data, which the public
-- supabase.auth.signUp() endpoint lets any anonymous caller set to anything
-- (e.g. {"role":"admin"}) -- a real self-service-admin vulnerability. The fix
-- was correct, but it also broke the admin "Add Coach" flow
-- (coaches.service.ts createCoach), which legitimately needs a coach_profiles
-- row provisioned: that flow calls supabase.auth.admin.createUser() with the
-- service-role key, so it can set app_metadata, which end users can never
-- touch via the public signup endpoint. Reading role from raw_app_meta_data
-- instead of raw_user_meta_data restores coach/admin provisioning through
-- that trusted, server-only channel while public signup (which never sets
-- app_metadata) keeps defaulting to 'client', same as the security fix
-- intended.
create or replace function handle_new_user()
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
