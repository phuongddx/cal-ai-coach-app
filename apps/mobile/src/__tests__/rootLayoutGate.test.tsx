import { act } from '@testing-library/react-native';
import { router, Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { RootGateRoute } from '../platform/rootGate';

/**
 * The root layout against the real expo-router (U-81, PL-01). The U-51 tests prove the route the gate
 * DECIDES; this one proves the screen the navigator FOCUSES. On a fresh install the gate said `onboarding`
 * and the navigator showed `debug`: expo-router builds the navigator state from the launch URL (`/`, so
 * `(tabs)`) while the gate still shows its spinner, and when the guard then closes `(tabs)` it sent the
 * screen to the first unguarded file route in alphabetical order, which is the always-mounted `debug`.
 *
 * The layout under test is the real `src/app/_layout.tsx`; the route table is the real file list with
 * every other screen replaced by a stub that prints its name. The gate state comes from a controller
 * double the test drives; native modules the layout imports are doubled.
 */
let mockRoute: RootGateRoute = 'wait';
const mockListeners = new Set<() => void>();
const mockController = {
  start: () => Promise.resolve(),
  getRoute: () => mockRoute,
  subscribe: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
};

jest.mock('../platform/rootRuntime', () => ({ getRootController: () => mockController }));
jest.mock('../platform/appEnvironmentDeps', () => ({ createAppEnvironment: () => ({}) }));
jest.mock('../platform/appEnvironment', () => ({
  AppEnvironmentProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../spike/builtinActions', () => ({ registerBuiltinSpikeActions: () => undefined }));
jest.mock('../spike/deepLink', () => ({ startSpikeDeepLinks: () => () => undefined }));
jest.mock('../design', () => ({ useTokens: () => ({ colors: { background: '#fff' } }) }));

// eslint-disable-next-line import/first
import RootLayout, { unstable_settings } from '../app/_layout';

const stub = (name: string) => () => <Text testID="stub">{name}</Text>;

/** The files of `src/app/`, as `expo-router` sees them (the keys match `git ls-files apps/mobile/src/app`). */
function routeTable() {
  return {
    _layout: { default: RootLayout, unstable_settings },
    '(tabs)/_layout': () => <Slot />,
    '(tabs)/index': stub('(tabs)/index'),
    '(tabs)/coach': stub('(tabs)/coach'),
    '(tabs)/profile': stub('(tabs)/profile'),
    '(tabs)/progress': stub('(tabs)/progress'),
    debug: stub('debug'),
    diary: stub('diary'),
    'onboarding/index': stub('onboarding/index'),
    'scan/index': stub('scan/index'),
    settings: stub('settings'),
    'sign-in': stub('sign-in'),
  };
}

/** A launch like the app's: the URL is `/`, and the gate is `wait` until the launch sequence is done. */
async function launchThenDecide(route: RootGateRoute) {
  mockRoute = 'wait';
  await renderRouter(routeTable(), { initialUrl: '/' });
  await act(async () => {
    mockRoute = route;
    mockListeners.forEach((listener) => listener());
  });
}

describe('root layout: the navigator reaches the route the gate decides (PL-01)', () => {
  beforeEach(() => {
    mockListeners.clear();
  });

  it('a fresh install (no target) shows onboarding, not the debug console', async () => {
    await launchThenDecide('onboarding');
    expect(screen).toHavePathname('/onboarding');
    expect(screen.getByTestId('stub').props.children).toBe('onboarding/index');
  });

  it('a signed-out user with a target shows sign-in', async () => {
    await launchThenDecide('sign-in');
    expect(screen).toHavePathname('/sign-in');
    expect(screen.getByTestId('stub').props.children).toBe('sign-in');
  });

  it('a user with a target shows the shell (the tabs)', async () => {
    await launchThenDecide('shell');
    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('stub').props.children).toBe('(tabs)/index');
  });

  it('the spinner shows until the gate has decided', async () => {
    mockRoute = 'wait';
    await renderRouter(routeTable(), { initialUrl: '/' });
    expect(screen.getByTestId('root:loading')).toBeTruthy();
    expect(screen.queryByTestId('stub')).toBeNull();
  });

  it('a gate change moves the navigator: onboarding saved a target, then the shell', async () => {
    await launchThenDecide('onboarding');
    await act(async () => {
      mockRoute = 'shell';
      mockListeners.forEach((listener) => listener());
    });
    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('stub').props.children).toBe('(tabs)/index');
  });

  it('a sign-in requirement while onboarding is open moves the navigator to sign-in, not to debug', async () => {
    await launchThenDecide('onboarding');
    await act(async () => {
      mockRoute = 'sign-in';
      mockListeners.forEach((listener) => listener());
    });
    expect(screen).toHavePathname('/sign-in');
  });

  it('the debug console stays reachable in every gate state', async () => {
    await launchThenDecide('onboarding');
    await act(async () => {
      router.push('/debug');
    });
    expect(screen).toHavePathname('/debug');
  });
});
