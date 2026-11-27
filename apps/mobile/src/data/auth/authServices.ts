/**
 * What the sign-in screen runs. Each sign-in stores the session in the session store (the one thing
 * the rest of the app reads) and returns it; sign-out tells the server on a best-effort basis and
 * always clears the device.
 */
import type { AuthApi } from './authApi';
import { appleSignInAvailable, signInWithAppleCredential } from './appleSignIn';
import type { SessionStore } from './sessionStore';
import type { Session } from './types';

export type AuthServices = {
  appleAvailable(): Promise<boolean>;
  signInWithApple(): Promise<Session>;
  signInWithGoogle(): Promise<Session>;
  /** E-mail one-time code: ask for it. */
  requestCode(email: string): Promise<void>;
  /** E-mail one-time code: verify it (creates the user when missing). */
  verifyCode(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
};

export function createAuthServices(deps: { api: AuthApi; store: SessionStore }): AuthServices {
  const { api, store } = deps;
  const persist = async (session: Session) => {
    await store.setSession(session);
    return session;
  };

  return {
    appleAvailable: () => appleSignInAvailable(),
    signInWithApple: async () => persist(await signInWithAppleCredential(api)),
    signInWithGoogle: async () => persist(await api.signInWithGoogle()),
    requestCode: (email) => api.requestOtp(email),
    verifyCode: async (email, code) => persist(await api.verifyOtp(email, code)),
    async signOut() {
      if (store.getSession() !== null) {
        try {
          await api.signOut(store.bearer);
        } catch {
          // Best effort: the device signs out whether or not the server heard about it.
        }
      }
      await store.clear();
    },
  };
}
