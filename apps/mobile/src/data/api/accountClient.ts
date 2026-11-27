/**
 * Account deletion: `DELETE /v1/account` over the caller's own bearer session. The server removes
 * the user's rows and sessions and revokes the Apple token; no admin secret ever exists on the device.
 */
import { OkSchema } from '@coachcal/api-contract';

import { apiRequest, isApiFailure, type ApiFailure, type BearerAuth } from './http';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** `AccountDeletionError` of the Swift app: the failure kind plus the status or code. */
export type AccountError = DistributiveOmit<ApiFailure, 'name'> & { name: 'AccountError' };

export function isAccountError(value: unknown): value is AccountError {
  return typeof value === 'object' && value !== null && (value as { name?: unknown }).name === 'AccountError';
}

export type DeleteAccountOptions = {
  auth: BearerAuth;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function deleteAccount(options: DeleteAccountOptions): Promise<void> {
  try {
    await apiRequest({
      method: 'DELETE',
      path: '/v1/account',
      response: OkSchema,
      auth: options.auth,
      baseUrl: options.baseUrl,
      fetchImpl: options.fetchImpl,
    });
  } catch (error) {
    if (isApiFailure(error)) {
      const { name: _name, ...failure } = error;
      throw { ...failure, name: 'AccountError' } satisfies AccountError;
    }
    throw error;
  }
}
