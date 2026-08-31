-- Self-hosted images for the rich editor (form descriptions, questions, announcements, answers).
-- External hotlinks (Discord CDN etc.) expire; uploads to our own public bucket do not.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 4194304, array['image/png','image/jpeg','image/gif','image/webp','image/avif'])
on conflict (id) do nothing;

create policy "images public read" on storage.objects
  for select using (bucket_id = 'images');
create policy "images auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'images');
