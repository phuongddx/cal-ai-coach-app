import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../delete-account/index.ts';
import { stackEnv } from './_env.ts';

// Direct handler invocation, same pattern as analyze-food.e2e.test.ts: drive
// the exported handler with real Requests against the local stack rather
// than booting a live Deno.serve process.
const { url, anonKey, serviceRoleKey } = stackEnv();

let serviceClient: SupabaseClient | null = null;

function service(): SupabaseClient {
  if (serviceClient) return serviceClient;
  serviceClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return serviceClient;
}

interface TestUser {
  id: string;
  accessToken: string;
}

async function createSignedInUser(): Promise<TestUser> {
  const email = `delacct-${crypto.randomUUID()}@coachcal.test`;
  const password = `Pw-${crypto.randomUUID()}A1!`;
  const { data: created, error: createError } = await service().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw createError ?? new Error('createUser returned no user');

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw signInError ?? new Error('sign-in returned no session');

  return { id: created.user.id, accessToken: signIn.session.access_token };
}

function deleteRequest(accessToken?: string, body?: unknown): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const CASCADE_TABLES = ['diary_entries', 'sync_operations', 'scan_items', 'scans', 'scan_usage'] as const;

async function seedRows(userId: string): Promise<void> {
  const db = service();
  const scanId = crypto.randomUUID();
  const per100g = { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, fiberG: 1 };

  const inserts = [
    db.from('diary_entries').insert({ id: crypto.randomUUID(), user_id: userId, display_text: 'test entry' }),
    db.from('sync_operations').insert({
      user_id: userId,
      op_id: crypto.randomUUID(),
      table_name: 'diary_entries',
      record_id: crypto.randomUUID(),
      kind: 'upsert',
      ack: { opId: crypto.randomUUID(), serverVersion: 1, acceptedOpId: crypto.randomUUID(), duplicate: false },
    }),
    db.from('scans').insert({ id: scanId, user_id: userId, kind: 'photo' }),
    db.from('scan_usage').insert({ user_id: userId, scan_id: crypto.randomUUID() }),
    db.from('entitlements').insert({
      app_user_id: `app-${userId}`,
      entitlement_id: 'premium',
      supabase_user_id: userId,
      active: true,
    }),
  ];
  for (const insert of inserts) {
    const { error } = await insert;
    if (error) throw error;
  }
  // scan_items has an FK on (user_id, scan_id) referencing scans — must
  // insert after the parent scans row lands.
  const { error: itemError } = await db.from('scan_items').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    scan_id: scanId,
    label: 'item',
    grams: 100,
    per100g,
    kcal: 100,
    macros: {},
  });
  if (itemError) throw itemError;
}

async function rowCounts(userId: string): Promise<Record<string, number>> {
  const db = service();
  const counts: Record<string, number> = {};
  for (const table of CASCADE_TABLES) {
    const { count } = await db
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    counts[table] = count ?? 0;
  }
  const { count: entitlementCount } = await db
    .from('entitlements')
    .select('*', { count: 'exact', head: true })
    .eq('supabase_user_id', userId);
  counts.entitlements = entitlementCount ?? 0;
  return counts;
}

async function forceCleanup(userId: string): Promise<void> {
  const db = service();
  for (const table of CASCADE_TABLES) {
    await db.from(table).delete().eq('user_id', userId);
  }
  await db.from('entitlements').delete().eq('supabase_user_id', userId);
  await db.auth.admin.deleteUser(userId);
}

Deno.test('handler: own-account deletion purges all six tables then deletes the auth user last', async () => {
  const user = await createSignedInUser();
  await seedRows(user.id);

  const before = await rowCounts(user.id);
  assert(Object.values(before).every((n) => n > 0), 'seed must land in every table');

  const response = await handler(deleteRequest(user.accessToken));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { deleted: true });

  const after = await rowCounts(user.id);
  assert(Object.values(after).every((n) => n === 0), 'every row must be gone');

  const { data: lookup } = await service().auth.admin.getUserById(user.id);
  assertEquals(lookup.user, null, 'the auth user itself must be deleted');
});

Deno.test('handler: an unauthenticated request is rejected with zero writes', async () => {
  const user = await createSignedInUser();
  await seedRows(user.id);
  try {
    const response = await handler(deleteRequest(undefined));
    assertEquals(response.status, 401);

    const after = await rowCounts(user.id);
    assert(Object.values(after).every((n) => n > 0), 'nothing is deleted without a valid session');
  } finally {
    await forceCleanup(user.id);
  }
});

Deno.test('handler: a forged target uid in the body is ignored — only the caller is deleted', async () => {
  const caller = await createSignedInUser();
  const victim = await createSignedInUser();
  await seedRows(caller.id);
  await seedRows(victim.id);
  try {
    const response = await handler(deleteRequest(caller.accessToken, { userId: victim.id }));
    assertEquals(response.status, 200);

    const callerAfter = await rowCounts(caller.id);
    assert(Object.values(callerAfter).every((n) => n === 0), "the caller's own rows are purged");

    const victimAfter = await rowCounts(victim.id);
    assert(Object.values(victimAfter).every((n) => n > 0), 'the victim account is untouched');

    const { data: victimLookup } = await service().auth.admin.getUserById(victim.id);
    assert(victimLookup.user !== null, 'the victim account must still exist');
  } finally {
    await forceCleanup(victim.id);
  }
});
