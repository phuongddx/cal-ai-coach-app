declare const process: { env: Record<string, string | undefined> };

import { dayKey } from './dayKey';

import { StreakEngine } from './streak';

import type { StreakInput } from './streak';

// Ported 1:1 from StreakEngineTests.swift. The Swift fixture pins a UTC
// calendar; the twin pins the process time zone to UTC for the file, the way
// the Swift suite pins its Calendar fixture.

const NOW = new Date('2026-09-15T12:00:00Z');

function addDays(date: Date, days: number): Date {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

describe('StreakEngine', () => {
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'UTC';
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  function days(offsetsFromToday: number[]): Set<string> {
    return new Set(offsetsFromToday.map((offset) => dayKey(addDays(NOW, offset))));
  }

  function evaluate(
    offsets: number[],
    freezesLeft = 0,
    bestStreak = 0,
    freezeUsedOn: string | null = null,
  ): ReturnType<typeof StreakEngine.evaluate> {
    return StreakEngine.evaluate({
      loggedDays: days(offsets),
      freezesLeft,
      bestStreak,
      freezeUsedOn,
      now: NOW,
    });
  }

  it('consecutive logged days ending today count fully', () => {
    const outcome = evaluate([-4, -3, -2, -1, 0], 1, 3);
    expect(outcome.currentStreak).toBe(5);
    expect(outcome.bestStreak).toBe(5);
    expect(outcome.freezesLeft).toBe(1);
    expect(outcome.freezeUsedOn).toBeNull();
    expect(outcome.freezeConsumedToday).toBe(false);
  });

  it('streak ending yesterday still counts when today is unlogged', () => {
    const outcome = evaluate([-4, -3, -2, -1], 1, 9);
    expect(outcome.currentStreak).toBe(4);
    expect(outcome.bestStreak).toBe(9);
  });

  it('gap without freeze starts fresh streak at one', () => {
    const outcome = evaluate([-7, -6, -5, -4, -3, -2, 0], 0, 3);
    // "Day 1 streak started!" surfaces from current == 1.
    expect(outcome.currentStreak).toBe(1);
    expect(outcome.bestStreak).toBe(3);
    expect(outcome.freezeConsumedToday).toBe(false);
  });

  it('freeze bridges single missed day and is consumed', () => {
    // Seeded-history shape: 12 logged days ending 2 days ago, yesterday
    // missed, today logged, 1 freeze → 12 + today, freeze spent on yesterday.
    const twelveDaysEndingDayBeforeYesterday = [-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2];
    const outcome = evaluate([...twelveDaysEndingDayBeforeYesterday, 0], 1, 12);
    expect(outcome.currentStreak).toBe(13);
    expect(outcome.freezesLeft).toBe(0);
    expect(outcome.freezeUsedOn).toBe('2026-09-14');
    expect(outcome.freezeConsumedToday).toBe(true);
    expect(outcome.bestStreak).toBe(13);
  });

  it('freeze unavailable leaves the gap broken', () => {
    const twelveDaysEndingDayBeforeYesterday = [-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2];
    const outcome = evaluate([...twelveDaysEndingDayBeforeYesterday, 0], 0, 12, null);
    expect(outcome.currentStreak).toBe(1);
    expect(outcome.freezeUsedOn).toBeNull();
    expect(outcome.freezeConsumedToday).toBe(false);
  });

  it('best streak never regresses', () => {
    const outcome = evaluate([-1, 0], 1, 18);
    expect(outcome.currentStreak).toBe(2);
    expect(outcome.bestStreak).toBe(18);
  });

  it('stale history without recent logs resets to zero', () => {
    const outcome = evaluate([-5, -4], 0, 7);
    expect(outcome.currentStreak).toBe(0);
    expect(outcome.bestStreak).toBe(7);
  });

  it('freeze is not burned without segment before the gap', () => {
    const outcome = evaluate([0], 1, 1);
    expect(outcome.currentStreak).toBe(1);
    expect(outcome.freezesLeft).toBe(1);
    expect(outcome.freezeConsumedToday).toBe(false);
  });

  it('two day gap is never bridged', () => {
    const outcome = evaluate([-5, -4, -3, 0], 1, 3);
    expect(outcome.currentStreak).toBe(1);
    expect(outcome.freezesLeft).toBe(1);
    expect(outcome.freezeConsumedToday).toBe(false);
  });

  it('existing freeze stamp is preserved when no new freeze is consumed', () => {
    const outcome = evaluate([-2, -1, 0], 1, 3, '2026-08-30');
    expect(outcome.currentStreak).toBe(3);
    expect(outcome.freezeUsedOn).toBe('2026-08-30');
    expect(outcome.freezesLeft).toBe(1);
  });

  it('evaluation is deterministic under fixed now', () => {
    const input: StreakInput = {
      loggedDays: days([-2, -1, 0]),
      freezesLeft: 1,
      bestStreak: 2,
      freezeUsedOn: null,
      now: NOW,
    };
    expect(StreakEngine.evaluate(input)).toEqual(StreakEngine.evaluate(input));
  });
});
