/**
 * Jest twin of GoldenFixtureTests: the sync golden bodies decode strictly against the shared
 * contract, and mutated copies (unknown key, missing key, wrong type, foreign ack) are rejected.
 */
import { validateAcknowledgementSet } from '@coachcal/core';
import { PullResponseSchema, PushRequestSchema, PushResponseSchema } from '@coachcal/api-contract';

import { syncGolden } from '../../testing/syncGolden';

describe('golden fixtures', () => {
  it('live push and pull fixtures decode strictly', () => {
    const pushRequest = PushRequestSchema.parse(syncGolden('sync_push_request'));
    const pushResponse = PushResponseSchema.parse(syncGolden('sync_push_response'));
    const pullResponse = PullResponseSchema.parse(syncGolden('sync_pull_response'));

    expect(pushRequest.operations.length).toBeGreaterThan(0);
    expect(() => validateAcknowledgementSet(pushRequest.operations, pushResponse.accepted)).not.toThrow();
    const newest = Math.max(0, ...pullResponse.rows.map((row) => row.record.serverVersion));
    expect(pullResponse.cursor).toBeGreaterThanOrEqual(newest);
  });

  it('push fixture rejects unknown missing wrong type and foreign acks', () => {
    const decode = (mutate: (body: any) => void) => {
      const body = syncGolden('sync_push_response');
      mutate(body);
      return PushResponseSchema.safeParse(body);
    };

    expect(decode((body) => (body.unknownKey = true)).success).toBe(false);
    expect(decode((body) => delete body.accepted).success).toBe(false);
    expect(decode((body) => (body.accepted = 'not-an-array')).success).toBe(false);

    const request = PushRequestSchema.parse(syncGolden('sync_push_request'));
    const foreign = decode((body) => (body.accepted[0].opId = '0f0e0d0c-0b0a-4908-8706-050403020100'));
    expect(foreign.success).toBe(true);
    expect(() => validateAcknowledgementSet(request.operations, foreign.data!.accepted)).toThrow(/unsent operation/);
  });

  it('pull fixture rejects unknown missing and wrong types', () => {
    const decode = (mutate: (body: any) => void) => {
      const body = syncGolden('sync_pull_response');
      mutate(body);
      return PullResponseSchema.safeParse(body);
    };

    expect(decode((body) => (body.unknownKey = true)).success).toBe(false);
    expect(decode((body) => delete body.rows).success).toBe(false);
    expect(decode((body) => (body.cursor = 'not-an-int')).success).toBe(false);
  });

  it('push fixture rejects an unknown key inside a nested record', () => {
    const body = syncGolden('sync_push_response');
    body.accepted[0].record.mysteryField = 1;
    expect(PushResponseSchema.safeParse(body).success).toBe(false);
  });
});
