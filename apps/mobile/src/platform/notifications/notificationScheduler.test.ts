/**
 * The `refresh()` half of NotificationScheduler.swift (ENG-03) over an injected center:
 * lazy permission ask, remove-every-CoachCal-identifier-then-re-add (idempotent replace,
 * T-P44-02), the three reminders decided by `NotificationScheduler` in `@coachcal/core`,
 * and the expo-notifications calendar-trigger mapping of the default port.
 */

import { afterEach, describe, expect, it } from '@jest/globals';

jest.mock('expo-notifications');

import { scheduleNotificationAsync, SchedulableTriggerInputTypes } from 'expo-notifications';
import { expoNotificationCenter, refreshNotifications } from './notificationScheduler';
import type { NotificationCenterPort } from './notificationScheduler';

/** An array-backed center: scheduling appends, cancellation filters — growth means duplication. */
function makeCenter(grant = true) {
  const scheduled: Array<{ identifier: string; title: string; body: string; trigger: unknown }> = [];
  const permissionCalls = jest.fn(async () => ({ granted: grant }));
  const cancelCalls: string[][] = [];
  const center: NotificationCenterPort & {
    scheduled: typeof scheduled;
    permissionCalls: ReturnType<typeof jest.fn>;
    cancelCalls: string[][];
  } = {
    requestPermissionsAsync: permissionCalls,
    cancelScheduledNotificationsAsync: async (identifiers) => {
      cancelCalls.push([...identifiers]);
      const dropped = new Set(identifiers);
      for (let i = scheduled.length - 1; i >= 0; i -= 1) {
        if (dropped.has(scheduled[i]!.identifier)) scheduled.splice(i, 1);
      }
    },
    scheduleNotificationAsync: async (request) => {
      scheduled.push({
        identifier: request.identifier,
        title: request.title,
        body: request.body,
        trigger: request.trigger,
      });
      return request.identifier;
    },
    scheduled,
    permissionCalls,
    cancelCalls,
  };
  return center;
}

const NO_MEALS: ReadonlySet<never> = new Set();
const LUNCH_ONLY = new Set<'lunch' | 'dinner'>(['lunch']);

function deps(center: NotificationCenterPort, meals: ReadonlySet<'lunch' | 'dinner'> = NO_MEALS) {
  return {
    mealsLoggedToday: async () => meals,
    edSafeMode: async () => false,
    now: () => new Date(2026, 10, 27, 12, 0, 0, 0),
    center,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('refreshNotifications — the refresh() wiring', () => {
  it('asks for permission, cancels every identifier, then schedules the three reminders', async () => {
    const center = makeCenter();

    await refreshNotifications(deps(center));

    expect(center.permissionCalls).toHaveBeenCalledTimes(1);
    expect(center.cancelCalls).toEqual([['meal.lunch', 'meal.dinner', 'eod.recap']]);
    expect(center.scheduled.map((request) => request.identifier)).toEqual([
      'meal.lunch',
      'meal.dinner',
      'eod.recap',
    ]);
  });

  it('schedules the three reminders with their copy and repeating calendar times', async () => {
    const center = makeCenter();

    await refreshNotifications(deps(center));

    const [lunch, dinner, recap] = center.scheduled;
    expect(lunch).toMatchObject({
      identifier: 'meal.lunch',
      title: 'Time to log lunch',
      body: 'Snap a photo or search to log your lunch.',
      trigger: { hour: 12, minute: 30, repeats: true },
    });
    expect(dinner).toMatchObject({
      identifier: 'meal.dinner',
      title: 'Time to log dinner',
      body: 'Snap a photo or search to log your dinner.',
      trigger: { hour: 18, minute: 30, repeats: true },
    });
    expect(recap).toMatchObject({
      identifier: 'eod.recap',
      title: 'Your day, wrapped',
      body: "See how today's calories added up.",
      trigger: { hour: 21, minute: 0, repeats: true },
    });
  });

  it('suppresses the lunch reminder on a day with lunch logged and dinner not', async () => {
    const center = makeCenter();

    await refreshNotifications(deps(center, LUNCH_ONLY));

    expect(center.scheduled.map((request) => request.identifier)).toEqual([
      'meal.dinner',
      'eod.recap',
    ]);
  });

  it('a second refresh does not duplicate a pending request', async () => {
    const center = makeCenter();
    const day = deps(center);

    await refreshNotifications(day);
    await refreshNotifications(day);

    // The replace: the pending set is exactly the three identifiers again, never additive.
    expect(center.scheduled.map((request) => request.identifier)).toEqual([
      'meal.lunch',
      'meal.dinner',
      'eod.recap',
    ]);
    expect(center.scheduled).toHaveLength(3);
    expect(center.cancelCalls).toHaveLength(2);
    expect(center.cancelCalls[1]).toEqual(['meal.lunch', 'meal.dinner', 'eod.recap']);
  });

  it('never throws when the center refuses the permission or a schedule', async () => {
    const center = makeCenter();
    center.requestPermissionsAsync = async () => {
      throw new Error('permission refused');
    };
    let refused = 0;
    const original = center.scheduleNotificationAsync.bind(center);
    center.scheduleNotificationAsync = async (request) => {
      refused += 1;
      if (refused === 1) throw new Error('request rejected');
      return original(request);
    };

    await expect(refreshNotifications(deps(center))).resolves.toBeUndefined();
    // The failed lunch does not block dinner and the recap.
    expect(center.scheduled.map((request) => request.identifier)).toEqual([
      'meal.dinner',
      'eod.recap',
    ]);
  });
});

describe('expoNotificationCenter — the default port', () => {
  it('the expo port schedules a repeating calendar trigger at the requested hour and minute', async () => {
    await expoNotificationCenter.scheduleNotificationAsync({
      identifier: 'meal.lunch',
      title: 'Time to log lunch',
      body: 'Snap a photo or search to log your lunch.',
      trigger: { hour: 12, minute: 30, repeats: true },
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'meal.lunch',
      content: { title: 'Time to log lunch', body: 'Snap a photo or search to log your lunch.' },
      trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 12, minute: 30, repeats: true },
    });
  });
});
