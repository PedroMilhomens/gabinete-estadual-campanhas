begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(65);

insert into public.chapters (id, name, number, city)
values
  ('a0000000-0000-0000-0000-000000000001', 'Chapter A', 1, 'City A'),
  ('b0000000-0000-0000-0000-000000000002', 'Chapter B', 2, 'City B');

insert into public.campaigns (id, name)
values ('c0000000-0000-0000-0000-000000000003', 'Test campaign');

insert into public.activities (id, campaign_id, name, points)
values (
  'd0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000003',
  'Test activity',
  100
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member A","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'member-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member B","chapter_id":"b0000000-0000-0000-0000-000000000002","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'reviewer@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Reviewer","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'pending@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Pending","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'rejected@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Rejected","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  ),
  (
    '80000000-0000-0000-0000-000000000008',
    'authenticated',
    'authenticated',
    'member-a2@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member A2","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true}',
    now(),
    now()
  );

alter table public.profiles disable trigger protect_profile_fields;

update public.profiles
set role = 'member', status = 'approved'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002'
);

update public.profiles
set role = 'reviewer', status = 'approved'
where id = '30000000-0000-0000-0000-000000000003';

update public.profiles
set role = 'admin', status = 'approved'
where id = '40000000-0000-0000-0000-000000000004';

update public.profiles
set status = 'rejected'
where id = '60000000-0000-0000-0000-000000000006';

update public.profiles
set role = 'member', status = 'approved'
where id = '80000000-0000-0000-0000-000000000008';

alter table public.profiles enable trigger protect_profile_fields;

insert into public.submissions (
  id,
  activity_id,
  chapter_id,
  submitted_by,
  description,
  status
)
values
  (
    'e0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Chapter A submission',
    'draft'
  ),
  (
    'f0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Chapter B submission',
    'submitted'
  );

insert into storage.objects (bucket_id, name, metadata)
values (
  'attachments',
  'b0000000-0000-0000-0000-000000000002/f0000000-0000-0000-0000-000000000006/50000000-0000-0000-0000-000000000001.jpg',
  '{"mimetype":"image/jpeg","size":1000}'
);

select is(
  (
    select count(*)::integer
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relrowsecurity
      and relforcerowsecurity
  ),
  8,
  'all public data tables enable and force RLS'
);

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000005';
select is((select count(*)::integer from public.chapters), 0, 'pending user cannot read chapters');
select is((select count(*)::integer from public.profiles), 0, 'pending user cannot read profiles');
select is((select count(*)::integer from public.campaigns), 0, 'pending user cannot read campaigns');
select is((select count(*)::integer from public.activities), 0, 'pending user cannot read activities');
select is((select count(*)::integer from public.submissions), 0, 'pending user cannot read submissions');
select is((select count(*)::integer from public.attachments), 0, 'pending user cannot read attachments');
select is((select count(*)::integer from public.comments), 0, 'pending user cannot read comments');
select is((select count(*)::integer from public.audit_log), 0, 'pending user cannot read audit log');
select is((select count(*)::integer from storage.objects), 0, 'pending user cannot read storage objects');
select is(public.current_profile() ->> 'id', '50000000-0000-0000-0000-000000000005', 'pending user can retrieve only their own profile status');
select is(public.current_profile() ->> 'role', 'member', 'pending profile helper returns the member role');
select is(public.current_profile() ->> 'status', 'pending', 'pending profile helper returns the pending status');

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000006';
select is((select count(*)::integer from public.chapters), 0, 'rejected user cannot read chapters');
select is((select count(*)::integer from public.profiles), 0, 'rejected user cannot read profiles');
select is((select count(*)::integer from public.campaigns), 0, 'rejected user cannot read campaigns');
select is((select count(*)::integer from public.activities), 0, 'rejected user cannot read activities');
select is((select count(*)::integer from public.submissions), 0, 'rejected user cannot read submissions');
select is((select count(*)::integer from public.attachments), 0, 'rejected user cannot read attachments');
select is((select count(*)::integer from public.comments), 0, 'rejected user cannot read comments');
select is((select count(*)::integer from public.audit_log), 0, 'rejected user cannot read audit log');
select is((select count(*)::integer from storage.objects), 0, 'rejected user cannot read storage objects');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select ok(
  not has_table_privilege('anon', 'public.audit_log', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_log', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE')
  and not has_table_privilege('service_role', 'public.audit_log', 'INSERT')
  and not has_table_privilege('service_role', 'public.audit_log', 'DELETE')
  and has_table_privilege('service_role', 'public.audit_log', 'UPDATE'),
  'audit log cannot be written directly by API roles'
);
select is(
  (select count(*)::integer from public.submissions where id = 'f0000000-0000-0000-0000-000000000006'),
  0,
  'chapter A member cannot read chapter B submissions'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501',
  null,
  'member cannot change their own role'
);
select throws_ok(
  $$update public.profiles set status = 'approved' where id = auth.uid()$$,
  '42501',
  null,
  'member cannot change their own status'
);
select throws_ok(
  $$update public.profiles set chapter_id = 'b0000000-0000-0000-0000-000000000002' where id = auth.uid()$$,
  '42501',
  null,
  'member cannot change their own chapter'
);
select throws_ok(
  $$update public.profiles set position = 'Different position' where id = auth.uid()$$,
  '42501',
  null,
  'member cannot change protected profile fields'
);
select lives_ok(
  $$update public.profiles set full_name = 'Updated Member A' where id = auth.uid()$$,
  'member can update their own full name'
);
select throws_ok(
  $$update public.submissions set score = 80 where id = 'e0000000-0000-0000-0000-000000000005'$$,
  '42501',
  null,
  'member cannot set a submission score'
);
select throws_ok(
  $$select public.review_submission(
    'e0000000-0000-0000-0000-000000000005',
    10,
    'approved',
    'Member review attempt'
  )$$,
  '42501',
  null,
  'member cannot call the reviewer RPC'
);
select is(
  (
    with updated as (
      update public.submissions
      set status = 'approved'
      where id = 'e0000000-0000-0000-0000-000000000005'
      returning 1
    )
    select count(*)::integer from updated
  ),
  0,
  'member cannot approve their own submission'
);
select throws_ok(
  $$insert into public.attachments (submission_id, storage_path, mime, size_bytes)
    values ('e0000000-0000-0000-0000-000000000005',
      'a0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000005/70000000-0000-0000-0000-000000000001.jpg',
      'text/plain', 100)$$,
  '23514',
  null,
  'disallowed attachment MIME type is rejected'
);
select throws_ok(
  $$insert into public.attachments (submission_id, storage_path, mime, size_bytes)
    values ('e0000000-0000-0000-0000-000000000005',
      'a0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000005/70000000-0000-0000-0000-000000000002.jpg',
      'image/jpeg', 5242881)$$,
  '23514',
  null,
  'attachment larger than 5 MB is rejected'
);
select is(
  (select count(*)::integer
   from storage.objects
   where name = 'b0000000-0000-0000-0000-000000000002/f0000000-0000-0000-0000-000000000006/50000000-0000-0000-0000-000000000001.jpg'),
  0,
  'member of chapter A cannot read chapter B storage objects'
);

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000008';
select is(
  (
    with updated as (
      update public.submissions
      set description = 'Changed by another chapter member'
      where id = 'e0000000-0000-0000-0000-000000000005'
      returning 1
    )
    select count(*)::integer from updated
  ),
  0,
  'member cannot edit another member submission in their chapter'
);
select throws_ok(
  $$insert into public.attachments (submission_id, storage_path, mime, size_bytes)
    values ('e0000000-0000-0000-0000-000000000005',
      'a0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000005/70000000-0000-0000-0000-000000000003.jpg',
      'image/jpeg', 100)$$,
  '42501',
  null,
  'member cannot attach files to another member submission'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    values ('attachments',
      'a0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000005/70000000-0000-0000-0000-000000000004.jpg',
      '{"mimetype":"image/jpeg","size":100}')$$,
  '42501',
  null,
  'member cannot upload files to another member submission'
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select is(
  (
    with updated as (
      update public.profiles set role = 'admin'
      where id = '10000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from updated
  ),
  0,
  'reviewer cannot change a user role'
);
select is(
  (
    with updated as (
      update public.profiles set status = 'rejected'
      where id = '10000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from updated
  ),
  0,
  'reviewer cannot change a user status'
);
select throws_ok(
  $$select public.review_submission(
    'f0000000-0000-0000-0000-000000000006',
    101,
    'approved',
    'Score above limit'
  )$$,
  '23514',
  null,
  'review RPC rejects scores above activity points'
);
select is(
  (select status::text from public.submissions
    where id = 'f0000000-0000-0000-0000-000000000006'),
  'submitted',
  'failed review RPC leaves submission status unchanged'
);
select is(
  (select count(*)::integer from public.comments
    where submission_id = 'f0000000-0000-0000-0000-000000000006'),
  0,
  'failed review RPC does not leave a partial comment'
);
select lives_ok(
  $$select public.review_submission(
    'f0000000-0000-0000-0000-000000000006',
    90,
    'returned',
    'Please add supporting details.'
  )$$,
  'review RPC records a valid decision'
);
select is(
  (select body from public.comments
    where submission_id = 'f0000000-0000-0000-0000-000000000006'
    order by created_at desc
    limit 1),
  'Please add supporting details.',
  'review RPC records the decision comment atomically'
);
select throws_ok(
  $$update public.submissions
    set score = 101, status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = 'f0000000-0000-0000-0000-000000000006'$$,
  '23514',
  null,
  'reviewer score above activity points is rejected'
);
select lives_ok(
  $$update public.submissions
    set score = 90, status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = 'f0000000-0000-0000-0000-000000000006'$$,
  'reviewer can approve with a score within activity points'
);

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';
select ok((select count(*) > 0 from public.audit_log), 'admin can read audit log');
select lives_ok(
  $$update public.chapters set city = 'Updated City' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'admin can manage chapters'
);
select lives_ok(
  $$update public.profiles set status = 'rejected'
    where id = '20000000-0000-0000-0000-000000000002'$$,
  'admin can manage user status'
);
select ok(
  exists (
    select 1
    from public.audit_log
    where actor_id = auth.uid()
      and action = 'UPDATE'
      and table_name = 'profiles'
      and record_id = '20000000-0000-0000-0000-000000000002'
  ),
  'profile status change is recorded with its administrator'
);
select ok(
  exists (
    select 1
    from public.audit_log
    where actor_id = '30000000-0000-0000-0000-000000000003'
      and action = 'UPDATE'
      and table_name = 'submissions'
      and record_id = 'f0000000-0000-0000-0000-000000000006'
  ),
  'submission score and status change is recorded with its reviewer'
);
select throws_ok(
  $$update public.submissions
    set score = 101, status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = 'f0000000-0000-0000-0000-000000000006'$$,
  '23514',
  null,
  'admin reviewer score above activity points is rejected'
);

set local role anon;
set local request.jwt.claim.sub = '';
select is((select count(*)::integer from public.chapters), 0, 'anonymous user cannot read chapters');
select is((select count(*)::integer from public.profiles), 0, 'anonymous user cannot read profiles');
select is((select count(*)::integer from public.campaigns), 0, 'anonymous user cannot read campaigns');
select is((select count(*)::integer from public.activities), 0, 'anonymous user cannot read activities');
select is((select count(*)::integer from public.submissions), 0, 'anonymous user cannot read submissions');
select is((select count(*)::integer from public.attachments), 0, 'anonymous user cannot read attachments');
select is((select count(*)::integer from public.comments), 0, 'anonymous user cannot read comments');
select is((select count(*)::integer from public.audit_log), 0, 'anonymous user cannot read audit log');
select is((select count(*)::integer from storage.objects), 0, 'anonymous user cannot read storage objects');

reset role;
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '70000000-0000-0000-0000-000000000007',
  'authenticated',
  'authenticated',
  'signup-test@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Signup Test","chapter_id":"a0000000-0000-0000-0000-000000000001","terms_accepted":true,"role":"admin","status":"approved"}',
  now(),
  now()
);

select is(
  (select role::text from public.profiles where id = '70000000-0000-0000-0000-000000000007'),
  'member',
  'signup ignores client-supplied role'
);
select is(
  (select status::text from public.profiles where id = '70000000-0000-0000-0000-000000000007'),
  'pending',
  'signup creates pending profile regardless of client-supplied status'
);
select ok(
  (
    select not public
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']
    from storage.buckets
    where id = 'attachments'
  ),
  'attachment bucket is private and enforces size and MIME limits'
);

select * from finish();
rollback;
