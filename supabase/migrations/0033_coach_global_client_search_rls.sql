-- LEANR — 0033: Coach global client search RLS (read-all, write-if-assigned)
--
-- FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.5: a coach should be able to look
-- up ANY client, not just their own -- read-only unless actually assigned.
-- Widens SELECT on client_profiles and client_timeline_events to any coach.
-- Postgres RLS OR's multiple permissive policies for the same command
-- together, so this is purely additive: the existing coach_client_linked()-
-- scoped select policies stay in place (now redundant but harmless) and,
-- critically, no write policy is touched -- workout_notes/attendance stay
-- coach_id = my_coach_id()-scoped, and client_profiles_update_own is
-- unaffected. progress_logs is deliberately NOT widened here either; it
-- stays assigned-only per migration 0012's own "session content stays
-- restricted" principle -- global search gets identity + narrative history,
-- not quantitative health data.

create policy client_profiles_select_by_any_coach on client_profiles for select using (my_role() = 'coach');
create policy timeline_select_by_any_coach on client_timeline_events for select using (my_role() = 'coach');

-- client_profiles embeds profile:profiles(full_name, photo_url, phone) in
-- every query this app makes -- PostgREST enforces RLS on the embedded
-- table too, so without this a coach could read an unassigned client's
-- client_profiles row but get a blank name/photo back. Scoped to profiles
-- that belong to a client (not other coaches'/admins' identities).
create policy profiles_select_by_any_coach_for_clients on profiles for select using (
  my_role() = 'coach' and exists (select 1 from client_profiles cpf where cpf.profile_id = profiles.id)
);
