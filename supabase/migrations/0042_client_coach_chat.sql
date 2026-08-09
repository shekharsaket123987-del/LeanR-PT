-- LEANR — 0042: client<->coach chat.
-- One conversation row per (client, coach) relationship. A coach change
-- closes the old conversation (frozen, read-only) and opens a fresh one with
-- the new coach -- history is never deleted or merged, and a coach can only
-- ever see conversations where they are literally coach_id, which is what
-- keeps an unrelated (or reassigned-away) coach from seeing a client's chat
-- even though other tables (client_profiles, timeline) are deliberately
-- readable by any coach (migration 0033).

create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id),
  coach_id uuid not null references coach_profiles(id),
  status text not null check (status in ('active', 'closed')) default 'active',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- A client only ever has one open thread at a time -- this is what makes
-- "close old, open new" on coach change unambiguous.
create unique index conversations_one_active_per_client on conversations(client_id) where status = 'active';
create index conversations_coach_idx on conversations(coach_id);
create index conversations_client_idx on conversations(client_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  sender_role text not null check (sender_role in ('client', 'coach')),
  sender_profile_id uuid not null references profiles(id),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages(conversation_id, created_at);

alter table conversations enable row level security;
alter table messages enable row level security;

-- ── conversations ── system-managed only (opened/closed via supabaseAdmin
-- as a side effect of coach assignment) -- deliberately no client/coach
-- insert/update policy, only read access to their own.
create policy conversations_admin_all on conversations for all using (is_admin()) with check (is_admin());
create policy conversations_select_participant on conversations for select using (
  client_id = my_client_id() or coach_id = my_coach_id()
);

-- ── messages ──
create policy messages_admin_all on messages for all using (is_admin()) with check (is_admin());

-- Select: any participant on the parent conversation, past or present --
-- this is what lets a coach who was reassigned away still read (but not
-- add to) their own historical thread with that client.
create policy messages_select_participant on messages for select using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.client_id = my_client_id() or c.coach_id = my_coach_id())
  )
);

-- Insert: only into a still-ACTIVE conversation, and only by whichever
-- participant matches the claimed sender_role -- this is the actual
-- enforcement of "communication stops the moment a new coach takes over",
-- not just a UI-level restriction.
create policy messages_insert_participant on messages for insert with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.status = 'active'
      and (
        (sender_role = 'client' and c.client_id = my_client_id())
        or (sender_role = 'coach' and c.coach_id = my_coach_id())
      )
  )
);

-- Live delivery for the chat UI.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
