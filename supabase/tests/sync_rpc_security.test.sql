-- Plan 01-03: pgTAP proof of the RPC-only sync boundary.
-- Run: supabase test db  (runs every file in supabase/tests/)
--
-- Role discipline: RPC calls run as `authenticated` with JWT claims; direct
-- mirror/ledger assertions run as `postgres` (the tests would otherwise be
-- denied by the very boundary they prove).

begin;
select plan(22);

-- 1-3: no direct table privileges for clients --------------------------------
select ok(
  not has_table_privilege('anon', 'public.diary_entries', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has no mirror privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public.diary_entries', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has no direct mirror DML/SELECT'
);
select ok(
  not has_table_privilege('authenticated', 'public.sync_operations', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has no direct ledger DML/SELECT'
);

-- 4-6: EXECUTE only on the two RPCs ------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.sync_push(jsonb)', 'EXECUTE'),
  'authenticated can execute sync_push(jsonb)'
);
select ok(
  has_function_privilege('authenticated', 'public.sync_pull(bigint)', 'EXECUTE'),
  'authenticated can execute sync_pull(bigint)'
);
select ok(
  not has_function_privilege('anon', 'public.sync_push(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.sync_pull(bigint)', 'EXECUTE'),
  'anon cannot execute either RPC'
);

-- Become User A ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 7: first-seen push is accepted ----------------------------------------------
select is(
  public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'opId', '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
      'table', 'diary_entries',
      'recordId', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
      'kind', 'upsert',
      'snapshot', jsonb_build_object(
        'id', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
        'displayText', 'Chicken rice bowl',
        'deletedAt', null,
        'serverVersion', 0,
        'acceptedOpId', null),
      'clientTimestamp', '2026-09-12T00:00:00.000Z')
  ))->'accepted'->0->>'opId',
  '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
  'first-seen push is accepted'
);

-- 8: replay returns duplicate=true --------------------------------------------
select is(
  public.sync_push(jsonb_build_array(
    jsonb_build_object(
      'opId', '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
      'table', 'diary_entries',
      'recordId', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
      'kind', 'upsert',
      'snapshot', jsonb_build_object(
        'id', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
        'displayText', 'TAMPERED VIA REPLAY',
        'deletedAt', null,
        'serverVersion', 0,
        'acceptedOpId', null),
      'clientTimestamp', '2026-09-12T00:00:01.000Z')
  ))->'accepted'->0->>'duplicate',
  'true',
  'replay returns duplicate=true'
);

-- Assert mirror state as postgres (clients have no table SELECT) --------------
reset role;
set local role postgres;
select is(
  (select display_text from public.diary_entries where id = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1'::uuid),
  'Chicken rice bowl',
  'replay did not re-apply the snapshot'
);
select is(
  (select count(*) from public.sync_operations),
  1::bigint,
  'exactly one ledger row after replay'
);

-- 10: pull (as User A again) returns the row ----------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.sync_pull(0)::jsonb->'rows'->0->'snapshot'->>'displayText',
  'Chicken rice bowl',
  'pull returns the owner row'
);

-- 11: tombstone reaches pull and stays deleted --------------------------------
select public.sync_push(jsonb_build_array(
  jsonb_build_object(
    'opId', '6b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    'table', 'diary_entries',
    'recordId', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
    'kind', 'tombstone',
    'snapshot', jsonb_build_object(
      'id', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
      'displayText', 'Chicken rice bowl',
      'deletedAt', '2026-09-12T01:00:00.000Z',
      'serverVersion', 0,
      'acceptedOpId', null),
    'clientTimestamp', '2026-09-12T01:00:00.000Z')
));
select is(
  public.sync_pull(0)::jsonb->'rows'->0->'snapshot'->>'deletedAt',
  '2026-09-12T01:00:00+00:00',
  'tombstone is retained as deleted metadata in pull'
);

-- 12: stale (older canonical version) push cannot overwrite -------------------
-- Seed a replica that already holds a newer accepted version, burn the
-- sequence so the next push assigns a LOWER version, and prove the comparator
-- refuses the overwrite (no resurrection of canonical state).
reset role;
set local role postgres;
update public.diary_entries
   set server_version = 1000,
       accepted_op_id = '7b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
       display_text = 'NEWER STATE'
 where id = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1'::uuid;
delete from public.sync_operations
 where op_id = '6b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e'::uuid;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
-- burn version 3 on a throwaway record so the next acceptance is < 1000
select public.sync_push(jsonb_build_array(
  jsonb_build_object(
    'opId', '8b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    'table', 'diary_entries',
    'recordId', 'bbbbbbbb-bbb2-4bbb-8bbb-bbbbbbbbbbb2',
    'kind', 'upsert',
    'snapshot', jsonb_build_object(
      'id', 'bbbbbbbb-bbb2-4bbb-8bbb-bbbbbbbbbbb2',
      'displayText', 'burn',
      'deletedAt', null,
      'serverVersion', 0,
      'acceptedOpId', null),
    'clientTimestamp', '2026-09-12T01:01:00.000Z')
));
select public.sync_push(jsonb_build_array(
  jsonb_build_object(
    'opId', '9b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    'table', 'diary_entries',
    'recordId', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
    'kind', 'upsert',
    'snapshot', jsonb_build_object(
      'id', 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
      'displayText', 'STALE OVERWRITE ATTEMPT',
      'deletedAt', null,
      'serverVersion', 0,
      'acceptedOpId', null),
    'clientTimestamp', '2026-09-12T01:02:00.000Z')
));

reset role;
set local role postgres;
select is(
  (select display_text from public.diary_entries where id = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1'::uuid),
  'NEWER STATE',
  'stale accepted version cannot overwrite the canonical row'
);

-- 13-15: direct DML denials (as authenticated A) -------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  'insert into public.diary_entries (id, user_id, display_text) values (''cccccccc-ccc3-4ccc-8ccc-ccccccccccc3''::uuid, ''11111111-1111-4111-8111-111111111111''::uuid, ''x'')',
  'permission denied for table diary_entries',
  'authenticated direct mirror INSERT denied'
);
select throws_ok(
  'update public.sync_operations set ack = null',
  'permission denied for table sync_operations',
  'authenticated direct ledger UPDATE denied'
);
select throws_ok(
  'delete from public.diary_entries',
  'permission denied for table diary_entries',
  'authenticated direct mirror DELETE denied'
);

-- 16-17: User B isolation ------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  jsonb_array_length(public.sync_pull(0)::jsonb->'rows'),
  0,
  'User B pull sees none of User A rows'
);
select throws_ok(
  'select public.sync_push(jsonb_build_array(jsonb_build_object(''opId'', ''ab1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e''::text, ''table'', ''diary_entries'', ''recordId'', ''aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1''::text, ''kind'', ''upsert'', ''snapshot'', jsonb_build_object(''id'', ''aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1'', ''displayText'', ''hijack'', ''deletedAt'', null, ''serverVersion'', 0, ''acceptedOpId'', null), ''clientTimestamp'', ''2026-09-12T02:00:00.000Z'')))',
  'operation targets a record owned by another user',
  'User B push targeting User A record is denied'
);

-- 18: unauthenticated pull rejected --------------------------------------------
set local role anon;
select throws_ok(
  'select public.sync_pull(0)',
  'permission denied for function sync_pull',
  'anon cannot pull'
);

-- 19: malformed envelopes rejected ---------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  'select public.sync_push(''[{"opId":"not-a-uuid","table":"diary_entries","recordId":"aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1","kind":"upsert","snapshot":{"id":"aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1","displayText":"x","deletedAt":null,"serverVersion":0,"acceptedOpId":null},"clientTimestamp":"2026-09-12T00:00:00.000Z"}]''::jsonb)',
  'operation identifiers must be valid UUIDs',
  'malformed operation envelope rejected'
);
select throws_ok(
  'select public.sync_push(''[]''::jsonb)',
  'sync_push expects a non-empty operation array',
  'empty push batch rejected'
);

-- 20: B-side denial left A''s data intact --------------------------------------
reset role;
set local role postgres;
select is(
  (select display_text from public.diary_entries where id = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1'::uuid),
  'NEWER STATE',
  'User A row intact after User B denial attempts'
);

select * from finish();
rollback;
