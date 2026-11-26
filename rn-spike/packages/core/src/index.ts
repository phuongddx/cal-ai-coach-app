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
