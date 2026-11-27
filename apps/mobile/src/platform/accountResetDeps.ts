/**
 * The real dependencies of the account reset: the app's database, session store, sync runtime and
 * widget. Kept apart from `accountReset.ts` so the rule imports no native module.
 */
import { deleteAccount } from '../data/api';
import { getSessionStore } from '../data/auth';
import { getDataEnvironment } from '../data/environment';
import { getSyncRuntime } from '../data/sync/runtime';
import { publish } from '../data/widget/WidgetSnapshotPublisher';
import { setEdSafeMode } from '../design/edSafe';
import { placeholderProps } from '../widgets/CaloriesWidget';
import { deleteAllRows, type AccountResetDeps } from './accountReset';
import { clearStoredFlags } from './storedFlags';

/** `onReset` is the root gate's: no target, no pending onboarding, no session. */
export function createAccountResetDeps(onReset: () => void): AccountResetDeps {
  return {
    deleteRemoteAccount: () => deleteAccount({ auth: getSessionStore().bearer }),
    clearSession: () => getSessionStore().clear(),
    clearStoredFlags: async () => clearStoredFlags((await getDataEnvironment()).db),
    setEdSafeMode,
    clearLocalRows: async () => {
      const runtime = await getSyncRuntime();
      // Let an in-flight dispatch finish before its tables are emptied (Swift does not stop the engine;
      // it is rebound by the next sign-in, as `applyPrincipal` does here when the session changes).
      await runtime.engine.stop();
      await deleteAllRows(runtime.db);
      // Writes the cursor row (`sync_state` id 1, cursor 0) back.
      await runtime.store.reset();
    },
    clearWidgetSnapshot: () => {
      publish(placeholderProps);
    },
    onReset,
  };
}
