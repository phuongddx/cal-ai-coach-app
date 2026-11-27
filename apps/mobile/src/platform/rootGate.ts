/**
 * The root gate (PL-01): which of the four screens the app shows. A pure rule, the port of the
 * `if` chain in `RootView.swift`:
 *
 *   not ready                                  -> wait (a spinner on the background)
 *   sign-in required and no session            -> sign-in
 *   a target exists, or onboarding is pending  -> shell (the tabs)
 *   otherwise                                  -> onboarding
 *
 * No React and no native module: `src/app/_layout.tsx` feeds it the state the launch sequence read.
 */
export type RootGateRoute = 'wait' | 'sign-in' | 'onboarding' | 'shell';

export type RootGateState = {
  /** `environment.isReady`: the session, the stored flags and the target have been read. */
  ready: boolean;
  /** `getDebugFlags().requireSignIn` (Swift: `environment.requiresSignIn`). */
  requiresSignIn: boolean;
  /** `environment.authSession != nil`. */
  hasSession: boolean;
  /** `environment.hasTargets`: an active target exists for the owner. */
  hasTargets: boolean;
  /** `environment.onboardingPending`: a debug launch that seeded no target and wants the shell anyway. */
  onboardingPending: boolean;
};

export function decideRootGate(state: RootGateState): RootGateRoute {
  if (!state.ready) return 'wait';
  if (state.requiresSignIn && !state.hasSession) return 'sign-in';
  if (state.hasTargets || state.onboardingPending) return 'shell';
  return 'onboarding';
}
