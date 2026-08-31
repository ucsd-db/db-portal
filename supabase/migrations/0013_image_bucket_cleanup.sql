-- Let signed-in members delete images: needed by the editor's storage-cap flow,
-- which (with the uploader's confirmation) evicts the oldest images when the bucket is full.
create policy "images auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'images');
