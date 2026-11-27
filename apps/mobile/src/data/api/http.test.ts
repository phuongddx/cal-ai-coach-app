/**
 * `apiRequest`: the one HTTP seam of the app (spec I3, I10). Base URL, bearer token, contract
 * parsing of every response, the typed error envelope and a single refresh-and-retry on 401.
 */
import { OkSchema, ScanResponseSchema } from '@coachcal/api-contract';

import { createMockFetch } from '../../testing/mockFetch';
import { apiRequest, isApiFailure, resolveBaseUrl, type ApiFailure, type BearerAuth } from './http';

const scanResponse = require('../../../../../packages/api-contract/golden/scan-response-200.golden.json');

async function failureOf(promise: Promise<unknown>): Promise<ApiFailure> {
  try {
    await promise;
  } catch (error) {
    expect(isApiFailure(error)).toBe(true);
    return error as ApiFailure;
  }
  throw new Error('expected apiRequest to throw');
}

describe('apiRequest', () => {
  const baseUrl = 'http://api.test';

  it('reads the base URL from EXPO_PUBLIC_API_URL and defaults to the local API', () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    try {
      delete process.env.EXPO_PUBLIC_API_URL;
      expect(resolveBaseUrl()).toBe('http://127.0.0.1:8787');
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
      expect(resolveBaseUrl()).toBe('https://api.example.test');
    } finally {
      if (saved === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = saved;
    }
  });

  it('sends JSON with the bearer token and returns the parsed body', async () => {
    const fetchImpl = createMockFetch({ json: scanResponse });
    const auth: BearerAuth = { token: async () => 'access-1' };

    const response = await apiRequest({
      method: 'POST',
      path: '/v1/scan',
      body: { scanId: 'x' },
      response: ScanResponseSchema,
      auth,
      baseUrl,
      fetchImpl,
    });

    expect(response.mealKcal).toBe(464);
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe('http://api.test/v1/scan');
    expect(call?.method).toBe('POST');
    expect(call?.headers['authorization']).toBe('Bearer access-1');
    expect(call?.headers['content-type']).toBe('application/json');
    expect(call?.body).toEqual({ scanId: 'x' });
  });

  it('sends no bearer header when the call is unauthenticated', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    await apiRequest({ method: 'POST', path: '/v1/auth/otp/request', body: {}, response: OkSchema, baseUrl, fetchImpl });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBeUndefined();
  });

  it('treats a 2xx body that fails the contract as an invalid response', async () => {
    const fetchImpl = createMockFetch({ json: { ...scanResponse, extra: 1 } });
    const failure = await failureOf(
      apiRequest({ method: 'POST', path: '/v1/scan', body: {}, response: ScanResponseSchema, baseUrl, fetchImpl }),
    );
    expect(failure.kind).toBe('invalidResponse');
  });

  it('treats a 2xx body that is not JSON as an invalid response', async () => {
    const fetchImpl = createMockFetch({ text: '<html>' });
    const failure = await failureOf(apiRequest({ method: 'GET', path: '/x', response: OkSchema, baseUrl, fetchImpl }));
    expect(failure.kind).toBe('invalidResponse');
  });

  it('turns the error envelope into a typed failure', async () => {
    const fetchImpl = createMockFetch({
      status: 402,
      json: {
        error: {
          code: 'FREE_LIMIT_REACHED',
          entitlement: { tier: 'free', scansUsed: 3, scanLimit: 3, windowResetAt: '2026-09-21T10:00:00Z' },
        },
      },
    });
    const failure = await failureOf(apiRequest({ method: 'POST', path: '/v1/scan', response: OkSchema, baseUrl, fetchImpl }));
    expect(failure).toMatchObject({ kind: 'envelope', status: 402, code: 'FREE_LIMIT_REACHED' });
    expect(failure.kind === 'envelope' && failure.entitlement?.scansUsed).toBe(3);
  });

  it('keeps the status for an error body that is not the envelope', async () => {
    const fetchImpl = createMockFetch({ status: 502, text: 'bad gateway' });
    const failure = await failureOf(apiRequest({ method: 'GET', path: '/x', response: OkSchema, baseUrl, fetchImpl }));
    expect(failure).toMatchObject({ kind: 'http', status: 502 });
  });

  it('reports a dropped connection as a network failure', async () => {
    const fetchImpl = createMockFetch({ networkError: 'Network request failed' });
    const failure = await failureOf(apiRequest({ method: 'GET', path: '/x', response: OkSchema, baseUrl, fetchImpl }));
    expect(failure.kind).toBe('network');
  });

  it('refreshes once on 401 and retries once with the new token', async () => {
    let token = 'old';
    const refresh = jest.fn(async () => {
      token = 'new';
      return true;
    });
    const fetchImpl = createMockFetch((request) =>
      request.headers['authorization'] === 'Bearer new'
        ? { json: { ok: true } }
        : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } },
    );

    const result = await apiRequest({
      method: 'POST',
      path: '/v1/sync/push',
      body: {},
      response: OkSchema,
      auth: { token: async () => token, refresh },
      baseUrl,
      fetchImpl,
    });

    expect(result).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl.calls.map((call) => call.headers['authorization'])).toEqual(['Bearer old', 'Bearer new']);
  });

  it('does not retry a second time when the retried call is also 401', async () => {
    const refresh = jest.fn(async () => true);
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const failure = await failureOf(
      apiRequest({ method: 'GET', path: '/x', response: OkSchema, auth: { token: async () => 't', refresh }, baseUrl, fetchImpl }),
    );
    expect(failure).toMatchObject({ kind: 'envelope', status: 401, code: 'UNAUTHORIZED' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('surfaces the 401 without a retry when the refresh fails', async () => {
    const refresh = jest.fn(async () => false);
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const failure = await failureOf(
      apiRequest({ method: 'GET', path: '/x', response: OkSchema, auth: { token: async () => 't', refresh }, baseUrl, fetchImpl }),
    );
    expect(failure).toMatchObject({ kind: 'envelope', status: 401 });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('never refreshes an unauthenticated call', async () => {
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const failure = await failureOf(apiRequest({ method: 'POST', path: '/v1/auth/email', response: OkSchema, baseUrl, fetchImpl }));
    expect(failure).toMatchObject({ kind: 'envelope', status: 401 });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});
