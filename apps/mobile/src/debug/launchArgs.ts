/**
 * Debug and fixture flags (PL-05). The names are the Swift app's launch arguments, read once at
 * startup. Reading process arguments needs a native module and a native build, which lands with
 * U-51; until then the flags are set through `setDebugFlags` by tests and by the debug console.
 * `flagsFromArguments` is the parser that reader will call with the process arguments.
 */
export type DebugFlags = {
  freshStart: boolean;
  disableAnimations: boolean;
  edSafe: boolean;
  /** `--ccFixedClock=<ISO instant or epoch milliseconds>`; null means the real clock. */
  fixedClock: number | null;
  fixtureCapture: boolean;
  forceOffline: boolean;
  requireSignIn: boolean;
  /** The value of `--ccScanScenario`; null means the live API. */
  scanScenario: string | null;
  seedNoTargets: boolean;
};

export const DEFAULT_DEBUG_FLAGS: Readonly<DebugFlags> = Object.freeze({
  freshStart: false,
  disableAnimations: false,
  edSafe: false,
  fixedClock: null,
  fixtureCapture: false,
  forceOffline: false,
  requireSignIn: false,
  scanScenario: null,
  seedNoTargets: false,
});

function parseInstant(value: string): number | null {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? Date.parse(value) || null : numeric;
}

/** Reads the flags out of a process argument list; unknown arguments are ignored. */
export function flagsFromArguments(argv: readonly string[]): DebugFlags {
  const flags: DebugFlags = { ...DEFAULT_DEBUG_FLAGS };
  const valueOf = (name: string): string | null => {
    const index = argv.findIndex((item) => item === name || item.startsWith(`${name}=`));
    if (index === -1) return null;
    const item = argv[index];
    if (item.startsWith(`${name}=`)) return item.slice(name.length + 1);
    const next = argv[index + 1];
    return next !== undefined && !next.startsWith('--') ? next : '';
  };
  const has = (name: string): boolean => argv.includes(name);

  flags.freshStart = has('--ccFreshStart');
  flags.disableAnimations = has('--ccDisableAnimations');
  flags.edSafe = has('--ccEDSafe');
  flags.fixtureCapture = has('--ccFixtureCapture');
  flags.forceOffline = has('--ccForceOffline');
  flags.requireSignIn = has('--ccRequireSignIn');
  flags.seedNoTargets = has('--ccSeedNoTargets');

  const clock = valueOf('--ccFixedClock');
  if (clock !== null && clock.length > 0) flags.fixedClock = parseInstant(clock);
  const scenario = valueOf('--ccScanScenario');
  if (scenario !== null && scenario.length > 0) flags.scanScenario = scenario;

  return flags;
}

let current: DebugFlags = { ...DEFAULT_DEBUG_FLAGS };

/** The flags in effect; a frozen snapshot until the next `setDebugFlags`. */
export function getDebugFlags(): Readonly<DebugFlags> {
  return current;
}

/** Replaces the given flags and keeps the others. */
export function setDebugFlags(patch: Partial<DebugFlags>): void {
  current = { ...current, ...patch };
}

/** Test hook: back to the defaults. */
export function resetDebugFlagsForTests(): void {
  current = { ...DEFAULT_DEBUG_FLAGS };
}
