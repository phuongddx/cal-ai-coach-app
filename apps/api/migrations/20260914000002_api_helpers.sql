-- U-11 helper functions: the Deno functions read and wrote food_cache and
-- entitlements with the service-role client. The API role holds no table
-- privileges (invariant I2), so the same two reads and one write go through
-- narrow SECURITY DEFINER functions instead. Each one requires an authenticated
-- caller (the app.user_id setting) and touches nothing but its own concern.

-- cache_get: the payload of an unexpired food_cache row, or null.
create or replace function public.cache_get(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if nullif(current_setting('app.user_id', true), '')::uuid is null then
    raise exception 'cache_get requires an authenticated user' using errcode = '42501';
  end if;
  select payload into v_payload
    from public.food_cache
   where cache_key = p_key and expires_at > now()
   limit 1;
  return v_payload;
end;
$$;

-- cache_put: upsert one grounding result (positive or negative) with a TTL.
create or replace function public.cache_put(
  p_key text, p_source text, p_payload jsonb, p_ttl_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(current_setting('app.user_id', true), '')::uuid is null then
    raise exception 'cache_put requires an authenticated user' using errcode = '42501';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'cache_put expects a positive ttl' using errcode = 'P0001';
  end if;
  insert into public.food_cache (cache_key, source, payload, fetched_at, expires_at)
  values (p_key, p_source, p_payload, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (cache_key) do update
    set source     = excluded.source,
        payload    = excluded.payload,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at;
end;
$$;

-- get_entitlement: the caller's current entitlement (AD-01 resolution order:
-- supabase_user_id or app_user_id equals the caller; active; unexpired; the
-- latest expiry wins, a null expiry never expires). Returns
-- {"active": bool, "expiresAt": timestamptz|null}.
create or replace function public.get_entitlement()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_found boolean := false;
  v_expires timestamptz;
begin
  if v_user is null then
    raise exception 'get_entitlement requires an authenticated user' using errcode = '42501';
  end if;
  select true, e.expires_at into v_found, v_expires
    from public.entitlements e
   where (e.supabase_user_id = v_user or e.app_user_id = v_user::text)
     and e.active = true
     and (e.expires_at is null or e.expires_at > now())
   order by e.expires_at desc nulls last
   limit 1;
  if v_found is not true then
    return jsonb_build_object('active', false, 'expiresAt', null);
  end if;
  return jsonb_build_object('active', true, 'expiresAt', v_expires);
end;
$$;

revoke all on function public.cache_get(text) from public, coachcal_api;
revoke all on function public.cache_put(text, text, jsonb, integer) from public, coachcal_api;
revoke all on function public.get_entitlement() from public, coachcal_api;
grant execute on function public.cache_get(text) to coachcal_api;
grant execute on function public.cache_put(text, text, jsonb, integer) to coachcal_api;
grant execute on function public.get_entitlement() to coachcal_api;
