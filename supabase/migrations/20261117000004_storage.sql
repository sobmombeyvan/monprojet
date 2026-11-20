-- ════════════════════════════════════════════════════════════════════
-- GLOBENTIA — Storage buckets & policies
-- Path convention: <bucket>/<user_id>/<uuid>.<ext>
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('consultant-documents', 'consultant-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('client-documents', 'client-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('articles', 'articles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public avatars: anyone reads, owner writes in their own folder
create policy "avatars: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Private verification documents: owner + admins only, never public
create policy "consultant docs: owner/admin read" on storage.objects for select to authenticated
  using (bucket_id = 'consultant-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "consultant docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'consultant-documents' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('consultant'));
create policy "consultant docs: owner/admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'consultant-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Private client documents
create policy "client docs: owner/admin read" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "client docs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client docs: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Article images: public read, editors write
create policy "article images: read" on storage.objects for select to anon, authenticated using (bucket_id = 'articles');
create policy "article images: editor write" on storage.objects for insert to authenticated
  with check (bucket_id = 'articles' and public.is_editor());
