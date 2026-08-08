-- LEANR Phase 2 — 0016: Coach employee code
-- Supports the admin "Add Coach" persona builder (name + employee code +
-- skills + languages + slot openings).

alter table coach_profiles add column employee_code text unique;
