/**
 * Mutable state shared by the manual Jest mock (`react-native-healthkit.ts` next to this
 * file) and the tests that drive it. A separate module so both sides import the same
 * instance — the mock file itself may only `import type` from the real package.
 *
 * Shapes mirror what the real library returns (see `CorrelationSample`, `QuantitySample`
 * in the package types); fabricated rows are built with `buildStoredCorrelation`.
 */

import type {
  CorrelationSample,
  QuantitySampleForSaving,
} from '@kingstinct/react-native-healthkit';

export type HealthKitMockState = {
  available: boolean;
  /** `AuthorizationStatus` value every type reports. */
  authorizationStatus: number;
  /** Args captured from `requestAuthorization` calls. */
  authRequests: Array<{ toShare: readonly string[]; toRead: readonly string[] }>;
  /** Rows an app (other than the test's own saves) already stored in the fake store. */
  storedCorrelations: CorrelationSample[];
  /** Rows produced by mocked `saveCorrelationSample` calls. */
  savedCorrelations: CorrelationSample[];
  /** Args captured from mocked `saveCorrelationSample` calls. */
  saveCalls: Array<{
    typeIdentifier: string;
    samples: QuantitySampleForSaving[];
    start: Date;
    end: Date;
    metadata: Record<string, unknown> | undefined;
  }>;
  /** Args captured from mocked `deleteObjects` calls. */
  deleteCalls: Array<{ objectTypeIdentifier: string; filter: unknown }>;
  /** Child samples left behind when their correlation is deleted (as in the real store). */
  looseSamples: Array<{ uuid: string; quantityType: string }>;
  failNextSaveWith: Error | null;
  failNextQueryWith: Error | null;
  nextUuid: number;
};

const freshState = (): HealthKitMockState => ({
  available: true,
  authorizationStatus: 0, // AuthorizationStatus.notDetermined
  authRequests: [],
  storedCorrelations: [],
  savedCorrelations: [],
  saveCalls: [],
  deleteCalls: [],
  looseSamples: [],
  failNextSaveWith: null,
  failNextQueryWith: null,
  nextUuid: 1,
});

export const healthKitMockControl = {
  state: freshState(),

  reset(): void {
    this.state = freshState();
  },

  setAvailability(available: boolean): void {
    this.state.available = available;
  },

  /** `status` is an `AuthorizationStatus` value (0 notDetermined, 1 sharingDenied, 2 sharingAuthorized). */
  setAuthorizationStatus(status: number): void {
    this.state.authorizationStatus = status;
  },

  /** Pre-seed the fake Health store with a row, as if another session had saved it. */
  addStoredCorrelation(correlation: CorrelationSample): void {
    this.state.storedCorrelations.push(correlation);
  },

  failNextSaveWith(error: Error): void {
    this.state.failNextSaveWith = error;
  },

  failNextQueryWith(error: Error): void {
    this.state.failNextQueryWith = error;
  },

  nextUuid(): string {
    return `mock-hk-uuid-${this.state.nextUuid++}`;
  },

  /** All rows visible to queries: pre-seeded rows first, then the session's saves. */
  allCorrelations(): CorrelationSample[] {
    return [...this.state.storedCorrelations, ...this.state.savedCorrelations];
  },

  removeCorrelations(uuids: ReadonlySet<string>): number {
    const before = this.state.storedCorrelations.length + this.state.savedCorrelations.length;
    const keep = (row: CorrelationSample) => !uuids.has(row.uuid);
    // Deleting a correlation leaves its child samples in the store (iOS 26.4 Simulator).
    for (const row of this.allCorrelations().filter((row) => uuids.has(row.uuid))) {
      for (const child of row.objects) {
        if ('quantityType' in child) {
          this.state.looseSamples.push({ uuid: child.uuid, quantityType: child.quantityType });
        }
      }
    }
    this.state.storedCorrelations = this.state.storedCorrelations.filter(keep);
    this.state.savedCorrelations = this.state.savedCorrelations.filter(keep);
    return before - this.state.storedCorrelations.length - this.state.savedCorrelations.length;
  },

  /** Delete child samples by uuid; returns how many were removed. */
  removeSamples(quantityType: string, uuids: ReadonlySet<string>): number {
    const before = this.state.looseSamples.length;
    this.state.looseSamples = this.state.looseSamples.filter(
      (sample) => !(sample.quantityType === quantityType && uuids.has(sample.uuid)),
    );
    return before - this.state.looseSamples.length;
  },

  /** True when `filter.metadata` matches a row's metadata (equalTo when a value is given, presence otherwise). */
  matchesMetadataFilter(
    metadata: Record<string, unknown> | undefined,
    filter: { withMetadataKey: string; operatorType?: number; value?: unknown } | undefined,
  ): boolean {
    if (!filter) return true;
    const rowMetadata = (metadata ?? {}) as Record<string, unknown>;
    if (!(filter.withMetadataKey in rowMetadata)) return false;
    if (filter.value === undefined) return true;
    return rowMetadata[filter.withMetadataKey] === filter.value;
  },

  /** True when the row's start date falls inside `filter.date`'s range. */
  matchesDateFilter(
    row: CorrelationSample,
    filter:
      | { startDate?: Date; endDate?: Date; strictStartDate?: boolean; strictEndDate?: boolean }
      | undefined,
  ): boolean {
    if (!filter) return true;
    const time = row.startDate.getTime();
    if (filter.startDate && time < filter.startDate.getTime()) return false;
    if (filter.endDate && time > filter.endDate.getTime()) return false;
    return true;
  },
};

export const MOCK_SOURCE_REVISION = {
  source: { name: 'CoachCalSpike', bundleIdentifier: 'com.nextlabs.coachcal.rnspike' },
  operatingSystemVersion: '26.4',
} as const;
