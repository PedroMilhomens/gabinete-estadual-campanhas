create function public.review_submission(
  p_submission_id uuid,
  p_score integer,
  p_status public.submission_status,
  p_comment text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  reviewed_submission_id uuid;
begin
  if not public.is_approved()
    or public.current_role() not in ('reviewer', 'admin')
  then
    raise exception 'only approved reviewers and admins may review submissions'
      using errcode = '42501';
  end if;

  if p_status not in ('returned', 'approved') then
    raise exception 'review status must be returned or approved'
      using errcode = '23514';
  end if;

  if p_score is null or p_score < 0 then
    raise exception 'score must be a non-negative integer'
      using errcode = '23514';
  end if;

  if p_comment is null
    or char_length(btrim(p_comment)) = 0
    or char_length(p_comment) > 2000
  then
    raise exception 'review comment must contain between 1 and 2000 characters'
      using errcode = '23514';
  end if;

  update public.submissions
  set score = p_score,
      status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_submission_id
    and status in ('submitted', 'returned')
    and exists (
      select 1
      from public.activities
      where activities.id = submissions.activity_id
        and activities.points is not null
        and p_score <= activities.points
    )
  returning id into reviewed_submission_id;

  if reviewed_submission_id is null then
    raise exception 'submission is unavailable or score exceeds activity points'
      using errcode = '23514';
  end if;

  insert into public.comments (submission_id, author_id, body)
  values (reviewed_submission_id, auth.uid(), btrim(p_comment));

  return reviewed_submission_id;
end;
$$;

revoke all on function public.review_submission(
  uuid,
  integer,
  public.submission_status,
  text
) from public, anon;
grant execute on function public.review_submission(
  uuid,
  integer,
  public.submission_status,
  text
) to authenticated;
