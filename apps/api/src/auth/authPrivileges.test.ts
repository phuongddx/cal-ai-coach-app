import { describeSql } from '../testing/sqlHarness';

// Invariant I2 for the account tables: the API role (coachcal_api) holds no privilege on them and
// reaches them only through the SECURITY DEFINER functions.
const AUTH_TABLES = [
  'users',
  'auth_identities',
  'auth_sessions',
  'auth_otp_codes',
  'auth_one_time_codes',
] as const;

async function sqlState(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}

describeSql('account tables and functions as coachcal_api (SQL-backed)', (harness) => {
  it.each(AUTH_TABLES)('coachcal_api cannot SELECT directly from %s', async (table) => {
    const h = harness();
    const { userId } = await h.newUser();
    const state = await sqlState(
      h.db.withUser(userId, (query) => query(`SELECT * FROM public.${table} LIMIT 1`)),
    );
    expect(state).toBe('42501'); // insufficient_privilege
  });

  it.each(AUTH_TABLES)('coachcal_api cannot write to %s directly', async (table) => {
    const h = harness();
    const { userId } = await h.newUser();
    expect(
      await sqlState(h.db.withUser(userId, (query) => query(`DELETE FROM public.${table}`))),
    ).toBe('42501');
    expect(
      await sqlState(
        h.db.withUser(userId, (query) => query(`UPDATE public.${table} SET created_at = now()`)),
      ),
    ).toBe('42501');
  });

  it('apply_webhook_event is not executable by coachcal_api; webhook_apply is', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const direct = await sqlState(
      h.db.withUser(userId, (query) =>
        query('SELECT public.apply_webhook_event($1::jsonb)', [
          { eventId: 'x', appUserId: 'x', entitlementId: 'x' },
        ]),
      ),
    );
    expect(direct).toBe('42501');
    const [row] = await h.owner<{ ok: boolean }[]>`
      SELECT has_function_privilege('coachcal_api', 'public.webhook_apply(jsonb)', 'EXECUTE') AS ok`;
    expect(row?.ok).toBe(true);
  });

  it('the internal user-shape helper is not executable by coachcal_api', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const state = await sqlState(
      h.db.withUser(userId, (query) =>
        query('SELECT public.auth_user_json($1::uuid)', [crypto.randomUUID()]),
      ),
    );
    expect(state).toBe('42501');
  });

  it('webhook_apply validates its input before anything is written', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const bad: unknown[] = [
      [],
      { eventId: 'e', appUserId: 'a' },
      { eventId: 'e', appUserId: 'a', entitlementId: 'p', surprise: 1 },
      { eventId: 'e', appUserId: 'a', entitlementId: 'p', active: 'yes' },
      { eventId: 'e', appUserId: 'a', entitlementId: 'p', timestampMs: 'soon' },
      { eventId: '', appUserId: 'a', entitlementId: 'p' },
    ];
    for (const payload of bad) {
      const state = await sqlState(
        h.db.withUser(userId, (query) => query('SELECT public.webhook_apply($1::jsonb)', [payload])),
      );
      expect(state).toBe('P0001');
    }
  });

  it('account_delete and the session writers need an authenticated user', async () => {
    const h = harness();
    const none = '';
    expect(
      await sqlState(h.db.withUser(none, (query) => query('SELECT public.account_delete()'))),
    ).toBe('42501');
    expect(
      await sqlState(
        h.db.withUser(none, (query) =>
          query('SELECT public.auth_session_revoke($1::uuid)', [crypto.randomUUID()]),
        ),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        h.db.withUser(none, (query) => query('SELECT public.sync_records_get($1::uuid[])', [[]])),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        h.db.withUser(none, (query) => query('SELECT public.sync_ops_seen($1::uuid[])', [[]])),
      ),
    ).toBe('42501');
  });
});
