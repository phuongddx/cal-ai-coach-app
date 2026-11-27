import { DEFAULT_DEBUG_FLAGS, flagsFromArguments, getDebugFlags, resetDebugFlagsForTests, setDebugFlags } from './launchArgs';

describe('debug flags', () => {
  beforeEach(() => {
    resetDebugFlagsForTests();
  });

  it('starts from the defaults', () => {
    expect(getDebugFlags()).toEqual(DEFAULT_DEBUG_FLAGS);
  });

  it('reads every switch argument', () => {
    expect(
      flagsFromArguments([
        'coachcal',
        '--ccFreshStart',
        '--ccDisableAnimations',
        '--ccEDSafe',
        '--ccFixtureCapture',
        '--ccForceOffline',
        '--ccRequireSignIn',
        '--ccSeedNoTargets',
      ]),
    ).toEqual({
      ...DEFAULT_DEBUG_FLAGS,
      freshStart: true,
      disableAnimations: true,
      edSafe: true,
      fixtureCapture: true,
      forceOffline: true,
      requireSignIn: true,
      seedNoTargets: true,
    });
  });

  it('reads a scan scenario written with an equals sign or as the next argument', () => {
    expect(flagsFromArguments(['--ccScanScenario=402']).scanScenario).toBe('402');
    expect(flagsFromArguments(['--ccScanScenario', '404']).scanScenario).toBe('404');
    expect(flagsFromArguments([]).scanScenario).toBeNull();
  });

  it('reads a fixed clock from the next argument as an ISO 8601 instant, as Swift does', () => {
    expect(flagsFromArguments(['--ccFixedClock', '2026-11-27T05:40:00Z']).fixedClock).toBe(
      Date.parse('2026-11-27T05:40:00Z'),
    );
    expect(flagsFromArguments(['--ccEDSafe', '--ccFixedClock', '2026-11-27T12:40:00+07:00']).fixedClock).toBe(
      Date.parse('2026-11-27T05:40:00Z'),
    );
  });

  it('leaves the real clock for a fixed clock Swift would not parse', () => {
    // The `=` form, epoch milliseconds, fractional seconds, a missing value and a bad value.
    expect(flagsFromArguments(['--ccFixedClock=2026-11-27T05:40:00Z']).fixedClock).toBeNull();
    expect(flagsFromArguments(['--ccFixedClock', '1764210000000']).fixedClock).toBeNull();
    expect(flagsFromArguments(['--ccFixedClock', '2026-11-27T05:40:00.000Z']).fixedClock).toBeNull();
    expect(flagsFromArguments(['--ccFixedClock']).fixedClock).toBeNull();
    expect(flagsFromArguments(['--ccFixedClock', 'not-a-date']).fixedClock).toBeNull();
  });

  it('matches the switches by exact name, as Swift `contains` does', () => {
    expect(flagsFromArguments(['--ccEDSafe=1', '--ccedsafe', '--ccFreshStart2'])).toEqual(DEFAULT_DEBUG_FLAGS);
  });

  it('ignores arguments it does not know', () => {
    expect(flagsFromArguments(['-AppleLanguages', '(en)', '--ccEDSafe'])).toEqual({ ...DEFAULT_DEBUG_FLAGS, edSafe: true });
  });

  it('changes only the flags it is given', () => {
    setDebugFlags({ edSafe: true, scanScenario: '402' });
    setDebugFlags({ edSafe: false });
    expect(getDebugFlags()).toEqual({ ...DEFAULT_DEBUG_FLAGS, scanScenario: '402' });
  });
});
