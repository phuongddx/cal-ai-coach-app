/**
 * Manual Jest mock for `expo-background-task`: registration resolves, nothing is scheduled. Task
 * bodies are driven by calling them directly in a test.
 */
export const BackgroundTaskStatus = { Restricted: 1, Available: 2 } as const;
export const BackgroundTaskResult = { Success: 1, Failed: 2 } as const;

export const getStatusAsync = jest.fn(async () => BackgroundTaskStatus.Available);
export const registerTaskAsync = jest.fn(async (_name: string, _options?: Record<string, unknown>): Promise<void> => undefined);
export const unregisterTaskAsync = jest.fn(async (_name: string): Promise<void> => undefined);
export const triggerTaskWorkerForTestingAsync = jest.fn(async () => true);
export const addExpirationListener = jest.fn(() => ({ remove: jest.fn() }));

export function __reset(): void {
  for (const fn of [getStatusAsync, registerTaskAsync, unregisterTaskAsync, triggerTaskWorkerForTestingAsync, addExpirationListener]) fn.mockClear();
}
