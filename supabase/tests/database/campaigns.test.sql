begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

select throws_ok(
  $$insert into public.campaigns (name) values (' ')$$,
  '23514',
  null,
  'campaign name cannot be blank'
);

select throws_ok(
  $$insert into public.campaigns (name, starts_at, ends_at)
    values ('Invalid period', '2026-12-01', '2026-11-01')$$,
  '23514',
  null,
  'campaign end date cannot precede start date'
);

insert into public.campaigns (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Valid campaign');

select throws_ok(
  $$insert into public.activities (campaign_id, name, points)
    values ('11111111-1111-4111-8111-111111111111', ' ', 1)$$,
  '23514',
  null,
  'activity name cannot be blank'
);

select throws_ok(
  $$insert into public.activities (campaign_id, name, description, points)
    values (
      '11111111-1111-4111-8111-111111111111',
      'Valid activity',
      repeat('x', 2001),
      1
    )$$,
  '23514',
  null,
  'activity description is limited to 2000 characters'
);

select * from finish();
rollback;
