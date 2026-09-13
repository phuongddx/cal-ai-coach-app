-- Plan 02-01: pgTAP proof of the scan pipeline boundary — quota claim,
-- webhook exactly-once ingestion, and the server-only table revokes.
-- Run: supabase test db  (runs every file in supabase/tests/)
--
-- Role discipline: claim_scan_credit runs as `authenticated` with JWT claims,
-- apply_webhook_event as `service_role` (its only grantee); direct table
-- assertions run as `postgres` (clients have no table privileges).

begin;
select plan(41);

-- 1-2: no direct table privileges for clients on the scan-pipeline tables ----
select ok(
  not has_table_privilege('anon', 'public.food_cache', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.scan_usage', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.entitlements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.webhook_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.scans', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.scan_items', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.eval_cases', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has no privileges on scan-pipeline tables'
);
select ok(
  not has_table_privilege('authenticated', 'public.food_cache', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.scan_usage', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.entitlements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.webhook_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.scans', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.scan_items', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.eval_cases', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has no direct scan-pipeline table privileges'
);

-- 3-7: EXECUTE only where the privilege boundary says so ----------------------
select ok(
  has_function_privilege('authenticated', 'public.claim_scan_credit(uuid)', 'EXECUTE'),
  'authenticated can execute claim_scan_credit(uuid)'
);
select ok(
  not has_function_privilege('anon', 'public.claim_scan_credit(uuid)', 'EXECUTE'),
  'anon cannot execute claim_scan_credit(uuid)'
);
select ok(
  not has_function_privilege('anon', 'public.apply_webhook_event(jsonb)', 'EXECUTE'),
  'anon cannot execute apply_webhook_event(jsonb)'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_webhook_event(jsonb)', 'EXECUTE'),
  'authenticated cannot execute apply_webhook_event(jsonb)'
);
select ok(
  has_function_privilege('service_role', 'public.apply_webhook_event(jsonb)', 'EXECUTE'),
  'service_role can execute apply_webhook_event(jsonb)'
);

-- 8: claim without a JWT identity is refused with the typed errcode -----------
set local role authenticated;
select throws_ok(
  'select public.claim_scan_credit(''aaaaaaaa-0000-4000-8000-000000000009''::uuid)',
  '42501',
  'claim_scan_credit requires an authenticated user',
  'claim without a JWT identity is refused with 42501'
);

-- 9-11: quota boundary — three claims accepted --------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000001'::uuid))->>'claimed',
  'true',
  'credit 1 claimed'
);
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000002'::uuid))->>'claimed',
  'true',
  'credit 2 claimed'
);
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000003'::uuid))->>'claimed',
  'true',
  'credit 3 claimed'
);

-- 12-14: the 4th scan in the rolling window is refused with limit + resetAt ---
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000004'::uuid))->>'claimed',
  'false',
  '4th scan in window refused'
);
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000004'::uuid))->>'limit',
  '3',
  'refusal carries limit 3'
);
select ok(
  (select (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000004'::uuid)->>'resetAt') is not null),
  'refusal carries a window resetAt'
);

-- 15-16: replay of an already-claimed scan keeps the original verdict ---------
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000001'::uuid))->>'claimed',
  'true',
  'idempotent replay stays claimed'
);
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000001'::uuid))->>'used',
  '3',
  'replay does not grow usage'
);

-- Assert ledger state as postgres (clients have no table SELECT) --------------
reset role;
set local role postgres;
select is(
  (select count(*) from public.scan_usage),
  3::bigint,
  'exactly 3 usage rows after refusal and replay'
);

-- 17: per-user serialization inside claim_scan_credit (review CR-03) ----------
-- Concurrent claims with distinct scan_ids are only safe if each claimant
-- holds a per-user advisory xact lock before the window count. pgTAP is a
-- single session, so a live two-session race is not deterministic here; the
-- lock itself is proven from pg_locks: while the RPC runs inside this
-- transaction, the advisory lock keyed on the claimant's uid is held by it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (public.claim_scan_credit('aaaaaaaa-0000-4000-8000-000000000021'::uuid))->>'claimed',
  'true',
  'a second user claims independently of the first user window'
);
select ok(
  exists (
    select 1 from pg_locks
     where locktype = 'advisory'
       and classid = 0
       and objid = (hashtext('22222222-2222-4222-8222-222222222222') & 2147483647)::oid
  ),
  'claim_scan_credit holds the per-user advisory xact lock while claiming'
);
reset role;
set local role postgres;

-- 18-19: webhook exactly-once — first apply wins, duplicate is a no-op --------
set local role service_role;
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-0001',
    'appUserId', 'rc-user-alpha',
    'entitlementId', 'premium',
    'active', true,
    'expiresAt', '2026-10-01T00:00:00Z',
    'productId', 'coachcal_premium_monthly',
    'supabaseUserId', '11111111-1111-4111-8111-111111111111'
  )))->>'applied',
  'true',
  'first webhook event applied'
);
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-0001',
    'appUserId', 'rc-user-alpha',
    'entitlementId', 'premium',
    'active', true,
    'expiresAt', '2026-10-01T00:00:00Z',
    'productId', 'coachcal_premium_monthly',
    'supabaseUserId', '11111111-1111-4111-8111-111111111111'
  )))->>'applied',
  'false',
  'duplicate event id not applied'
);

-- Entitlement state as postgres ------------------------------------------------
reset role;
set local role postgres;
select is(
  (select count(*) from public.entitlements),
  1::bigint,
  'duplicate event did not create a second entitlement'
);
select ok(
  (select active from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'entitlement active after grant'
);
select is(
  (select supabase_user_id::text from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  '11111111-1111-4111-8111-111111111111',
  'app_user_id mapped to the Supabase user'
);

-- 23: a distinct event for the same identity updates the single row in place --
set local role service_role;
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-0002',
    'appUserId', 'rc-user-alpha',
    'entitlementId', 'premium',
    'active', true,
    'expiresAt', '2026-12-01T00:00:00Z',
    'productId', 'coachcal_premium_annual'
  )))->>'applied',
  'true',
  'distinct event for the same entitlement applied'
);

reset role;
set local role postgres;
select is(
  (select count(*) from public.entitlements),
  1::bigint,
  'distinct event still leaves exactly one entitlement row'
);
select ok(
  (select expires_at = '2026-12-01T00:00:00Z'::timestamptz from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'distinct event updated expires_at in place'
);
select ok(
  (select supabase_user_id::text = '11111111-1111-4111-8111-111111111111' from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'identity mapping preserved when the update event omits it'
);
select is(
  (select count(*) from public.webhook_events),
  2::bigint,
  'ledger keeps one row per distinct event id'
);

-- 28-32: events that state no period end preserve the stored expiry (WR-02) ---
-- A ledger-only event (e.g. BILLING_ISSUE) arrives active=true with no
-- expiresAt; the upsert must keep the prior expiry instead of nulling it.
set local role service_role;
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-0003',
    'appUserId', 'rc-user-alpha',
    'entitlementId', 'premium',
    'active', true
  )))->>'applied',
  'true',
  'event without expiresAt is applied'
);

reset role;
set local role postgres;
select ok(
  (select expires_at = '2026-12-01T00:00:00Z'::timestamptz from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'event without expiresAt preserves the prior expiry'
);
select ok(
  (select active from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'event without expiresAt keeps access active'
);

-- Revocation is untouched by the coalesce: active=false lands even when the
-- event carries no expiry of its own.
set local role service_role;
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-0004',
    'appUserId', 'rc-user-alpha',
    'entitlementId', 'premium',
    'active', false
  )))->>'applied',
  'true',
  'revocation without expiresAt is applied'
);

reset role;
set local role postgres;
select is(
  (select active from public.entitlements
    where app_user_id = 'rc-user-alpha' and entitlement_id = 'premium'),
  'f',
  'revocation without expiresAt deactivates access'
);

-- 33-36: out-of-order event protection (WR-03) --------------------------------
-- RevenueCat delivers at-least-once with no ordering guarantee: an older
-- event (by event timestamp) must not overwrite newer state for the same
-- (app_user_id, entitlement_id).
set local role service_role;
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-beta-1',
    'appUserId', 'rc-user-beta',
    'entitlementId', 'premium',
    'active', true,
    'expiresAt', '2027-01-01T00:00:00Z',
    'timestampMs', 5000
  )))->>'applied',
  'true',
  'beta grant at event time 5000 applied'
);
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-beta-2',
    'appUserId', 'rc-user-beta',
    'entitlementId', 'premium',
    'active', false,
    'timestampMs', 4000
  )))->>'stale',
  'true',
  'older event is reported stale and not applied'
);
select is(
  (public.apply_webhook_event(jsonb_build_object(
    'eventId', 'evt-beta-3',
    'appUserId', 'rc-user-beta',
    'entitlementId', 'premium',
    'active', false,
    'timestampMs', 6000
  )))->>'applied',
  'true',
  'genuinely newer event applies'
);

reset role;
set local role postgres;
select ok(
  (select active = false and expires_at = '2027-01-01T00:00:00Z'::timestamptz
     and last_event_ms = 6000
    from public.entitlements
   where app_user_id = 'rc-user-beta' and entitlement_id = 'premium'),
  'final state follows the newest event only'
);

-- 28: malformed envelope refused with the typed errcode ------------------------
set local role service_role;
select throws_ok(
  'select public.apply_webhook_event(''{"eventId":"evt-orphan"}''::jsonb)',
  'P0001',
  'webhook event envelope is missing required fields',
  'webhook envelope missing required fields is refused'
);

-- 29-30: food_cache round-trip and source constraint ---------------------------
reset role;
set local role postgres;
insert into public.food_cache (cache_key, source, payload, expires_at)
values ('fdc:328637', 'fdc',
        jsonb_build_object('kcal', 645, 'proteinG', 8.7, 'carbsG', 0.1, 'fatG', 72.1, 'fiberG', 0),
        now() + interval '30 days');
select is(
  (select payload->>'kcal' from public.food_cache where cache_key = 'fdc:328637'),
  '645',
  'food_cache round-trips by cache_key'
);
select throws_ok(
  'insert into public.food_cache (cache_key, source, payload, expires_at) values (''x:1'', ''wikipedia'', jsonb_build_object(''kcal'', 10), now())',
  'new row for relation "food_cache" violates check constraint "food_cache_source_check"',
  'food_cache refuses unknown sources'
);

select * from finish();
rollback;
