-- LEANR — 0051: Close the signup role-escalation hole (QA audit finding C1)
--
-- handle_new_user() previously trusted new.raw_user_meta_data->>'role',
-- which is the exact `options.data` object a caller passes to Supabase's
-- PUBLIC, unauthenticated auth.signUp() endpoint. Anyone holding only the
-- public anon key could POST {"data":{"role":"admin"}} at signup and be
-- inserted into `profiles` with role='admin' — every authorization check in
-- this app (middleware.ts, requireRole(), every is_admin()-gated RLS policy)
-- trusts that column. Real coach/admin provisioning has never actually gone
-- through this metadata field in practice (see supabase/seed_step2_fix_roles.sql
-- — coaches are provisioned by creating the auth user, then correcting role
-- via a privileged SQL statement), so hardcoding 'client' here does not
-- remove any real capability, only the unauthenticated-escalation path.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, photo_url)
  values (
    new.id,
    'client',
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

  insert into public.client_profiles (profile_id) values (new.id);

  return new;
end;
$$;

-- Trigger definition (on_auth_user_created) is unchanged — this migration
-- only redefines the function body, same pattern as 0040/0050.
