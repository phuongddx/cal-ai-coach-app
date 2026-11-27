/**
 * The root gate's state holder (PL-01): an external store over the pieces `RootView.swift` reads
 * (`isReady`, `requiresSignIn`, `authSession`, `hasTargets`, `onboardingPending`). It runs the launch
 * sequence once, then keeps the state current:
 *  - the session store's `onChange` (sign-in, sign-out, a rejected refresh) updates `hasSession`;
 *  - every local write (`notifyLocalMutation`) and every session change re-reads the target, so the
 *    gate leaves onboarding as soon as onboarding saves one (Swift's `completeOnboarding()`).
 *
 * Dependencies are injected: no native module, no timer, no React here. `useRootGate.ts` is the hook.
 */
import type { Session } from '../data/auth/types';
import type { DebugFlags } from '../debug/launchArgs';
import { decideRootGate, type RootGateRoute, type RootGateState } from './rootGate';
import { runLaunchSequence, targetOwners, type LaunchDeps } from './launchSequence';

export type RootControllerDeps = LaunchDeps & {
  flags: () => Readonly<DebugFlags>;
  getSession: () => Session | null;
  /** The session store's `onChange`. */
  subscribeSession: (listener: (session: Session | null) => void) => () => void;
  /** `subscribeDebugFlags`: the console can flip `requireSignIn` while the app runs. */
  subscribeFlags: (listener: () => void) => () => void;
  /** The runtime's `subscribe`: fires after every local write and every sync run. */
  subscribeLocalMutation: (listener: () => void) => () => void;
};

export type RootController = {
  /** Runs the launch sequence once; later calls return the same promise. */
  start: () => Promise<void>;
  getState: () => RootGateState;
  getRoute: () => RootGateRoute;
  subscribe: (listener: () => void) => () => void;
  /** Re-reads the target (what a local write triggers). */
  refreshTargets: () => Promise<void>;
  /** Onboarding saved its target: shell, as Swift's `completeOnboarding()` (also re-read from the database). */
  completeOnboarding: () => void;
  /** After an account reset: no target, no pending onboarding, no session. */
  handleReset: () => void;
  dispose: () => void;
};

const INITIAL: RootGateState = {
  ready: false,
  requiresSignIn: false,
  hasSession: false,
  hasTargets: false,
  onboardingPending: false,
};

export function createRootController(deps: RootControllerDeps): RootController {
  let state: RootGateState = INITIAL;
  const listeners = new Set<() => void>();
  const cleanups: Array<() => void> = [];
  let started: Promise<void> | null = null;
  let disposed = false;
  // A target read that started before a newer one must not overwrite it.
  let readToken = 0;

  const set = (patch: Partial<RootGateState>) => {
    const next = { ...state, ...patch };
    if (Object.keys(next).every((key) => next[key as keyof RootGateState] === state[key as keyof RootGateState])) return;
    state = next; // replaced, never mutated: a stable snapshot for useSyncExternalStore
    listeners.forEach((listener) => listener());
  };

  const refreshTargets = async () => {
    if (!state.ready) return;
    const token = ++readToken;
    const hasTargets = await deps.hasTarget(targetOwners(deps.getSession())).catch(() => state.hasTargets);
    if (disposed || token !== readToken) return;
    set({ hasTargets });
  };

  const start = () => {
    started ??= (async () => {
      const result = await runLaunchSequence(deps);
      if (disposed) {
        result.stop();
        return;
      }
      cleanups.push(result.stop);
      set({
        ready: true,
        requiresSignIn: deps.flags().requireSignIn,
        hasSession: result.session !== null,
        hasTargets: result.hasTargets,
        onboardingPending: result.onboardingPending,
      });
      cleanups.push(
        deps.subscribeSession((session) => {
          set({ hasSession: session !== null });
          void refreshTargets();
        }),
      );
      cleanups.push(deps.subscribeLocalMutation(() => void refreshTargets()));
      cleanups.push(deps.subscribeFlags(() => set({ requiresSignIn: deps.flags().requireSignIn })));
    })();
    return started;
  };

  return {
    start,
    getState: () => state,
    getRoute: () => decideRootGate(state),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refreshTargets,
    completeOnboarding: () => {
      readToken++; // an older read may not undo it
      set({ hasTargets: true, onboardingPending: false });
    },
    handleReset: () => {
      readToken++;
      set({ hasTargets: false, onboardingPending: false, hasSession: false });
    },
    dispose: () => {
      disposed = true;
      cleanups.splice(0).forEach((cleanup) => cleanup());
      listeners.clear();
    },
  };
}
