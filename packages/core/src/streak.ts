/**
 * StreakEngine.swift — pure streak/freeze evaluation (ENG-01): a set-based
 * recount over logged diary days, anchoring on yesterday-or-today, with at
 * most ONE single-day gap bridged while a freeze remains — the bridged day
 * joins the chain without adding to the count. Zero imports by contract;
 * deterministic under the injected `now`.
 *
 * Swift takes an explicit `calendar`; the process time zone is that calendar
 * here, and day strings come from `dayKey` so they match the diary
 * day-string convention exactly.
 */

import { dayKey } from './dayKey';

export interface StreakInput {
  /** Local `YYYY-MM-DD` day keys of every logged diary day in the window. */
  loggedDays: ReadonlySet<string>;
  freezesLeft: number;
  bestStreak: number;
  freezeUsedOn: string | null;
  now: Date;
}

export interface StreakOutcome {
  currentStreak: number;
  bestStreak: number;
  freezesLeft: number;
  freezeUsedOn: string | null;
  freezeConsumedToday: boolean;
}

/** Calendar-day add on the local timeline (DST-safe: `Date` normalizes the fields). */
function addDays(date: Date, days: number): Date {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

export const StreakEngine = {
  /**
   * Walk bound keeps the recount O(n) over real usage (T-P06-04). Callers
   * feeding `loggedDays` from a SQL window must cover at least this span or
   * the recount silently caps at the window edge.
   */
  maxLookbackDays: 730,

  evaluate(input: StreakInput): StreakOutcome {
    const today = dayKey(input.now);
    const yesterdayDate = addDays(input.now, -1);
    const yesterday = dayKey(yesterdayDate);

    let current = 0;
    let bridgedDay: string | null = null;
    let cursorDate: Date | null = null;
    if (input.loggedDays.has(today)) {
      cursorDate = input.now;
    } else if (input.loggedDays.has(yesterday)) {
      cursorDate = yesterdayDate;
    }

    if (cursorDate !== null) {
      current = 1;
      for (let step = 0; step < StreakEngine.maxLookbackDays; step += 1) {
        const cursor: Date = cursorDate;
        const previousDate = addDays(cursor, -1);
        const previousDay = dayKey(previousDate);
        if (input.loggedDays.has(previousDay)) {
          current += 1;
          cursorDate = previousDate;
          continue;
        }
        // Bridge candidate: only a single-day gap with a logged segment
        // directly before it, and only once per evaluation.
        const dayBeforeGap = addDays(previousDate, -1);
        if (bridgedDay === null && input.freezesLeft > 0 && input.loggedDays.has(dayKey(dayBeforeGap))) {
          bridgedDay = previousDay;
          cursorDate = dayBeforeGap;
          current += 1;
          continue;
        }
        break;
      }
    }

    const consumed = bridgedDay !== null;
    return {
      currentStreak: current,
      bestStreak: Math.max(input.bestStreak, current),
      freezesLeft: input.freezesLeft - (consumed ? 1 : 0),
      freezeUsedOn: consumed ? bridgedDay : input.freezeUsedOn,
      freezeConsumedToday: consumed,
    };
  },
} as const;
