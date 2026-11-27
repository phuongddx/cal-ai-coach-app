import type { Session } from '../data/auth/types';
import { DEFAULT_DEBUG_FLAGS, type DebugFlags } from '../debug/launchArgs';
import { createRootController, type RootControllerDeps } from './rootController';

const SESSION = { user: { id: 'user-1' } } as unknown as Session;

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeHarness(init: { flags?: Partial<DebugFlags>; session?: Session | null; target?: boolean } = {}) {
  let flags: DebugFlags = { ...DEFAULT_DEBUG_FLAGS, ...init.flags };
  let session: Session | null = init.session ?? null;
  let target = init.target ?? false;
  const sessionListeners = new Set<(s: Session | null) => void>();
  const mutationListeners = new Set<() => void>();
  const flagListeners = new Set<() => void>();
  const calls: string[] = [];
  const startDataBinding = jest.fn(() => {
    calls.push('binding');
    return () => calls.push('stop');
  });
  const deps: RootControllerDeps = {
    flags: () => flags,
    getSession: () => session,
    loadSession: async () => {
      calls.push('session');
      return session;
    },
    readStoredEdSafe: async () => false,
    setEdSafeMode: () => undefined,
    hasTarget: async () => {
      calls.push('target');
      return target;
    },
    startDataBinding,
    wipeLocalData: async () => undefined,
    subscribeSession: (l) => {
      sessionListeners.add(l);
      return () => sessionListeners.delete(l);
    },
    subscribeLocalMutation: (l) => {
      mutationListeners.add(l);
      return () => mutationListeners.delete(l);
    },
    subscribeFlags: (l) => {
      flagListeners.add(l);
      return () => flagListeners.delete(l);
    },
  };
  return {
    deps,
    calls,
    startDataBinding,
    setTarget: (value: boolean) => (target = value),
    signIn: (next: Session | null) => {
      session = next;
      sessionListeners.forEach((l) => l(next));
    },
    mutate: () => mutationListeners.forEach((l) => l()),
    setFlags: (patch: Partial<DebugFlags>) => {
      flags = { ...flags, ...patch };
      flagListeners.forEach((l) => l());
    },
  };
}

describe('root controller (PL-01)', () => {
  it('opens the gate even when the --ccFreshStart wipe fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = makeHarness({ flags: { freshStart: true }, target: true });
    h.deps.wipeLocalData = async () => {
      throw new Error('disk');
    };
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getState().ready).toBe(true);
    expect(controller.getRoute()).toBe('shell');
    expect(h.startDataBinding).toHaveBeenCalledTimes(1);
    controller.dispose();
    warn.mockRestore();
  });

  it('waits for the session and the target before it decides', async () => {
    const session = deferred<Session | null>();
    const target = deferred<boolean>();
    const h = makeHarness({ flags: { requireSignIn: true } });
    h.deps.loadSession = () => session.promise;
    h.deps.hasTarget = () => target.promise;
    const controller = createRootController(h.deps);
    const seen: string[] = [];
    controller.subscribe(() => seen.push(controller.getRoute()));

    void controller.start();
    await flush();
    expect(controller.getRoute()).toBe('wait');

    session.resolve(SESSION);
    await flush();
    // The session is in, the target read is still pending: still waiting.
    expect(controller.getRoute()).toBe('wait');

    target.resolve(true);
    await flush();
    expect(controller.getRoute()).toBe('shell');
    expect(seen).toEqual(['shell']); // it never passed through a wrong screen
  });

  it('shows sign-in when sign-in is required and the keychain holds no session', async () => {
    const h = makeHarness({ flags: { requireSignIn: true }, target: true });
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getRoute()).toBe('sign-in');
  });

  it('shows onboarding when there is no target, then the shell once a local write saved one', async () => {
    const h = makeHarness();
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getRoute()).toBe('onboarding');

    h.setTarget(true);
    h.mutate();
    await flush();
    expect(controller.getRoute()).toBe('shell');
  });

  it('shows the shell at once when onboarding is pending (--ccSeedNoTargets)', async () => {
    const controller = createRootController(makeHarness({ flags: { seedNoTargets: true } }).deps);
    await controller.start();
    expect(controller.getRoute()).toBe('shell');
  });

  it('moves from sign-in to the shell when the session arrives, re-reading the target for that user', async () => {
    const h = makeHarness({ flags: { requireSignIn: true } });
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getRoute()).toBe('sign-in');

    h.setTarget(true);
    h.signIn(SESSION);
    await flush();
    expect(controller.getRoute()).toBe('shell');

    h.signIn(null);
    await flush();
    expect(controller.getRoute()).toBe('sign-in');
  });

  it('follows --ccRequireSignIn when the console flips it', async () => {
    const h = makeHarness({ target: true });
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getRoute()).toBe('shell');
    h.setFlags({ requireSignIn: true });
    expect(controller.getRoute()).toBe('sign-in');
  });

  it('runs the launch sequence once however often start is called, and starts the data binding once', async () => {
    const h = makeHarness();
    const controller = createRootController(h.deps);
    await Promise.all([controller.start(), controller.start()]);
    await controller.start();
    expect(h.startDataBinding).toHaveBeenCalledTimes(1);
    expect(h.calls.filter((c) => c === 'session')).toHaveLength(1);
  });

  it('does not let an older target read overwrite a newer answer', async () => {
    const h = makeHarness();
    const controller = createRootController(h.deps);
    await controller.start();
    const first = deferred<boolean>();
    h.deps.hasTarget = () => first.promise;
    h.mutate(); // slow read, resolves later with a stale `false`
    controller.completeOnboarding();
    first.resolve(false);
    await flush();
    expect(controller.getRoute()).toBe('shell');
  });

  it('goes to onboarding after an account reset: no target, no pending onboarding, no session', async () => {
    const h = makeHarness({ target: true, flags: { seedNoTargets: true } });
    const controller = createRootController(h.deps);
    await controller.start();
    expect(controller.getRoute()).toBe('shell');
    h.setTarget(false);
    controller.handleReset();
    expect(controller.getState()).toMatchObject({ hasTargets: false, onboardingPending: false, hasSession: false });
    expect(controller.getRoute()).toBe('onboarding');
  });

  it('stops the data binding and ignores later events once disposed', async () => {
    const h = makeHarness();
    const controller = createRootController(h.deps);
    await controller.start();
    controller.dispose();
    expect(h.calls.at(-1)).toBe('stop');
    h.setTarget(true);
    h.mutate();
    await flush();
    expect(controller.getRoute()).toBe('onboarding');
  });
});
