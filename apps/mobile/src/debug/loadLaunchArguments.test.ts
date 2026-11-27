/**
 * PL-05, the reader of the process arguments (U-79). Swift: `DebugLaunchArguments.parse()` over
 * `ProcessInfo.processInfo.arguments`. The native module is the local Expo module
 * `modules/coachcal-launch-arguments`; Jest has none, so a test installs a stand-in on `globalThis.expo.modules`.
 */
import {
  DEFAULT_DEBUG_FLAGS,
  applyLaunchArguments,
  getDebugFlags,
  loadLaunchArguments,
  resetDebugFlagsForTests,
  setDebugFlags,
} from './launchArgs';

type ExpoGlobal = { modules: Record<string, unknown> };
const expoGlobal = (): ExpoGlobal => (globalThis as unknown as { expo: ExpoGlobal }).expo;

function installNativeModule(module: unknown): void {
  expoGlobal().modules.CoachCalLaunchArguments = module;
}

afterEach(() => {
  delete expoGlobal().modules.CoachCalLaunchArguments;
  resetDebugFlagsForTests();
});

describe('loadLaunchArguments (PL-05)', () => {
  it('returns an empty list when the native module is missing (Jest, a development client built before U-79)', async () => {
    expect(expoGlobal().modules.CoachCalLaunchArguments).toBeUndefined();
    expect(await loadLaunchArguments()).toEqual([]);
  });

  it('returns the process arguments the native module reports', async () => {
    const argv = ['/path/CoachCal', '--ccEDSafe', '--ccFixedClock', '2026-11-27T09:00:00Z'];
    installNativeModule({ getArguments: () => argv });
    expect(await loadLaunchArguments()).toEqual(argv);
  });

  it('returns an empty list when the native module throws or answers with something else', async () => {
    installNativeModule({
      getArguments: () => {
        throw new Error('native failure');
      },
    });
    expect(await loadLaunchArguments()).toEqual([]);

    installNativeModule({ getArguments: () => 'not a list' });
    expect(await loadLaunchArguments()).toEqual([]);

    installNativeModule({ getArguments: () => ['--ccEDSafe', 7, null] });
    expect(await loadLaunchArguments()).toEqual(['--ccEDSafe']);
  });
});

describe('applyLaunchArguments (PL-05)', () => {
  beforeEach(() => resetDebugFlagsForTests());

  it('sets the flags the arguments name and leaves the rest alone', () => {
    const flags = applyLaunchArguments(['/path/CoachCal', '--ccEDSafe', '--ccScanScenario', '402', '--ccFixedClock', '2026-11-27T09:00:00Z']);
    expect(flags).toEqual({
      ...DEFAULT_DEBUG_FLAGS,
      edSafe: true,
      scanScenario: '402',
      fixedClock: Date.parse('2026-11-27T09:00:00Z'),
    });
    expect(getDebugFlags()).toBe(flags);
  });

  it('lets an argument win over a flag set earlier in the same launch', () => {
    setDebugFlags({ scanScenario: '200', fixedClock: Date.parse('2026-01-01T00:00:00Z') });
    applyLaunchArguments(['--ccScanScenario', '402', '--ccFixedClock', '2026-11-27T09:00:00Z']);
    expect(getDebugFlags().scanScenario).toBe('402');
    expect(getDebugFlags().fixedClock).toBe(Date.parse('2026-11-27T09:00:00Z'));
  });

  it('keeps a flag set earlier when the arguments do not mention it', () => {
    setDebugFlags({ forceOffline: true, scanScenario: '402' });
    applyLaunchArguments(['/path/CoachCal']);
    expect(getDebugFlags()).toEqual({ ...DEFAULT_DEBUG_FLAGS, forceOffline: true, scanScenario: '402' });
  });

  it('changes nothing for an empty list', () => {
    const before = getDebugFlags();
    applyLaunchArguments([]);
    expect(getDebugFlags()).toBe(before);
  });
});
