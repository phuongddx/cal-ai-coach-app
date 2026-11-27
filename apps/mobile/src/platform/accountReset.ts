/**
 * Account reset (PL-02): the port of `AppEnvironment.performLocalAccountReset()`.
 *
 * Swift, in order: best-effort `accountDeletionTransport.deleteAccount()`; `authSessionStore.signOut()`
 * (best effort, and unconditional, so a surviving keychain session cannot re-authenticate on the next
 * launch); clear `authSession`; remove the ED-safe and burn add-back defaults and set the ED-safe mode
 * off; delete every row of every table except the migration bookkeeping; clear the widget snapshot;
 * `hasTargets = false` and `onboardingPending = false`.
 *
 * Every step is an injected dependency so Jest proves each one and their order. The remote call and the
 * session clear never stop the reset: "this device forgets you" holds even when the server needs a retry.
 * A failure of a local step (the rows, the flags) is not swallowed: the caller must not announce a reset
 * that did not happen.
 */
import { sql } from 'drizzle-orm';

import { inTransaction, type SqlDb } from '../data/repos/sqlDb';

export type AccountResetDeps = {
  /** `DELETE /v1/account` over the signed-in session. Only called when the reset deletes the account. */
  deleteRemoteAccount: () => Promise<void>;
  /** Forget the session in memory and in the keychain. */
  clearSession: () => Promise<void>;
  /** Remove the stored ED-safe and burn add-back flags. */
  clearStoredFlags: () => Promise<void>;
  /** Turn the in-memory ED-safe mode off. */
  setEdSafeMode: (value: boolean) => void;
  /** Delete every local row: the sync store's `reset()` and every other table. */
  clearLocalRows: () => Promise<void>;
  /** Replace the App Group widget snapshot with the placeholder. */
  clearWidgetSnapshot: () => void;
  /** Tell the root gate: no target, no pending onboarding, no session. */
  onReset: () => void;
};

export type AccountResetOptions = {
  /** True for "Delete account" (Swift always calls the server first); false for a plain local sign-out. Default true. */
  deleteRemote?: boolean;
};

export async function resetAccount(deps: AccountResetDeps, options: AccountResetOptions = {}): Promise<void> {
  const deleteRemote = options.deleteRemote ?? true;
  if (deleteRemote) {
    // `try?`: a cascade failure (offline, already deleted) must never skip the sign-out.
    await deps.deleteRemoteAccount().catch(() => undefined);
  }
  // `try?`: the keychain error must not keep the local rows on the device.
  await deps.clearSession().catch(() => undefined);
  await deps.clearStoredFlags();
  deps.setEdSafeMode(false);
  await deps.clearLocalRows();
  deps.clearWidgetSnapshot();
  deps.onReset();
}

/** Every table a reset empties: all of them except SQLite's own (`sqlite_%`). The migrations are tracked in `user_version`, not in a table. */
export async function listUserTables(db: SqlDb): Promise<string[]> {
  const rows = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )) as Array<{ name: string } | [string]>;
  return rows.map((row) => (Array.isArray(row) ? row[0] : row.name));
}

/**
 * `DELETE FROM <table>` for every table, in one transaction. The sync store's `reset()` runs after it
 * because it also writes the cursor row back (`sync_state` id 1 at cursor 0) that the sync engine expects.
 */
export async function deleteAllRows(db: SqlDb): Promise<void> {
  const tables = await listUserTables(db);
  await inTransaction(db, async (tx) => {
    for (const table of tables) {
      await tx.run(sql.raw(`DELETE FROM "${table.replaceAll('"', '""')}"`));
    }
  });
}
