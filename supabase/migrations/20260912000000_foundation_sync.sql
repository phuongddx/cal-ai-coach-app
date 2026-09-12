-- Plan 01-03: foundation sync mirror, immutable ledger, RPC-only grants,
-- defense-in-depth RLS, and hardened SECURITY DEFINER sync RPCs.
--
-- Boundary: clients hold NO table privileges. Every durable server write goes
-- through public.sync_push(jsonb) / public.sync_pull(bigint), which derive the
-- owner from auth.uid(), run with SET search_path = '', and schema-qualify
-- every relation.

-- ---------------------------------------------------------------------------
-- Canonical version sequence (server-owned acceptance order)
-- ---------------------------------------------------------------------------
create sequence if not exists public.diary_entry_version_seq as bigint start 1;

-- ---------------------------------------------------------------------------
-- Mirror: diary_entries (mirrors local src/db/schema.ts diaryEntries)
-- ---------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id uuid primary key,
  user_id uuid not null,
  display_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_version bigint not null default 0,
  accepted_op_id uuid,
  server_updated_at timestamptz not null default now()
);

create index if not exists diary_entries_user_version_idx
  on public.diary_entries (user_id, server_version);

-- ---------------------------------------------------------------------------
-- Immutable operation ledger: first acknowledgement per (user_id, op_id)
-- ---------------------------------------------------------------------------
create table if not exists public.sync_operations (
  user_id uuid not null,
  op_id uuid not null,
  table_name text not null,
  record_id uuid not null,
  kind text not null,
  ack jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, op_id)
);

create index if not exists sync_operations_user_record_idx
  on public.sync_operations (user_id, record_id);

-- ---------------------------------------------------------------------------
-- RLS: defense in depth (revokes below are the real boundary)
-- ---------------------------------------------------------------------------
alter table public.diary_entries enable row level security;
alter table public.sync_operations enable row level security;

drop policy if exists "owner reads mirror" on public.diary_entries;
create policy "owner reads mirror" on public.diary_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owner writes mirror" on public.diary_entries;
create policy "owner writes mirror" on public.diary_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "owner reads ledger" on public.sync_operations;
create policy "owner reads ledger" on public.sync_operations
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privileges: NO client table access; EXECUTE only for authenticated
-- ---------------------------------------------------------------------------
revoke all on public.diary_entries from anon, authenticated;
revoke all on public.sync_operations from anon, authenticated;
revoke all on public.diary_entry_version_seq from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hardened SECURITY DEFINER sync RPCs
-- ---------------------------------------------------------------------------
create or replace function public.sync_push(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_op jsonb;
  v_op_id uuid;
  v_record_id uuid;
  v_kind text;
  v_snapshot jsonb;
  v_existing jsonb;
  v_version bigint;
  v_i integer;
  v_result jsonb := jsonb_build_array();
  v_row_server_version bigint;
  v_row_accepted_op_id uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'sync_push requires an authenticated user' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'sync_push expects a non-empty operation array' using errcode = 'P0001';
  end if;

  for v_i in 0 .. jsonb_array_length(p_ops) - 1 loop
    v_op := p_ops -> v_i;
    -- Envelope validation: fixed Phase 1 vocabulary, no dynamic SQL.
    if v_op->>'opId' is null or v_op->>'table' is null or v_op->>'recordId' is null
       or v_op->>'kind' is null or v_op->>'snapshot' is null
       or v_op->>'clientTimestamp' is null then
      raise exception 'operation envelope is missing required fields' using errcode = 'P0001';
    end if;
    begin
      v_op_id := (v_op->>'opId')::uuid;
      v_record_id := (v_op->>'recordId')::uuid;
    exception when others then
      raise exception 'operation identifiers must be valid UUIDs' using errcode = 'P0001';
    end;
    if v_op->>'table' <> 'diary_entries' then
      raise exception 'unsupported sync table' using errcode = 'P0001';
    end if;
    v_kind := v_op->>'kind';
    if v_kind not in ('upsert', 'tombstone') then
      raise exception 'unsupported mutation kind' using errcode = 'P0001';
    end if;
    if (v_op->'snapshot'->>'id')::uuid is distinct from v_record_id then
      raise exception 'snapshot id must match recordId' using errcode = 'P0001';
    end if;
    v_snapshot := v_op->'snapshot';

    -- Ownership: an op aimed at a record owned by someone else is rejected
    -- before any ledger or mirror mutation (plan behavior for hostile push).
    if exists (
      select 1 from public.diary_entries d
       where d.id = v_record_id and d.user_id <> v_owner
    ) then
      raise exception 'operation targets a record owned by another user'
        using errcode = '42501';
    end if;

    -- Idempotency: first acknowledgement wins, forever.
    select ack into v_existing
      from public.sync_operations
     where user_id = v_owner and op_id = v_op_id;
    if v_existing is not null then
      v_result := v_result || jsonb_build_array(
        jsonb_set(v_existing, '{duplicate}', 'true'));
      continue;
    end if;

    -- Canonical acceptance order is assigned once, centrally.
    v_version := nextval('public.diary_entry_version_seq');

    insert into public.sync_operations (user_id, op_id, table_name, record_id, kind, ack)
    values (v_owner, v_op_id, 'diary_entries', v_record_id, v_kind,
            jsonb_build_object(
              'opId', v_op_id,
              'serverVersion', v_version,
              'acceptedOpId', v_op_id,
              'duplicate', false));

    -- LWW apply guard: apply only if the canonical version is newer.
    select server_version, accepted_op_id
      into v_row_server_version, v_row_accepted_op_id
      from public.diary_entries
     where id = v_record_id and user_id = v_owner;
    if v_row_server_version is null then
      insert into public.diary_entries (id, user_id, display_text, deleted_at,
                                        server_version, accepted_op_id, server_updated_at)
      values (v_record_id, v_owner, v_snapshot->>'displayText',
              (v_snapshot->>'deletedAt')::timestamptz,
              v_version, v_op_id, now());
    elsif v_version > v_row_server_version
       or (v_version = v_row_server_version and v_op_id > coalesce(v_row_accepted_op_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
      update public.diary_entries
         set display_text = v_snapshot->>'displayText',
             deleted_at = (v_snapshot->>'deletedAt')::timestamptz,
             server_version = v_version,
             accepted_op_id = v_op_id,
             updated_at = now(),
             server_updated_at = now()
       where id = v_record_id and user_id = v_owner;
    end if;
    -- Losing operations keep their immutable ack; the mirror keeps the winner.

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'opId', v_op_id,
        'serverVersion', v_version,
        'acceptedOpId', v_op_id,
        'duplicate', false));
  end loop;

  return jsonb_build_object('accepted', v_result);
end;
$$;

create or replace function public.sync_pull(p_cursor bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_rows jsonb;
  v_max_version bigint;
  v_cursor bigint := coalesce(p_cursor, 0);
begin
  v_owner := auth.uid();
  if v_owner is null then
    raise exception 'sync_pull requires an authenticated user' using errcode = '42501';
  end if;
  if v_cursor < 0 then
    raise exception 'cursor must be non-negative' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'table', 'diary_entries',
           'recordId', d.id,
           'snapshot', jsonb_build_object(
             'id', d.id,
             'displayText', d.display_text,
             'deletedAt', d.deleted_at,
             'serverVersion', d.server_version,
             'acceptedOpId', d.accepted_op_id)
         ) order by d.server_version, d.accepted_op_id), '[]'::jsonb)
    into v_rows
    from public.diary_entries d
   where d.user_id = v_owner
     and d.server_version > v_cursor;

  select max(server_version) into v_max_version
    from public.diary_entries
   where user_id = v_owner and server_version > v_cursor;

  return jsonb_build_object(
    'rows', v_rows,
    'cursor', coalesce(v_max_version, v_cursor));
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon, authenticated;
revoke all on function public.sync_pull(bigint) from public, anon, authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(bigint) to authenticated;
