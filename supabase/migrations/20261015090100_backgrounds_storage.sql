-- Private bucket for custom planner backgrounds. Each user's files live under
-- a folder named after their user id ("<uid>/bg.webp"); the app serves them
-- through signed URLs, so the bucket is not public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "backgrounds_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "backgrounds_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "backgrounds_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "backgrounds_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text);
