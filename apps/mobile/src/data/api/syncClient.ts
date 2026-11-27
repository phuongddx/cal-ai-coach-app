/**
 * The fetch-based `SyncTransport` (spec D4) over `apiRequest`. Responses are parsed with the shared
 * contract schemas: an unknown key in a server response is a typed error, never silently dropped
 * (I10). After a push the acknowledged set must equal the submitted set (`validateAcknowledgementSet`
 * of `@coachcal/core`).
 *
 * The bearer token comes from an injected provider. The default provider keeps the spike's dev token
 * (`expo-constants` extra `apiToken`, default `spike-dev-token`) so `src/data/sync/runtime.ts` is
 * unchanged. When a `refreshSession` is injected, a 401 refreshes once and retries once.
 */
import Constants from 'expo-constants';
import {
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  PushResponseSchema,
  type SyncOperation,
} from '@coachcal/api-contract';
import { validateAcknowledgementSet } from '@coachcal/core';
import type { ZodType } from 'zod';

import { SyncError, type SyncTransport } from '../sync/types';
import { apiRequest, isApiFailure, resolveBaseUrl, type ApiFailure } from './http';

export type ApiConfig = { baseUrl: string; token: string };

/** The spike's configuration: `expo-constants` extra first, then `EXPO_PUBLIC_API_URL`. */
export function resolveApiConfig(): ApiConfig {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string; apiToken?: string } | undefined;
  return {
    baseUrl: extra?.apiBaseUrl ?? resolveBaseUrl(),
    token: extra?.apiToken ?? 'spike-dev-token',
  };
}

/** `SyncError` is the sync boundary's typed error (the engine switches on its `kind`). */
export type SyncApiError = SyncError;

export type SyncTransportOptions = {
  /** Where the bearer token comes from; null means signed out. Defaults to the spike dev token. */
  tokenProvider?: () => Promise<string | null>;
  /** Refreshes the session after a 401; true when `tokenProvider` now has a new token. */
  refreshSession?: () => Promise<boolean>;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

function toSyncError(failure: ApiFailure): SyncError {
  switch (failure.kind) {
    case 'network':
      return new SyncError('transport', 'network request failed', { cause: failure });
    case 'invalidResponse':
      // A 2xx body that fails the strict contract is the server's fault.
      return new SyncError('server', failure.message, { details: failure.issues });
    case 'envelope':
    case 'http': {
      const details = failure.kind === 'envelope' ? failure.details : undefined;
      if (failure.status === 401) return new SyncError('unauthorized', 'the API rejected the token');
      if (failure.status >= 400 && failure.status < 500) {
        return new SyncError('invalidRequest', `the API rejected the request (${failure.status})`, { details });
      }
      if (failure.status >= 500) return new SyncError('server', `the API failed (${failure.status})`);
      return new SyncError('transport', `unexpected API status ${failure.status}`);
    }
  }
}

export function createFetchSyncTransport(options: SyncTransportOptions = {}): SyncTransport {
  const defaultToken = () => resolveApiConfig().token;
  const tokenProvider = options.tokenProvider ?? (async () => defaultToken());
  const auth = { token: tokenProvider, refresh: options.refreshSession };

  async function call<T>(path: string, body: unknown, response: ZodType<T>): Promise<T> {
    // Signed out: nothing to send, and nothing for the server to accept.
    if ((await tokenProvider()) === null) throw new SyncError('unauthorized', 'there is no session');
    try {
      return await apiRequest({
        method: 'POST',
        path,
        body,
        response,
        auth,
        baseUrl: options.baseUrl ?? resolveApiConfig().baseUrl,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      throw isApiFailure(error) ? toSyncError(error) : error;
    }
  }

  return {
    async push(operations: SyncOperation[]) {
      const parsed = PushRequestSchema.safeParse({ operations });
      if (!parsed.success) {
        // A locally corrupt operation: typed error so the engine quarantines it.
        throw new SyncError('invalidRequest', 'a pending operation failed the contract', {
          details: parsed.error.issues,
        });
      }
      const response = await call('/v1/sync/push', parsed.data, PushResponseSchema);
      try {
        validateAcknowledgementSet(parsed.data.operations, response.accepted);
      } catch (cause) {
        throw new SyncError('server', cause instanceof Error ? cause.message : 'push acknowledgement set mismatch', {
          cause,
        });
      }
      return response;
    },
    async pull(cursor, limit) {
      const parsed = PullRequestSchema.safeParse({ cursor, limit });
      if (!parsed.success) {
        throw new SyncError('invalidRequest', 'the pull request failed the contract', {
          details: parsed.error.issues,
        });
      }
      return call('/v1/sync/pull', parsed.data, PullResponseSchema);
    },
  };
}
