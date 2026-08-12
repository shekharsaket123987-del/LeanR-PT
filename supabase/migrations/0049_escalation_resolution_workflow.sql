-- Escalation resolution workflow: admin must confirm they've called the
-- client before the rest of the resolution form (issue type, fault, admin
-- summary, status changes) becomes usable, plus a running progress-notes
-- log for cases that take days and multiple teams to close out.

alter table escalations
  add column admin_issue_type text,
  add column fault text check (fault in ('coach', 'client', 'platform', 'third_party', 'none', 'other')),
  add column admin_summary text,
  add column called_client_at timestamptz,
  add column called_by uuid references profiles(id) on delete set null;

-- ── escalation_notes: append-only progress log, client-visible ──
-- Distinct from resolution_notes (the final closing summary) -- this is the
-- day-by-day "what's happening" trail for cases that need coordination
-- across teams before they can close.
create table escalation_notes (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references escalations(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);
create index escalation_notes_escalation_idx on escalation_notes(escalation_id, created_at);

alter table escalation_notes enable row level security;
create policy escalation_notes_admin_all on escalation_notes for all using (is_admin()) with check (is_admin());
-- Client can read notes on their own escalations (this is the "what did
-- admin do about it" trail the client-facing concern detail shows) but
-- never write them -- notes are admin-authored only.
create policy escalation_notes_select_own_client on escalation_notes for select using (
  exists (select 1 from escalations e where e.id = escalation_notes.escalation_id and e.client_id = my_client_id())
);
