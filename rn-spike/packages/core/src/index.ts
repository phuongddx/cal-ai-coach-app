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
 * Local calendar day as `YYYY-MM-DD`, using the device's local time zone (the web client's `dayKey`).
 * An invalid date returns an empty string rather than throwing.
 */
export function dayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
