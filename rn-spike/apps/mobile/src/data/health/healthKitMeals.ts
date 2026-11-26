/**
 * HealthKit adapter for meal correlations (spec D3). The console (`spikeActions.ts`) and
 * the tests import this module, never the library directly.
 *
 * Every exported function returns a `HealthResult` — nothing throws out of the adapter,
 * so a HealthKit refusal or unavailability leaves the app usable (spec: typed errors,
 * never a crash). Unit tests run against the manual mock in `src/__mocks__/@kingstinct/`.
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  ComparisonPredicateOperator,
  deleteObjects,
  isHealthDataAvailable,
  queryCorrelationSamples,
  requestAuthorization,
  saveCorrelationSample,
} from '@kingstinct/react-native-healthkit';
import {
  correlationsToMeals,
  dayKeyRange,
  healthUuidForMeal,
  MEAL_CORRELATION_TYPE,
  MEAL_METADATA_KEYS,
  MEAL_QUANTITY_IDENTIFIERS,
  mealToCorrelationPayload,
  type HealthMealReadBack,
  type Meal,
} from './mealToHealthKit';

export type HealthMealErrorCode =
  | 'notAvailable'
  | 'unauthorized'
  | 'saveFailed'
  | 'queryFailed';

export class HealthMealError extends Error {
  readonly code: HealthMealErrorCode;

  constructor(code: HealthMealErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'HealthMealError';
    this.code = code;
  }
}

export type HealthResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: HealthMealError };

function failure<T>(code: HealthMealErrorCode, message: string): HealthResult<T> {
  return { ok: false, error: new HealthMealError(code, message) };
}

/** The meal correlation type plus the four quantity types, for authorization requests. */
const ALL_MEAL_TYPES = [MEAL_CORRELATION_TYPE, ...MEAL_QUANTITY_IDENTIFIERS] as const;

/**
 * Read + write authorization for the four quantity types and the meal correlation type
 * (spec D3). The promise resolves once the sheet completes; it does not tell whether the
 * user granted — Apple never exposes read grants, so callers re-check with
 * `authorizationStatusFor` before touching data.
 */
export async function requestMealAuthorization(): Promise<
  HealthResult<{ requested: boolean }>
> {
  if (!isHealthDataAvailable()) {
    return failure('notAvailable', 'HealthKit is not available on this device');
  }
  try {
    const requested = await requestAuthorization({
      toShare: [...ALL_MEAL_TYPES],
      toRead: [...ALL_MEAL_TYPES],
    });
    return { ok: true, value: { requested } };
  } catch (error) {
    return failure('queryFailed', `authorization request failed: ${String(error)}`);
  }
}

/**
 * HealthKit has no readable read-grant (Apple hides it), and querying a type that was
 * never requested can crash the app (the library README warns about exactly this). The
 * write status of the correlation type is the proxy: `notDetermined` (never asked) and
 * `sharingDenied` (asked, refused) both count as unauthorized.
 */
function isAuthorizedForMeals(): boolean {
  return authorizationStatusFor(MEAL_CORRELATION_TYPE) === AuthorizationStatus.sharingAuthorized;
}

export type SaveMealOutcome = {
  /** False when a correlation for this meal id already existed — the retry case of spec D3. */
  saved: boolean;
  /** HealthKit's own UUID of the correlation row. */
  healthKitUuid: string | undefined;
  /** The stable UUID derived from the meal id that travels in the metadata. */
  mealHealthUuid: string;
};

export async function saveMealToHealth(
  meal: Meal,
): Promise<HealthResult<SaveMealOutcome>> {
  if (!isHealthDataAvailable()) {
    return failure('notAvailable', 'HealthKit is not available on this device');
  }
  if (!isAuthorizedForMeals()) {
    return failure(
      'unauthorized',
      'meal write not authorized — call requestMealAuthorization() first',
    );
  }
  const payload = mealToCorrelationPayload(meal);
  const mealHealthUuid = payload.metadata[MEAL_METADATA_KEYS.mealId];
  try {
    // Idempotency probe: the library's save API takes no UUID, so a retry must find its
    // earlier row by the derived id in the metadata before saving again (spec D3: a retry
    // cannot double-save).
    const existing = await queryCorrelationSamples(MEAL_CORRELATION_TYPE, {
      limit: 1,
      filter: {
        metadata: {
          withMetadataKey: MEAL_METADATA_KEYS.mealId,
          operatorType: ComparisonPredicateOperator.equalTo,
          value: mealHealthUuid,
        },
      },
    });
    const found = existing.find(
      (correlation) =>
        (correlation.metadata as Record<string, unknown> | undefined)?.[
          MEAL_METADATA_KEYS.mealId
        ] === mealHealthUuid,
    );
    if (found) {
      return { ok: true, value: { saved: false, healthKitUuid: found.uuid, mealHealthUuid } };
    }
    const saved = await saveCorrelationSample(
      MEAL_CORRELATION_TYPE,
      payload.samples,
      payload.start,
      payload.end,
      payload.metadata,
    );
    if (!saved) {
      return failure('saveFailed', `HealthKit did not confirm the save of meal ${meal.id}`);
    }
    return {
      ok: true,
      value: { saved: true, healthKitUuid: saved.uuid, mealHealthUuid },
    };
  } catch (error) {
    return failure('saveFailed', `saving meal ${meal.id} failed: ${String(error)}`);
  }
}

export async function readMealsFromHealth(
  dayKey: string,
): Promise<HealthResult<HealthMealReadBack[]>> {
  if (!isHealthDataAvailable()) {
    return failure('notAvailable', 'HealthKit is not available on this device');
  }
  if (!isAuthorizedForMeals()) {
    return failure(
      'unauthorized',
      'meal read not authorized — call requestMealAuthorization() first',
    );
  }
  const range = dayKeyRange(dayKey);
  if (!range) {
    return failure('queryFailed', `not a YYYY-MM-DD day key: ${dayKey}`);
  }
  try {
    const correlations = await queryCorrelationSamples(MEAL_CORRELATION_TYPE, {
      limit: 0, // 0 = no limit, per the library's query-options docs
      ascending: true,
      filter: {
        date: {
          startDate: range.start,
          endDate: range.end,
          strictStartDate: true,
          strictEndDate: true,
        },
      },
    });
    return { ok: true, value: correlationsToMeals(correlations) };
  } catch (error) {
    return failure('queryFailed', `reading meals for ${dayKey} failed: ${String(error)}`);
  }
}

export async function deleteMealFromHealth(
  meal: Meal,
): Promise<HealthResult<{ deleted: number }>> {
  if (!isHealthDataAvailable()) {
    return failure('notAvailable', 'HealthKit is not available on this device');
  }
  if (!isAuthorizedForMeals()) {
    return failure(
      'unauthorized',
      'meal delete not authorized — call requestMealAuthorization() first',
    );
  }
  const mealHealthUuid = healthUuidForMeal(meal.id);
  try {
    const deleted = await deleteObjects(MEAL_CORRELATION_TYPE, {
      metadata: {
        withMetadataKey: MEAL_METADATA_KEYS.mealId,
        operatorType: ComparisonPredicateOperator.equalTo,
        value: mealHealthUuid,
      },
    });
    return { ok: true, value: { deleted } };
  } catch (error) {
    return failure('saveFailed', `deleting meal ${meal.id} failed: ${String(error)}`);
  }
}
