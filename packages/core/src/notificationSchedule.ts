/**
 * NotificationScheduler.swift — the PURE rule part only (ENG-03): which of
 * `meal.lunch`, `meal.dinner` and `eod.recap` should be pending, and with
 * which copy and repeating calendar trigger. A meal reminder is suppressed
 * once that slot is logged today; the EOD recap is always present and never
 * shows a raw kcal figure while ED-Safe Mode is on (T-P44-01).
 *
 * The Swift `pendingRequests(mealsLoggedToday:edSafeMode:now:)` ignores
 * `now` (the triggers are repeating wall-clock times), and so does this port;
 * the parameter stays for signature parity.
 *
 * NOT core — the notification-center calls `refresh()` makes are listed in
 * docs/rn-migration/findings/U-10.md for U-42 to wire with expo-notifications.
 */

export type MealSlot = 'lunch' | 'dinner';

export type ScheduledIdentifier = 'meal.lunch' | 'meal.dinner' | 'eod.recap';

export interface NotificationTrigger {
  hour: number;
  minute: number;
  /** UNCalendarNotificationTrigger(dateMatching:repeats: true). */
  repeats: true;
}

export interface ScheduledNotificationRequest {
  identifier: ScheduledIdentifier;
  title: string;
  body: string;
  trigger: NotificationTrigger;
}

function request(
  identifier: ScheduledIdentifier,
  title: string,
  body: string,
  hour: number,
  minute: number,
): ScheduledNotificationRequest {
  return { identifier, title, body, trigger: { hour, minute, repeats: true } };
}

export const NotificationScheduler = {
  allIdentifiers: ['meal.lunch', 'meal.dinner', 'eod.recap'] as readonly ScheduledIdentifier[],

  pendingRequests(
    mealsLoggedToday: ReadonlySet<MealSlot>,
    edSafeMode: boolean,
    now?: Date,
  ): ScheduledNotificationRequest[] {
    void now;
    const requests: ScheduledNotificationRequest[] = [];

    if (!mealsLoggedToday.has('lunch')) {
      requests.push(
        request(
          'meal.lunch',
          'Time to log lunch',
          'Snap a photo or search to log your lunch.',
          12,
          30,
        ),
      );
    }
    if (!mealsLoggedToday.has('dinner')) {
      requests.push(
        request(
          'meal.dinner',
          'Time to log dinner',
          'Snap a photo or search to log your dinner.',
          18,
          30,
        ),
      );
    }

    requests.push(
      request(
        'eod.recap',
        'Your day, wrapped',
        edSafeMode ? 'See your day in the Diary tab.' : "See how today's calories added up.",
        21,
        0,
      ),
    );

    return requests;
  },
} as const;
