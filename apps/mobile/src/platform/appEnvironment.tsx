/**
 * The React environment (PL-02): the one place a screen takes its dependencies from, as the Swift
 * views read `@Environment(AppEnvironment.self)`. It lives under `src/platform` because every file
 * under `src/app` becomes a route. The feature routes keep their own wiring in this wave; moving them
 * onto this provider is a later unit.
 */
import { createContext, useContext, type ReactNode } from 'react';

import type { CoachCalApi } from '../data/api';
import type { SessionStore } from '../data/auth';
import type { DataEnvironment } from '../data/environment';
import type { DebugFlags } from '../debug/launchArgs';
import type { AccountResetOptions } from './accountReset';
import type { Telemetry } from './telemetry';

export type AppEnvironment = {
  /** The database handle and the repositories over it (opens the database on first call). */
  data: () => Promise<DataEnvironment>;
  session: SessionStore;
  /** A scan API for the current flags: the fixture one under a scenario, else the live one. */
  createApi: () => CoachCalApi;
  /** The injected clock: the real one, or `--ccFixedClock`. */
  now: () => Date;
  flags: () => Readonly<DebugFlags>;
  telemetry: Telemetry;
  /** Opens the scan flow over the tabs. */
  openScan: () => void;
  /** Sign-out and account deletion: local rows, stored flags and session (`performLocalAccountReset`). */
  resetLocalData: (options?: AccountResetOptions) => Promise<void>;
};

const AppEnvironmentContext = createContext<AppEnvironment | null>(null);

export function AppEnvironmentProvider({ value, children }: { value: AppEnvironment; children: ReactNode }) {
  return <AppEnvironmentContext.Provider value={value}>{children}</AppEnvironmentContext.Provider>;
}

export function useAppEnvironment(): AppEnvironment {
  const value = useContext(AppEnvironmentContext);
  if (value === null) throw new Error('useAppEnvironment() was called outside AppEnvironmentProvider');
  return value;
}
