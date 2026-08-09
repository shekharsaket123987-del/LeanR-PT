-- LEANR — 0045: coach availability becomes admin-managed only.
-- Coaches keep read access via coach_availability_select_authenticated
-- (needed for their own read-only display) and coach_availability_admin_all
-- still lets admins manage every coach's template.
drop policy coach_availability_manage_own on coach_availability;
