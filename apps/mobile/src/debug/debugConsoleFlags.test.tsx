/**
 * PL-05: the Flags card of the debug console changes the flags. The test presses the switches and reads
 * `getDebugFlags()` and `edSafeMode()` back.
 */
jest.mock('react', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});
// The console's other cards read the sync runtime and the widget; the Flags card needs neither.
jest.mock('../data/binding', () => ({
  useSyncState: () => ({ ready: false, online: true, forcedOffline: false, lastStatus: 'not started', outbox: 0, cursor: 0, quarantined: 0, meals: 0 }),
}));
jest.mock('expo-glass-effect', () => ({ isLiquidGlassAvailable: () => false }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DebugConsole from '../app/debug';
import { edSafeMode, setEdSafeMode } from '../design/edSafe';
import { DEFAULT_DEBUG_FLAGS, getDebugFlags, resetDebugFlagsForTests, setDebugFlags } from './launchArgs';

beforeEach(() => {
  resetDebugFlagsForTests();
  setEdSafeMode(false);
});
afterEach(() => {
  setEdSafeMode(false);
});

describe('debug console Flags card', () => {
  it('shows one switch per flag of getDebugFlags() and one for ED-safe mode', async () => {
    await render(<DebugConsole />);
    const switches = [
      'freshStart',
      'seedNoTargets',
      'forceOffline',
      'disableAnimations',
      'edSafe',
      'requireSignIn',
      'fixtureCapture',
      'edSafeMode',
    ];
    for (const name of switches) expect(screen.getByTestId(`debug:flag:${name}`)).toBeOnTheScreen();
    // Every boolean flag has a switch; the two valued flags are shown as text.
    const booleanFlags = (Object.keys(DEFAULT_DEBUG_FLAGS) as Array<keyof typeof DEFAULT_DEBUG_FLAGS>).filter(
      (key) => typeof DEFAULT_DEBUG_FLAGS[key] === 'boolean',
    );
    for (const flag of booleanFlags) expect(screen.getByTestId(`debug:flag:${flag}`)).toBeOnTheScreen();
    expect(screen.getByTestId('debug:flags:values')).toHaveTextContent(/fixedClock real · scanScenario live API/);
  });

  it('presses a switch and the flag changes', async () => {
    await render(<DebugConsole />);
    expect(getDebugFlags().requireSignIn).toBe(false);
    await fireEvent(screen.getByTestId('debug:flag:requireSignIn'), 'valueChange', true);
    expect(getDebugFlags().requireSignIn).toBe(true);
    await fireEvent(screen.getByTestId('debug:flag:requireSignIn'), 'valueChange', false);
    expect(getDebugFlags().requireSignIn).toBe(false);
    await fireEvent(screen.getByTestId('debug:flag:forceOffline'), 'valueChange', true);
    expect(getDebugFlags()).toEqual({ ...DEFAULT_DEBUG_FLAGS, forceOffline: true });
  });

  it('presses the ED-safe switch and the live mode changes', async () => {
    await render(<DebugConsole />);
    expect(edSafeMode()).toBe(false);
    await fireEvent(screen.getByTestId('debug:flag:edSafeMode'), 'valueChange', true);
    expect(edSafeMode()).toBe(true);
  });

  it('shows a flag changed from outside the console', async () => {
    await render(<DebugConsole />);
    await act(async () => setDebugFlags({ freshStart: true, scanScenario: '402' }));
    expect(screen.getByTestId('debug:flag:freshStart').props.value).toBe(true);
    expect(screen.getByTestId('debug:flags:values')).toHaveTextContent(/scanScenario 402/);
  });
});
