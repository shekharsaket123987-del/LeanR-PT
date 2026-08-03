-- LEANR Phase 3 — 0022: Human-readable client codes (Coach Portal PRD §3-4,
-- "CL1025" style Client ID). Clients self-register (no admin "create client"
-- form to hand-enter a code the way coaches' employee_code works), so this
-- is DB-generated: a sequence + a column default, backfilling existing rows
-- automatically when the column is added.

create sequence client_code_seq;

alter table client_profiles
  add column client_code text unique not null default ('CL' || lpad(nextval('client_code_seq')::text, 4, '0'));
