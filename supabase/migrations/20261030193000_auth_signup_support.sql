create function public.signup_chapters()
returns table (id uuid, name text, number integer)
language sql
stable
security definer
set search_path = public
as $$
  select chapters.id, chapters.name, chapters.number
  from public.chapters
  where chapters.number is not null
  order by chapters.number;
$$;

revoke all on function public.signup_chapters() from public;
grant execute on function public.signup_chapters() to anon, authenticated;

create function public.current_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', profiles.id,
    'full_name', profiles.full_name,
    'role', profiles.role,
    'status', profiles.status
  )
  from public.profiles
  where profiles.id = (select auth.uid());
$$;

revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;
