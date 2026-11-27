/**
 * Jest twin of native/App/CoachCalTests/HealthKitServiceTests.swift — one case per Swift
 * test, the same behavior sentence. The Swift suite proves the LOGIC seam over a mock
 * `HealthStoring`; this one injects the same kind of mock as the `HealthKitNativePort`.
 *
 * Brief-required extras beyond the Swift cases: the narrowed ask reads the step count only
 * and skips a determined status; deleting a meal removes each child sample (I12); the
 * anchored step query and the stored burn-add-back read.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  confirmEnergyEntry,
  aggregateStepCount,
  createHealthKitService,
  HealthAuthorizationStatus,
  type HealthKitNativePort,
  type MealCorrelationRow,
} from './healthKitService';
import { fixtureMeal } from './mealToHealthKit';

const NOON_ON_FIXTURE_DAY = new Date(2026, 10, 27, 12, 40, 0, 0); // 2026-11-27 local
const MIDNIGHT_ON_FIXTURE_DAY = new Date(2026, 10, 27, 0, 0, 0, 0);

/** The MockHealthStore of the Swift suite: one status for every type, counts per call. */
class MockHealthKitNative implements HealthKitNativePort {
  status: HealthAuthorizationStatus = HealthAuthorizationStatus.notDetermined;
  requestCallCount = 0;
  backgroundDeliveryCallCount = 0;
  savedSamples: Array<{
    type: string;
    unit: string;
    value: number;
    start: Date;
    end: Date;
    metadata?: Record<string, unknown>;
  }> = [];
  queries: Array<{
    type: string;
    anchor?: string;
    limit: number;
    startDate?: Date;
    endDate?: Date;
    strictStartDate?: boolean;
  }> = [];
  correlations: MealCorrelationRow[] = [];
  deleteCalls: Array<{ type: string; filter: { metadata?: unknown; uuids?: readonly string[] } }> = [];
  nextAnchor = 'anchor-1';
  failNextRequestWith: Error | undefined;

  authorizationStatusFor(): HealthAuthorizationStatus {
    return this.status;
  }

  // Like the Swift mock's requestAuthorization: records, then grants.
  async requestAuthorization(types: {
    toShare: readonly string[];
    toRead: readonly string[];
  }): Promise<boolean> {
    this.requestCallCount += 1;
    this.lastRequest = { toShare: [...types.toShare], toRead: [...types.toRead] };
    if (this.failNextRequestWith) {
      const error = this.failNextRequestWith;
      this.failNextRequestWith = undefined;
      throw error;
    }
    this.status = HealthAuthorizationStatus.sharingAuthorized;
    return true;
  }

  lastRequest: { toShare: string[]; toRead: string[] } | undefined;

  async enableBackgroundDelivery(): Promise<boolean> {
    this.backgroundDeliveryCallCount += 1;
    return true;
  }

  async queryQuantitySamplesWithAnchor(
    type: string,
    options: {
      readonly anchor?: string;
      readonly limit: number;
      readonly filter?: {
        readonly date?: { readonly startDate?: Date; readonly endDate?: Date; readonly strictStartDate?: boolean };
      };
    },
  ): Promise<{ readonly samples: ReadonlyArray<{ readonly quantity: number }>; readonly newAnchor: string }> {
    this.queries.push({
      type,
      anchor: options.anchor,
      limit: options.limit,
      startDate: options.filter?.date?.startDate,
      endDate: options.filter?.date?.endDate,
      strictStartDate: options.filter?.date?.strictStartDate,
    });
    return { samples: [{ quantity: 500 }, { quantity: 250 }], newAnchor: this.nextAnchor };
  }

  async saveQuantitySample(
    type: string,
    unit: string,
    value: number,
    start: Date,
    end: Date,
    metadata?: Record<string, unknown>,
  ): Promise<{ readonly uuid: string } | undefined> {
    this.savedSamples.push({ type, unit, value, start, end, metadata });
    return { uuid: 'saved-1' };
  }

  async queryCorrelationSamples(
    _type: string,
    _options: { readonly limit: number },
  ): Promise<readonly MealCorrelationRow[]> {
    return this.correlations;
  }

  async deleteObjects(
    type: string,
    filter: { readonly metadata?: unknown; readonly uuids?: readonly string[] },
  ): Promise<number> {
    this.deleteCalls.push({ type, filter });
    return filter.uuids ? filter.uuids.length : 1;
  }
}

function makeService(native: MockHealthKitNative, readBurnAddBack?: () => Promise<boolean>) {
  return createHealthKitService({
    native,
    now: () => NOON_ON_FIXTURE_DAY,
    ...(readBurnAddBack ? { readBurnAddBack } : {}),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HealthKitService — the HealthKitServiceTests twin', () => {
  let native: MockHealthKitNative;

  beforeEach(() => {
    native = new MockHealthKitNative();
  });

  it('requests exactly once when the status is not determined', async () => {
    native.status = HealthAuthorizationStatus.notDetermined;
    const service = makeService(native);

    const granted = await service.requestAuthorizationIfNeeded();

    expect(granted).toBe(true);
    expect(native.requestCallCount).toBe(1);
  });

  it('never requests again when already authorized', async () => {
    native.status = HealthAuthorizationStatus.sharingAuthorized;
    const service = makeService(native);

    const granted = await service.requestAuthorizationIfNeeded();

    expect(granted).toBe(true);
    expect(native.requestCallCount).toBe(0); // already-authorized must never re-prompt
  });

  it('returns false without throwing when the status is a terminal denial', async () => {
    native.status = HealthAuthorizationStatus.sharingDenied;
    const service = makeService(native);

    const granted = await service.requestAuthorizationIfNeeded();

    expect(granted).toBe(false);
    expect(native.requestCallCount).toBe(0); // a terminal denial is a JIT no-op, not a re-ask
  });

  it('enables background delivery only when authorized', async () => {
    native.status = HealthAuthorizationStatus.notDetermined;
    const service = makeService(native);

    await service.enableBackgroundDeliveryIfAuthorized();
    expect(native.backgroundDeliveryCallCount).toBe(0);

    native.status = HealthAuthorizationStatus.sharingAuthorized;
    await service.enableBackgroundDeliveryIfAuthorized();
    expect(native.backgroundDeliveryCallCount).toBe(1);
  });

  it('aggregates step samples by summing their quantities', () => {
    const samples = [{ quantity: 500 }, { quantity: 250 }];

    expect(aggregateStepCount(samples)).toBe(750);
  });

  it('aggregates an empty sample list to zero', () => {
    expect(aggregateStepCount([])).toBe(0);
  });

  it('writes burned energy from a confirmed energy entry', async () => {
    const service = makeService(native);
    const confirmedAt = new Date(2026, 10, 27, 18, 5, 0, 0);
    const entry = confirmEnergyEntry(320, confirmedAt);

    await service.writeBurnedEnergy(entry);

    expect(native.savedSamples).toHaveLength(1);
    expect(native.savedSamples[0]).toMatchObject({
      type: 'HKQuantityTypeIdentifierActiveEnergyBurned',
      unit: 'kcal',
      value: 320,
    });
    expect(native.savedSamples[0]?.start).toBe(confirmedAt);
    expect(native.savedSamples[0]?.end).toBe(confirmedAt);
  });

  it('defaults burn add-back to false', async () => {
    const service = makeService(native);
    expect(await service.burnAddBackEnabled()).toBe(false);
  });
});

describe('HealthKitService — U-42 extras over the spike', () => {
  let native: MockHealthKitNative;

  beforeEach(() => {
    native = new MockHealthKitNative();
  });

  it('the authorization ask reads the step count only and shares nothing', async () => {
    native.status = HealthAuthorizationStatus.notDetermined;
    const service = makeService(native);

    await service.requestAuthorizationIfNeeded();

    expect(native.lastRequest).toEqual({
      toShare: [],
      toRead: ['HKQuantityTypeIdentifierStepCount'],
    });
  });

  it('returns false without throwing when the ask itself fails', async () => {
    native.status = HealthAuthorizationStatus.notDetermined;
    native.failNextRequestWith = new Error('the sheet failed');
    const service = makeService(native);

    const granted = await service.requestAuthorizationIfNeeded();

    expect(granted).toBe(false);
    expect(native.requestCallCount).toBe(1);
  });

  it('returns zero step counts without querying while unauthorized', async () => {
    native.status = HealthAuthorizationStatus.sharingDenied;
    const service = makeService(native);

    expect(await service.todayStepCount()).toBe(0);
    expect(native.queries).toHaveLength(0);
  });

  it('queries today steps through the anchored query and stores the new anchor', async () => {
    native.status = HealthAuthorizationStatus.sharingAuthorized;
    const service = makeService(native);

    expect(await service.todayStepCount()).toBe(750);
    expect(native.queries).toHaveLength(1);
    expect(native.queries[0]).toMatchObject({
      type: 'HKQuantityTypeIdentifierStepCount',
      limit: 0,
      startDate: MIDNIGHT_ON_FIXTURE_DAY,
      endDate: NOON_ON_FIXTURE_DAY,
      strictStartDate: true,
    });
    expect(native.queries[0]?.anchor).toBeUndefined();

    native.nextAnchor = 'anchor-2';
    await service.todayStepCount();
    expect(native.queries).toHaveLength(2);
    expect(native.queries[1]?.anchor).toBe('anchor-1'); // the anchor travels across calls
  });

  it('deleting a meal removes the correlation and each child sample', async () => {
    const meal = fixtureMeal(NOON_ON_FIXTURE_DAY);
    native.correlations = [
      {
        uuid: 'hk-correlation-1',
        objects: [
          { uuid: 'sample-energy', quantityType: 'HKQuantityTypeIdentifierDietaryEnergyConsumed' },
          { uuid: 'sample-protein', quantityType: 'HKQuantityTypeIdentifierDietaryProtein' },
          { uuid: 'sample-carbs', quantityType: 'HKQuantityTypeIdentifierDietaryCarbohydrates' },
          { uuid: 'sample-fat', quantityType: 'HKQuantityTypeIdentifierDietaryFatTotal' },
        ],
      },
    ];
    const service = makeService(native);

    const result = await service.deleteMealSamples(meal);

    expect(result).toEqual({ deleted: 1, deletedSamples: 4 });
    // First the correlation by its derived metadata id…
    expect(native.deleteCalls[0]?.type).toBe('HKCorrelationTypeIdentifierFood');
    expect(native.deleteCalls[0]?.filter).toMatchObject({
      metadata: { withMetadataKey: 'ccSpikeMealId', operatorType: 4 },
    });
    // …then each child sample, one delete per quantity type.
    const childDeletes = native.deleteCalls.slice(1);
    expect(childDeletes.map((call) => call.type).sort()).toEqual(
      [
        'HKQuantityTypeIdentifierDietaryEnergyConsumed',
        'HKQuantityTypeIdentifierDietaryProtein',
        'HKQuantityTypeIdentifierDietaryCarbohydrates',
        'HKQuantityTypeIdentifierDietaryFatTotal',
      ].sort(),
    );
    for (const call of childDeletes) {
      expect(call.filter.uuids).toHaveLength(1);
    }
  });

  it('reads the stored burn-add-back flag the Settings toggle writes', async () => {
    const stored = { value: '0' };
    const service = makeService(native, async () => stored.value === '1');

    expect(await service.burnAddBackEnabled()).toBe(false);
    stored.value = '1';
    expect(await service.burnAddBackEnabled()).toBe(true);
  });
});
