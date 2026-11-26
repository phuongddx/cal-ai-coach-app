/**
 * The fetch-based `SyncTransport` (spec D4). Responses are parsed with the
 * shared contract schemas — an unknown key in a server response is a typed
 * error, never silently dropped. Base URL and token come from `expo-constants`
 * extra (`apiBaseUrl`, default http://127.0.0.1:8787; `apiToken`, default
 * spike-dev-token).
 */
import Constants from 'expo-constants';
import {
  ErrorEnvelopeSchema,
  PullResponseSchema,
  PushRequestSchema,
  PushResponseSchema,
} from '@coachcal/api-contract';
import type { ZodType } from 'zod';

import { SyncError, type SyncTransport } from '../sync/types';

export type ApiConfig = { baseUrl: string; token: string };

export function resolveApiConfig(): ApiConfig {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string; apiToken?: string } | undefined;
  return {
    baseUrl: extra?.apiBaseUrl ?? 'http://127.0.0.1:8787',
    token: extra?.apiToken ?? 'spike-dev-token',
  };
}

async function post<T>(
  config: ApiConfig,
  path: string,
  body: unknown,
  responseSchema: ZodType<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new SyncError('transport', 'network request failed', { cause });
  }

  const raw = await res.text();

  if (res.status === 401) {
    throw new SyncError('unauthorized', 'the API rejected the token');
  }
  if (res.status >= 400 && res.status < 500) {
    const envelope = ErrorEnvelopeSchema.safeParse(JSON.parse(raw || '{}'));
    throw new SyncError('invalidRequest', `the API rejected the request (${res.status})`, {
      details: envelope.success ? envelope.data.error.details : raw,
    });
  }
  if (res.status >= 500) {
    throw new SyncError('server', `the API failed (${res.status})`);
  }
  if (!res.ok) {
    throw new SyncError('transport', `unexpected API status ${res.status}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (cause) {
    throw new SyncError('server', 'the API returned malformed JSON', { cause });
  }
  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // A 2xx body that fails the strict contract is the server's fault.
    throw new SyncError('server', 'the API response failed the contract', {
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function createFetchSyncTransport(config: ApiConfig = resolveApiConfig()): SyncTransport {
  return {
    async push(operations) {
      const parsed = PushRequestSchema.safeParse({ operations });
      if (!parsed.success) {
        // A locally corrupt operation: typed error so the engine quarantines it.
        throw new SyncError('invalidRequest', 'a pending operation failed the contract', {
          details: parsed.error.issues,
        });
      }
      return post(config, '/v1/sync/push', parsed.data, PushResponseSchema);
    },
    async pull(cursor, limit) {
      return post(config, '/v1/sync/pull', { cursor, limit }, PullResponseSchema);
    },
  };
}
