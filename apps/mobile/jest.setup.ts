/**
 * Runs after the Jest framework is installed, before every test file (`setupFilesAfterEnv`).
 *
 * Manual mocks for the native modules live in `src/__mocks__/` and activate by themselves. Each keeps
 * a little state (the keychain, the scheduled notifications, the picked photo) and exports `__reset`;
 * this file resets them all so no test sees what an earlier one left behind.
 */
import { __reset as resetAppleAuthentication } from './src/__mocks__/expo-apple-authentication';
import { __reset as resetBackgroundTask } from './src/__mocks__/expo-background-task';
import { __reset as resetCamera } from './src/__mocks__/expo-camera';
import { __reset as resetImageManipulator } from './src/__mocks__/expo-image-manipulator';
import { __reset as resetImagePicker } from './src/__mocks__/expo-image-picker';
import { __reset as resetNotifications } from './src/__mocks__/expo-notifications';
import { __reset as resetSecureStore } from './src/__mocks__/expo-secure-store';
import { __reset as resetSharing } from './src/__mocks__/expo-sharing';
import { __reset as resetWebBrowser } from './src/__mocks__/expo-web-browser';

/**
 * The reset functions are imported from the mock files themselves, the same module instances the app
 * gets for `import 'expo-secure-store'` and the rest. The earlier `jest.requireMock(name).__reset?.()`
 * could return a different registry entry than the one the app imports, so the reset silently did
 * nothing (the keychain kept a session between tests).
 */
const RESETTERS = [
  resetSecureStore,
  resetNotifications,
  resetAppleAuthentication,
  resetCamera,
  resetImagePicker,
  resetImageManipulator,
  resetWebBrowser,
  resetSharing,
  resetBackgroundTask,
];

beforeEach(() => {
  for (const reset of RESETTERS) reset();
});
