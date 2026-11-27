/**
 * The session store (`AuthSessionStore` of the Swift app): the session (user and tokens) kept in
 * `expo-secure-store`, loaded at start, cleared on sign-out, with an injected clock.
 *
 *  - `getAccessToken()` refreshes when the token is expired (or about to be).
 *  - `refresh()` is single-flight: the refresh token rotates, so two concurrent refreshes would burn it.
 *  - A refresh the server rejects (4xx) clears the session; a dropped connection or a 5xx keeps it,
 *    so being offline never signs the person out.
 */
import * as SecureStore from 'expo-secure-store';
import { SessionResponseSchema } from '@coachcal/api-contract';

import type { BearerAuth } from '../api/http';
import { isRejection, type Session } from './types';

export const SESSION_STORAGE_KEY = 'coachcal.auth.session';

/** Refresh this long before `expiresAt` so a token cannot expire while a request is in flight. */
const EXPIRY_SKEW_MS = 30_000;

export type SessionStoreOptions = {
  /** Wall clock in ms. */
  now?: () => number;
  /** Calls `POST /v1/auth/refresh`; throws an `AuthError` on failure. */
  refreshSession: (refreshToken: string) => Promise<Session>;
};

export type SessionStore = {
  /** Reads the keychain once at start; a stored value that fails the contract is discarded. */
  load(): Promise<Session | null>;
  getSession(): Session | null;
  setSession(session: Session): Promise<void>;
  /** Sign-out: forgets the session in memory and in the keychain. */
  clear(): Promise<void>;
  onChange(listener: (session: Session | null) => void): () => void;
  /** The access token, refreshed first when expired; null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** True when a fresh session is available afterwards. */
  refresh(): Promise<boolean>;
  /** The store as the bearer source of `apiRequest`. */
  bearer: BearerAuth;
};

export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const now = options.now ?? Date.now;
  const listeners = new Set<(session: Session | null) => void>();
  let session: Session | null = null;
  let inFlightRefresh: Promise<boolean> | null = null;

  const publish = (next: Session | null) => {
    session = next;
    for (const listener of [...listeners]) listener(next);
  };

  const forget = async () => {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  };

  const isFresh = (candidate: Session) => Date.parse(candidate.tokens.expiresAt) - EXPIRY_SKEW_MS > now();

  const store: SessionStore = {
    async load() {
      const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
      if (raw === null) {
        session = null;
        return null;
      }
      let parsed: ReturnType<typeof SessionResponseSchema.safeParse>;
      try {
        parsed = SessionResponseSchema.safeParse(JSON.parse(raw));
      } catch {
        parsed = SessionResponseSchema.safeParse(undefined);
      }
      if (!parsed.success) {
        await forget();
        session = null;
        return null;
      }
      session = parsed.data;
      return session;
    },

    getSession: () => session,

    async setSession(next) {
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(next));
      publish(next);
    },

    async clear() {
      await forget();
      publish(null);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async getAccessToken() {
      if (session === null) return null;
      if (!isFresh(session)) await store.refresh();
      // After a transient refresh failure the stale token still goes out: offline that ends as a
      // network failure, and a 401 gets the one refresh-and-retry of `apiRequest`.
      return session?.tokens.accessToken ?? null;
    },

    refresh() {
      inFlightRefresh ??= (async () => {
        const current = session;
        if (current === null) return false;
        try {
          await store.setSession(await options.refreshSession(current.tokens.refreshToken));
          return true;
        } catch (error) {
          if (isRejection(error)) await store.clear();
          return false;
        }
      })().finally(() => {
        inFlightRefresh = null;
      });
      return inFlightRefresh;
    },

    bearer: {
      token: () => store.getAccessToken(),
      refresh: () => store.refresh(),
    },
  };

  return store;
}
