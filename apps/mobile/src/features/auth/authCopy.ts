/**
 * The two error lines of the sign-in frames (110 and 111, 114 and 115) and the typed errors of
 * `data/auth/types.ts` that earn them. A line says no more than the app knows:
 *
 * - "We couldn't send the code" for what the request-code call can answer: a rejected address
 *   (400 and the client's own `invalidInput`), the server's sending limit (429, the same envelope code),
 *   and a delivery failure (503 `UPSTREAM_ERROR`). The line never says whether the address has an account.
 * - "That code is wrong or has expired" for the one answer the verify call gives to a wrong or an old
 *   code: 401 `UNAUTHORIZED`.
 *
 * Any other error (a dropped connection, a body that is not the contract, a 429 on verify) keeps the
 * message of `authErrorMessage`, which names what happened.
 */
import { authErrorMessage, isAuthError, type AuthError } from '../../data/auth/types';

export const sendCodeErrorLine = "We couldn't send the code. Check the address and try again.";
export const wrongCodeErrorLine = 'That code is wrong or has expired. Check the latest email, or send a new code.';
const genericErrorLine = 'Sign-in failed. Please try again.';

/** Which control the error border belongs to: the e-mail field, the six cells, or none. */
export type FailureTarget = 'field' | 'cells' | null;

export type Failure = { message: string; target: FailureTarget };

function isSendRefusal(error: AuthError): boolean {
  if (error.kind === 'invalidInput') return true;
  if (error.kind !== 'envelope') return false;
  return error.code === 'VALIDATION_ERROR' || error.code === 'UPSTREAM_ERROR';
}

/** The failure of `requestCode`, from the e-mail step or from Resend. */
export function sendCodeFailure(error: unknown): Failure {
  if (!isAuthError(error)) return { message: genericErrorLine, target: null };
  if (isSendRefusal(error)) return { message: sendCodeErrorLine, target: 'field' };
  return { message: authErrorMessage(error), target: null };
}

/** The failure of `verifyCode`. */
export function verifyCodeFailure(error: unknown): Failure {
  if (!isAuthError(error)) return { message: genericErrorLine, target: null };
  if (error.kind === 'envelope' && error.code === 'UNAUTHORIZED') {
    return { message: wrongCodeErrorLine, target: 'cells' };
  }
  return { message: authErrorMessage(error), target: null };
}

/** The failure of a sign-in that is not the e-mail code (Apple, Google). */
export function providerFailure(error: unknown): Failure {
  return { message: isAuthError(error) ? authErrorMessage(error) : genericErrorLine, target: null };
}
