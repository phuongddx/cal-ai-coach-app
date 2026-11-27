/**
 * The just-in-time HealthKit ask of the privacy step (INT-01), narrowed to the Swift
 * scope (parity OB-03): the model receives this as
 * `requestHealthAccess: () => Promise<'granted' | 'denied'>`; Jest injects a double, so
 * this file is only imported by the route file.
 *
 * U-42: the ask is `HealthKitService.requestAuthorizationIfNeeded()` — it reads the step
 * count only, and only while the status is not determined (the Swift `PrivacyHealthView`
 * ask), instead of the five types this file requested before. A denied or failed ask is a
 * `'denied'`: the screen then shows its footnote and the flow goes on.
 */

import { createNativeHealthKitPort } from '../../data/health/healthKitNative';
import { createHealthKitService } from '../../data/health/healthKitService';

/** The service this route uses, over the real HealthKit port. */
function healthKitService() {
  return createHealthKitService({ native: createNativeHealthKitPort(), now: () => new Date() });
}

export async function requestHealthAccess(): Promise<'granted' | 'denied'> {
  try {
    return (await healthKitService().requestAuthorizationIfNeeded()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
