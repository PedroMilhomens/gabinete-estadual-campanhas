-- Corrige a regex do caminho do arquivo na policy de upload do Storage.
-- O ultimo UUID (nome do arquivo) estava com um grupo de 4 caracteres a menos,
-- o que rejeitava todos os uploads com o erro 42501.
drop policy if exists "members can upload to own editable submissions" on storage.objects;

create policy "members can upload to own editable submissions"
on storage.objects
for insert
to authenticated
with check (
  (bucket_id = 'attachments'::text)
  and is_approved()
  and ((select "current_role"()) = 'member'::user_role)
  and (name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'::text)
  and (split_part(name, '/'::text, 1) = ((select current_chapter())::text))
  and exists (
    select 1
    from submissions
    where ((submissions.id)::text = split_part(objects.name, '/'::text, 2))
      and (submissions.submitted_by = (select auth.uid()))
      and ((submissions.chapter_id)::text = split_part(objects.name, '/'::text, 1))
      and (submissions.status = any (array['draft'::submission_status, 'returned'::submission_status]))
  )
);