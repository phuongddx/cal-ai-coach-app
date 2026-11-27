import { decideRootGate, type RootGateState } from './rootGate';

/** Every field the rule reads, from `RootView.swift`: isReady, requiresSignIn, authSession, hasTargets, onboardingPending. */
const READY: RootGateState = {
  ready: true,
  requiresSignIn: false,
  hasSession: false,
  hasTargets: false,
  onboardingPending: false,
};

describe('root gate rule (RootView.swift)', () => {
  it('waits while the launch sequence has not finished, whatever else is true', () => {
    expect(decideRootGate({ ...READY, ready: false })).toBe('wait');
    expect(decideRootGate({ ready: false, requiresSignIn: true, hasSession: true, hasTargets: true, onboardingPending: true })).toBe('wait');
  });

  it('asks for sign-in when sign-in is required and there is no session', () => {
    expect(decideRootGate({ ...READY, requiresSignIn: true })).toBe('sign-in');
    // Required sign-in wins over a stored target and over pending onboarding.
    expect(decideRootGate({ ...READY, requiresSignIn: true, hasTargets: true, onboardingPending: true })).toBe('sign-in');
  });

  it('does not ask for sign-in when it is not required, with or without a session', () => {
    expect(decideRootGate({ ...READY, hasTargets: true })).toBe('shell');
    expect(decideRootGate({ ...READY, hasSession: true, hasTargets: true })).toBe('shell');
  });

  it('shows the shell when a target exists', () => {
    expect(decideRootGate({ ...READY, hasTargets: true })).toBe('shell');
    expect(decideRootGate({ ...READY, requiresSignIn: true, hasSession: true, hasTargets: true })).toBe('shell');
  });

  it('shows the shell when onboarding is pending even without a target', () => {
    expect(decideRootGate({ ...READY, onboardingPending: true })).toBe('shell');
  });

  it('shows onboarding when there is no target and onboarding is not pending', () => {
    expect(decideRootGate(READY)).toBe('onboarding');
    expect(decideRootGate({ ...READY, requiresSignIn: true, hasSession: true })).toBe('onboarding');
  });
});
