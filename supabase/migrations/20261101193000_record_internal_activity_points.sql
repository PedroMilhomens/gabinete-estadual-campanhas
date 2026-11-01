create or replace function public.record_internal_activity_points(
  p_activity_id uuid,
  p_chapter_id uuid,
  p_score integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_points integer;
  submission_id uuid;
begin
  if not public.is_approved()
    or public.current_role() not in ('reviewer', 'admin')
  then
    raise exception 'only approved reviewers and admins may record internal activity points'
      using errcode = '42501';
  end if;

  if p_score is null or p_score < 0 then
    raise exception 'score must be a non-negative integer'
      using errcode = '23514';
  end if;

  if p_chapter_id is null
    or not exists (
      select 1
      from public.chapters
      where chapters.id = p_chapter_id
    )
  then
    raise exception 'chapter is required'
      using errcode = '23514';
  end if;

  select activities.points
  into activity_points
  from public.activities
  where activities.id = p_activity_id
    and activities.reviewer_managed
  for update;

  if not found then
    raise exception 'activity is not available for staff scoring'
      using errcode = '23514';
  end if;

  if activity_points is null or p_score > activity_points then
    raise exception 'score exceeds activity points'
      using errcode = '23514';
  end if;

  insert into public.submissions (
    activity_id,
    chapter_id,
    submitted_by,
    description,
    status,
    score,
    reviewed_by,
    reviewed_at
  )
  values (
    p_activity_id,
    p_chapter_id,
    null,
    'Pontuação registrada pela equipe.',
    'approved',
    p_score,
    auth.uid(),
    now()
  )
  returning id into submission_id;

  return submission_id;
end;
$$;

revoke all on function public.record_internal_activity_points(uuid, uuid, integer)
from public, anon;
grant execute on function public.record_internal_activity_points(uuid, uuid, integer)
to authenticated;
