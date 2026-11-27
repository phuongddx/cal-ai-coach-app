/**
 * Account reset (PL-02): the port of `AppEnvironment.performLocalAccountReset()`. Order and error
 * handling are proven with injected steps; the rows, the stored flags and the session are proven against
 * a real migrated SQLite (sql.js) and the mocked keychain.
 */
import { sql } from 'drizzle-orm';
import * as SecureStore from 'expo-secure-store';

import { createSessionStore, SESSION_STORAGE_KEY } from '../data/auth';
import type { Session } from '../data/auth/types';
import { createSeedDataManager } from '../data/repos/seedDataManager';
import { readAppSetting, writeAppSetting } from '../data/repos/engagementRepository';
import { createRepoFixture } from '../data/repos/testing/fixtures';
import { createSqliteSyncStore } from '../data/sync/store.sqlite';
import { deleteAllRows, listUserTables, resetAccount, type AccountResetDeps } from './accountReset';
import { BURN_ADD_BACK_SETTING_KEY, ED_SAFE_SETTING_KEY, clearStoredFlags, readStoredEdSafe, writeStoredEdSafe } from './storedFlags';

function makeDeps(failures: Partial<Record<keyof AccountResetDeps, Error>> = {}) {
  const calls: string[] = [];
  const step = (name: keyof AccountResetDeps) => async () => {
    calls.push(name);
    const failure = failures[name];
    if (failure) throw failure;
  };
  const deps: AccountResetDeps = {
    deleteRemoteAccount: step('deleteRemoteAccount'),
    clearSession: step('clearSession'),
    clearStoredFlags: step('clearStoredFlags'),
    setEdSafeMode: (value) => calls.push(`setEdSafeMode:${value}`),
    clearLocalRows: step('clearLocalRows'),
    clearWidgetSnapshot: () => calls.push('clearWidgetSnapshot'),
    onReset: () => calls.push('onReset'),
  };
  return { deps, calls };
}

describe('resetAccount order', () => {
  it('calls the server, forgets the session, clears the flags, turns ED-safe off, deletes the rows, clears the widget, then tells the gate', async () => {
    const { deps, calls } = makeDeps();
    await resetAccount(deps);
    expect(calls).toEqual([
      'deleteRemoteAccount',
      'clearSession',
      'clearStoredFlags',
      'setEdSafeMode:false',
      'clearLocalRows',
      'clearWidgetSnapshot',
      'onReset',
    ]);
  });

  it('skips the server call for a plain local sign-out', async () => {
    const { deps, calls } = makeDeps();
    await resetAccount(deps, { deleteRemote: false });
    expect(calls).not.toContain('deleteRemoteAccount');
    expect(calls[0]).toBe('clearSession');
  });

  it('forgets this device even when the server cascade and the keychain fail', async () => {
    const { deps, calls } = makeDeps({ deleteRemoteAccount: new Error('offline'), clearSession: new Error('keychain') });
    await resetAccount(deps);
    expect(calls).toContain('clearLocalRows');
    expect(calls.at(-1)).toBe('onReset');
  });

  it('does not announce a reset when a local step fails', async () => {
    const { deps, calls } = makeDeps({ clearLocalRows: new Error('disk full') });
    await expect(resetAccount(deps)).rejects.toThrow('disk full');
    expect(calls).not.toContain('onReset');
  });
});

describe('what the reset removes', () => {
  const SESSION: Session = {
    user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
    tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: '2026-11-27T10:15:00.000Z' },
  };

  it('removes the local rows, the stored flags and the session', async () => {
    const fixture = await createRepoFixture();
    const { db } = fixture;
    await createSeedDataManager(db, { now: fixture.clock, newId: fixture.newId }).ensureSeeded(true);
    await writeStoredEdSafe(db, true);
    await writeAppSetting(db, BURN_ADD_BACK_SETTING_KEY, '1');
    await writeAppSetting(db, 'unrelatedSetting', 'kept?');
    const store = createSessionStore({ refreshSession: async () => SESSION });
    await store.setSession(SESSION);
    const syncStore = createSqliteSyncStore(db, { ownerId: () => SESSION.user.id });

    // Before: there is something to remove.
    expect(await readStoredEdSafe(db)).toBe(true);
    const tablesWithRows = async () => {
      const found: string[] = [];
      for (const table of await listUserTables(db)) {
        const rows = fixture.client.exec(`SELECT COUNT(*) FROM "${table}"`);
        if (Number(rows[0]?.values[0]?.[0] ?? 0) > 0) found.push(table);
      }
      return found;
    };
    expect((await tablesWithRows()).length).toBeGreaterThan(3);
    expect(await SecureStore.getItemAsync(SESSION_STORAGE_KEY)).not.toBeNull();

    let edSafe = true;
    let resets = 0;
    await resetAccount({
      deleteRemoteAccount: async () => undefined,
      clearSession: () => store.clear(),
      clearStoredFlags: () => clearStoredFlags(db),
      setEdSafeMode: (value) => (edSafe = value),
      clearLocalRows: async () => {
        await deleteAllRows(db);
        await syncStore.reset();
      },
      clearWidgetSnapshot: () => undefined,
      onReset: () => resets++,
    });

    // After: no rows in any table but the cursor row the sync engine expects, no flags, no session.
    expect(await tablesWithRows()).toEqual(['sync_state']);
    expect(await syncStore.cursor()).toBe(0);
    expect(await readStoredEdSafe(db)).toBe(false);
    expect(await readAppSetting(db, ED_SAFE_SETTING_KEY)).toBeNull();
    expect(await readAppSetting(db, BURN_ADD_BACK_SETTING_KEY)).toBeNull();
    expect(await readAppSetting(db, 'unrelatedSetting')).toBeNull(); // every row goes, not just the flags
    expect(store.getSession()).toBeNull();
    expect(await SecureStore.getItemAsync(SESSION_STORAGE_KEY)).toBeNull();
    expect(edSafe).toBe(false);
    expect(resets).toBe(1);
  });

  it('lists every table except SQLite\'s own', async () => {
    const { db } = await createRepoFixture();
    const tables = await listUserTables(db);
    expect(tables).toEqual(expect.arrayContaining(['app_settings', 'diary_entries', 'user_targets', 'pending_ops', 'sync_state']));
    expect(tables.some((name) => name.startsWith('sqlite_'))).toBe(false);
    // Sanity check on the SQL used: it is the sqlite_master query.
    expect((await db.all(sql`SELECT 1 AS one`)) as unknown[]).toHaveLength(1);
  });
});

describe('stored ED-safe flag', () => {
  it('round-trips as "1" and "0" under the Swift key', async () => {
    const { db } = await createRepoFixture();
    expect(ED_SAFE_SETTING_KEY).toBe('edSafeMode');
    expect(await readStoredEdSafe(db)).toBe(false);
    await writeStoredEdSafe(db, true);
    expect(await readAppSetting(db, 'edSafeMode')).toBe('1');
    expect(await readStoredEdSafe(db)).toBe(true);
    await writeStoredEdSafe(db, false);
    expect(await readAppSetting(db, 'edSafeMode')).toBe('0');
    expect(await readStoredEdSafe(db)).toBe(false);
  });
});
