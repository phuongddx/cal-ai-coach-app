/**
 * Manual Jest mock for `expo-notifications`. The real entry point warns about Expo Go on import and
 * its native module is an auto-mock returning `undefined`; this mock keeps a granted permission and
 * the list of scheduled requests in memory. `jest.setup.ts` calls `__reset()` before every test.
 */
type Request = { identifier: string; content: Record<string, unknown>; trigger: unknown };

let permission: 'granted' | 'denied' | 'undetermined' = 'granted';
let scheduled: Request[] = [];
let counter = 0;

export const SchedulableTriggerInputTypes = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
} as const;

export const AndroidImportance = { DEFAULT: 3, HIGH: 4, LOW: 2, MAX: 5, MIN: 1, NONE: 0, UNSPECIFIED: -1000 } as const;

const response = () => ({
  status: permission,
  granted: permission === 'granted',
  canAskAgain: permission === 'undetermined',
  expires: 'never' as const,
});

export const getPermissionsAsync = jest.fn(async () => response());
export const requestPermissionsAsync = jest.fn(async () => {
  if (permission === 'undetermined') permission = 'granted';
  return response();
});
export const setNotificationHandler = jest.fn();
export const scheduleNotificationAsync = jest.fn(
  async (request: { identifier?: string; content: Record<string, unknown>; trigger: unknown }): Promise<string> => {
    const identifier = request.identifier ?? `mock-notification-${++counter}`;
    scheduled = scheduled.filter((r) => r.identifier !== identifier).concat({ identifier, content: request.content, trigger: request.trigger });
    return identifier;
  },
);
export const cancelScheduledNotificationAsync = jest.fn(async (identifier: string): Promise<void> => {
  scheduled = scheduled.filter((r) => r.identifier !== identifier);
});
export const cancelAllScheduledNotificationsAsync = jest.fn(async (): Promise<void> => {
  scheduled = [];
});
export const getAllScheduledNotificationsAsync = jest.fn(async () => scheduled.map((r) => ({ ...r })));
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

/** Test helper: set the OS permission the next `getPermissionsAsync` reports. */
export function __setPermission(next: 'granted' | 'denied' | 'undetermined'): void {
  permission = next;
}

/** Test helper: the requests currently scheduled. */
export function __scheduled(): Request[] {
  return scheduled.map((r) => ({ ...r }));
}

export function __reset(): void {
  permission = 'granted';
  scheduled = [];
  counter = 0;
  for (const fn of [
    getPermissionsAsync,
    requestPermissionsAsync,
    setNotificationHandler,
    scheduleNotificationAsync,
    cancelScheduledNotificationAsync,
    cancelAllScheduledNotificationsAsync,
    getAllScheduledNotificationsAsync,
    addNotificationResponseReceivedListener,
    addNotificationReceivedListener,
  ]) {
    fn.mockClear();
  }
}
