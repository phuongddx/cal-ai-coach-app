/**
 * HealthKitService.swift — the Swift service API over injected native calls (the
 * `HealthStoring` seam of the Swift file; here the seam is `HealthKitNativePort`, so Jest
 * injects doubles and never loads the Nitro-backed library — the real port lives in
 * `healthKitNative.ts` and is imported only by route-level files).
 *
 * Contract parity with Swift, kept line for line:
 * - `requestAuthorizationIfNeeded()` asks to READ the step count only, and only while the
 *   status is `.notDetermined`; never throws; false on denial.
 * - `enableBackgroundDeliveryIfAuthorized()` registers hourly delivery for steps, no-op
 *   unless authorized, and swallows failures (`try?`).
 * - `todayStepCount()` is the midnight-to-now anchored object query; 0 while unauthorized.
 * - `writeBurnedEnergy(entry)` only accepts a `ConfirmedEnergyEntry` (the branded type is
 *   the write gate — no AI-scan type converts into it).
 * - `burnAddBackEnabled` reads the same stored key the Settings toggle writes
 *   (`HealthKitSettingsKey.burnAddBackEnabled`; the app_settings `'1'`/`'0'` format).
 * - `deleteMealSamples(meal)` is I12 on top of what the spike proved: deleting a meal
 *   correlation does NOT delete its child samples, so they are collected first and
 *   deleted one by one (per quantity type) after the correlation.
 *
 * Status/operator numbers mirror the library's ObjC enums (`AuthorizationStatus`,
 * `ComparisonPredicateOperator`, `UpdateFrequency`) — values are stable, so this
 * type-only module never imports the library at runtime.
 */

import {
  confirmEnergyEntry,
  type ConfirmedEnergyEntry,
} from './confirmedEnergyEntry';
import {
  healthUuidForMeal,
  MEAL_CORRELATION_TYPE,
  MEAL_METADATA_KEYS,
  type Meal,
} from './mealToHealthKit';

export { confirmEnergyEntry, type ConfirmedEnergyEntry } from './confirmedEnergyEntry';

/** Mirrors `AuthorizationStatus` (0 notDetermined, 1 sharingDenied, 2 sharingAuthorized). */
export const HealthAuthorizationStatus = {
  notDetermined: 0,
  sharingDenied: 1,
  sharingAuthorized: 2,
} as const;
export type HealthAuthorizationStatus = 2 | 1 | 0;

/** Mirrors `ComparisonPredicateOperator.equalTo`. */
const EQUAL_TO = 4;
/** Mirrors `UpdateFrequency.hourly` — stepCount's delivery is hourly-capped by the platform. */
const HOURLY = 2;

const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount';
const ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned';

/** The correlation rows the delete needs, reduced to the two fields it touches. */
export interface MealCorrelationChild {
  readonly uuid: string;
  readonly quantityType: string;
}

export interface MealCorrelationRow {
  readonly uuid: string;
  readonly objects: ReadonlyArray<MealCorrelationChild>;
}

export type MealMetadataFilter = {
  readonly withMetadataKey: string;
  readonly operatorType: number;
  readonly value: string;
};

/**
 * The exact `@kingstinct/react-native-healthkit` surface the service touches — the
 * `HealthStoring` counterpart. Identifiers are the plain HK strings; status values are
 * `HealthAuthorizationStatus`.
 */
export interface HealthKitNativePort {
  authorizationStatusFor(type: string): HealthAuthorizationStatus;
  requestAuthorization(types: {
    toShare: readonly string[];
    toRead: readonly string[];
  }): Promise<boolean>;
  enableBackgroundDelivery(type: string, updateFrequency: number): Promise<boolean>;
  queryQuantitySamplesWithAnchor(
    type: string,
    options: {
      readonly anchor?: string;
      readonly limit: number;
      readonly filter?: {
        readonly date?: {
          readonly startDate?: Date;
          readonly endDate?: Date;
          readonly strictStartDate?: boolean;
        };
      };
    },
  ): Promise<{
    readonly samples: ReadonlyArray<{ readonly quantity: number }>;
    readonly newAnchor: string;
  }>;
  saveQuantitySample(
    type: string,
    unit: string,
    value: number,
    start: Date,
    end: Date,
    metadata?: Record<string, unknown>,
  ): Promise<{ readonly uuid: string } | undefined>;
  queryCorrelationSamples(
    type: string,
    options: { readonly limit: number; readonly filter?: { readonly metadata?: MealMetadataFilter } },
  ): Promise<readonly MealCorrelationRow[]>;
  deleteObjects(
    type: string,
    filter: { readonly metadata?: MealMetadataFilter; readonly uuids?: readonly string[] },
  ): Promise<number>;
}

/** What the caller must provide besides the port (Swift: `init(store:now:)`). */
export interface HealthKitServiceDeps {
  readonly native: HealthKitNativePort;
  readonly now: () => Date;
  /**
   * Reads the stored burn-add-back flag (the Settings toggle's key, `'1'`/`'0'`).
   * Omitted reads as false — the `NoOpHealthKitService` default — until a route binds
   * the database (the steps card is a later unit's caller).
   */
  readonly readBurnAddBack?: () => Promise<boolean>;
}

export interface HealthKitService {
  requestAuthorizationIfNeeded(): Promise<boolean>;
  enableBackgroundDeliveryIfAuthorized(): Promise<void>;
  todayStepCount(): Promise<number>;
  writeBurnedEnergy(entry: ConfirmedEnergyEntry): Promise<void>;
  deleteMealSamples(meal: Meal): Promise<{ deleted: number; deletedSamples: number }>;
  /** Async because the RN flag lives in the database, not `UserDefaults`. */
  burnAddBackEnabled(): Promise<boolean>;
}

/** Pure aggregation, unit-tested directly — the Swift `aggregateStepCount(from:)` twin. */
export function aggregateStepCount(
  samples: ReadonlyArray<{ readonly quantity: number }>,
): number {
  return samples.reduce((total, sample) => total + sample.quantity, 0);
}

export function createHealthKitService(deps: HealthKitServiceDeps): HealthKitService {
  const { native } = deps;
  // The anchored query's anchor, kept across calls exactly like the Swift service does.
  let anchor: string | undefined;

  const stepStatus = (): HealthAuthorizationStatus => native.authorizationStatusFor(STEP_TYPE);

  return {
    /**
     * JIT permission ask — only requests when not determined, never throws, false on
     * denial. Asks to READ steps only: `toShare` stays empty (Swift passes `[]`).
     */
    async requestAuthorizationIfNeeded(): Promise<boolean> {
      switch (stepStatus()) {
        case HealthAuthorizationStatus.sharingAuthorized:
          return true;
        case HealthAuthorizationStatus.notDetermined:
          try {
            await native.requestAuthorization({ toShare: [], toRead: [STEP_TYPE] });
          } catch {
            return false;
          }
          return stepStatus() === HealthAuthorizationStatus.sharingAuthorized;
        default:
          return false;
      }
    },

    /** Hourly background delivery for steps within the platform's cap; `try?` parity. */
    async enableBackgroundDeliveryIfAuthorized(): Promise<void> {
      if (stepStatus() !== HealthAuthorizationStatus.sharingAuthorized) return;
      try {
        await native.enableBackgroundDelivery(STEP_TYPE, HOURLY);
      } catch {
        // try? — delivery timing is a platform detail, never a user-visible failure.
      }
    },

    /** Midnight-to-now anchored step query; 0 while unauthorized. */
    async todayStepCount(): Promise<number> {
      if (stepStatus() !== HealthAuthorizationStatus.sharingAuthorized) return 0;
      const now = deps.now();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const response = await native.queryQuantitySamplesWithAnchor(STEP_TYPE, {
        anchor: anchor === undefined ? undefined : anchor,
        limit: 0,
        filter: { date: { startDate: start, endDate: now, strictStartDate: true } },
      });
      anchor = response.newAnchor;
      return aggregateStepCount(response.samples);
    },

    /** The ONE seam that may save an energy sample — a confirmed entry type-checks it. */
    async writeBurnedEnergy(entry: ConfirmedEnergyEntry): Promise<void> {
      await native.saveQuantitySample(
        ENERGY_TYPE,
        'kcal',
        entry.kcal,
        entry.confirmedAt,
        entry.confirmedAt,
      );
    },

    /**
     * I12: a meal is one correlation of four child quantity samples; deleting the
     * correlation leaves the children behind (proven on the Simulator by the spike), so
     * the children are collected first and deleted per quantity type after it.
     */
    async deleteMealSamples(meal: Meal): Promise<{ deleted: number; deletedSamples: number }> {
      const metadataFilter: MealMetadataFilter = {
        withMetadataKey: MEAL_METADATA_KEYS.mealId,
        operatorType: EQUAL_TO,
        value: healthUuidForMeal(meal.id),
      };
      const stored = await native.queryCorrelationSamples(MEAL_CORRELATION_TYPE, {
        limit: 0,
        filter: { metadata: metadataFilter },
      });
      const childUuidsByType = new Map<string, string[]>();
      for (const correlation of stored) {
        for (const child of correlation.objects) {
          const uuids = childUuidsByType.get(child.quantityType) ?? [];
          uuids.push(child.uuid);
          childUuidsByType.set(child.quantityType, uuids);
        }
      }

      const deleted = await native.deleteObjects(MEAL_CORRELATION_TYPE, {
        metadata: metadataFilter,
      });

      let deletedSamples = 0;
      for (const [quantityType, uuids] of childUuidsByType) {
        deletedSamples += await native.deleteObjects(quantityType, { uuids });
      }
      return { deleted, deletedSamples };
    },

    /** The Settings toggle's key, read on every call like `UserDefaults.bool`. */
    async burnAddBackEnabled(): Promise<boolean> {
      if (!deps.readBurnAddBack) return false;
      return deps.readBurnAddBack();
    },
  };
}
