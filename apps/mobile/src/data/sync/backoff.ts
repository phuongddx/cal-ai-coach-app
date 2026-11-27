/**
 * Backoff.swift — the delay policy for failed dispatches. `attempts` counts failed dispatches: the
 * first waits one second, then each later failure doubles up to the 30-second cap
 * (1, 2, 4, 8, 16, 30, 30, ...).
 */
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 30_000;

export function backoffDelayMs(attempts: number): number {
  if (attempts <= 1) return BACKOFF_BASE_MS;
  const exponent = Math.min(attempts - 1, 5);
  return Math.min(2 ** exponent * 1_000, BACKOFF_CAP_MS);
}
