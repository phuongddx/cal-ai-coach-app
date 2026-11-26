/**
 * Unit tests for the HealthKit meal mapping and adapter (spec D3, plan T4).
 *
 * The library is replaced by the manual mock in `src/__mocks__/@kingstinct/`; its shared
 * test state is driven through `healthKitMockControl`. The pure mapping tests run without
 * the mock state at all.
 */

import { afterEach, describe, expect, it } from '@jest/globals';

jest.mock('@kingstinct/react-native-healthkit');

import { AuthorizationStatus } from '@kingstinct/react-native-healthkit';
import {
  deleteMealFromHealth,
  readMealsFromHealth,
  requestMealAuthorization,
  saveMealToHealth,
} from './healthKitMeals';
import { healthKitMockControl as control } from '../../__mocks__/@kingstinct/healthKitMockControl';
import { MOCK_SOURCE_REVISION } from '../../__mocks__/@kingstinct/healthKitMockControl';
import {
  correlationsToMeals,
  dayKeyOf,
  dayKeyRange,
  fixtureMeal,
  healthUuidForMeal,
  MEAL_CORRELATION_TYPE,
  MEAL_METADATA_KEYS,
  MEAL_QUANTITY_IDENTIFIERS,
  MEAL_SAMPLE_UNITS,
  mealToCorrelationPayload,
} from './mealToHealthKit';
import type { CorrelationSample } from '@kingstinct/react-native-healthkit';

const NOON_ON_FIXTURE_DAY = new Date(2026, 10, 27, 12, 40, 0, 0); // 2026-11-27 local

/** The queried sampleType field is a structured object, not the identifier string. */
const SAMPLE_TYPE = (identifier: string) => ({
  identifier,
  allowsRecalibrationForEstimates: false,
  isMinimumDurationRestricted: false,
  isMaximumDurationRestricted: false,
});

/** Builds a stored correlation exactly as `mealToCorrelationPayload` would have saved it. */
function storedFixtureCorrelation(): CorrelationSample {
  const payload = mealToCorrelationPayload(fixtureMeal(NOON_ON_FIXTURE_DAY));
  return {
    uuid: 'hk-correlation-1',
    sourceRevision: MOCK_SOURCE_REVISION,
    metadata: { ...payload.metadata },
    sampleType: SAMPLE_TYPE('HKCorrelationTypeIdentifierFood'),
    startDate: payload.start,
    endDate: payload.end,
    hasUndeterminedDuration: false,
    correlationType: MEAL_CORRELATION_TYPE,
    objects: payload.samples.map((sample) => ({
      uuid: `hk-sample-${sample.quantityType}`,
      sourceRevision: MOCK_SOURCE_REVISION,
      metadata: {},
      sampleType: SAMPLE_TYPE(sample.quantityType),
      startDate: sample.startDate,
      endDate: sample.endDate,
      hasUndeterminedDuration: false,
      quantityType: sample.quantityType,
      quantity: sample.quantity,
      unit: sample.unit,
    })),
  };
}

afterEach(() => {
  control.reset();
});

describe('mealToHealthKit pure mapping', () => {
  it('maps one meal to a food correlation with four samples in kcal and grams', () => {
    const meal = fixtureMeal(NOON_ON_FIXTURE_DAY);
    const payload = mealToCorrelationPayload(meal);

    expect(payload.correlationType).toBe('HKCorrelationTypeIdentifierFood');
    expect(payload.samples).toHaveLength(4);
    expect(payload.start.getTime()).toBe(NOON_ON_FIXTURE_DAY.getTime());
    expect(payload.end.getTime()).toBe(NOON_ON_FIXTURE_DAY.getTime());

    const byIdentifier = new Map(payload.samples.map((s) => [s.quantityType, s]));
    expect(byIdentifier.get('HKQuantityTypeIdentifierDietaryEnergyConsumed')).toMatchObject({
      quantity: 624,
      unit: 'kcal',
    });
    expect(byIdentifier.get('HKQuantityTypeIdentifierDietaryProtein')).toMatchObject({
      quantity: 38,
      unit: 'g',
    });
    expect(byIdentifier.get('HKQuantityTypeIdentifierDietaryCarbohydrates')).toMatchObject({
      quantity: 70,
      unit: 'g',
    });
    expect(byIdentifier.get('HKQuantityTypeIdentifierDietaryFatTotal')).toMatchObject({
      quantity: 18,
      unit: 'g',
    });

    expect(payload.metadata[MEAL_METADATA_KEYS.mealId]).toBe(healthUuidForMeal(meal.id));
    expect(payload.metadata[MEAL_METADATA_KEYS.mealName]).toBe('Chicken rice bowl');
  });

  it('derives a stable UUID from the meal id', () => {
    expect(healthUuidForMeal('meal-a')).toBe(healthUuidForMeal('meal-a'));
    expect(healthUuidForMeal('meal-a')).not.toBe(healthUuidForMeal('meal-b'));
    expect(healthUuidForMeal('meal-a')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('reads a meal of 624 kcal back as 624 with its macros', () => {
    const meals = correlationsToMeals([storedFixtureCorrelation()]);
    expect(meals).toHaveLength(1);
    expect(meals[0].kcal).toBe(624);
    expect(meals[0].proteinG).toBe(38);
    expect(meals[0].carbsG).toBe(70);
    expect(meals[0].fatG).toBe(18);
    expect(meals[0].name).toBe('Chicken rice bowl');
    expect(meals[0].healthKitUuid).toBe('hk-correlation-1');
    expect(meals[0].unknownUnits).toEqual([]);
  });

  it('skips correlations that were not written by this app or are not food', () => {
    const ours = storedFixtureCorrelation();
    const foreign: CorrelationSample = {
      ...ours,
      uuid: 'hk-foreign',
      metadata: { HKMetadataKeyFoodType: 'rice' },
    };
    const nonFood: CorrelationSample = {
      ...ours,
      uuid: 'hk-bp',
      correlationType: 'HKCorrelationTypeIdentifierBloodPressure',
    };
    const meals = correlationsToMeals([foreign, nonFood, ours]);
    expect(meals).toHaveLength(1);
    expect(meals[0].healthKitUuid).toBe('hk-correlation-1');
  });

  it('flags read-back quantities whose unit is not the one we saved with', () => {
    const stored = storedFixtureCorrelation();
    const objects = stored.objects.map((object) =>
      'quantityType' in object && object.quantityType === 'HKQuantityTypeIdentifierDietaryEnergyConsumed'
        ? { ...object, unit: 'Cal' }
        : object,
    );
    const meals = correlationsToMeals([{ ...stored, objects }]);
    expect(meals).toHaveLength(1);
    expect(meals[0].kcal).toBe(0);
    expect(meals[0].unknownUnits).toEqual([
      'HKQuantityTypeIdentifierDietaryEnergyConsumed in Cal',
    ]);
  });

  it('computes the local day range of a day key and rejects malformed keys', () => {
    const range = dayKeyRange('2026-11-27');
    expect(range).not.toBeNull();
    expect(range?.start.getFullYear()).toBe(2026);
    expect(range?.start.getMonth()).toBe(10);
    expect(range?.start.getDate()).toBe(27);
    expect(range?.start.getHours()).toBe(0);
    expect(range?.end.getDate()).toBe(28);
    expect(range?.end.getHours()).toBe(0);

    expect(dayKeyRange('junk')).toBeNull();
    expect(dayKeyRange('2026-13-01')).toBeNull();
    expect(dayKeyRange('2026-02-30')).toBeNull();
    expect(dayKeyOf(NOON_ON_FIXTURE_DAY)).toBe('2026-11-27');
  });
});

describe('healthKitMeals adapter (library mocked)', () => {
  it('requests read and write for the four quantities and the meal correlation', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    const result = await requestMealAuthorization();

    expect(result).toEqual({ ok: true, value: { requested: true } });
    expect(control.state.authRequests).toHaveLength(1);
    for (const identifier of MEAL_QUANTITY_IDENTIFIERS) {
      expect(control.state.authRequests[0].toRead).toContain(identifier);
      expect(control.state.authRequests[0].toShare).toContain(identifier);
    }
    expect(control.state.authRequests[0].toShare).toContain(MEAL_CORRELATION_TYPE);
  });

  it('saves one food correlation with the meal name in metadata', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    const result = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.saved).toBe(true);
    expect(result.value.healthKitUuid).toBe('mock-hk-uuid-1');
    expect(control.state.saveCalls).toHaveLength(1);
    expect(control.state.saveCalls[0].samples).toHaveLength(4);
    expect(control.state.saveCalls[0].metadata?.[MEAL_METADATA_KEYS.mealName]).toBe(
      'Chicken rice bowl',
    );
    expect(control.state.saveCalls[0].metadata?.[MEAL_METADATA_KEYS.mealId]).toBe(
      healthUuidForMeal(fixtureMeal(NOON_ON_FIXTURE_DAY).id),
    );
  });

  it('does not save a meal twice when retried', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    const first = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    const retry = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));

    expect(control.state.saveCalls).toHaveLength(1);
    expect(first.ok && first.value.saved).toBe(true);
    expect(retry.ok).toBe(true);
    if (!retry.ok || !first.ok) return;
    expect(retry.value.saved).toBe(false);
    expect(retry.value.healthKitUuid).toBe(first.value.healthKitUuid);
  });

  it('reports unauthorized instead of throwing when authorization was never requested', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.notDetermined);

    const read = await readMealsFromHealth('2026-11-27');
    const save = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    const remove = await deleteMealFromHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));

    expect(read.ok).toBe(false);
    expect(save.ok).toBe(false);
    expect(remove.ok).toBe(false);
    if (read.ok || save.ok || remove.ok) return;
    expect(read.error.code).toBe('unauthorized');
    expect(save.error.code).toBe('unauthorized');
    expect(remove.error.code).toBe('unauthorized');
    expect(control.state.authorizationStatus).toBe(AuthorizationStatus.notDetermined);
  });

  it('ignores the correlation type status, which is sharingAuthorized before any request', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.notDetermined);
    const save = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    expect(save.ok).toBe(false);
    if (save.ok) return;
    expect(save.error.code).toBe('unauthorized');
    expect(control.state.saveCalls).toHaveLength(0);
  });

  it('reports unauthorized when the user denied sharing', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingDenied);
    const read = await readMealsFromHealth('2026-11-27');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error).toMatchObject({ code: 'unauthorized', name: 'HealthMealError' });
  });

  it('reports notAvailable when the HealthKit store is unavailable (iPad-like)', async () => {
    control.setAvailability(false);

    const auth = await requestMealAuthorization();
    const save = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    const read = await readMealsFromHealth('2026-11-27');
    const remove = await deleteMealFromHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));

    for (const result of [auth, save, read, remove]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('notAvailable');
    }
  });

  it('turns a rejected query into a typed queryFailed error', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    control.failNextQueryWith(new Error('query blew up'));
    const read = await readMealsFromHealth('2026-11-27');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe('queryFailed');
    expect(read.error.message).toContain('query blew up');
  });

  it('turns a rejected save into a typed saveFailed error', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    control.failNextSaveWith(new Error('save blew up'));
    const save = await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    expect(save.ok).toBe(false);
    if (save.ok) return;
    expect(save.error.code).toBe('saveFailed');
  });

  it('deletes only the stored meal by its derived id and reports the count', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    const other = fixtureMeal(NOON_ON_FIXTURE_DAY);
    control.addStoredCorrelation({
      ...storedFixtureCorrelation(),
      uuid: 'hk-other-meal',
      metadata: {
        [MEAL_METADATA_KEYS.mealId]: healthUuidForMeal('some-other-meal'),
        [MEAL_METADATA_KEYS.mealName]: 'Other meal',
      },
    });

    const result = await deleteMealFromHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));
    expect(result).toEqual({ ok: true, value: { deleted: 1 } });

    const remaining = await readMealsFromHealth('2026-11-27');
    expect(remaining.ok).toBe(true);
    if (!remaining.ok) return;
    expect(remaining.value.map((meal) => meal.name)).toEqual(['Other meal']);
  });

  it('reads back the saved meal for its day through the adapter', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);
    await saveMealToHealth(fixtureMeal(NOON_ON_FIXTURE_DAY));

    const read = await readMealsFromHealth('2026-11-27');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toHaveLength(1);
    expect(read.value[0].kcal).toBe(624);
    expect(read.value[0].mealId).toBe(healthUuidForMeal(fixtureMeal(NOON_ON_FIXTURE_DAY).id));
  });
});
