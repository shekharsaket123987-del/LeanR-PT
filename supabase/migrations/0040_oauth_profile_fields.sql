-- LEANR Phase 1 — 0040: Google OAuth account provisioning fills full_name
-- and photo_url from the wrong metadata keys ('full_name'/'photo_url').
-- Email/password signup sets those keys directly (see SignupForm.tsx), but
-- Google OAuth populates 'name'/'full_name' and 'picture'/'avatar_url'
-- instead -- so a Google-created profile silently got no photo and, if
-- Google ever omits full_name, no name either. Fall back across both sets.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'client');
begin
  insert into public.profiles (id, role, full_name, photo_url)
  values (
    new.id,
    new_role,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
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
