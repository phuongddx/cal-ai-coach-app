/** Jest twin of CoachCalNetworkingTests: the module exposes its public surface. */
import * as networking from './index';

describe('networking module', () => {
  it('module name is exposed', () => {
    expect(Object.keys(networking).sort()).toEqual(
      [
        'LiveScanApi',
        'apiRequest',
        'buildScanRequest',
        'createFetchSyncTransport',
        'deleteAccount',
        'isAccountError',
        'isApiFailure',
        'isScanApiError',
        'resolveApiConfig',
        'resolveBaseUrl',
      ].sort(),
    );
  });
});
