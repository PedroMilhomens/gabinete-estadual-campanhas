create or replace function public.current_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', profiles.id,
    'full_name', profiles.full_name,
    'chapter_id', profiles.chapter_id,
    'role', profiles.role,
    'status', profiles.status
  )
  from public.profiles
  where profiles.id = (select auth.uid());
$$;

drop policy "members can edit draft or returned submissions"
on public.submissions;

create policy "members can edit own draft or returned submissions"
on public.submissions
for update
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and submitted_by = (select auth.uid())
  and status in ('draft', 'returned')
)
with check (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and submitted_by = (select auth.uid())
  and status in ('draft', 'submitted')
);

drop policy "members can attach files to editable chapter submissions"
on public.attachments;

create policy "members can attach files to own editable submissions"
on public.attachments
for insert
to authenticated
with check (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and exists (
    select 1
    from public.submissions
    where submissions.id = attachments.submission_id
      and submissions.submitted_by = (select auth.uid())
      and submissions.chapter_id = (select public.current_chapter())
      and submissions.status in ('draft', 'returned')
  )
);

drop policy "members can delete attachments on editable submissions"
on public.attachments;

create policy "members can delete attachments on own editable submissions"
on public.attachments
for delete
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and exists (
    select 1
    from public.submissions
    where submissions.id = attachments.submission_id
      and submissions.submitted_by = (select auth.uid())
      and submissions.chapter_id = (select public.current_chapter())
      and submissions.status in ('draft', 'returned')
  )
);

drop policy "members can upload to editable chapter submissions"
on storage.objects;

create policy "members can upload to own editable submissions"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and public.is_approved()
  and (select public.current_role()) = 'member'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  and split_part(name, '/', 1) = (select public.current_chapter())::text
  and exists (
    select 1
    from public.submissions
    where submissions.id::text = split_part(storage.objects.name, '/', 2)
      and submissions.submitted_by = (select auth.uid())
      and submissions.chapter_id::text = split_part(storage.objects.name, '/', 1)
      and submissions.status in ('draft', 'returned')
  )
);

drop policy "members can delete objects on editable submissions"
on storage.objects;

create policy "members can delete objects on own editable submissions"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_approved()
  and (
    (
      (select public.current_role()) = 'member'
      and split_part(name, '/', 1) = (select public.current_chapter())::text
      and exists (
        select 1
        from public.submissions
        where submissions.id::text = split_part(storage.objects.name, '/', 2)
          and submissions.submitted_by = (select auth.uid())
          and submissions.chapter_id::text = split_part(storage.objects.name, '/', 1)
          and submissions.status in ('draft', 'returned')
      )
    )
    or (select public.current_role()) = 'admin'
  )
);
