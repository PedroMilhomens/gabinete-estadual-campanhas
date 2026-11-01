alter table public.activities
  add column reviewer_managed boolean not null default false;

drop policy "approved users can read activities"
on public.activities;

create policy "approved users can read activities available to their role"
on public.activities
for select
to authenticated
using (
  public.is_approved()
  and (
    not reviewer_managed
    or (select public.current_role()) in ('reviewer', 'admin')
  )
);

drop policy "members can create own chapter submissions"
on public.submissions;

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
  and exists (
    select 1
    from public.activities
    where activities.id = submissions.activity_id
      and not activities.reviewer_managed
  )
);

create function public.chapter_rankings(p_campaign_id uuid default null)
returns table (
  chapter_id uuid,
  chapter_name text,
  chapter_number integer,
  total_score bigint,
  approved_submissions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_approved()
    or public.current_role() not in ('member', 'reviewer', 'admin')
  then
    raise exception 'only approved users may view chapter rankings'
      using errcode = '42501';
  end if;

  return query
  select
    chapters.id,
    chapters.name,
    chapters.number,
    sum(submissions.score)::bigint,
    count(submissions.id)::bigint
  from public.chapters as chapters
  join public.submissions as submissions
    on submissions.chapter_id = chapters.id
  join public.activities as activities
    on activities.id = submissions.activity_id
  where submissions.status = 'approved'
    and submissions.score is not null
    and (p_campaign_id is null or activities.campaign_id = p_campaign_id)
    and (
      public.current_role() in ('reviewer', 'admin')
      or submissions.chapter_id = public.current_chapter()
    )
  group by chapters.id, chapters.name, chapters.number
  order by sum(submissions.score) desc, chapters.name;
end;
$$;

revoke all on function public.chapter_rankings(uuid) from public, anon;
grant execute on function public.chapter_rankings(uuid) to authenticated;
