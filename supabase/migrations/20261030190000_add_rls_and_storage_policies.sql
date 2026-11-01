grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attachments',
  'attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.attachments
  add constraint attachments_mime_allowed
  check (mime in ('image/jpeg', 'image/png', 'application/pdf'));

alter table public.attachments
  add constraint attachments_path_format
  check (
    storage_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  );

create function public.protect_submission_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  activity_points integer;
begin
  actor_role := public.current_role();

  if actor_role = 'member' then
    if new.score is distinct from old.score
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.id is distinct from old.id
      or new.activity_id is distinct from old.activity_id
      or new.chapter_id is distinct from old.chapter_id
      or new.submitted_by is distinct from old.submitted_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'members cannot change submission review fields'
        using errcode = '42501';
    end if;
  elsif actor_role in ('reviewer', 'admin') then
    if new.id is distinct from old.id
      or new.activity_id is distinct from old.activity_id
      or new.chapter_id is distinct from old.chapter_id
      or new.submitted_by is distinct from old.submitted_by
      or new.description is distinct from old.description
      or new.created_at is distinct from old.created_at
    then
      raise exception 'reviewers cannot change submission content'
        using errcode = '42501';
    end if;

    if new.status not in ('returned', 'approved')
      or new.score is null
      or new.reviewed_by is distinct from auth.uid()
      or new.reviewed_at is null
    then
      raise exception 'reviewers must record a valid review'
        using errcode = '23514';
    end if;

    select points
    into activity_points
    from public.activities
    where id = new.activity_id;

    if activity_points is null or new.score > activity_points then
      raise exception 'score must not exceed the activity points'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin'::public.user_role
    and (
      new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.chapter_id is distinct from old.chapter_id
      or new.position is distinct from old.position
      or new.terms_accepted_at is distinct from old.terms_accepted_at
      or new.guardian_consent_at is distinct from old.guardian_consent_at
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'only admins may change protected profile fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.validate_attachment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_chapter_id uuid;
  attachment_count integer;
  expected_extension text;
begin
  select chapter_id
  into parent_chapter_id
  from public.submissions
  where id = new.submission_id
  for update;

  if parent_chapter_id is null
    or split_part(new.storage_path, '/', 1) <> parent_chapter_id::text
    or split_part(new.storage_path, '/', 2) <> new.submission_id::text
  then
    raise exception 'attachment path must match the submission chapter and ID'
      using errcode = '23514';
  end if;

  expected_extension := lower(split_part(new.storage_path, '.', 2));
  if (new.mime = 'image/jpeg' and expected_extension not in ('jpg', 'jpeg'))
    or (new.mime = 'image/png' and expected_extension <> 'png')
    or (new.mime = 'application/pdf' and expected_extension <> 'pdf')
  then
    raise exception 'attachment MIME type must match its file extension'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select count(*)::integer
    into attachment_count
    from public.attachments
    where submission_id = new.submission_id;

    if attachment_count >= 5 then
      raise exception 'a submission can have no more than five attachments'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_attachment
before insert or update on public.attachments
for each row execute function public.validate_attachment();

create trigger protect_submission_review_fields
before update on public.submissions
for each row execute function public.protect_submission_review_fields();

create policy "approved users can read visible profiles"
on public.profiles
for select
to authenticated
using (
  public.is_approved()
  and (
    id = (select auth.uid())
    or (select public.current_role()) in ('reviewer', 'admin')
  )
);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (public.is_approved() and id = (select auth.uid()))
with check (public.is_approved() and id = (select auth.uid()));

create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_approved() and (select public.current_role()) = 'admin')
with check (public.is_approved() and (select public.current_role()) = 'admin');

create policy "admins can delete profiles"
on public.profiles
for delete
to authenticated
using (public.is_approved() and (select public.current_role()) = 'admin');

create policy "approved users can read chapters"
on public.chapters
for select
to authenticated
using (public.is_approved());

create policy "admins can manage chapters"
on public.chapters
for all
to authenticated
using (public.is_approved() and (select public.current_role()) = 'admin')
with check (public.is_approved() and (select public.current_role()) = 'admin');

create policy "approved users can read campaigns"
on public.campaigns
for select
to authenticated
using (public.is_approved());

create policy "admins can manage campaigns"
on public.campaigns
for all
to authenticated
using (public.is_approved() and (select public.current_role()) = 'admin')
with check (public.is_approved() and (select public.current_role()) = 'admin');

create policy "approved users can read activities"
on public.activities
for select
to authenticated
using (public.is_approved());

create policy "admins can manage activities"
on public.activities
for all
to authenticated
using (public.is_approved() and (select public.current_role()) = 'admin')
with check (public.is_approved() and (select public.current_role()) = 'admin');

create policy "approved users can read visible submissions"
on public.submissions
for select
to authenticated
using (
  public.is_approved()
  and (
    chapter_id = (select public.current_chapter())
    or (select public.current_role()) in ('reviewer', 'admin')
  )
);

create policy "members can create own chapter submissions"
on public.submissions
for insert
to authenticated
with check (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and submitted_by = (select auth.uid())
  and status in ('draft', 'submitted')
  and score is null
  and reviewed_by is null
  and reviewed_at is null
);

create policy "members can edit draft or returned submissions"
on public.submissions
for update
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and status in ('draft', 'returned')
)
with check (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and status in ('draft', 'submitted')
);

create policy "reviewers can review submissions"
on public.submissions
for update
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) in ('reviewer', 'admin')
)
with check (
  public.is_approved()
  and (select public.current_role()) in ('reviewer', 'admin')
  and status in ('returned', 'approved')
  and score is not null
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
);

create policy "members can delete own draft submissions"
on public.submissions
for delete
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'member'
  and chapter_id = (select public.current_chapter())
  and submitted_by = (select auth.uid())
  and status = 'draft'
);

create policy "admins can delete submissions"
on public.submissions
for delete
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'admin'
);

create policy "users can read visible attachments"
on public.attachments
for select
to authenticated
using (
  public.is_approved()
  and exists (
    select 1
    from public.submissions
    where submissions.id = attachments.submission_id
      and (
        submissions.chapter_id = (select public.current_chapter())
        or (select public.current_role()) in ('reviewer', 'admin')
      )
  )
);

create policy "members can attach files to editable chapter submissions"
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
      and submissions.chapter_id = (select public.current_chapter())
      and submissions.status in ('draft', 'returned')
  )
);

create policy "members can delete attachments on editable submissions"
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
      and submissions.chapter_id = (select public.current_chapter())
      and submissions.status in ('draft', 'returned')
  )
);

create policy "admins can delete attachments"
on public.attachments
for delete
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'admin'
);

create policy "users can read visible comments"
on public.comments
for select
to authenticated
using (
  public.is_approved()
  and exists (
    select 1
    from public.submissions
    where submissions.id = comments.submission_id
      and (
        submissions.chapter_id = (select public.current_chapter())
        or (select public.current_role()) in ('reviewer', 'admin')
      )
  )
);

create policy "users can comment on visible submissions"
on public.comments
for insert
to authenticated
with check (
  public.is_approved()
  and author_id = (select auth.uid())
  and exists (
    select 1
    from public.submissions
    where submissions.id = comments.submission_id
      and (
        submissions.chapter_id = (select public.current_chapter())
        or (select public.current_role()) in ('reviewer', 'admin')
      )
  )
);

create policy "admins can read audit log"
on public.audit_log
for select
to authenticated
using (
  public.is_approved()
  and (select public.current_role()) = 'admin'
);

create policy "approved members can read chapter storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_approved()
  and exists (
    select 1
    from public.submissions
    where submissions.id::text = split_part(storage.objects.name, '/', 2)
      and submissions.chapter_id::text = split_part(storage.objects.name, '/', 1)
  )
  and (
    split_part(storage.objects.name, '/', 1) = (select public.current_chapter())::text
    or (select public.current_role()) in ('reviewer', 'admin')
  )
);

create policy "members can upload to editable chapter submissions"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and public.is_approved()
  and (select public.current_role()) = 'member'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  and split_part(name, '/', 1) = (select public.current_chapter())::text
  and exists (
    select 1
    from public.submissions
    where submissions.id::text = split_part(storage.objects.name, '/', 2)
      and submissions.chapter_id::text = split_part(storage.objects.name, '/', 1)
      and submissions.status in ('draft', 'returned')
  )
);

create policy "members can delete objects on editable submissions"
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
          and submissions.chapter_id::text = split_part(storage.objects.name, '/', 1)
          and submissions.status in ('draft', 'returned')
      )
    )
    or (select public.current_role()) = 'admin'
  )
);
