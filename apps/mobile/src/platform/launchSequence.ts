/**
 * The launch sequence (PL-01, launch half of PL-08): what the Swift `AppEnvironment` does between
 * process start and `isReady = true`, as a pure function over injected steps so Jest can prove the
 * order. The real steps are wired in `rootRuntime.ts`; nothing here touches a native module.
 *
 * Order, which the root gate depends on:
 *  1. (`--ccFreshStart` only) wipe the local data, as Swift removes the database files.
 *  2. load the session (the keychain);
 *  3. read the stored ED-safe mode and apply `flags.edSafe || stored`;
 *  4. read whether a target exists;
 *  5. start the data binding. `startDataBinding()` already starts the sync triggers through the
 *     runtime, so this is the ONLY place that calls it: the triggers are never started twice.
 */
import type { Session } from '../data/auth/types';
import { DEMO_USER_ID } from '../data/repos/seedDataManager';
import type { DebugFlags } from '../debug/launchArgs';

export type LaunchDeps = {
  flags: () => Readonly<DebugFlags>;
  /** `getSessionStore().load()`. */
  loadSession: () => Promise<Session | null>;
  /** `readStoredEdSafe(db)`. */
  readStoredEdSafe: () => Promise<boolean>;
  setEdSafeMode: (value: boolean) => void;
  /** `targets.activeTarget(owner)` for each owner in turn: true when any returns a target. */
  hasTarget: (ownerIds: readonly string[]) => Promise<boolean>;
  /** `startDataBinding`; returns its stop function. */
  startDataBinding: () => () => void;
  /** Empties the local rows and the stored flags (`--ccFreshStart`). */
  wipeLocalData: () => Promise<void>;
};

export type LaunchResult = {
  session: Session | null;
  hasTargets: boolean;
  /** Swift sets it under DEBUG when the targetless persona is seeded (`--ccSeedNoTargets`). */
  onboardingPending: boolean;
  edSafe: boolean;
  /** Stops the data binding (and with it the sync triggers). */
  stop: () => void;
};

/**
 * The owners whose target counts. Swift asks for the demo persona at launch (`demoUserId`) while the
 * onboarding it shows saves under `currentUserId` (the session user once signed in), so a signed-in
 * person who finished onboarding would be sent through it again on the next launch. Asking for both
 * closes that gap; for a signed-out person it is exactly Swift's single question.
 */
export function targetOwners(session: Session | null): string[] {
  return session === null ? [DEMO_USER_ID] : [DEMO_USER_ID, session.user.id];
}

export async function runLaunchSequence(deps: LaunchDeps): Promise<LaunchResult> {
  const flags = deps.flags();
  if (flags.freshStart) await deps.wipeLocalData();

  const session = await deps.loadSession().catch(() => null);

  const stored = await deps.readStoredEdSafe().catch(() => false);
  const edSafe = flags.edSafe || stored;
  deps.setEdSafeMode(edSafe);

  const hasTargets = await deps.hasTarget(targetOwners(session)).catch(() => false);

  const stop = deps.startDataBinding();
  return { session, hasTargets, onboardingPending: flags.seedNoTargets, edSafe, stop };
}
