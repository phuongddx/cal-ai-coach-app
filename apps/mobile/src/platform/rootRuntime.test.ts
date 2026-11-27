/**
 * The real wiring of the root gate over a real migrated SQLite (sql.js), the real session store on the
 * mocked keychain and the real `startDataBinding`; only the sync runtime's engine, transport and the
 * widget are fakes. It proves the claims the pure tests make about the app's own modules: the launch
 * reads the stored ED-safe flag from `app_settings`, the target through `getDataEnvironment()`, and the
 * sync triggers start exactly once.
 */
import type { SyncRuntime } from '../data/sync/runtime';

type Fake = { runtime: SyncRuntime; startTriggers: jest.Mock; stopTriggers: jest.Mock; calls: string[] };
const holder: { current: Fake | null } = { current: null };

jest.mock('../data/sync/runtime', () => ({
  getSyncRuntime: async () => holder.current!.runtime,
  notifyLocalMutation: () => undefined,
}));
jest.mock('../data/widget/WidgetSnapshotPublisher', () => ({
  publish: jest.fn(),
  startForegroundReload: () => ({ remove: () => undefined }),
}));

jest.mock('../spike/spikeLog', () => ({ spikeLog: jest.fn() }));

import * as SecureStore from 'expo-secure-store';

import { resetAuthForTests, getSessionStore, SESSION_STORAGE_KEY } from '../data/auth';
import { getDataEnvironment, resetDataEnvironmentForTests } from '../data/environment';
import { createSeedDataManager } from '../data/repos/seedDataManager';
import { createRepoFixture } from '../data/repos/testing/fixtures';
import { resetDebugFlagsForTests, setDebugFlags } from '../debug/launchArgs';
import { edSafeMode, setEdSafeMode } from '../design/edSafe';
import { createRootController } from './rootController';
import { createRealRootDeps } from './rootRuntime';
import { writeStoredEdSafe } from './storedFlags';

async function makeFake(): Promise<Fake & { fixture: Awaited<ReturnType<typeof createRepoFixture>> }> {
  const fixture = await createRepoFixture();
  const calls: string[] = [];
  const stopTriggers = jest.fn();
  const startTriggers = jest.fn(() => {
    calls.push('triggers');
    return { stop: stopTriggers } as unknown as ReturnType<SyncRuntime['startTriggers']>;
  });
  const runtime = {
    db: fixture.db,
    engine: {
      isOnline: () => true,
      isForcedOffline: () => false,
      lastResult: () => ({ status: 'ok', pushed: 0, pulled: 0 }),
      setForcedOffline: jest.fn(),
      stop: async () => undefined,
    },
    repository: { listMeals: async () => [] },
    store: { outboxCount: async () => 0, cursor: async () => 0, quarantinedOperations: async () => [], reset: async () => undefined },
    startTriggers,
    subscribe: () => () => undefined,
    notifyLocalWrite: () => undefined,
    syncNow: () => undefined,
  } as unknown as SyncRuntime;
  return { runtime, startTriggers, stopTriggers, calls, fixture };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(async () => {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  resetAuthForTests();
  resetDataEnvironmentForTests();
  resetDebugFlagsForTests();
  setEdSafeMode(false);
});

describe('the root gate over the app modules', () => {
  it('reads the stored ED-safe flag and the target from SQLite, then starts the sync triggers once', async () => {
    const fake = await makeFake();
    holder.current = fake;
    await writeStoredEdSafe(fake.fixture.db, true);
    await createSeedDataManager(fake.fixture.db, { now: fake.fixture.clock, newId: fake.fixture.newId }).ensureSeeded(true);

    const controller = createRootController(createRealRootDeps());
    await Promise.all([controller.start(), controller.start()]);
    await flush();

    expect(edSafeMode()).toBe(true);
    expect(controller.getRoute()).toBe('shell'); // the seeded demo persona has a target
    expect(fake.startTriggers).toHaveBeenCalledTimes(1);
    controller.dispose();
    expect(fake.stopTriggers).toHaveBeenCalledTimes(1);
  });

  it('shows onboarding on an empty database, and the session from the keychain is loaded before the gate decides', async () => {
    const fake = await makeFake();
    holder.current = fake;
    setDebugFlags({ requireSignIn: true });
    const session = {
      user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2099-01-01T00:00:00.000Z' },
    };
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(getSessionStore().getSession()).toBeNull(); // nothing is loaded before the launch sequence

    const controller = createRootController(createRealRootDeps());
    await controller.start();
    expect(getSessionStore().getSession()?.user.id).toBe(session.user.id);
    expect(controller.getRoute()).toBe('onboarding'); // signed in, no target yet
    controller.dispose();
  });

  it('shows sign-in when it is required and the keychain is empty', async () => {
    const fake = await makeFake();
    holder.current = fake;
    setDebugFlags({ requireSignIn: true });
    const controller = createRootController(createRealRootDeps());
    await controller.start();
    expect(controller.getRoute()).toBe('sign-in');
    controller.dispose();
  });

  it('puts the sync engine offline for --ccForceOffline, at launch and when the console flips it', async () => {
    const fake = await makeFake();
    holder.current = fake;
    setDebugFlags({ forceOffline: true });
    const controller = createRootController(createRealRootDeps());
    await controller.start();
    await flush();
    expect(fake.runtime.engine.setForcedOffline).toHaveBeenLastCalledWith(true);
    setDebugFlags({ forceOffline: false });
    await flush();
    expect(fake.runtime.engine.setForcedOffline).toHaveBeenLastCalledWith(false);
    controller.dispose();
  });

  it('feeds the data environment clock from --ccFixedClock', async () => {
    const fake = await makeFake();
    holder.current = fake;
    const environment = await getDataEnvironment();
    setDebugFlags({ fixedClock: Date.parse('2026-03-01T08:30:00.000Z') });
    expect(environment.now().toISOString()).toBe('2026-03-01T08:30:00.000Z');
    resetDebugFlagsForTests();
    expect(environment.now().getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
