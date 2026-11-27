/**
 * The narrowed OB-03 ask (U-42): `requestHealthAccess` goes through the health service's
 * `requestAuthorizationIfNeeded` — the step count only, and only while undetermined —
 * instead of the five types the file asked for before. The library is replaced by the
 * manual mock in `src/__mocks__/@kingstinct/`; the real port module is never loaded by
 * tests, so its import resolves to the mock.
 */

import { afterEach, describe, expect, it } from '@jest/globals';

jest.mock('@kingstinct/react-native-healthkit');

import { AuthorizationStatus } from '@kingstinct/react-native-healthkit';
import { requestHealthAccess } from './healthAccess';
import { healthKitMockControl as control } from '../../__mocks__/@kingstinct/healthKitMockControl';

afterEach(() => {
  control.reset();
});

describe('requestHealthAccess — the OB-03 narrowing', () => {
  it('asks to read the step count only and shares nothing', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.notDetermined);

    await requestHealthAccess();

    expect(control.state.authRequests).toHaveLength(1);
    expect(control.state.authRequests[0]?.toRead).toEqual(['HKQuantityTypeIdentifierStepCount']);
    expect(control.state.authRequests[0]?.toShare).toEqual([]);
  });

  it('never asks again when the status is already determined', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingAuthorized);

    const result = await requestHealthAccess();

    expect(result).toBe('granted');
    expect(control.state.authRequests).toHaveLength(0);
  });

  it('maps a terminal denial to denied without asking', async () => {
    control.setAuthorizationStatus(AuthorizationStatus.sharingDenied);

    const result = await requestHealthAccess();

    expect(result).toBe('denied');
    expect(control.state.authRequests).toHaveLength(0);
  });
});
