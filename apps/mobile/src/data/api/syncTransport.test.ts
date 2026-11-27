/**
 * Jest twin of the sync transport tests: push and pull hit the sync endpoints with the contract
 * bodies, answers are strictly decoded, and a failure surfaces as a typed SyncError. The bearer
 * token comes from an injected provider; a 401 triggers one refresh and one retry.
 */
import { createMockFetch } from '../../testing/mockFetch';
import { syncGolden } from '../../testing/syncGolden';
import { SyncError } from '../sync/types';
import { createFetchSyncTransport, resolveApiConfig } from './syncClient';

const baseUrl = 'http://api.test';
const tokenProvider = async () => 'access-token';

const operations = () => syncGolden('sync_push_request').operations;

async function syncErrorOf(promise: Promise<unknown>): Promise<SyncError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(SyncError);
    return error as SyncError;
  }
  throw new Error('expected a SyncError');
}

describe('sync transport', () => {
  it('push calls sync push and returns strict decoded acknowledgements', async () => {
    const fetchImpl = createMockFetch({ json: syncGolden('sync_push_response') });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl });

    const response = await transport.push(operations());

    const recorded = fetchImpl.calls[0]!;
    expect(recorded.path).toBe('/v1/sync/push');
    expect(recorded.method).toBe('POST');
    expect(recorded.headers['authorization']).toBe('Bearer access-token');
    expect((recorded.body as { operations: Array<{ opId: string }> }).operations.map((op) => op.opId)).toEqual([
      '826fa3c6-d8a7-4405-b28b-9dbcd75bc4c5',
      '2947d66a-f80b-42da-8951-679b9b2a5d48',
    ]);
    expect(response.accepted.map((ack) => ack.opId)).toEqual([
      '826fa3c6-d8a7-4405-b28b-9dbcd75bc4c5',
      '2947d66a-f80b-42da-8951-679b9b2a5d48',
    ]);
  });

  it('pull calls sync pull and returns strict decoded rows', async () => {
    const fetchImpl = createMockFetch({ json: syncGolden('sync_pull_response') });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl });

    const response = await transport.pull(0, 200);

    const recorded = fetchImpl.calls[0]!;
    expect(recorded.path).toBe('/v1/sync/pull');
    expect(recorded.body).toEqual({ cursor: 0, limit: 200 });
    expect(response.cursor).toBe(13);
    expect(response.rows.map((row) => row.record.id)).toEqual([
      '26277672-8328-4b1a-9b77-c2da2631f63c',
      '41bca976-477b-4405-8523-2c6f98e2b4f7',
    ]);
  });

  it('rpc failure surfaces as sync transport error', async () => {
    const fetchImpl = createMockFetch({
      status: 400,
      json: { error: { code: 'VALIDATION_ERROR', details: ['operation targets a record owned by another user'] } },
    });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl });

    const error = await syncErrorOf(transport.push(operations()));

    expect(error.kind).toBe('invalidRequest');
    expect(error.details).toEqual(['operation targets a record owned by another user']);
  });

  it('push rejects an acknowledgement set that does not match the request', async () => {
    const partial = syncGolden('sync_push_response');
    partial.accepted.pop();
    const foreign = syncGolden('sync_push_response');
    foreign.accepted[0].opId = '0f0e0d0c-0b0a-4908-8706-050403020100';

    for (const body of [partial, foreign]) {
      const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl: createMockFetch({ json: body }) });
      expect((await syncErrorOf(transport.push(operations()))).kind).toBe('server');
    }
  });

  it('push rejects a response with an unknown key as a server fault (invariant I10)', async () => {
    const body = syncGolden('sync_push_response');
    body.unknownKey = true;
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl: createMockFetch({ json: body }) });
    expect((await syncErrorOf(transport.push(operations()))).kind).toBe('server');
  });

  it('a locally corrupt operation fails before any network call', async () => {
    const fetchImpl = createMockFetch({ json: syncGolden('sync_push_response') });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl });
    const corrupt = operations();
    corrupt[1].meal = corrupt[0].meal; // a tombstone must not carry a meal

    expect((await syncErrorOf(transport.push(corrupt))).kind).toBe('invalidRequest');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('maps a dropped connection, a 5xx and a 401 to the kinds the engine retries or stops on', async () => {
    const dropped = createFetchSyncTransport({ baseUrl, tokenProvider, fetchImpl: createMockFetch({ networkError: 'offline' }) });
    expect((await syncErrorOf(dropped.pull(0, 200))).kind).toBe('transport');

    const failing = createFetchSyncTransport({
      baseUrl,
      tokenProvider,
      fetchImpl: createMockFetch({ status: 503, json: { error: { code: 'UPSTREAM_ERROR' } } }),
    });
    expect((await syncErrorOf(failing.pull(0, 200))).kind).toBe('server');

    const rejected = createFetchSyncTransport({
      baseUrl,
      tokenProvider,
      fetchImpl: createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }),
    });
    expect((await syncErrorOf(rejected.pull(0, 200))).kind).toBe('unauthorized');
  });

  it('a 401 triggers one refresh and one retry with the new token', async () => {
    let token = 'expired';
    const refreshSession = jest.fn(async () => {
      token = 'fresh';
      return true;
    });
    const fetchImpl = createMockFetch((request) =>
      request.headers['authorization'] === 'Bearer fresh'
        ? { json: syncGolden('sync_pull_response') }
        : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } },
    );
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider: async () => token, refreshSession, fetchImpl });

    const response = await transport.pull(0, 200);

    expect(response.cursor).toBe(13);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchImpl.calls.map((call) => call.headers['authorization'])).toEqual(['Bearer expired', 'Bearer fresh']);
  });

  it('a 401 that survives the retry is unauthorized and does not refresh again', async () => {
    const refreshSession = jest.fn(async () => true);
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider, refreshSession, fetchImpl });

    expect((await syncErrorOf(transport.pull(0, 200))).kind).toBe('unauthorized');
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('without a session the transport is unauthorized and sends nothing', async () => {
    const fetchImpl = createMockFetch({ json: syncGolden('sync_pull_response') });
    const transport = createFetchSyncTransport({ baseUrl, tokenProvider: async () => null, fetchImpl });

    expect((await syncErrorOf(transport.pull(0, 200))).kind).toBe('unauthorized');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('the default provider keeps the spike dev token so the runtime wiring is unchanged', async () => {
    const config = resolveApiConfig();
    expect(config.token).toBe('spike-dev-token');
    expect(config.baseUrl).toBe('http://127.0.0.1:8787');

    const fetchImpl = createMockFetch({ json: syncGolden('sync_pull_response') });
    await createFetchSyncTransport({ fetchImpl }).pull(0, 200);
    expect(fetchImpl.calls[0]?.headers['authorization']).toBe('Bearer spike-dev-token');
    expect(fetchImpl.calls[0]?.url).toBe('http://127.0.0.1:8787/v1/sync/pull');
  });
});
