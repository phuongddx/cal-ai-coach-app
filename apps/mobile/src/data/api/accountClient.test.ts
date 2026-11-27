/**
 * Account deletion call (`AccountDeletionTransport` of the Swift app): `DELETE /v1/account` with the
 * caller's own bearer session; failures are typed AccountErrors.
 */
import { createMockFetch } from '../../testing/mockFetch';
import { deleteAccount, isAccountError, type AccountError } from './accountClient';

const baseUrl = 'http://api.test';
const auth = { token: async () => 'access-token' };

async function errorOf(promise: Promise<unknown>): Promise<AccountError> {
  try {
    await promise;
  } catch (error) {
    expect(isAccountError(error)).toBe(true);
    return error as AccountError;
  }
  throw new Error('expected an AccountError');
}

describe('account client', () => {
  it('delete account sends DELETE to the account endpoint with the session bearer', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });

    await expect(deleteAccount({ auth, baseUrl, fetchImpl })).resolves.toBeUndefined();

    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/account', method: 'DELETE' });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBe('Bearer access-token');
  });

  it('a 401 refreshes the session once and retries once', async () => {
    let token = 'expired';
    const refresh = jest.fn(async () => {
      token = 'fresh';
      return true;
    });
    const fetchImpl = createMockFetch((request) =>
      request.headers['authorization'] === 'Bearer fresh'
        ? { json: { ok: true } }
        : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } },
    );

    await deleteAccount({ auth: { token: async () => token, refresh }, baseUrl, fetchImpl });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('an http failure carries the status', async () => {
    const fetchImpl = createMockFetch({ status: 502, text: '<html>bad gateway</html>' });
    const error = await errorOf(deleteAccount({ auth, baseUrl, fetchImpl }));
    expect(error).toMatchObject({ kind: 'http', status: 502 });
  });

  it('an envelope failure carries its code', async () => {
    const fetchImpl = createMockFetch({ status: 503, json: { error: { code: 'UPSTREAM_ERROR' } } });
    const error = await errorOf(deleteAccount({ auth, baseUrl, fetchImpl }));
    expect(error).toMatchObject({ kind: 'envelope', status: 503, code: 'UPSTREAM_ERROR' });
  });

  it('a dropped connection is a network failure', async () => {
    const fetchImpl = createMockFetch({ networkError: 'offline' });
    const error = await errorOf(deleteAccount({ auth, baseUrl, fetchImpl }));
    expect(error.kind).toBe('network');
  });

  it('a 200 that is not the ok body is an invalid response', async () => {
    const fetchImpl = createMockFetch({ json: { ok: false } });
    const error = await errorOf(deleteAccount({ auth, baseUrl, fetchImpl }));
    expect(error.kind).toBe('invalidResponse');
  });
});
