/**
 * The flags that survive a relaunch. The Swift app keeps them in `UserDefaults`; RN keeps them in the
 * `app_settings` table under the same keys, as the text `'1'` or `'0'`. The settings toggle (U-41)
 * writes the same key; do not rename it.
 */
import { inArray } from 'drizzle-orm';

import { appSettings } from '../data/db/schema';
import { readAppSetting, writeAppSetting } from '../data/repos/engagementRepository';
import type { SqlDb } from '../data/repos/sqlDb';

/** `AppEnvironment.edSafeDefaultsKey`. */
export const ED_SAFE_SETTING_KEY = 'edSafeMode';
/** `HealthKitSettingsKey.burnAddBackEnabled`. */
export const BURN_ADD_BACK_SETTING_KEY = 'burnAddBackEnabled';

/** What `UserDefaults.standard.bool(forKey:)` answers: true only for the stored `'1'`. */
export async function readStoredEdSafe(db: SqlDb): Promise<boolean> {
  return (await readAppSetting(db, ED_SAFE_SETTING_KEY)) === '1';
}

export async function writeStoredEdSafe(db: SqlDb, value: boolean): Promise<void> {
  await writeAppSetting(db, ED_SAFE_SETTING_KEY, value ? '1' : '0');
}

/** Account reset: `removeObject(forKey:)` for the ED-safe and the burn add-back keys. */
export async function clearStoredFlags(db: SqlDb): Promise<void> {
  await db.delete(appSettings).where(inArray(appSettings.key, [ED_SAFE_SETTING_KEY, BURN_ADD_BACK_SETTING_KEY]));
}
