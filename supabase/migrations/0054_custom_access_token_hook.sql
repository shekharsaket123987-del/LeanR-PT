-- LEANR — 0054: Custom Access Token Hook — embed role in the JWT
--
-- middleware.ts gates every /admin, /coach, /client route with two
-- sequential Supabase round trips per request: auth.getUser() (verifies
-- the session against the Auth server) then a separate `profiles` query
-- just to read `role`. Both cross the Vercel<->Supabase network hop
-- independently, on every single navigation.
--
-- This project already signs JWTs asymmetrically (ES256 -- confirmed via
-- /auth/v1/.well-known/jwks.json), so the Supabase JS client's getClaims()
-- can verify a session's JWT locally (WebCrypto, cached JWKS) with NO
-- Auth-server round trip, IF the claim it needs is embedded in the token
-- itself. This hook adds that claim: role, straight from `profiles`, into
-- every newly-issued/refreshed access token as `user_role`.
--
-- Requires the "Custom Access Token" Auth Hook to be enabled in the
-- Supabase Dashboard (Authentication -> Hooks) pointing at
-- pg-functions://postgres/public/custom_access_token_hook -- this
-- migration only creates the function and grants; it cannot toggle that
-- dashboard setting itself.
--
-- Existing sessions issued before the hook is enabled won't carry this
-- claim until they next refresh/re-login -- middleware.ts's fallback to
-- the old query-based check (see that file) covers the gap, so this is
-- safe to ship independently of when the dashboard toggle actually flips.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims jsonb;
  the_role public.user_role;
begin
  select role into the_role from public.profiles where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if the_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(the_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', 'null');
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- supabase_auth_admin is the role GoTrue actually invokes this function
-- as -- it has no grants on `public` by default, and profiles has RLS
-- enabled with no policy that would otherwise let it read `role`.
grant usage on schema public to supabase_auth_admin;

grant execute
  on function public.custom_access_token_hook
  to supabase_auth_admin;

revoke execute
  on function public.custom_access_token_hook
  from authenticated, anon, public;

grant select (id, role) on table public.profiles to supabase_auth_admin;

create policy "Allow auth admin to read role for custom claims"
  on public.profiles
  as permissive
  for select
  to supabase_auth_admin
  using (true);
