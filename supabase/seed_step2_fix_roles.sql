-- LEANR Phase 1 — seed step 2 (fix roles)
-- Run this AFTER creating the 4 test accounts (arjun.mehta@leanr.dev,
-- priya.nair@leanr.dev, saket.shekhar@leanr.dev, ananya.rao@leanr.dev) with
-- just email + password. Since this dashboard doesn't expose a "User
-- Metadata" field at creation time, the 0002 trigger defaulted all 4 to
-- role='client' — this corrects their role/name and, for the two coaches,
-- swaps their client_profiles row for a coach_profiles row instead.

update profiles set role = 'coach', full_name = 'Arjun Mehta'
where id = (select id from auth.users where email = 'arjun.mehta@leanr.dev');

update profiles set role = 'coach', full_name = 'Priya Nair'
where id = (select id from auth.users where email = 'priya.nair@leanr.dev');

update profiles set full_name = 'Saket Shekhar'
where id = (select id from auth.users where email = 'saket.shekhar@leanr.dev');

update profiles set full_name = 'Ananya Rao'
where id = (select id from auth.users where email = 'ananya.rao@leanr.dev');

-- The two coaches were auto-provisioned with a client_profiles row (since
-- they were created as role='client' by default) — remove that and give
-- them a coach_profiles row instead.
delete from client_profiles
where profile_id in (
  select id from auth.users where email in ('arjun.mehta@leanr.dev', 'priya.nair@leanr.dev')
);

insert into coach_profiles (profile_id)
select id from auth.users where email in ('arjun.mehta@leanr.dev', 'priya.nair@leanr.dev');
