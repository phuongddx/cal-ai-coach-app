/**
 * The Today route's lifecycle (src/app/(tabs)/index.tsx). It has no Swift twin: the SwiftUI view owns its
 * model through @State, so there is no async build to outlive the view. Here the model is built after
 * `getDataEnvironment()` resolves, and the route can unmount first (React StrictMode mounts twice in
 * development); the test pins that the model is then disposed exactly once and leaves no listener on the
 * sync runtime. The test lives here, not under src/app, where every file is a route.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { TodayModel } from '../todayModel';

const mockModels: TodayModel[] = [];
const mockDispose = jest.fn();
const mockListeners = new Set<() => void>();

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let mockEnvironment: Deferred<unknown>;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../../data/binding', () => ({
  useSyncState: () => ({ online: true, lastStatus: 'idle' }),
}));
jest.mock('../../../data/auth', () => ({ getSessionStore: () => ({ getSession: () => null }) }));
jest.mock('../../../data/environment', () => ({ getDataEnvironment: () => mockEnvironment.promise }));
jest.mock('../../../data/sync/runtime', () => ({
  notifyLocalMutation: jest.fn(),
  // The runtime resolves at once; its listener set is what the test inspects for a leak.
  getSyncRuntime: () =>
    Promise.resolve({
      subscribe: (listener: () => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
      },
    }),
}));
jest.mock('../../../spike/firstRender', () => ({ writeFirstRender: jest.fn() }));
jest.mock('../todayReaders', () => ({
  createTodayReaders: () => ({
    meals: async () => [],
    activeTarget: async () => null,
    waterMl: async () => 0,
    streakState: async () => null,
  }),
}));
jest.mock('../todayModel', () => {
  const actual = jest.requireActual('../todayModel');
  return {
    ...actual,
    createTodayModel: (deps: Parameters<typeof actual.createTodayModel>[0]) => {
      const model: TodayModel = actual.createTodayModel(deps);
      const realDispose = model.dispose.bind(model);
      model.dispose = () => {
        mockDispose();
        realDispose();
      };
      mockModels.push(model);
      return model;
    },
  };
});

// eslint-disable-next-line import/first -- the route is imported after the mocks it reads
import TodayRoute from '../../../app/(tabs)/index';

const metrics = { frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } };
const inProvider = (ui: ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;

const environment = {
  db: {},
  targets: {},
  tracking: { addWater: async () => undefined },
  engagement: {},
  now: () => new Date(2026, 8, 12, 9, 0, 0, 0),
};

/** Lets the pending continuation run: the runtime's promise, the model's first read, the setState. */
async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

beforeEach(() => {
  mockModels.length = 0;
  mockDispose.mockClear();
  mockListeners.clear();
  mockEnvironment = deferred();
});

describe('TodayRoute lifecycle', () => {
  it('disposes the model once and leaves no listener when the route unmounts before the environment resolves', async () => {
    const view = await render(inProvider(<TodayRoute />));
    await view.unmount();

    mockEnvironment.resolve(environment);
    await flush();

    expect(mockModels).toHaveLength(1);
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(mockListeners.size).toBe(0);
  });

  it('disposes the model once when the route unmounts after it was shown', async () => {
    mockEnvironment.resolve(environment);
    const view = await render(inProvider(<TodayRoute />));
    await waitFor(() => expect(screen.getByTestId('today.recentMeals')).toBeOnTheScreen());
    expect(mockDispose).not.toHaveBeenCalled();
    expect(mockListeners.size).toBeGreaterThan(0);

    await view.unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(mockListeners.size).toBe(0);
  });
});
