/**
 * The cooldown of "Resend code": 60 seconds counted by the client from the moment a code was requested
 * (the server keeps its own sending limit). The clock is injected: the screen passes `Date.now`, a test
 * passes its own. The hook re-renders once a second while the cooldown runs and stops at zero.
 */
import { useCallback, useEffect, useState } from 'react';

/** Seconds between two requests of a code. */
export const RESEND_COOLDOWN_SECONDS = 60;

export function useResendCountdown(now: () => number): { secondsLeft: number; start: () => void } {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const secondsLeft = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now()) / 1000));

  useEffect(() => {
    if (deadline === null || secondsLeft === 0) return undefined;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [deadline, secondsLeft === 0]); // eslint-disable-line react-hooks/exhaustive-deps -- the interval only starts and stops

  const start = useCallback(() => setDeadline(now() + RESEND_COOLDOWN_SECONDS * 1000), [now]);
  return { secondsLeft, start };
}

/** `m:ss`: 60 is "1:00", 42 is "0:42". */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
