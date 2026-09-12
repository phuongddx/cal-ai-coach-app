import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  PushResponseSchema,
  SyncOperationSchema,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '../../contracts/sync';

/**
 * The ONLY sync RPC adapter (Plan 01-04 Task 2). Every call goes through the
 * typed Supabase RPC surface; responses are validated against the shared
 * contract before any local state sees them. No table insert/update/delete
 * requests ever originate here.
 */

export interface SyncTransport {
  push(request: PushRequest): Promise<PushResponse>;
  pull(request: PullRequest): Promise<PullResponse>;
}

export class TransportError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export function createSupabaseTransport(client: SupabaseClient): SyncTransport {
  return {
    async push(request: PushRequest): Promise<PushResponse> {
      const parsedRequest = PushRequestSchema.parse(request);
      const { data, error } = await client.rpc('sync_push', {
        p_ops: parsedRequest.operations,
      });
      if (error) {
        throw new TransportError(`sync_push failed: ${error.message}`, error);
      }
      const parsed = PushResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new TransportError(
          `sync_push response failed contract validation: ${parsed.error.message}`,
          parsed.error
        );
      }
      return parsed.data;
    },

    async pull(request: PullRequest): Promise<PullResponse> {
      const parsedRequest = PullRequestSchema.parse(request);
      const { data, error } = await client.rpc('sync_pull', {
        p_cursor: parsedRequest.cursor,
      });
      if (error) {
        throw new TransportError(`sync_pull failed: ${error.message}`, error);
      }
      const parsed = PullResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new TransportError(
          `sync_pull response failed contract validation: ${parsed.error.message}`,
          parsed.error
        );
      }
      return parsed.data;
    },
  };
}

/** Re-validates one stored outbox envelope; used by the dispatcher on load. */
export function validateStoredOperation(raw: unknown) {
  return SyncOperationSchema.parse(raw);
}
