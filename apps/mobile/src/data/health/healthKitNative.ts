/**
 * The real `HealthKitNativePort` — a thin adapter over `@kingstinct/react-native-healthkit`,
 * the concrete `HKHealthStore` side of the Swift `HealthStoring` seam. This module statically
 * imports the library, whose Nitro hybrid objects need native autolinking: only route-level
 * files import it (today: `features/onboarding/healthAccess.ts`), never Jest — the tests
 * inject doubles into `createHealthKitService` instead.
 *
 * The casts are the adapter's job: the service passes the stable HK identifier strings and
 * mirrored enum numbers (so it stays library-free), and this module hands them to the
 * library under its branded union types.
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  deleteObjects,
  enableBackgroundDelivery,
  queryCorrelationSamples,
  queryQuantitySamplesWithAnchor,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
import type {
  CorrelationTypeIdentifier,
  ObjectTypeIdentifier,
  PredicateWithMetadataKey,
  QuantityTypeIdentifier,
  QuantityTypeIdentifierWriteable,
  SampleTypeIdentifierWriteable,
  UpdateFrequency,
} from '@kingstinct/react-native-healthkit/types';

import {
  HealthAuthorizationStatus,
  type HealthKitNativePort,
  type MealCorrelationRow,
} from './healthKitService';

function toServiceStatus(status: AuthorizationStatus): HealthAuthorizationStatus {
  return status as HealthAuthorizationStatus;
}

function toMetadataFilter(metadata: unknown): PredicateWithMetadataKey | undefined {
  if (!metadata) return undefined;
  return metadata as PredicateWithMetadataKey;
}

/** Adapts a stored correlation to the two fields the meal delete touches (I12). */
function toCorrelationRow(correlation: {
  uuid: string;
  objects: ReadonlyArray<unknown>;
}): MealCorrelationRow {
  return {
    uuid: correlation.uuid,
    objects: correlation.objects.flatMap((object) => {
      if (typeof object !== 'object' || object === null) return [];
      const candidate = object as { uuid?: unknown; quantityType?: unknown };
      if (typeof candidate.uuid !== 'string' || typeof candidate.quantityType !== 'string') {
        return [];
      }
      return [{ uuid: candidate.uuid, quantityType: candidate.quantityType }];
    }),
  };
}

export function createNativeHealthKitPort(): HealthKitNativePort {
  return {
    authorizationStatusFor: (type) => toServiceStatus(authorizationStatusFor(type as ObjectTypeIdentifier)),

    requestAuthorization: (types) =>
      requestAuthorization({
        toShare: types.toShare as readonly SampleTypeIdentifierWriteable[],
        toRead: types.toRead as readonly ObjectTypeIdentifier[],
      }),

    enableBackgroundDelivery: (type, updateFrequency) =>
      enableBackgroundDelivery(type as ObjectTypeIdentifier, updateFrequency as UpdateFrequency),

    queryQuantitySamplesWithAnchor: (type, options) =>
      queryQuantitySamplesWithAnchor(type as QuantityTypeIdentifier, {
        anchor: options.anchor,
        limit: options.limit,
        filter: options.filter,
      }),

    saveQuantitySample: (type, unit, value, start, end, metadata) =>
      saveQuantitySample(
        type as QuantityTypeIdentifierWriteable,
        unit,
        value,
        start,
        end,
        metadata as Parameters<typeof saveQuantitySample>[5],
      ),

    queryCorrelationSamples: async (type, options) => {
      const rows = await queryCorrelationSamples(type as CorrelationTypeIdentifier, {
        limit: options.limit,
        filter: { metadata: toMetadataFilter(options.filter?.metadata) },
      });
      return rows.map(toCorrelationRow);
    },

    deleteObjects: (type, filter) =>
      deleteObjects(type as SampleTypeIdentifierWriteable, {
        metadata: toMetadataFilter(filter.metadata),
        uuids: filter.uuids ? [...filter.uuids] : undefined,
      }),
  };
}
