/**
 * Manual Jest mock for `expo-secure-store`: an in-memory keychain. jest-expo auto-mocks the native
 * module with `jest.fn()`s that return `undefined`, so `getItemAsync` would never see what
 * `setItemAsync` wrote. `jest.setup.ts` calls `__reset()` before every test.
 */
const store = new Map<string, string>();

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

export const isAvailableAsync = jest.fn(async () => true);
export const canUseBiometricAuthentication = jest.fn(() => false);

export const getItemAsync = jest.fn(async (key: string): Promise<string | null> => store.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string): Promise<void> => {
  store.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  store.delete(key);
});
export const getItem = jest.fn((key: string): string | null => store.get(key) ?? null);
export const setItem = jest.fn((key: string, value: string): void => {
  store.set(key, value);
});

/** Test helper: forget every stored value and every recorded call. */
export function __reset(): void {
  store.clear();
  for (const fn of [isAvailableAsync, canUseBiometricAuthentication, getItemAsync, setItemAsync, deleteItemAsync, getItem, setItem]) {
    fn.mockClear();
  }
}

/** Test helper: the stored keys, for assertions on what the app persisted. */
export function __keys(): string[] {
  return [...store.keys()];
}
