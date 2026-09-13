/**
 * Canonical scan arithmetic — the single kcal/macro computation rule for
 * every response and golden fixture. Inputs are pre-validated contract
 * numbers; the module is pure with zero I/O.
 *
 * Math.round is half-up for positive values; this exact rule is the spec for
 * Swift display parity. The server-computed value is canonical — clients
 * display it, they never re-compute it.
 */

export const roundKcal = (per100g: number, grams: number): number => {
  if (grams <= 0) {
    return 0;
  }
  return Math.round((per100g * grams) / 100);
};

export const roundMacro = (per100g: number, grams: number): number => {
  if (grams <= 0) {
    return 0;
  }
  return Math.round((per100g * grams) / 10) / 10;
};

export interface KcalBearing {
  kcal: number;
}

export const sumItemKcal = <T extends KcalBearing>(
  items: readonly T[]
): number => items.reduce((mealKcal, item) => mealKcal + item.kcal, 0);
