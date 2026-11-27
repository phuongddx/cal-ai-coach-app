-- U-21: accounts, sign-in identities, sessions, e-mail codes, one-time codes, account deletion
-- and the validated webhook entry point.
--
-- Boundary (invariant I2): the API role (coachcal_api) holds NO privilege on any table here.
-- Everything goes through the SECURITY DEFINER functions below. Each one runs with
-- SET search_path = '' and schema-qualifies every relation. Functions that act on "the caller"
-- read the user from the app.user_id setting that the API sets inside the request transaction
-- (db.withUser); the pre-sign-in functions (auth_*) take their inputs explicitly and validate
-- them, because there is no caller yet.
--
-- Secrets never reach this schema in clear: passwords are scrypt hashes, session refresh
-- tokens, e-mail codes and one-time codes are stored as hashes (the API computes them), and the
-- Apple refresh token is stored AES-256-GCM encrypted (the API holds the key).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  -- Always lower-cased by the functions; null when no verified e-mail is known.
  email         text,
  -- scrypt hash for the e-mail + password sign-in (used by review/demo accounts); null otherwise.
  password_hash text,
  created_at    timestamptz not null default now(),
  constraint users_email_lower check (email is null or email = lower(email))
);
create unique index if not exists users_email_key on public.users (email) where email is not null;

create table if not exists public.auth_identities (
  provider                text not null check (provider in ('apple', 'google', 'email')),
  subject                 text not null check (length(subject) between 1 and 320),
  user_id                 uuid not null references public.users (id) on delete cascade,
  email                   text,
  -- AES-256-GCM envelope (v1.<iv>.<tag>.<ciphertext>, base64url); only on the apple identity.
  apple_refresh_token_enc text,
  created_at              timestamptz not null default now(),
  primary key (provider, subject)
);
create index if not exists auth_identities_user_idx on public.auth_identities (user_id);

create table if not exists public.auth_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  -- sha256 of the current refresh token; prev_refresh_hash is the one it replaced (reuse detection).
  refresh_hash      text not null,
  prev_refresh_hash text,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  revoked_at        timestamptz
);
create index if not exists auth_sessions_user_idx on public.auth_sessions (user_id);

create table if not exists public.auth_otp_codes (
  email      text primary key check (email = lower(email)),
  -- HMAC of the six-digit code (keyed with a server secret), never the code.
  code_hash  text not null,
  attempts   integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.auth_one_time_codes (
  code_hash  text primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

alter table public.users enable row level security;
alter table public.auth_identities enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_otp_codes enable row level security;
alter table public.auth_one_time_codes enable row level security;

revoke all on public.users, public.auth_identities, public.auth_sessions,
              public.auth_otp_codes, public.auth_one_time_codes
  from public, coachcal_api;

-- ---------------------------------------------------------------------------
-- Internal helper (not executable by the API role): the public shape of a user
-- ---------------------------------------------------------------------------
create or replace function public.auth_user_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'providers', coalesce(
      (select jsonb_agg(distinct i.provider order by i.provider)
         from public.auth_identities i where i.user_id = u.id),
      '[]'::jsonb))
    from public.users u
   where u.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Sign-in with Apple / Google: find or create the user for a verified identity
-- ---------------------------------------------------------------------------
create or replace function public.auth_sign_in_identity(
  p_provider text, p_subject text, p_email text, p_email_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_user_id uuid;
begin
  if p_provider is null or p_provider not in ('apple', 'google') then
    raise exception 'auth_sign_in_identity supports apple and google only' using errcode = 'P0001';
  end if;
  if p_subject is null or length(p_subject) = 0 or length(p_subject) > 320 then
    raise exception 'identity subject is required' using errcode = 'P0001';
  end if;
  if v_email is not null and length(v_email) > 320 then
    raise exception 'e-mail is too long' using errcode = 'P0001';
  end if;

  select i.user_id into v_user_id
    from public.auth_identities i
   where i.provider = p_provider and i.subject = p_subject;

  if v_user_id is null then
    -- Link to an existing account only through an e-mail the provider verified; an
    -- unverified e-mail would let anyone claim another person's account.
    if v_email is not null and coalesce(p_email_verified, false) then
      select u.id into v_user_id from public.users u where u.email = v_email;
    end if;
    if v_user_id is null then
      insert into public.users (email)
      values (case when coalesce(p_email_verified, false) then v_email else null end)
      returning id into v_user_id;
    end if;
    insert into public.auth_identities (provider, subject, user_id, email)
    values (p_provider, p_subject, v_user_id, v_email)
    on conflict (provider, subject) do nothing;
    -- A concurrent first sign-in may have won the insert: resolve to the stored owner.
    select i.user_id into v_user_id
      from public.auth_identities i
     where i.provider = p_provider and i.subject = p_subject;
  end if;

  return public.auth_user_json(v_user_id);
end;
$$;

-- Stores the (already encrypted) Apple refresh token on the caller's apple identity.
create or replace function public.auth_apple_token_store(p_enc text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  if v_user is null then
    raise exception 'auth_apple_token_store requires an authenticated user' using errcode = '42501';
  end if;
  if p_enc is null or length(p_enc) = 0 or length(p_enc) > 8192 then
    raise exception 'invalid encrypted token' using errcode = 'P0001';
  end if;
  update public.auth_identities
     set apple_refresh_token_enc = p_enc
   where user_id = v_user and provider = 'apple';
end;
$$;

-- ---------------------------------------------------------------------------
-- E-mail + password (existing users only)
-- ---------------------------------------------------------------------------
-- Returns {userId, passwordHash} or null. The API verifies the scrypt hash; the function does
-- not create users.
create or replace function public.auth_password_lookup(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('userId', u.id, 'passwordHash', u.password_hash)
    from public.users u
   where u.email = lower(btrim(p_email)) and u.password_hash is not null;
$$;

create or replace function public.auth_user_get(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_user_json(p_user_id);
$$;

-- ---------------------------------------------------------------------------
-- E-mail code (OTP)
-- ---------------------------------------------------------------------------
create or replace function public.auth_otp_issue(p_email text, p_code_hash text, p_ttl_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' or length(v_email) > 320 or p_code_hash is null or length(p_code_hash) <> 64
     or p_ttl_seconds is null or p_ttl_seconds not between 30 and 3600 then
    raise exception 'invalid otp request' using errcode = 'P0001';
  end if;
  insert into public.auth_otp_codes (email, code_hash, attempts, created_at, expires_at)
  values (v_email, p_code_hash, 0, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (email) do update
    set code_hash = excluded.code_hash,
        attempts = 0,
        created_at = now(),
        expires_at = excluded.expires_at;
end;
$$;

-- {result: ok|invalid|expired|locked, user?}. A wrong code counts an attempt (committed: the
-- function returns normally); five wrong attempts lock the code. A right code is consumed and
-- the user is created when missing.
create or replace function public.auth_otp_verify(p_email text, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.auth_otp_codes%rowtype;
  v_user_id uuid;
begin
  if v_email = '' or length(v_email) > 320 or p_code_hash is null or length(p_code_hash) <> 64 then
    raise exception 'invalid otp verification' using errcode = 'P0001';
  end if;

  select * into v_row from public.auth_otp_codes where email = v_email for update;
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  if v_row.expires_at <= now() then
    delete from public.auth_otp_codes where email = v_email;
    return jsonb_build_object('result', 'expired');
  end if;
  if v_row.attempts >= 5 then
    return jsonb_build_object('result', 'locked');
  end if;
  if v_row.code_hash <> p_code_hash then
    update public.auth_otp_codes set attempts = attempts + 1 where email = v_email;
    return jsonb_build_object('result', 'invalid');
  end if;

  delete from public.auth_otp_codes where email = v_email;

  select i.user_id into v_user_id
    from public.auth_identities i
   where i.provider = 'email' and i.subject = v_email;
  if v_user_id is null then
    select u.id into v_user_id from public.users u where u.email = v_email;
    if v_user_id is null then
      insert into public.users (email) values (v_email) returning id into v_user_id;
    end if;
    insert into public.auth_identities (provider, subject, user_id, email)
    values ('email', v_email, v_user_id, v_email)
    on conflict (provider, subject) do nothing;
    select i.user_id into v_user_id
      from public.auth_identities i
     where i.provider = 'email' and i.subject = v_email;
  end if;

  return jsonb_build_object('result', 'ok', 'user', public.auth_user_json(v_user_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create or replace function public.auth_session_create(
  p_user_id uuid, p_refresh_hash text, p_refresh_ttl_seconds integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid uuid;
begin
  if p_user_id is null or p_refresh_hash is null or length(p_refresh_hash) <> 64
     or p_refresh_ttl_seconds is null or p_refresh_ttl_seconds not between 60 and 31536000 then
    raise exception 'invalid session request' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'unknown user' using errcode = 'P0001';
  end if;
  insert into public.auth_sessions (user_id, refresh_hash, expires_at)
  values (p_user_id, p_refresh_hash, now() + make_interval(secs => p_refresh_ttl_seconds))
  returning id into v_sid;
  return v_sid;
end;
$$;

-- True while the session exists, belongs to the user, is not revoked and has not expired.
create or replace function public.auth_session_active(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.auth_sessions s
     where s.id = p_session_id
       and s.user_id = p_user_id
       and s.revoked_at is null
       and s.expires_at > now());
$$;

-- Rotating refresh: {result: ok|invalid|reuse, user?, userId?}. Presenting the token that was
-- replaced by a rotation revokes the whole session (the token was stolen or replayed).
create or replace function public.auth_session_rotate(
  p_session_id uuid, p_old_hash text, p_new_hash text, p_refresh_ttl_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.auth_sessions%rowtype;
begin
  if p_session_id is null or p_old_hash is null or length(p_old_hash) <> 64
     or p_new_hash is null or length(p_new_hash) <> 64
     or p_refresh_ttl_seconds is null or p_refresh_ttl_seconds not between 60 and 31536000 then
    raise exception 'invalid refresh request' using errcode = 'P0001';
  end if;

  select * into v_row from public.auth_sessions where id = p_session_id for update;
  if not found or v_row.revoked_at is not null or v_row.expires_at <= now() then
    return jsonb_build_object('result', 'invalid');
  end if;
  if v_row.refresh_hash = p_old_hash then
    update public.auth_sessions
       set prev_refresh_hash = refresh_hash,
           refresh_hash = p_new_hash,
           last_used_at = now(),
           expires_at = now() + make_interval(secs => p_refresh_ttl_seconds)
     where id = p_session_id;
    return jsonb_build_object(
      'result', 'ok', 'userId', v_row.user_id, 'user', public.auth_user_json(v_row.user_id));
  end if;
  if v_row.prev_refresh_hash is not null and v_row.prev_refresh_hash = p_old_hash then
    update public.auth_sessions set revoked_at = now() where id = p_session_id;
    return jsonb_build_object('result', 'reuse');
  end if;
  return jsonb_build_object('result', 'invalid');
end;
$$;

-- Sign out: revokes one of the caller's own sessions.
create or replace function public.auth_session_revoke(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  if v_user is null then
    raise exception 'auth_session_revoke requires an authenticated user' using errcode = '42501';
  end if;
  update public.auth_sessions
     set revoked_at = now()
   where id = p_session_id and user_id = v_user and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- One-time codes (Google callback -> app)
-- ---------------------------------------------------------------------------
create or replace function public.auth_one_time_issue(
  p_code_hash text, p_user_id uuid, p_ttl_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code_hash is null or length(p_code_hash) <> 64 or p_user_id is null
     or p_ttl_seconds is null or p_ttl_seconds not between 10 and 900 then
    raise exception 'invalid one-time code request' using errcode = 'P0001';
  end if;
  delete from public.auth_one_time_codes where expires_at < now() - interval '1 day';
  insert into public.auth_one_time_codes (code_hash, user_id, expires_at)
  values (p_code_hash, p_user_id, now() + make_interval(secs => p_ttl_seconds));
end;
$$;

-- Atomic single use: returns the user for a live code and marks it used; null otherwise.
create or replace function public.auth_one_time_consume(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_code_hash is null or length(p_code_hash) <> 64 then
    return null;
  end if;
  update public.auth_one_time_codes
     set used_at = now()
   where code_hash = p_code_hash and used_at is null and expires_at > now()
  returning user_id into v_user_id;
  if v_user_id is null then
    return null;
  end if;
  return public.auth_user_json(v_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion: the caller's own account only (the target is never an argument)
-- ---------------------------------------------------------------------------
-- Purges every table that holds the caller's rows, revokes the sessions, deletes the user
-- (identities, sessions and one-time codes cascade) and returns {deleted: true,
-- appleRefreshTokenEnc} so the API can revoke the Apple token after the commit.
create or replace function public.account_delete()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_enc text;
  v_email text;
begin
  if v_user is null then
    raise exception 'account_delete requires an authenticated user' using errcode = '42501';
  end if;

  select i.apple_refresh_token_enc into v_enc
    from public.auth_identities i
   where i.user_id = v_user and i.provider = 'apple' and i.apple_refresh_token_enc is not null
   limit 1;
  select u.email into v_email from public.users u where u.id = v_user;

  update public.auth_sessions set revoked_at = now() where user_id = v_user and revoked_at is null;

  delete from public.diary_entries where user_id = v_user;
  delete from public.sync_operations where user_id = v_user;
  delete from public.scan_items where user_id = v_user;
  delete from public.scans where user_id = v_user;
  delete from public.scan_usage where user_id = v_user;
  delete from public.entitlements where user_id = v_user or app_user_id = v_user::text;
  if v_email is not null then
    delete from public.auth_otp_codes where email = v_email;
  end if;
  delete from public.users where id = v_user;

  return jsonb_build_object('deleted', true, 'appleRefreshTokenEnc', v_enc);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sync: a narrow reader for the adapter (the caller's own rows only)
-- ---------------------------------------------------------------------------
create or replace function public.sync_records_get(p_record_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  if v_owner is null then
    raise exception 'sync_records_get requires an authenticated user' using errcode = '42501';
  end if;
  if p_record_ids is null or cardinality(p_record_ids) > 100 then
    raise exception 'sync_records_get expects at most 100 ids' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'recordId', d.id,
             'displayText', d.display_text,
             'deletedAt', d.deleted_at,
             'serverVersion', d.server_version,
             'acceptedOpId', d.accepted_op_id))
      from public.diary_entries d
     where d.user_id = v_owner and d.id = any (p_record_ids)), '[]'::jsonb);
end;
$$;

-- Opens a push batch: serialises pushes of the same user for the rest of the transaction (the
-- adapter decides last-writer-wins from a read, so two concurrent batches must not interleave)
-- and returns which of the given operation ids the ledger has already acknowledged.
create or replace function public.sync_ops_seen(p_op_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  if v_owner is null then
    raise exception 'sync_ops_seen requires an authenticated user' using errcode = '42501';
  end if;
  if p_op_ids is null or cardinality(p_op_ids) > 100 then
    raise exception 'sync_ops_seen expects at most 100 ids' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('coachcal.sync.' || v_owner::text, 0));
  return coalesce((
    select jsonb_agg(o.op_id)
      from public.sync_operations o
     where o.user_id = v_owner and o.op_id = any (p_op_ids)), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: validated entry point; apply_webhook_event is no longer executable by the API role
-- ---------------------------------------------------------------------------
create or replace function public.webhook_apply(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_allowed constant text[] := array[
    'eventId', 'appUserId', 'entitlementId', 'active', 'expiresAt', 'productId', 'userId',
    'timestampMs'];
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'webhook_apply expects a jsonb object' using errcode = 'P0001';
  end if;
  for v_key in select jsonb_object_keys(p_event) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'webhook event has an unknown field' using errcode = 'P0001';
    end if;
  end loop;
  if jsonb_typeof(p_event -> 'eventId') is distinct from 'string'
     or jsonb_typeof(p_event -> 'appUserId') is distinct from 'string'
     or jsonb_typeof(p_event -> 'entitlementId') is distinct from 'string' then
    raise exception 'webhook event envelope is missing required fields' using errcode = 'P0001';
  end if;
  if length(p_event ->> 'eventId') not between 1 and 255
     or length(p_event ->> 'appUserId') not between 1 and 255
     or length(p_event ->> 'entitlementId') not between 1 and 255 then
    raise exception 'webhook event fields have an invalid length' using errcode = 'P0001';
  end if;
  if p_event ? 'active' and jsonb_typeof(p_event -> 'active') <> 'boolean' then
    raise exception 'active must be a boolean' using errcode = 'P0001';
  end if;
  if p_event ? 'timestampMs' and jsonb_typeof(p_event -> 'timestampMs') <> 'number' then
    raise exception 'timestampMs must be a number' using errcode = 'P0001';
  end if;
  return public.apply_webhook_event(p_event);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: EXECUTE only where the boundary says so
-- ---------------------------------------------------------------------------
revoke all on function public.apply_webhook_event(jsonb) from public, coachcal_api;

revoke all on function public.auth_user_json(uuid) from public, coachcal_api;

revoke all on function public.auth_sign_in_identity(text, text, text, boolean) from public, coachcal_api;
revoke all on function public.auth_apple_token_store(text) from public, coachcal_api;
revoke all on function public.auth_password_lookup(text) from public, coachcal_api;
revoke all on function public.auth_user_get(uuid) from public, coachcal_api;
revoke all on function public.auth_otp_issue(text, text, integer) from public, coachcal_api;
revoke all on function public.auth_otp_verify(text, text) from public, coachcal_api;
revoke all on function public.auth_session_create(uuid, text, integer) from public, coachcal_api;
revoke all on function public.auth_session_active(uuid, uuid) from public, coachcal_api;
revoke all on function public.auth_session_rotate(uuid, text, text, integer) from public, coachcal_api;
revoke all on function public.auth_session_revoke(uuid) from public, coachcal_api;
revoke all on function public.auth_one_time_issue(text, uuid, integer) from public, coachcal_api;
revoke all on function public.auth_one_time_consume(text) from public, coachcal_api;
revoke all on function public.account_delete() from public, coachcal_api;
revoke all on function public.sync_records_get(uuid[]) from public, coachcal_api;
revoke all on function public.sync_ops_seen(uuid[]) from public, coachcal_api;
revoke all on function public.webhook_apply(jsonb) from public, coachcal_api;

grant execute on function public.auth_sign_in_identity(text, text, text, boolean) to coachcal_api;
grant execute on function public.auth_apple_token_store(text) to coachcal_api;
grant execute on function public.auth_password_lookup(text) to coachcal_api;
grant execute on function public.auth_user_get(uuid) to coachcal_api;
grant execute on function public.auth_otp_issue(text, text, integer) to coachcal_api;
grant execute on function public.auth_otp_verify(text, text) to coachcal_api;
grant execute on function public.auth_session_create(uuid, text, integer) to coachcal_api;
grant execute on function public.auth_session_active(uuid, uuid) to coachcal_api;
grant execute on function public.auth_session_rotate(uuid, text, text, integer) to coachcal_api;
grant execute on function public.auth_session_revoke(uuid) to coachcal_api;
grant execute on function public.auth_one_time_issue(text, uuid, integer) to coachcal_api;
grant execute on function public.auth_one_time_consume(text) to coachcal_api;
grant execute on function public.account_delete() to coachcal_api;
grant execute on function public.sync_records_get(uuid[]) to coachcal_api;
grant execute on function public.sync_ops_seen(uuid[]) to coachcal_api;
grant execute on function public.webhook_apply(jsonb) to coachcal_api;
