/**
 * The app's sign-in wiring: one session store and one set of services over the API, created on first
 * use (nothing native is touched at import time). `getSessionStore().bearer` is the bearer source for
 * every authenticated client; `tokenProvider`/`refreshSession` plug the same store into the sync client.
 */
import { createAuthApi } from './authApi';
import { createAuthServices, type AuthServices } from './authServices';
import { createSessionStore, type SessionStore } from './sessionStore';

let wiring: { store: SessionStore; services: AuthServices } | null = null;

function getWiring() {
  if (wiring === null) {
    const api = createAuthApi();
    const store = createSessionStore({ refreshSession: api.refresh });
    wiring = { store, services: createAuthServices({ api, store }) };
  }
  return wiring;
}

export const getSessionStore = (): SessionStore => getWiring().store;
export const getAuthServices = (): AuthServices => getWiring().services;

/** Test hook: forget the memoized wiring. */
export function resetAuthForTests(): void {
  wiring = null;
}

export { createAuthApi } from './authApi';
export type { AuthApi } from './authApi';
export { createAuthServices } from './authServices';
export type { AuthServices } from './authServices';
export { createSessionStore, SESSION_STORAGE_KEY } from './sessionStore';
export type { SessionStore } from './sessionStore';
export { authErrorMessage, isAuthError } from './types';
export type { AuthError, Session } from './types';
