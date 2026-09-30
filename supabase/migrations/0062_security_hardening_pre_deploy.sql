-- Pre-deploy security hardening, driven by Supabase's security advisor.
--
-- 1) client_workout_notes was SECURITY DEFINER, so it ran as the view owner
--    (bypassing RLS on workout_notes/bookings/client_profiles entirely) even
--    though its WHERE clause already scopes rows to `auth.uid()`. Switching
--    to SECURITY INVOKER makes it run as the querying user instead, so RLS
--    on the underlying tables is enforced too -- defense in depth, not a
--    behavior change: workout_notes_select_own_client, bookings_select_authenticated,
--    and client_profiles_select_own already grant the exact same access.
alter view public.client_workout_notes set (security_invoker = true);

-- 2) 21 SECURITY DEFINER functions were callable by the `anon` role (i.e.
--    with no login at all) via PostgREST's /rest/v1/rpc/<fn> endpoint.
--    Postgres grants EXECUTE to the pseudo-role PUBLIC by default on
--    function creation, and `anon` inherits through that -- these functions
--    were never explicitly granted to anon, so `revoke ... from anon` is a
--    no-op; the blanket PUBLIC grant has to be revoked instead.
--
--    None of the app's code calls any of these while unauthenticated --
--    they're either trigger functions (never invoked via RPC; revoking
--    EXECUTE here doesn't stop the trigger, which fires under the trigger
--    mechanism regardless of grants) or helpers/RPCs the app only ever
--    calls with a signed-in user's session (see coaches.service.ts,
--    demoBooking.service.ts, scheduling.service.ts -- all gated by
--    requireRole()/getCallerContext()). `authenticated` already had an
--    explicit grant on every one of these prior to this migration, so
--    revoking PUBLIC removes anon's access with zero functionality loss.
revoke execute on function public.append_coach_skill(uuid, text) from public;
revoke execute on function public.coach_client_linked(uuid, uuid) from public;
revoke execute on function public.count_my_reschedules_this_week() from public;
revoke execute on function public.enforce_escalation_call_gate() from public;
revoke execute on function public.enforce_escalation_note_call_gate() from public;
revoke execute on function public.ensure_conversation_for_coach_assignment() from public;
revoke execute on function public.expire_temporary_bookings() from public;
revoke execute on function public.fn_audit_trigger() from public;
revoke execute on function public.fn_audit_trigger_settings() from public;
revoke execute on function public.get_setting_int(text) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.has_scheduling_conflict(uuid, timestamptz, integer, uuid, uuid) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_slot_within_working_hours(uuid, timestamptz, integer) from public;
revoke execute on function public.my_client_id() from public;
revoke execute on function public.my_coach_id() from public;
revoke execute on function public.my_role() from public;
revoke execute on function public.notify_session_booked(uuid) from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.sync_role_on_auth_user_metadata_update() from public;
revoke execute on function public.trigger_send_push_notification() from public;

-- Re-assert authenticated's access explicitly for the ones the app actually
-- calls as a logged-in user, now that the blanket PUBLIC grant is gone.
-- (service_role and postgres already had their own explicit grants,
-- unaffected by revoking PUBLIC.)
grant execute on function public.append_coach_skill(uuid, text) to authenticated;
grant execute on function public.coach_client_linked(uuid, uuid) to authenticated;
grant execute on function public.count_my_reschedules_this_week() to authenticated;
grant execute on function public.get_setting_int(text) to authenticated;
grant execute on function public.has_scheduling_conflict(uuid, timestamptz, integer, uuid, uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_slot_within_working_hours(uuid, timestamptz, integer) to authenticated;
grant execute on function public.my_client_id() to authenticated;
grant execute on function public.my_coach_id() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.notify_session_booked(uuid) to authenticated;
