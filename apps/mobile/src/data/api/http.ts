/**
 * The one HTTP seam of the app. `apiRequest` reads the base URL from `EXPO_PUBLIC_API_URL`, sends
 * JSON, attaches the bearer token, parses every 2xx body with the contract schema (a body that
 * fails the schema is a server fault, spec I10), turns the error envelope into a typed failure
 * (spec I3) and, on a 401, refreshes the session once and retries once.
 *
 * Failures are plain objects (`ApiFailure`), never `any`; each client maps them to the typed error
 * of its own boundary (`ScanApiError`, `SyncError`, `AuthError`, `AccountError`).
 */
import { ErrorEnvelopeSchema, type EntitlementState, type ErrorCode } from '@coachcal/api-contract';
import type { ZodType } from 'zod';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';

/** `EXPO_PUBLIC_API_URL`, without a trailing slash. Metro inlines the literal property access. */
export function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  return (configured && configured.length > 0 ? configured : DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export type ApiFailure =
  | {
      name: 'ApiFailure';
      kind: 'envelope';
      status: number;
      code: ErrorCode;
      details?: string[];
      entitlement?: EntitlementState;
    }
  /** The request never produced a response. */
  | { name: 'ApiFailure'; kind: 'network'; message: string }
  /** A 2xx response whose body is not JSON or fails the contract schema. */
  | { name: 'ApiFailure'; kind: 'invalidResponse'; status: number; message: string; issues?: unknown[] }
  /** A non-2xx response whose body is not the error envelope. */
  | { name: 'ApiFailure'; kind: 'http'; status: number; message: string };

export function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && (value as { name?: unknown }).name === 'ApiFailure';
}

/** Where a bearer token comes from; `refresh` is optional (a dev token cannot refresh). */
export type BearerAuth = {
  token: () => Promise<string | null>;
  /** Refreshes the session; true when a new token is available through `token()`. */
  refresh?: () => Promise<boolean>;
};

export type ApiRequestOptions<T> = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  response: ZodType<T>;
  /** Omit for an unauthenticated call (sign-in endpoints): no bearer, no refresh. */
  auth?: BearerAuth;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

async function send(
  options: ApiRequestOptions<unknown>,
  token: string | null,
): Promise<{ status: number; raw: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${options.baseUrl ?? resolveBaseUrl()}${options.path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: res.status, raw: await res.text() };
  } catch (cause) {
    const failure: ApiFailure = {
      name: 'ApiFailure',
      kind: 'network',
      message: cause instanceof Error ? cause.message : 'network request failed',
    };
    throw failure;
  }
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export async function apiRequest<T>(options: ApiRequestOptions<T>): Promise<T> {
  let token = options.auth ? await options.auth.token() : null;
  let reply = await send(options, token);

  // One refresh and one retry; a second 401 is the answer.
  if (reply.status === 401 && options.auth?.refresh) {
    const refreshed = await options.auth.refresh();
    if (refreshed) {
      token = await options.auth.token();
      reply = await send(options, token);
    }
  }

  const json = parseJson(reply.raw);

  if (reply.status < 200 || reply.status >= 300) {
    const envelope = json.ok ? ErrorEnvelopeSchema.safeParse(json.value) : null;
    if (envelope?.success) {
      const { code, details, entitlement } = envelope.data.error;
      const failure: ApiFailure = {
        name: 'ApiFailure',
        kind: 'envelope',
        status: reply.status,
        code,
        ...(details ? { details } : {}),
        ...(entitlement ? { entitlement } : {}),
      };
      throw failure;
    }
    const failure: ApiFailure = {
      name: 'ApiFailure',
      kind: 'http',
      status: reply.status,
      message: `the API answered ${reply.status} without an error envelope`,
    };
    throw failure;
  }

  if (!json.ok) {
    const failure: ApiFailure = {
      name: 'ApiFailure',
      kind: 'invalidResponse',
      status: reply.status,
      message: 'the API returned malformed JSON',
    };
    throw failure;
  }
  const parsed = options.response.safeParse(json.value);
  if (!parsed.success) {
    const failure: ApiFailure = {
      name: 'ApiFailure',
      kind: 'invalidResponse',
      status: reply.status,
      message: 'the API response failed the contract',
      issues: parsed.error.issues,
    };
    throw failure;
  }
  return parsed.data;
}
