-- LEANR Phase 3 — 0023: Emergency contact field (Coach Portal PRD §13,
-- one of the four fields a coach may edit on their own profile). Additive
-- only; applies to `profiles` so it's available to any role, though only
-- the coach-facing profile page exposes an edit control for it today.

alter table profiles add column emergency_contact text;
