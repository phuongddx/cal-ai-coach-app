/**
 * The `UNUserNotificationCenter` wiring of `NotificationScheduler.swift` (ENG-03) — the half
 * `packages/core` deliberately left to this unit (see findings U-10 §4). The pure decision
 * stays `NotificationScheduler.pendingRequests` in `@coachcal/core`; this module only talks
 * to a notification center, through the injected `NotificationCenterPort` (Jest doubles; the
 * default port is `expo-notifications`).
 *
 * Swift `refresh()`, kept line for line:
 * - authorization is requested lazily here, on the first scheduling attempt — never at
 *   launch — and its result is ignored (`_ = try? await`);
 * - every CoachCal identifier is removed before the current set is re-added — idempotent
 *   replace, at most three pending, never additive (T-P44-02);
 * - failures never throw out of the refresh.
 *
 * One platform mapping: Swift removes pending UNNotificationRequests by identifier;
 * expo-notifications has no pending-request API — its scheduled notifications are the
 * pending counterpart, so the port cancels them by the same three identifiers.
 *
 * The caller (after a local write and at launch, `AppEnvironment.notifyLocalMutation()`'s
 * counterpart) is a later unit; nothing calls `refreshNotifications()` yet.
 */

import * as ExpoNotifications from 'expo-notifications';

import { NotificationScheduler } from '@coachcal/core';
import type { MealSlot, ScheduledNotificationRequest } from '@coachcal/core';

/** The UNUserNotificationCenter surface `refresh()` touches. */
export interface NotificationCenterPort {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  /** Swift's `removePendingNotificationRequests(withIdentifiers:)`. */
  cancelScheduledNotificationsAsync(identifiers: readonly string[]): Promise<void>;
  scheduleNotificationAsync(request: ScheduledNotificationRequest): Promise<string>;
}

export interface RefreshNotificationsDeps {
  /** Which meal slots are logged today (Swift's `mealsLoggedToday` closure). */
  mealsLoggedToday(): Promise<ReadonlySet<MealSlot>>;
  /** Swift's `edSafeMode` closure — the recap body loses its kcal framing while on. */
  edSafeMode(): boolean | Promise<boolean>;
  /** Swift's `now`; defaults to the wall clock (the rule ignores it, for signature parity). */
  now?(): Date;
  /** Defaults to the expo-notifications port below. */
  center?: NotificationCenterPort;
}

/** The expo-notifications center: repeating calendar triggers at the request's time. */
export const expoNotificationCenter: NotificationCenterPort = {
  requestPermissionsAsync: async () => {
    const response = await ExpoNotifications.requestPermissionsAsync();
    return { granted: response.granted };
  },
  cancelScheduledNotificationsAsync: async (identifiers) => {
    for (const identifier of identifiers) {
      await ExpoNotifications.cancelScheduledNotificationAsync(identifier);
    }
  },
  scheduleNotificationAsync: (request) =>
    ExpoNotifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: request.trigger.hour,
        minute: request.trigger.minute,
        repeats: true,
      },
    }),
};

/**
 * Idempotent replace: ask permission, cancel every CoachCal request, schedule the pending
 * set again. Errors are swallowed like Swift's `try?` — a notification-center refusal must
 * never break the write that triggered the refresh.
 */
export async function refreshNotifications(deps: RefreshNotificationsDeps): Promise<void> {
  const center = deps.center ?? expoNotificationCenter;
  const logged = await deps.mealsLoggedToday();
  const requests = NotificationScheduler.pendingRequests(
    logged,
    await deps.edSafeMode(),
    deps.now ? deps.now() : new Date(),
  );
  try {
    await center.requestPermissionsAsync();
  } catch {
    // try? — the result is ignored either way.
  }
  try {
    await center.cancelScheduledNotificationsAsync(NotificationScheduler.allIdentifiers);
  } catch {
    // Swift's removePendingNotificationRequests is synchronous; a rejected promise here
    // still must not break the refresh.
  }
  for (const request of requests) {
    try {
      await center.scheduleNotificationAsync(request);
    } catch {
      // try? — one failed request never blocks the others.
    }
  }
}
