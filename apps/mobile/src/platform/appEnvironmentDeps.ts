/**
 * The real values of the React environment: the app's data environment, session store, API client
 * factory, clock, flags, telemetry seam and account reset. Kept apart from `appEnvironment.tsx` so a
 * test provides its own values and no native module loads through the provider.
 */
import { LiveScanApi, resolveBaseUrl, type CoachCalApi } from '../data/api';
import { getSessionStore } from '../data/auth';
import { getDataEnvironment } from '../data/environment';
import { getDebugFlags } from '../debug/launchArgs';
import { FixtureScanApi, resolveFixtureScenario } from '../testing';
import { resetAccount, type AccountResetOptions } from './accountReset';
import { createAccountResetDeps } from './accountResetDeps';
import type { AppEnvironment } from './appEnvironment';
import { getRootController } from './rootRuntime';
import { createTelemetry } from './telemetry';

/** The scan API of the current flags: the fixture when a scenario or fixture capture is on, else the live one. */
export function createScanApi(): CoachCalApi {
  const flags = getDebugFlags();
  if (flags.scanScenario !== null || flags.fixtureCapture) {
    return new FixtureScanApi(resolveFixtureScenario(flags.scanScenario === null ? [] : ['--ccScanScenario', flags.scanScenario]));
  }
  return new LiveScanApi({ auth: getSessionStore().bearer, baseUrl: resolveBaseUrl() });
}

/** `openScan` is the router's: the layout passes it in, because only a component can reach the router. */
export function createAppEnvironment(openScan: () => void): AppEnvironment {
  const telemetry = createTelemetry();
  return {
    data: getDataEnvironment,
    session: getSessionStore(),
    createApi: createScanApi,
    now: () => {
      const fixed = getDebugFlags().fixedClock;
      return fixed === null ? new Date() : new Date(fixed);
    },
    flags: getDebugFlags,
    telemetry,
    openScan,
    resetLocalData: (options?: AccountResetOptions) =>
      resetAccount(createAccountResetDeps(() => getRootController().handleReset()), options),
  };
}
