/**
 * The real just-in-time HealthKit ask of the privacy step (INT-01). The model
 * receives this as `requestHealthAccess: () => Promise<'granted' | 'denied'>`;
 * Jest injects a double, so this file is only imported by the route file.
 *
 * `requestAuthorization` resolves to whether the user completed the prompt
 * with any sharing enabled (its typings in node_modules: `Promise<boolean>`).
 * An error is a denial: the screen then shows its footnote and the flow goes on.
 */

import { requestAuthorization } from '@kingstinct/react-native-healthkit';

/** The sample types onboarding needs to read and write. */
const SHARED_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierStepCount',
] as const;

export async function requestHealthAccess(): Promise<'granted' | 'denied'> {
  try {
    const granted = await requestAuthorization({
      toShare: [...SHARED_TYPES],
      toRead: [...SHARED_TYPES],
    });
    return granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
