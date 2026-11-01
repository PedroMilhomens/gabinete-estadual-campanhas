alter table public.activities
  add column multiple_submissions boolean not null default false;

alter table public.submissions
  drop constraint if exists submissions_activity_id_chapter_id_key;

create index submissions_activity_chapter_idx
  on public.submissions (activity_id, chapter_id);

create function public.enforce_activity_submission_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allows_multiple boolean;
begin
  select activities.multiple_submissions
  into allows_multiple
  from public.activities
  where activities.id = new.activity_id
  for update;

  if found and not allows_multiple and exists (
    select 1
    from public.submissions
    where submissions.activity_id = new.activity_id
      and submissions.chapter_id = new.chapter_id
      and submissions.id <> new.id
  ) then
    raise exception 'Esta atividade permite apenas um envio por capítulo.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_activity_submission_mode
before insert or update of activity_id, chapter_id on public.submissions
for each row execute function public.enforce_activity_submission_mode();

create function public.prevent_disabling_multiple_submissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.multiple_submissions
    and not new.multiple_submissions
    and exists (
      select 1
      from public.submissions
      where submissions.activity_id = old.id
      group by submissions.chapter_id
      having count(*) > 1
    )
  then
    raise exception 'Existem múltiplos envios nesta atividade; não é possível desativar a opção.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_disabling_multiple_submissions
before update of multiple_submissions on public.activities
for each row execute function public.prevent_disabling_multiple_submissions();
