/**
 * Runs after the Jest framework is installed, before every test file (`setupFilesAfterEnv`).
 *
 * Manual mocks for the native modules live in `src/__mocks__/` and activate by themselves. Each keeps
 * a little state (the keychain, the scheduled notifications, the picked photo) and exports `__reset`;
 * this file resets them all so no test sees what an earlier one left behind.
 */
const RESETTABLE = [
  'expo-secure-store',
  'expo-notifications',
  'expo-apple-authentication',
  'expo-camera',
  'expo-image-picker',
  'expo-image-manipulator',
  'expo-web-browser',
  'expo-sharing',
  'expo-background-task',
] as const;

beforeEach(() => {
  for (const name of RESETTABLE) {
    (jest.requireMock(name) as { __reset?: () => void }).__reset?.();
  }
});
