import { NotificationScheduler } from './notificationSchedule';

import type { ScheduledNotificationRequest } from './notificationSchedule';

describe('NotificationScheduler pending rules', () => {
  it('all three requests when nothing logged and not ed safe', () => {
    const requests = NotificationScheduler.pendingRequests(new Set(), false, new Date());
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map((request) => request.identifier))).toEqual(
      new Set(['meal.lunch', 'meal.dinner', 'eod.recap']),
    );
  });

  it('lunch reminder suppressed once lunch logged', () => {
    const requests = NotificationScheduler.pendingRequests(new Set(['lunch']), false, new Date());
    expect(requests).toHaveLength(2);
    expect(requests.some((request) => request.identifier === 'meal.lunch')).toBe(false);
  });

  it('dinner reminder suppressed once dinner logged', () => {
    const requests = NotificationScheduler.pendingRequests(new Set(['dinner']), false, new Date());
    expect(requests).toHaveLength(2);
    expect(requests.some((request) => request.identifier === 'meal.dinner')).toBe(false);
  });

  it('eod recap always present regardless of whats logged', () => {
    const combinations: Array<Set<'lunch' | 'dinner'>> = [
      new Set(),
      new Set(['lunch']),
      new Set(['dinner']),
      new Set(['lunch', 'dinner']),
    ];
    for (const logged of combinations) {
      const requests = NotificationScheduler.pendingRequests(logged, false, new Date());
      expect(requests.some((request) => request.identifier === 'eod.recap')).toBe(true);
    }
  });

  it('ed safe recap body contains no digit characters', () => {
    const requests = NotificationScheduler.pendingRequests(new Set(), true, new Date());
    const recap = requests.find((request) => request.identifier === 'eod.recap');
    expect(recap).not.toBeUndefined();
    const body = recap?.body ?? '';
    expect(body.length).toBeGreaterThan(0);
    expect(/\d/.test(body)).toBe(false);
  });

  it('trigger times match documented schedule', () => {
    const requests = NotificationScheduler.pendingRequests(new Set(), false, new Date());
    const expectedTimes: Record<string, { hour: number; minute: number }> = {
      'meal.lunch': { hour: 12, minute: 30 },
      'meal.dinner': { hour: 18, minute: 30 },
      'eod.recap': { hour: 21, minute: 0 },
    };
    expect(requests).toHaveLength(Object.keys(expectedTimes).length);
    for (const request of requests as ScheduledNotificationRequest[]) {
      const expected = expectedTimes[request.identifier];
      expect(request.trigger.hour).toBe(expected?.hour);
      expect(request.trigger.minute).toBe(expected?.minute);
      expect(request.trigger.repeats).toBe(true);
    }
  });

  it('identical input produces byte identical requests', () => {
    const now = new Date();
    const first = NotificationScheduler.pendingRequests(new Set(['lunch']), true, now);
    const second = NotificationScheduler.pendingRequests(new Set(['lunch']), true, now);
    expect(first.map((request) => request.identifier)).toEqual(second.map((request) => request.identifier));
    expect(first.map((request) => request.title)).toEqual(second.map((request) => request.title));
    expect(first.map((request) => request.body)).toEqual(second.map((request) => request.body));
    expect(first).toEqual(second);
  });
});
