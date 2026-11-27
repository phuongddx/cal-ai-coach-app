/**
 * @coachcal/core — pure domain logic. Must stay importable from RN (Hermes) and Node.
 *
 * kcal rule (ported from web/core.js + KcalArithmetic.swift): protein and carbs are 4 kcal/g,
 * fat is 9 kcal/g; the result is rounded half-up to the nearest integer.
 */

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type Macros = { proteinG: number; carbsG: number; fatG: number };

/** Round half-up, matching `Math.round` on the server (KcalArithmetic parity). */
export function roundHalfUp(value: number): number {
  return Math.round(value);
}

export function kcalFromMacros(macros: Macros): number {
  const { proteinG, carbsG, fatG } = macros;
  if (![proteinG, carbsG, fatG].every((n) => Number.isFinite(n) && n >= 0)) {
    return 0;
  }
  return roundHalfUp(proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat);
}

/** Clamp `value` into [min, max]. Non-finite input (NaN, ±Infinity) collapses to `min` instead of throwing. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Local calendar day as `YYYY-MM-DD` — the DayKey.swift port lives in
 * `dayKey.ts` and is re-exported here unchanged.
 */
export { dayKey } from './dayKey';

export type MacroTotals = Macros & { kcal: number; fiberG: number };

/** What `sumMacros` reads from a meal: the contract `Meal` fields it needs. */
export type MealTotalsInput = Macros & { kcal: number; fiberG: number };

function safe(n: number): number {
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Sum kcal and macros of meals. Unsafe numbers count as 0 (clamp, never throw). Grams keep one decimal. */
export function sumMacros(meals: readonly MealTotalsInput[]): MacroTotals {
  const total = meals.reduce<MacroTotals>(
    (acc, m) => ({
      kcal: acc.kcal + safe(m.kcal),
      proteinG: acc.proteinG + safe(m.proteinG),
      carbsG: acc.carbsG + safe(m.carbsG),
      fatG: acc.fatG + safe(m.fatG),
      fiberG: acc.fiberG + safe(m.fiberG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
  const oneDecimal = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: roundHalfUp(total.kcal),
    proteinG: oneDecimal(total.proteinG),
    carbsG: oneDecimal(total.carbsG),
    fatG: oneDecimal(total.fatG),
    fiberG: oneDecimal(total.fiberG),
  };
}

/** Fraction of `goal` reached by `consumed`, clamped to 0…1. A goal of 0 or less gives 0. */
export function ringProgress(consumed: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) {
    return 0;
  }
  return clamp(consumed / goal, 0, 1);
}

/** kcal left today: goal − consumed, never below 0 (the ring centre number). */
export function kcalLeft(goalKcal: number, consumedKcal: number): number {
  return Math.max(0, roundHalfUp(safe(goalKcal) - safe(consumedKcal)));
}

export { roundKcal, roundMacro, sumItemKcal, type KcalBearing } from './arithmetic';

// ---------------------------------------------------------------------------
// CoachCalCore.swift — the module surface itself.
// ---------------------------------------------------------------------------

/** The Swift module name this package ports (`CoachCalCore.moduleName`). */
export const moduleName = 'CoachCalCore' as const;

/** WalkingSnapshot from CoachCalCore.swift. */
export interface WalkingSnapshot {
  stepCount: number;
}

// ---------------------------------------------------------------------------
// The nine CoachCalCore engine ports — one file per Swift source, all
// re-exported from here (docs/rn-migration/briefs/U-10.md).
// ---------------------------------------------------------------------------

export { KcalArithmetic } from './kcal';

export { TargetsEngine, ACTIVITY_MULTIPLIER } from './targets';
export type {
  Sex,
  ActivityLevel,
  Goal,
  QuizProfile,
  Targets,
  ClampedKcal,
  ClampedPace,
  MacroSplit,
} from './targets';

export { StreakEngine } from './streak';
export type { StreakInput, StreakOutcome } from './streak';

export { WidgetSnapshotStore, encodeWidgetSnapshot, decodeWidgetSnapshot } from './widgetSnapshot';
export type { WidgetSnapshot, WidgetSnapshotContainer } from './widgetSnapshot';

export { compareCanonicalVersions } from './canonicalVersion';
export type { CanonicalRowVersion } from './canonicalVersion';

export {
  SyncEnvelopeError,
  createPushRequest,
  decodeDiaryEntrySnapshot,
  formatSyncDate,
  parseSyncDate,
  rejectUnknownKeys,
  validateAcknowledgementSet,
  validatePullResponse,
} from './syncEnvelope';
export type {
  SyncedTable,
  MutationKind,
  DiaryEntrySnapshot,
  SyncOperation,
  PushRequest,
  PushAcknowledgement,
  PushResponse,
  PulledRow,
  PullResponse,
  SyncTransport,
} from './syncEnvelope';

export { ProofRecordSerializer, ProofRedactionError } from './proofRecord';
export type {
  ProofScenario,
  ProofCheckStatus,
  ProofEnvironment,
  ProofCheck,
  ProofValue,
  ProofRecord,
} from './proofRecord';

export { NotificationScheduler } from './notificationSchedule';
export type {
  MealSlot,
  ScheduledIdentifier,
  NotificationTrigger,
  ScheduledNotificationRequest,
} from './notificationSchedule';
