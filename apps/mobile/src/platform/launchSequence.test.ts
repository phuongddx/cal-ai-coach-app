import type { Session } from '../data/auth/types';
import { DEMO_USER_ID } from '../data/repos/seedDataManager';
import { DEFAULT_DEBUG_FLAGS, type DebugFlags } from '../debug/launchArgs';
import { runLaunchSequence, targetOwners, type LaunchDeps } from './launchSequence';

const SESSION = { user: { id: 'user-1' } } as unknown as Session;

function makeDeps(overrides: Partial<Omit<LaunchDeps, 'flags'>> & { flags?: Partial<DebugFlags> } = {}) {
  const calls: string[] = [];
  const { flags, ...rest } = overrides;
  const deps: LaunchDeps = {
    flags: () => ({ ...DEFAULT_DEBUG_FLAGS, ...flags }),
    loadSession: async () => {
      calls.push('session');
      return null;
    },
    readStoredEdSafe: async () => {
      calls.push('flag');
      return false;
    },
    setEdSafeMode: (value) => calls.push(`edSafe:${value}`),
    hasTarget: async () => {
      calls.push('target');
      return false;
    },
    startDataBinding: () => {
      calls.push('binding');
      return () => calls.push('stop');
    },
    wipeLocalData: async () => {
      calls.push('wipe');
    },
    ...rest,
  };
  return { deps, calls };
}

describe('launch sequence (PL-01)', () => {
  it('loads the session, reads the stored flag, reads the target, then starts the data binding', async () => {
    const { deps, calls } = makeDeps();
    await runLaunchSequence(deps);
    expect(calls).toEqual(['session', 'flag', 'edSafe:false', 'target', 'binding']);
  });

  it('starts the data binding (which starts the sync triggers) exactly once', async () => {
    const startDataBinding = jest.fn(() => () => undefined);
    const { deps } = makeDeps({ startDataBinding });
    await runLaunchSequence(deps);
    expect(startDataBinding).toHaveBeenCalledTimes(1);
  });

  it('applies the stored ED-safe mode, and the --ccEDSafe flag forces it on', async () => {
    const stored = makeDeps({ readStoredEdSafe: async () => true });
    expect((await runLaunchSequence(stored.deps)).edSafe).toBe(true);
    expect(stored.calls).toContain('edSafe:true');

    const forced = makeDeps({ flags: { edSafe: true } });
    expect((await runLaunchSequence(forced.deps)).edSafe).toBe(true);
    expect(forced.calls).toContain('edSafe:true');

    const neither = makeDeps();
    expect((await runLaunchSequence(neither.deps)).edSafe).toBe(false);
  });

  it('reads the target for the demo persona, and also for the session user once signed in', async () => {
    const hasTarget = jest.fn(async () => true);
    const signedOut = makeDeps({ hasTarget });
    expect((await runLaunchSequence(signedOut.deps)).hasTargets).toBe(true);
    expect(hasTarget).toHaveBeenLastCalledWith([DEMO_USER_ID]);

    const signedIn = makeDeps({ hasTarget, loadSession: async () => SESSION });
    const result = await runLaunchSequence(signedIn.deps);
    expect(result.session).toBe(SESSION);
    expect(hasTarget).toHaveBeenLastCalledWith([DEMO_USER_ID, 'user-1']);
    expect(targetOwners(SESSION)).toEqual([DEMO_USER_ID, 'user-1']);
  });

  it('keeps launching when the keychain, the flag or the target read fails', async () => {
    const { deps, calls } = makeDeps({
      loadSession: async () => {
        throw new Error('keychain');
      },
      readStoredEdSafe: async () => {
        throw new Error('db');
      },
      hasTarget: async () => {
        throw new Error('db');
      },
    });
    const result = await runLaunchSequence(deps);
    expect(result).toMatchObject({ session: null, edSafe: false, hasTargets: false });
    expect(calls).toEqual(['edSafe:false', 'binding']);
  });

  it('marks onboarding pending only for --ccSeedNoTargets (Swift: DEBUG and no seeded targets)', async () => {
    expect((await runLaunchSequence(makeDeps().deps)).onboardingPending).toBe(false);
    expect((await runLaunchSequence(makeDeps({ flags: { seedNoTargets: true } }).deps)).onboardingPending).toBe(true);
  });

  it('wipes the local data first under --ccFreshStart, as Swift removes the database files', async () => {
    const { deps, calls } = makeDeps({ flags: { freshStart: true } });
    await runLaunchSequence(deps);
    expect(calls).toEqual(['wipe', 'session', 'flag', 'edSafe:false', 'target', 'binding']);
  });

  it('still opens the gate when the --ccFreshStart wipe fails (Swift never hangs on this path)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps, calls } = makeDeps({
      flags: { freshStart: true },
      wipeLocalData: async () => {
        throw new Error('disk');
      },
    });
    const result = await runLaunchSequence(deps);
    expect(calls).toEqual(['session', 'flag', 'edSafe:false', 'target', 'binding']);
    expect(result).toMatchObject({ session: null, hasTargets: false });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns the data binding stop function', async () => {
    const { deps, calls } = makeDeps();
    (await runLaunchSequence(deps)).stop();
    expect(calls.at(-1)).toBe('stop');
  });
});
