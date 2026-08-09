-- LEANR — 0046: profile picture uploads.
-- Public read (matches every other photo in this app already being an
-- unauthenticated public URL); write restricted to a user uploading under
-- their own {auth.uid()}/... path, where auth.uid() = profiles.id (0002).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');

create policy avatars_write on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_update_own on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
