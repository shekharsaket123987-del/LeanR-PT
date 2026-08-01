-- LEANR Phase 1 — 0013: Storage buckets
-- Convention: object path's first folder segment is the owning profile's
-- auth.uid(), e.g. avatars/<uid>/photo.jpg — policies check that segment.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('progress-photos', 'progress-photos', false),
  ('coach-certifications', 'coach-certifications', false)
on conflict (id) do nothing;

-- avatars: public read, owner write
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_owner_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- progress-photos: private — owning client, their coach, or admin
create policy progress_photos_owner_all on storage.objects for all
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy progress_photos_coach_read on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from client_profiles cpf
      where cpf.profile_id::text = (storage.foldername(name))[1]
        and coach_client_linked(my_coach_id(), cpf.id)
    )
  );
create policy progress_photos_admin_all on storage.objects for all
  using (bucket_id = 'progress-photos' and is_admin())
  with check (bucket_id = 'progress-photos' and is_admin());

-- coach-certifications: private — owning coach or admin
create policy coach_certifications_owner_all on storage.objects for all
  using (bucket_id = 'coach-certifications' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'coach-certifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy coach_certifications_admin_all on storage.objects for all
  using (bucket_id = 'coach-certifications' and is_admin())
  with check (bucket_id = 'coach-certifications' and is_admin());
