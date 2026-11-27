/**
 * Debug and fixture flags (PL-05). The names are the Swift app's launch arguments, read once at
 * startup. Reading process arguments needs a native module and a native build, which belongs to the
 * native slot (U-50); until then the flags are set through `setDebugFlags` by tests and by the debug
 * console. `flagsFromArguments` is the parser that reader will call with the process arguments.
 *
 * The seven arguments `DebugLaunchArguments.parse()` reads (`AppEnvironment.swift`) follow it exactly:
 * six are bare switches matched by exact name, and `--ccFixedClock` takes the NEXT argument as an
 * ISO 8601 instant in the form `ISO8601DateFormatter` accepts by default (`2026-11-27T05:40:00Z`, no
 * fractional seconds). `--ccScanScenario` and `--ccFixtureCapture` are Swift's `CameraCaptureService`
 * arguments and keep their own forms.
 */
import { useSyncExternalStore } from 'react';

export type DebugFlags = {
  freshStart: boolean;
  disableAnimations: boolean;
  edSafe: boolean;
  /** `--ccFixedClock <ISO 8601 instant>` in epoch milliseconds; null means the real clock. */
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

/** `ISO8601DateFormatter()` default: date, `T`, time to whole seconds, and `Z` or an offset. */
const SWIFT_ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

function parseSwiftInstant(value: string): number | null {
  if (!SWIFT_ISO8601.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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

  // Swift: `firstIndex(of:)` then `index + 1 < count`; an unparsable value leaves the real clock.
  const clockIndex = argv.indexOf('--ccFixedClock');
  if (clockIndex !== -1 && clockIndex + 1 < argv.length) flags.fixedClock = parseSwiftInstant(argv[clockIndex + 1]);
  const scenario = valueOf('--ccScanScenario');
  if (scenario !== null && scenario.length > 0) flags.scanScenario = scenario;

  return flags;
}

let current: DebugFlags = { ...DEFAULT_DEBUG_FLAGS };
const listeners = new Set<() => void>();

/** The flags in effect; a frozen snapshot until the next `setDebugFlags`. */
export function getDebugFlags(): Readonly<DebugFlags> {
  return current;
}

/** Replaces the given flags and keeps the others; subscribers (the root gate, the console) hear of a change. */
export function setDebugFlags(patch: Partial<DebugFlags>): void {
  const next = { ...current, ...patch };
  if ((Object.keys(next) as Array<keyof DebugFlags>).every((key) => next[key] === current[key])) return;
  current = next;
  listeners.forEach((listener) => listener());
}

/** Calls `listener` after every change of the flags; returns the unsubscribe function. */
export function subscribeDebugFlags(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The flags for a component; re-renders when they change. */
export function useDebugFlags(): Readonly<DebugFlags> {
  return useSyncExternalStore(subscribeDebugFlags, getDebugFlags, getDebugFlags);
}

/** Test hook: back to the defaults. */
export function resetDebugFlagsForTests(): void {
  current = { ...DEFAULT_DEBUG_FLAGS };
  listeners.forEach((listener) => listener());
}
