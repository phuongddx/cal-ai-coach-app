/**
 * Manual Jest mock for `@kingstinct/react-native-healthkit` (plan T4).
 *
 * The real module builds Nitro hybrid objects (`NitroModules.createHybridObject`) that
 * need native autolinking, so unit tests must never load it: a test activates this mock
 * with `jest.mock('@kingstinct/react-native-healthkit')`. Test state lives in
 * `healthKitMockControl.ts` next to this file.
 *
 * Only the surface `healthKitMeals.ts` uses is mocked. Only `import type` from the real
 * package — a runtime import here would recurse into the mock itself.
 */

import type {
  CorrelationSample,
  CorrelationTypeIdentifier,
  QuantitySampleForSaving,
  SampleForSaving,
} from '@kingstinct/react-native-healthkit';
import { healthKitMockControl as control } from './healthKitMockControl';

/** Mirrors `AuthorizationStatus` from `@react-native-healthkit/core`. */
export const AuthorizationStatus = {
  notDetermined: 0,
  sharingDenied: 1,
  sharingAuthorized: 2,
} as const;

/** Mirrors `ComparisonPredicateOperator` (only the values the adapter can pass are listed). */
export const ComparisonPredicateOperator = {
  lessThan: 0,
  lessThanOrEqualTo: 1,
  greaterThan: 2,
  greaterThanOrEqualTo: 3,
  equalTo: 4,
  notEqualTo: 5,
  contains: 99,
} as const;

export const isHealthDataAvailable = (): boolean => control.state.available;

export const requestAuthorization = async (toRequest: {
  toShare?: readonly string[];
  toRead?: readonly string[];
}): Promise<boolean> => {
  control.state.authRequests.push({
    toShare: toRequest.toShare ?? [],
    toRead: toRequest.toRead ?? [],
  });
  return true;
};

// Like the real store on the iOS 26.4 Simulator: the correlation type always answers
// sharingAuthorized (value 2); only the quantity types carry the real status.
export const authorizationStatusFor = (type: string): number =>
  type === 'HKCorrelationTypeIdentifierFood' ? 2 : control.state.authorizationStatus;

type MockRevision = {
  source: { name: string; bundleIdentifier: string };
  operatingSystemVersion: string;
};

type MockCorrelation = {
  uuid: string;
  sourceRevision: MockRevision;
  device: undefined;
  metadata: Record<string, unknown>;
  sampleType: string;
  startDate: Date;
  endDate: Date;
  hasUndeterminedDuration: boolean;
  correlationType: CorrelationTypeIdentifier;
  objects: Array<{
    uuid: string;
    sourceRevision: MockRevision;
    metadata: Record<string, unknown>;
    sampleType: string;
    startDate: Date;
    endDate: Date;
    hasUndeterminedDuration: boolean;
    quantityType: string;
    quantity: number;
    unit: string;
  }>;
};

const revision: MockRevision = {
  source: { name: 'CoachCal', bundleIdentifier: 'com.nextlabs.coachcal' },
  operatingSystemVersion: '26.4',
};

export const saveCorrelationSample = async (
  typeIdentifier: CorrelationTypeIdentifier,
  samples: SampleForSaving[],
  start: Date,
  end: Date,
  metadata?: Record<string, unknown>,
): Promise<CorrelationSample> => {
  if (control.state.failNextSaveWith) {
    const error = control.state.failNextSaveWith;
    control.state.failNextSaveWith = null;
    throw error;
  }
  const quantitySamples = samples as QuantitySampleForSaving[];
  const uuid = control.nextUuid();
  const correlation: MockCorrelation = {
    uuid,
    sourceRevision: revision,
    device: undefined,
    metadata: { ...(metadata ?? {}) },
    sampleType: typeIdentifier,
    startDate: start,
    endDate: end,
    hasUndeterminedDuration: false,
    correlationType: typeIdentifier,
    objects: quantitySamples.map((sample) => ({
      uuid: control.nextUuid(),
      sourceRevision: revision,
      metadata: { ...(sample.metadata ?? {}) },
      sampleType: sample.quantityType,
      startDate: sample.startDate,
      endDate: sample.endDate,
      hasUndeterminedDuration: false,
      quantityType: sample.quantityType,
      quantity: sample.quantity,
      unit: sample.unit,
    })),
  };
  control.state.saveCalls.push({ typeIdentifier, samples: quantitySamples, start, end, metadata });
  control.state.savedCorrelations.push(correlation as unknown as CorrelationSample);
  return correlation as unknown as CorrelationSample;
};

export const queryCorrelationSamples = async (
  _typeIdentifier: CorrelationTypeIdentifier,
  options?: {
    filter?: {
      uuid?: string;
      metadata?: { withMetadataKey: string; operatorType?: number; value?: unknown };
      date?: { startDate?: Date; endDate?: Date };
    };
  },
): Promise<readonly CorrelationSample[]> => {
  if (control.state.failNextQueryWith) {
    const error = control.state.failNextQueryWith;
    control.state.failNextQueryWith = null;
    throw error;
  }
  const filter = options?.filter;
  let rows = control.allCorrelations();
  if (filter?.uuid) rows = rows.filter((row) => row.uuid === filter.uuid);
  if (filter?.metadata) {
    rows = rows.filter((row) =>
      control.matchesMetadataFilter(row.metadata as Record<string, unknown>, filter.metadata),
    );
  }
  if (filter?.date) rows = rows.filter((row) => control.matchesDateFilter(row, filter.date));
  return [...rows];
};

export const deleteObjects = async (
  objectTypeIdentifier: string,
  filter: {
    uuids?: string[];
    metadata?: { withMetadataKey: string; operatorType?: number; value?: unknown };
  },
): Promise<number> => {
  control.state.deleteCalls.push({ objectTypeIdentifier, filter });
  // Child samples: like the real store, only the listed samples go; a correlation stays.
  if (objectTypeIdentifier !== 'HKCorrelationTypeIdentifierFood') {
    return control.removeSamples(objectTypeIdentifier, new Set(filter.uuids ?? []));
  }
  const rows = control.allCorrelations();
  const matching = rows.filter((row) =>
    control.matchesMetadataFilter(row.metadata as Record<string, unknown>, filter.metadata),
  );
  return control.removeCorrelations(new Set(matching.map((row) => row.uuid)));
};
