/**
 * One smoke test per package added by U-13: the module imports under Jest (jest-expo's own mocks or
 * `src/__mocks__`) and exposes the API the feature units rely on. They guard the manifest, not the
 * libraries: a package that stops importing under Jest fails here first.
 */
describe('native modules import under Jest', () => {
  it('@tanstack/react-query exposes QueryClient and the hooks', () => {
    const rq = require('@tanstack/react-query');
    expect(new rq.QueryClient()).toBeInstanceOf(rq.QueryClient);
    expect(typeof rq.useQuery).toBe('function');
    expect(typeof rq.QueryClientProvider).toBe('function');
  });

  it('zustand creates a store', () => {
    const { create } = require('zustand');
    const useStore = create((set: (s: { n: number }) => void) => ({ n: 0, inc: () => set({ n: 1 }) }));
    expect(useStore.getState().n).toBe(0);
    useStore.getState().inc();
    expect(useStore.getState().n).toBe(1);
  });

  it('expo-camera exposes CameraView and the permission hook', () => {
    const camera = require('expo-camera');
    expect(camera.CameraView).toBeDefined();
    expect(typeof camera.useCameraPermissions).toBe('function');
  });

  it('expo-image-picker exposes the library launcher', () => {
    const picker = require('expo-image-picker');
    expect(typeof picker.launchImageLibraryAsync).toBe('function');
  });

  it('expo-image-manipulator exposes the manipulate API', () => {
    const manipulator = require('expo-image-manipulator');
    expect(typeof manipulator.manipulateAsync).toBe('function');
    expect(manipulator.SaveFormat.JPEG).toBe('jpeg');
  });

  it('expo-apple-authentication exposes the sign-in call and the scopes', () => {
    const apple = require('expo-apple-authentication');
    expect(typeof apple.signInAsync).toBe('function');
    expect(apple.AppleAuthenticationScope.EMAIL).toBeDefined();
  });

  it('expo-crypto computes a SHA-256 digest', async () => {
    const crypto = require('expo-crypto');
    await expect(crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, 'abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('expo-web-browser exposes the in-app browser', () => {
    const browser = require('expo-web-browser');
    expect(typeof browser.openBrowserAsync).toBe('function');
  });

  it('expo-secure-store round-trips a value', async () => {
    const store = require('expo-secure-store');
    await store.setItemAsync('k', 'v');
    await expect(store.getItemAsync('k')).resolves.toBe('v');
    await store.deleteItemAsync('k');
    await expect(store.getItemAsync('k')).resolves.toBeNull();
  });

  it('expo-notifications exposes scheduling and permissions', () => {
    const notifications = require('expo-notifications');
    expect(typeof notifications.scheduleNotificationAsync).toBe('function');
    expect(typeof notifications.getPermissionsAsync).toBe('function');
  });

  it('expo-background-task exposes registration', () => {
    const task = require('expo-background-task');
    expect(typeof task.registerTaskAsync).toBe('function');
    expect(task.BackgroundTaskResult.Success).toBeDefined();
  });

  it('expo-file-system exposes File and Paths', () => {
    const fs = require('expo-file-system');
    expect(typeof fs.File).toBe('function');
    expect(fs.Paths.document).toBeDefined();
  });

  it('expo-sharing exposes shareAsync', () => {
    const sharing = require('expo-sharing');
    expect(typeof sharing.shareAsync).toBe('function');
  });
});
