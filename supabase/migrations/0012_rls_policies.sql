-- LEANR Phase 1 — 0012: Row Level Security
-- Deliberate Phase-1 tradeoff, documented here rather than left implicit:
-- coach_availability/coach_shifts/package_tiers and the *existence/timing* of
-- bookings are readable by any authenticated user, because the booking flow
-- needs to check "is this coach free at this time" system-wide, not just for
-- rows the caller already owns. Session content (workout_notes, attendance,
-- ratings/feedback, medical notes) stays restricted to admin / the owning
-- coach / the owning client. See docs/business-rules.md.

-- ── Helper functions (security definer to avoid RLS self-recursion) ──
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

create or replace function my_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_coach_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from coach_profiles where profile_id = auth.uid();
$$;

create or replace function my_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from client_profiles where profile_id = auth.uid();
$$;

create or replace function coach_client_linked(p_coach_id uuid, p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from bookings where coach_id = p_coach_id and client_id = p_client_id)
      or exists (select 1 from recurring_slots where coach_id = p_coach_id and client_id = p_client_id);
$$;

-- ── profiles ──
alter table profiles enable row level security;
create policy profiles_admin_all on profiles for all using (is_admin()) with check (is_admin());
create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_select_linked_as_coach on profiles for select using (
  exists (select 1 from client_profiles cpf where cpf.profile_id = profiles.id and coach_client_linked(my_coach_id(), cpf.id))
);
create policy profiles_select_linked_as_client on profiles for select using (
  exists (select 1 from coach_profiles cop where cop.profile_id = profiles.id and coach_client_linked(cop.id, my_client_id()))
);

-- ── coach_profiles ──
alter table coach_profiles enable row level security;
create policy coach_profiles_admin_all on coach_profiles for all using (is_admin()) with check (is_admin());
create policy coach_profiles_select_authenticated on coach_profiles for select using (auth.role() = 'authenticated');
create policy coach_profiles_update_own on coach_profiles for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ── client_profiles ──
alter table client_profiles enable row level security;
create policy client_profiles_admin_all on client_profiles for all using (is_admin()) with check (is_admin());
create policy client_profiles_select_own on client_profiles for select using (profile_id = auth.uid());
create policy client_profiles_update_own on client_profiles for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy client_profiles_select_by_coach on client_profiles for select using (coach_client_linked(my_coach_id(), id));

-- ── package_tiers ──
alter table package_tiers enable row level security;
create policy package_tiers_admin_all on package_tiers for all using (is_admin()) with check (is_admin());
create policy package_tiers_select_active on package_tiers for select using (is_active or is_admin());

-- ── subscriptions ── (writes happen via the service-role client in Server Actions: purchase, pause, resume)
alter table subscriptions enable row level security;
create policy subscriptions_admin_all on subscriptions for all using (is_admin()) with check (is_admin());
create policy subscriptions_select_own on subscriptions for select using (client_id = my_client_id());
create policy subscriptions_select_by_coach on subscriptions for select using (coach_client_linked(my_coach_id(), client_id));

-- ── coach_availability / coach_shifts ── (coach manages their own; everyone can read for booking)
alter table coach_availability enable row level security;
create policy coach_availability_admin_all on coach_availability for all using (is_admin()) with check (is_admin());
create policy coach_availability_select_authenticated on coach_availability for select using (auth.role() = 'authenticated');
create policy coach_availability_manage_own on coach_availability for all
  using (coach_id = my_coach_id()) with check (coach_id = my_coach_id());

alter table coach_shifts enable row level security;
create policy coach_shifts_admin_all on coach_shifts for all using (is_admin()) with check (is_admin());
create policy coach_shifts_select_authenticated on coach_shifts for select using (auth.role() = 'authenticated');
create policy coach_shifts_manage_own on coach_shifts for all
  using (coach_id = my_coach_id()) with check (coach_id = my_coach_id());

-- ── coach_leave ── (coach requests, only admin approves/rejects)
alter table coach_leave enable row level security;
create policy coach_leave_admin_all on coach_leave for all using (is_admin()) with check (is_admin());
create policy coach_leave_select_authenticated on coach_leave for select using (auth.role() = 'authenticated');
create policy coach_leave_insert_own on coach_leave for insert with check (coach_id = my_coach_id());

-- ── recurring_slots ──
alter table recurring_slots enable row level security;
create policy recurring_slots_admin_all on recurring_slots for all using (is_admin()) with check (is_admin());
create policy recurring_slots_select_own on recurring_slots for select using (client_id = my_client_id());
create policy recurring_slots_select_by_coach on recurring_slots for select using (coach_id = my_coach_id());
create policy recurring_slots_insert_own on recurring_slots for insert with check (client_id = my_client_id());
create policy recurring_slots_update_own on recurring_slots for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());

-- ── temporary_bookings ──
alter table temporary_bookings enable row level security;
create policy temporary_bookings_admin_all on temporary_bookings for all using (is_admin()) with check (is_admin());
create policy temporary_bookings_select_own on temporary_bookings for select using (client_id = my_client_id());
create policy temporary_bookings_insert_own on temporary_bookings for insert with check (client_id = my_client_id());
create policy temporary_bookings_update_own on temporary_bookings for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());

-- ── assessment_sessions ── (prospects have no auth account yet; admin/coach manage these)
alter table assessment_sessions enable row level security;
create policy assessment_sessions_admin_all on assessment_sessions for all using (is_admin()) with check (is_admin());
create policy assessment_sessions_select_assigned_coach on assessment_sessions for select using (assigned_coach_id = my_coach_id());

-- ── bookings ──
alter table bookings enable row level security;
create policy bookings_admin_all on bookings for all using (is_admin()) with check (is_admin());
create policy bookings_select_authenticated on bookings for select using (auth.role() = 'authenticated'); -- see file header note
create policy bookings_insert_own_client on bookings for insert with check (client_id = my_client_id());
create policy bookings_update_own_client on bookings for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy bookings_update_own_coach on bookings for update
  using (coach_id = my_coach_id()) with check (coach_id = my_coach_id());

-- ── shadow_coach_assignments / coach_change_requests ── (admin-resolved; participants can read/propose)
alter table shadow_coach_assignments enable row level security;
create policy shadow_admin_all on shadow_coach_assignments for all using (is_admin()) with check (is_admin());
create policy shadow_select_participant on shadow_coach_assignments for select using (
  client_id = my_client_id() or primary_coach_id = my_coach_id() or shadow_coach_id = my_coach_id()
);

alter table coach_change_requests enable row level security;
create policy coach_change_admin_all on coach_change_requests for all using (is_admin()) with check (is_admin());
create policy coach_change_select_own on coach_change_requests for select using (client_id = my_client_id());
create policy coach_change_insert_own on coach_change_requests for insert with check (client_id = my_client_id());
create policy coach_change_select_by_coach on coach_change_requests for select using (current_coach_id = my_coach_id());

-- ── attendance / workout_notes ── (coach writes, client + coach + admin read)
alter table attendance enable row level security;
create policy attendance_admin_all on attendance for all using (is_admin()) with check (is_admin());
create policy attendance_manage_by_coach on attendance for all using (
  exists (select 1 from bookings b where b.id = attendance.booking_id and b.coach_id = my_coach_id())
) with check (
  exists (select 1 from bookings b where b.id = attendance.booking_id and b.coach_id = my_coach_id())
);
create policy attendance_select_by_client on attendance for select using (
  exists (select 1 from bookings b where b.id = attendance.booking_id and b.client_id = my_client_id())
);

alter table workout_notes enable row level security;
create policy workout_notes_admin_all on workout_notes for all using (is_admin()) with check (is_admin());
create policy workout_notes_manage_own_coach on workout_notes for all
  using (coach_id = my_coach_id()) with check (coach_id = my_coach_id());
create policy workout_notes_select_own_client on workout_notes for select using (client_id = my_client_id());

-- ── progress_logs ──
alter table progress_logs enable row level security;
create policy progress_logs_admin_all on progress_logs for all using (is_admin()) with check (is_admin());
create policy progress_logs_manage_own on progress_logs for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy progress_logs_select_by_coach on progress_logs for select using (
  coach_client_linked(my_coach_id(), client_id)
);

-- ── notification_templates ── (internal reference data, admin only)
alter table notification_templates enable row level security;
create policy notification_templates_admin_all on notification_templates for all using (is_admin()) with check (is_admin());

-- ── notifications ──
alter table notifications enable row level security;
create policy notifications_admin_all on notifications for all using (is_admin()) with check (is_admin());
create policy notifications_select_own on notifications for select using (user_id = auth.uid());
create policy notifications_update_own on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid()); -- e.g. marking read

-- ── audit_logs ── (admin read-only; writes only via the security-definer trigger)
alter table audit_logs enable row level security;
create policy audit_logs_admin_select on audit_logs for select using (is_admin());

-- ── system_settings ── (admin manages; any authenticated user can read, since
-- client-side UI reads cutoff/join-window values to gate buttons)
alter table system_settings enable row level security;
create policy system_settings_admin_write on system_settings for all using (is_admin()) with check (is_admin());
create policy system_settings_select_authenticated on system_settings for select using (auth.role() = 'authenticated');
