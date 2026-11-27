/**
 * The settings deletion entry against the real store (the U-41 rework): the
 * confirmed destructive action must keep the promise its dialog makes — "this
 * permanently deletes your data on this device". The chain is the model's
 * (server cascade → full local reset → sign-out, standing-order 19 shape) with
 * the route's real binding: the platform's full local reset with
 * `deleteRemote: false` (`environment.resetLocalData`, the PR-22 flow — every
 * table, both stored flags, the widget and the root gate), proven over a real
 * migrated SQLite (sql.js) holding a row in every one of the fifteen tables.
 *
 * The route's binding mirrors `apps/mobile/src/app/settings.tsx`; the doubles
 * stand in for the native-only seams (the API call, the widget publish), as
 * `src/platform/accountReset.test.ts` does for the same steps.
 */
import * as SecureStore from 'expo-secure-store';
import { sql } from 'drizzle-orm';

import { createSessionStore, SESSION_STORAGE_KEY } from '../../data/auth';
import type { Session } from '../../data/auth/types';
import { readAppSetting, writeAppSetting } from '../../data/repos/engagementRepository';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import type { SqlDb } from '../../data/repos/sqlDb';
import { createRepoFixture } from '../../data/repos/testing/fixtures';
import { createSqliteSyncStore } from '../../data/sync/store.sqlite';
import { deleteAllRows, listUserTables, resetAccount } from '../../platform/accountReset';
import { BURN_ADD_BACK_SETTING_KEY, ED_SAFE_SETTING_KEY, clearStoredFlags } from '../../platform/storedFlags';

import { createSettingsModel, type SettingsModelDeps } from './settingsModel';

const SESSION: Session = {
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: '2026-11-27T16:50:00.000Z' },
};

/** One row in every one of the fifteen tables, with the minimal columns. */
async function seedEveryTable(db: SqlDb): Promise<void> {
  const inserts = [
    `INSERT INTO diary_entries (id, user_id, display_text) VALUES ('e1', '${DEMO_USER_ID}', 'Lunch')`,
    `INSERT INTO pending_ops (op_id, table_name, record_id, kind, snapshot, client_timestamp)
       VALUES ('op1', 'diary_entries', 'e1', 'upsert', '{}', '2026-11-27T09:00:00.000Z')`,
    // The single-row tables come seeded by the migrations; replace to hold a
    // non-default value (the cursor 7 proves the reset rewinds it to 0).
    `INSERT OR REPLACE INTO sync_state (id, pull_cursor) VALUES (1, 7)`,
    `INSERT INTO user_targets (id, user_id, daily_kcal, protein_g, carbs_g, fat_g, fiber_goal_g, sex, activity, goal, updated_at)
       VALUES ('t1', '${DEMO_USER_ID}', 2000, 150, 200, 67, 30, 'female', 'moderate', 'lose', '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO diary_entry_details (entry_id, meal_slot, title) VALUES ('e1', 'lunch', 'Lunch')`,
    `INSERT INTO foods (id, name, per100g_kcal, protein_g, carbs_g, fat_g, fiber_g, created_at)
       VALUES ('f1', 'Rice', 130, 2.7, 28, 0.3, 0.4, '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO saved_meals (id, user_id, name, kcal, items_json, created_at)
       VALUES ('s1', '${DEMO_USER_ID}', 'Pho', 420, '[]', '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO custom_foods (id, user_id, name, basis, kcal, protein_g, carbs_g, fat_g, fiber_g, created_at)
       VALUES ('c1', '${DEMO_USER_ID}', 'Grandma soup', 'per100g', 80, 3, 9, 2, 1, '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO water_logs (id, user_id, day, ml, created_at)
       VALUES ('w1', '${DEMO_USER_ID}', '2026-11-27', 500, '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO weight_logs (id, user_id, day, kg, created_at)
       VALUES ('wg1', '${DEMO_USER_ID}', '2026-11-27', 70.5, '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO exercise_logs (id, user_id, day, exercise_type, duration_min, created_at)
       VALUES ('x1', '${DEMO_USER_ID}', '2026-11-27', 'run', 30, '2026-11-27T09:00:00.000Z')`,
    `INSERT OR REPLACE INTO streak_state (id) VALUES (1)`,
    `INSERT INTO badges (id, user_id, code, label) VALUES ('b1', '${DEMO_USER_ID}', 'first_day', 'First day')`,
    `INSERT INTO insights (id, user_id, day, kind, title, body, created_at)
       VALUES ('i1', '${DEMO_USER_ID}', '2026-11-27', 'weekly', 'Week', 'Steady.', '2026-11-27T09:00:00.000Z')`,
    `INSERT INTO app_settings (key, value) VALUES ('${ED_SAFE_SETTING_KEY}', '1')`,
    `INSERT INTO app_settings (key, value) VALUES ('${BURN_ADD_BACK_SETTING_KEY}', '1')`,
    `INSERT INTO app_settings (key, value) VALUES ('unrelatedSetting', 'kept?')`,
  ];
  for (const statement of inserts) {
    await db.run(sql.raw(statement));
  }
}

describe('the settings deletion entry (the route binding)', () => {
  it('empties every one of the fifteen tables, removes both stored flags and forgets the session', async () => {
    const fixture = await createRepoFixture();
    const { db } = fixture;
    await seedEveryTable(db);

    // Before: every user table holds a row (the store is the worst case).
    const countOf = async (table: string): Promise<number> =>
      Number(fixture.client.exec(`SELECT COUNT(*) FROM "${table}"`)[0]?.values[0]?.[0] ?? 0);
    const tables = await listUserTables(db);
    expect(tables).toHaveLength(15);
    for (const table of tables) {
      expect(await countOf(table)).toBeGreaterThan(0);
    }
    expect(await readAppSetting(db, ED_SAFE_SETTING_KEY)).toBe('1');

    const store = createSessionStore({ refreshSession: async () => SESSION });
    await store.setSession(SESSION);
    const syncStore = createSqliteSyncStore(db, { ownerId: () => SESSION.user.id });
    expect(await SecureStore.getItemAsync(SESSION_STORAGE_KEY)).not.toBeNull();

    // The route's binding (app/settings.tsx): the design flag and the full
    // local reset come from the platform; the API call and the widget are the
    // native seams this environment replaces with doubles.
    let designFlag = true;
    const order: string[] = [];
    const model = createSettingsModel({
      ownerId: DEMO_USER_ID,
      policyStorageKey: ED_SAFE_SETTING_KEY,
      burnAddBackStorageKey: BURN_ADD_BACK_SETTING_KEY,
      initialPolicyOn: true,
      applyPolicyFlag: (on) => {
        designFlag = on;
      },
      writeSetting: async (key, value) => {
        await writeAppSetting(db, key, value);
      },
      readSetting: async (key) => readAppSetting(db, key),
      deleteAccount: async () => {
        order.push('remote');
      },
      resetLocalData: async () => {
        order.push('localReset');
        await resetAccount(
          {
            deleteRemoteAccount: async () => undefined,
            clearSession: () => store.clear(),
            clearStoredFlags: () => clearStoredFlags(db),
            setEdSafeMode: (value) => {
              designFlag = value;
            },
            clearLocalRows: async () => {
              await deleteAllRows(db);
              await syncStore.reset();
            },
            clearWidgetSnapshot: () => undefined,
            onReset: () => {
              order.push('gate');
            },
          },
          { deleteRemote: false },
        );
      },
      signOut: async () => {
        order.push('signOut');
      },
      csvExportAction: async () => '# user_targets\nid\n',
    });

    await model.resetAccount();

    // The chain keeps the model's proven order: remote → full local reset (the
    // root gate is its last step) → sign-out.
    expect(order).toEqual(['remote', 'localReset', 'gate', 'signOut']);

    // After: no rows in any table but the cursor row the sync engine expects
    // (`sync_state` id 1 at cursor 0, written back by the sync store's reset),
    // both stored flags gone, every app_settings row gone with them.
    for (const table of tables) {
      expect(await countOf(table)).toBe(table === 'sync_state' ? 1 : 0);
    }
    expect(await countOf('sync_state')).toBe(1);
    expect(await syncStore.cursor()).toBe(0);
    expect(await readAppSetting(db, ED_SAFE_SETTING_KEY)).toBeNull();
    expect(await readAppSetting(db, BURN_ADD_BACK_SETTING_KEY)).toBeNull();
    expect(await readAppSetting(db, 'unrelatedSetting')).toBeNull();
    expect(designFlag).toBe(false);
    expect(model.wellnessPolicyOn).toBe(false);
    expect(model.burnAddBackOn).toBe(false);
    expect(store.getSession()).toBeNull();
    expect(await SecureStore.getItemAsync(SESSION_STORAGE_KEY)).toBeNull();
  });
});
