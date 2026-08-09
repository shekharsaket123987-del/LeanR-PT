-- LEANR — 0044: chat images + read receipts + unread notification.
-- Extends the client<->coach chat (0042) with an optional image attachment
-- per message, a read_at timestamp the RECIPIENT sets (WhatsApp-style single
-- vs. double-tick on the sender's side), and a notification template so an
-- unread message actually surfaces somewhere besides the chat page itself.

alter table messages add column attachment_url text;
alter table messages add column read_at timestamptz;

-- An image-only message has no body -- relax both the NOT NULL and the
-- non-empty check to require EITHER a body or an attachment, never neither.
alter table messages alter column body drop not null;
alter table messages drop constraint messages_body_check;
alter table messages add constraint messages_body_or_attachment_check
  check (attachment_url is not null or char_length(trim(coalesce(body, ''))) > 0);

-- Recipient-side read receipt: the participant who is NOT the sender may
-- update a message in their own conversation. The app only ever patches
-- read_at (never body/attachment_url) -- trusted at the app layer, same as
-- sender_role already is on insert (see 0042's messages_insert_participant).
create policy messages_mark_read on messages for update using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (
        (messages.sender_role = 'coach' and c.client_id = my_client_id())
        or (messages.sender_role = 'client' and c.coach_id = my_coach_id())
      )
  )
) with check (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (
        (messages.sender_role = 'coach' and c.client_id = my_client_id())
        or (messages.sender_role = 'client' and c.coach_id = my_coach_id())
      )
  )
);

insert into notification_templates (key, type, title_template, body_template) values
  ('new_chat_message', 'system', 'New message from {{sender_name}}', '{{sender_name}}: {{preview}}');

-- Storage bucket for chat images -- public read (every photo already served
-- by this app, e.g. profile pictures, is an unauthenticated public URL, so
-- this matches the existing security posture rather than introducing a new
-- one), write restricted to a conversation participant uploading under that
-- conversation's own folder.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy chat_attachments_read on storage.objects for select using (bucket_id = 'chat-attachments');

create policy chat_attachments_write on storage.objects for insert with check (
  bucket_id = 'chat-attachments'
  and exists (
    select 1 from conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (c.client_id = my_client_id() or c.coach_id = my_coach_id())
  )
);
