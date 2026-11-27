/**
 * KcalArithmetic.swift — the client-side per-100 g arithmetic behind the
 * review sheet. Same rule as the server's canonical `arithmetic.ts`
 * (`roundKcal` / `roundMacro`): half-up rounding, zero grams give zero,
 * never a throw. The displayed kcal after an edit is recomputed from the
 * current grams through these helpers (invariant I6).
 */
export const KcalArithmetic = {
  /** Meal kcal for a food of `per100gKcal` at `grams`, rounded half-up. */
  mealKcal(per100gKcal: number, grams: number): number {
    return Math.round((per100gKcal * grams) / 100);
  },

  /** Macro grams for `per100g` at `grams`, rounded to one decimal. */
  macroGrams(per100g: number, grams: number): number {
    return Math.round(((per100g * grams) / 100) * 10) / 10;
  },
};
