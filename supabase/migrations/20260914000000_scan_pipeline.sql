-- Plan 02-01: scan pipeline foundation — food cache, scan quota, entitlements,
-- webhook ledger, scan results, eval cases, and the quota/webhook SECURITY
-- DEFINER RPCs.
--
-- Boundary: these are server tables. Clients hold NO table privileges and get
-- no policies (service role bypasses RLS; revocation is the real boundary,
-- RLS is defense in depth). claim_scan_credit derives the owner from
-- auth.uid(); apply_webhook_event is granted to service_role only.

-- ---------------------------------------------------------------------------
-- food_cache: normalized per-100g grounding results (shared, non-user data)
-- ---------------------------------------------------------------------------
create table if not exists public.food_cache (
  cache_key  text primary key,
  source     text not null constraint food_cache_source_check check (source in ('fdc','off','fatsecret')),
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists food_cache_expires_idx
  on public.food_cache (expires_at);

-- ---------------------------------------------------------------------------
-- scan_usage: idempotent quota ledger keyed by (user_id, scan_id)
-- ---------------------------------------------------------------------------
create table if not exists public.scan_usage (
  user_id    uuid not null,
  scan_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, scan_id)
);

create index if not exists scan_usage_window_idx
  on public.scan_usage (user_id, created_at);

-- ---------------------------------------------------------------------------
-- entitlements: RevenueCat identity (app_user_id) plus an optional Supabase
-- user mapping column (AD-01); aliasing finalizes in Phase 5
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  app_user_id      text not null,
  entitlement_id   text not null,
  supabase_user_id uuid,
  active           boolean not null default false,
  expires_at       timestamptz,
  product_id       text,
  updated_at       timestamptz not null default now(),
  primary key (app_user_id, entitlement_id)
);

-- ---------------------------------------------------------------------------
-- webhook_events: exactly-once ledger for RevenueCat event ids
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  event_id    text primary key,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scans / scan_items: server-originated scan results reaching the client in
-- the HTTP response (response-mirror pattern; never client-synced)
-- ---------------------------------------------------------------------------
create table if not exists public.scans (
  id         uuid primary key,
  user_id    uuid not null,
  kind       text check (kind in ('photo','label','text','barcode')),
  meal_type  text,
  created_at timestamptz not null default now()
);

create table if not exists public.scan_items (
  id                uuid primary key,
  scan_id           uuid references public.scans (id),
  label             text not null,
  grams             numeric not null,
  per100g           jsonb not null,
  kcal              integer not null,
  macros            jsonb not null,
  confidence        numeric,
  hidden_fat_likely boolean default false,
  source            text
);

-- ---------------------------------------------------------------------------
-- eval_cases: golden evaluation inputs/expectations for the VLM pipeline
-- ---------------------------------------------------------------------------
create table if not exists public.eval_cases (
  id            text primary key,
  kind          text,
  input         jsonb,
  expected      jsonb,
  expected_tier text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: defense in depth (revokes below are the real boundary)
-- ---------------------------------------------------------------------------
alter table public.food_cache enable row level security;
alter table public.scan_usage enable row level security;
alter table public.entitlements enable row level security;
alter table public.webhook_events enable row level security;
alter table public.scans enable row level security;
alter table public.scan_items enable row level security;
alter table public.eval_cases enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges: NO client table access, no policies
-- ---------------------------------------------------------------------------
revoke all on public.food_cache from anon, authenticated;
revoke all on public.scan_usage from anon, authenticated;
revoke all on public.entitlements from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.scans from anon, authenticated;
revoke all on public.scan_items from anon, authenticated;
revoke all on public.eval_cases from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- claim_scan_credit: atomic, idempotent free-tier quota claim — 3 scans per
-- rolling 7-day window; network retries of the same scan collapse on the
-- (user_id, scan_id) primary key and return the original verdict.
-- ---------------------------------------------------------------------------
create or replace function public.claim_scan_credit(p_scan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit constant int := 3;
  v_used  int;
  v_reset timestamptz;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'claim_scan_credit requires an authenticated user' using errcode = '42501';
  end if;

  insert into public.scan_usage (user_id, scan_id)
  values (v_owner, p_scan_id)
  on conflict (user_id, scan_id) do nothing;

  if not exists (
    select 1 from public.scan_usage
     where user_id = v_owner and scan_id = p_scan_id
  ) then
    return jsonb_build_object('claimed', false, 'used', v_limit, 'limit', v_limit);
  end if;

  select count(*)::int, min(created_at) + interval '7 days'
    into v_used, v_reset
    from public.scan_usage
   where user_id = v_owner and created_at > now() - interval '7 days';

  if v_used > v_limit then
    -- This scan is the (limit+1)th inside the window: refund it.
    delete from public.scan_usage
     where user_id = v_owner and scan_id = p_scan_id;
    return jsonb_build_object(
      'claimed', false,
      'used', v_used - 1,
      'limit', v_limit,
      'resetAt', v_reset);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'used', v_used,
    'limit', v_limit,
    'resetAt', v_reset);
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_webhook_event: exactly-once webhook ingestion — the dedupe-ledger
-- insert and the entitlement upsert commit in this single call.
-- p_event: { eventId, appUserId, entitlementId, active?, expiresAt?,
--            productId?, supabaseUserId? }
-- ---------------------------------------------------------------------------
create or replace function public.apply_webhook_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id         text;
  v_app_user_id      text;
  v_entitlement_id   text;
  v_active           boolean;
  v_expires_at       timestamptz;
  v_product_id       text;
  v_supabase_user_id uuid;
  v_inserted         boolean;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'apply_webhook_event expects a jsonb object' using errcode = 'P0001';
  end if;

  v_event_id       := p_event ->> 'eventId';
  v_app_user_id    := p_event ->> 'appUserId';
  v_entitlement_id := p_event ->> 'entitlementId';
  v_product_id     := p_event ->> 'productId';

  if v_event_id is null or v_app_user_id is null or v_entitlement_id is null then
    raise exception 'webhook event envelope is missing required fields' using errcode = 'P0001';
  end if;

  -- Cast optional fields before the ledger insert so a malformed event aborts
  -- with nothing written and the sender's retry can succeed.
  begin
    v_active           := coalesce((p_event ->> 'active')::boolean, false);
    v_expires_at       := (p_event ->> 'expiresAt')::timestamptz;
    v_supabase_user_id := (p_event ->> 'supabaseUserId')::uuid;
  exception
    when invalid_datetime_format or invalid_text_representation then
      raise exception 'webhook event fields must use canonical boolean, timestamp, and UUID text forms'
        using errcode = 'P0001';
  end;

  insert into public.webhook_events (event_id)
  values (v_event_id)
  on conflict (event_id) do nothing
  returning true into v_inserted;

  if v_inserted is not true then
    return jsonb_build_object('applied', false);
  end if;

  insert into public.entitlements
    (app_user_id, entitlement_id, active, expires_at, product_id,
     supabase_user_id, updated_at)
  values
    (v_app_user_id, v_entitlement_id, v_active, v_expires_at, v_product_id,
     v_supabase_user_id, now())
  on conflict (app_user_id, entitlement_id) do update
    set active           = excluded.active,
        expires_at       = excluded.expires_at,
        product_id       = excluded.product_id,
        supabase_user_id = coalesce(excluded.supabase_user_id,
                                    public.entitlements.supabase_user_id),
        updated_at       = now();

  return jsonb_build_object('applied', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: EXECUTE only where the boundary says so
-- ---------------------------------------------------------------------------
revoke all on function public.claim_scan_credit(uuid) from public, anon, authenticated;
grant execute on function public.claim_scan_credit(uuid) to authenticated;

revoke all on function public.apply_webhook_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_webhook_event(jsonb) to service_role;
