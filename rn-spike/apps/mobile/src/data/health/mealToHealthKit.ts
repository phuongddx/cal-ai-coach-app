/**
 * Pure mapping between spike meals and HealthKit payloads (spec D3).
 *
 * Only `import type` from the library, so this file loads in Jest with no Nitro native
 * modules and is unit-tested directly. The library-facing wrapper is `healthKitMeals.ts`.
 */

import type {
  CorrelationSample,
  CorrelationTypeIdentifier,
  QuantitySampleForSaving,
} from '@kingstinct/react-native-healthkit';

/**
 * Meal shape of the sync contract (spec D4), declared locally on purpose: T4 must not
 * import `packages/api-contract` (plan's file-ownership table).
 */
export type Meal = {
  id: string;
  /** ISO-8601. */
  eatenAt: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Client wall clock at the last edit, ms (the LWW clock; unused by the Health mapping). */
  updatedAt: number;
};

/** One meal is one correlation of type meal (spec D3) — the food correlation type. */
export const MEAL_CORRELATION_TYPE: CorrelationTypeIdentifier =
  'HKCorrelationTypeIdentifierFood';

/** The four quantity samples every meal correlation holds (spec D3). */
export const MEAL_QUANTITY_IDENTIFIERS = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
] as const;

export type MealQuantityIdentifier = (typeof MEAL_QUANTITY_IDENTIFIERS)[number];

/**
 * Units we save with, also the units the read-back accepts. These match the canonical
 * units the library itself declares for these types (`QUANTITY_IDENTIFIER_CANONICAL_UNITS`
 * in `generated/healthkit.generated.ts`: kcal, g, g, g).
 */
export const MEAL_SAMPLE_UNITS: Record<MealQuantityIdentifier, string> = {
  HKQuantityTypeIdentifierDietaryEnergyConsumed: 'kcal',
  HKQuantityTypeIdentifierDietaryProtein: 'g',
  HKQuantityTypeIdentifierDietaryCarbohydrates: 'g',
  HKQuantityTypeIdentifierDietaryFatTotal: 'g',
};

/**
 * Custom metadata keys. HealthKit keeps custom keys readable by the writing app only,
 * so the presence of `mealId` is what marks a correlation as written by this spike app.
 */
export const MEAL_METADATA_KEYS = {
  mealId: 'ccSpikeMealId',
  mealName: 'ccSpikeMealName',
} as const;

/**
 * Deterministic UUID derived from the meal id (spec D3: stable, so a retry maps to the
 * same identity). The library's save API takes no UUID — HealthKit assigns the stored
 * correlation its own UUID — so this value travels in the metadata and is the idempotency
 * key `saveMealToHealth` checks before saving. Four FNV-1a lanes formatted as a UUID
 * (version 4 nibble, RFC-4122 variant bits); deterministic, not cryptographic.
 */
export function healthUuidForMeal(mealId: string): string {
  const fnv1a = (input: string, seed: number): number => {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };
  const hex8 = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  const a = fnv1a(mealId, 0x811c9dc5);
  const b = fnv1a(`${mealId}#b`, 0x9dc5811c);
  const c = fnv1a(`${mealId}#c`, 0xc59d811c);
  const d = fnv1a(`${mealId}#d`, 0x1c811c9d);
  const e = fnv1a(`${mealId}#e`, 0x339d811c);
  // RFC-4122 variant `10xx`: mask to 14 bits, then set bit 15.
  const variant = (((c >>> 12) & 0x3fff) | 0x8000) & 0xffff;
  return [
    hex8(a),
    hex8(b).slice(0, 4),
    `4${hex8(b).slice(5, 8)}`,
    variant.toString(16).padStart(4, '0'),
    `${hex8(d)}${hex8(e).slice(0, 4)}`,
  ].join('-');
}

/** Everything `saveCorrelationSample` needs to store one meal as one correlation. */
export type MealCorrelationPayload = {
  correlationType: CorrelationTypeIdentifier;
  samples: QuantitySampleForSaving[];
  start: Date;
  end: Date;
  metadata: Record<string, string>;
};

export function mealToCorrelationPayload(meal: Meal): MealCorrelationPayload {
  const when = new Date(meal.eatenAt);
  const samples = MEAL_QUANTITY_IDENTIFIERS.map((quantityType) => ({
    startDate: when,
    endDate: when,
    quantityType,
    quantity: mealQuantityFor(meal, quantityType),
    unit: MEAL_SAMPLE_UNITS[quantityType],
  }));
  return {
    correlationType: MEAL_CORRELATION_TYPE,
    samples,
    start: when,
    end: when,
    metadata: {
      [MEAL_METADATA_KEYS.mealId]: healthUuidForMeal(meal.id),
      [MEAL_METADATA_KEYS.mealName]: meal.name,
    },
  };
}

function mealQuantityFor(meal: Meal, quantityType: MealQuantityIdentifier): number {
  switch (quantityType) {
    case 'HKQuantityTypeIdentifierDietaryEnergyConsumed':
      return meal.kcal;
    case 'HKQuantityTypeIdentifierDietaryProtein':
      return meal.proteinG;
    case 'HKQuantityTypeIdentifierDietaryCarbohydrates':
      return meal.carbsG;
    case 'HKQuantityTypeIdentifierDietaryFatTotal':
      return meal.fatG;
  }
}

/** One meal read back from a stored correlation. */
export type HealthMealReadBack = {
  /** The stable UUID we derived from the meal id (from metadata), not HealthKit's own sample UUID. */
  mealId: string;
  name: string;
  /** ISO-8601, from the correlation's start date. */
  eatenAt: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Fiber is not saved to HealthKit (only four samples are), so it always reads back as 0. */
  fiberG: number;
  /** HealthKit's own UUID of the correlation row. */
  healthKitUuid: string;
  /** Quantities whose unit the reduction could not interpret — surfaced, never silently dropped. */
  unknownUnits: string[];
};

/**
 * Read-back reduction (spec D3): correlations of type meal written by this app → plain
 * meal objects. Correlations without our `mealId` metadata (other apps, or Health's own)
 * are skipped: other apps never see our custom keys, so key presence is the app filter.
 */
export function correlationsToMeals(
  correlations: readonly CorrelationSample[],
): HealthMealReadBack[] {
  const meals: HealthMealReadBack[] = [];
  for (const correlation of correlations) {
    if (correlation.correlationType !== MEAL_CORRELATION_TYPE) continue;
    const metadata = (correlation.metadata ?? {}) as Record<string, unknown>;
    const mealId = metadata[MEAL_METADATA_KEYS.mealId];
    if (typeof mealId !== 'string' || mealId === '') continue;
    const name = metadata[MEAL_METADATA_KEYS.mealName];

    const unknownUnits: string[] = [];
    let kcal = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const object of correlation.objects) {
      if (!('quantityType' in object)) continue;
      const expectedUnit = MEAL_SAMPLE_UNITS[object.quantityType as MealQuantityIdentifier];
      if (expectedUnit === undefined) continue;
      if (object.unit !== expectedUnit) {
        unknownUnits.push(`${object.quantityType} in ${object.unit}`);
        continue;
      }
      switch (object.quantityType) {
        case 'HKQuantityTypeIdentifierDietaryEnergyConsumed':
          kcal = object.quantity;
          break;
        case 'HKQuantityTypeIdentifierDietaryProtein':
          proteinG = object.quantity;
          break;
        case 'HKQuantityTypeIdentifierDietaryCarbohydrates':
          carbsG = object.quantity;
          break;
        case 'HKQuantityTypeIdentifierDietaryFatTotal':
          fatG = object.quantity;
          break;
      }
    }

    meals.push({
      mealId,
      name: typeof name === 'string' && name !== '' ? name : '(unknown meal)',
      eatenAt: correlation.startDate.toISOString(),
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: 0,
      healthKitUuid: correlation.uuid,
      unknownUnits,
    });
  }
  return meals;
}

/** Local-day Date range for a `YYYY-MM-DD` key; null when the key is malformed. */
export function dayKeyRange(dayKey: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, monthIndex, day, 0, 0, 0, 0);
  const end = new Date(year, monthIndex, day + 1, 0, 0, 0, 0);
  // Out-of-range parts roll over instead of failing; reject those keys.
  if (start.getFullYear() !== year || start.getMonth() !== monthIndex || start.getDate() !== day) {
    return null;
  }
  return { start, end };
}

/** `YYYY-MM-DD` key of a Date in local time (the day-key convention of the spike). */
export function dayKeyOf(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Fixed id for the console fixture meal, so repeated health-save runs hit the idempotency path. */
export const FIXTURE_MEAL_ID = 'c1a7a0e2-4b1d-4f0e-9a21-6f5c8d2e3b10';

/**
 * The fixture meal the `health-save` console action writes (plan T4): Chicken rice bowl,
 * 624 kcal, 38/70/18 g, eaten today at 12:40 local. `fiberG` is display-only and not
 * saved to HealthKit.
 */
export function fixtureMeal(now: Date = new Date()): Meal {
  const eatenAt = new Date(now);
  eatenAt.setHours(12, 40, 0, 0);
  return {
    id: FIXTURE_MEAL_ID,
    eatenAt: eatenAt.toISOString(),
    name: 'Chicken rice bowl',
    kcal: 624,
    proteinG: 38,
    carbsG: 70,
    fatG: 18,
    fiberG: 4,
    updatedAt: now.getTime(),
  };
}
