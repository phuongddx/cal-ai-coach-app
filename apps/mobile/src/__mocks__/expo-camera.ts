/**
 * Manual Jest mock for `expo-camera`: the permission hook reports "granted" and `CameraView` is the
 * real component over jest-expo's auto-mocked native view. Types and enums come from the real package.
 */
const actual = jest.requireActual<typeof import('expo-camera')>('expo-camera');

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as const;

export const useCameraPermissions = jest.fn(() => [granted, jest.fn(async () => granted), jest.fn(async () => granted)] as const);
export const useMicrophonePermissions = jest.fn(() => [granted, jest.fn(async () => granted), jest.fn(async () => granted)] as const);
export const scanFromURLAsync = jest.fn(async () => []);

export const CameraView = actual.CameraView;
export const Camera = actual.Camera;

export function __reset(): void {
  useCameraPermissions.mockClear();
  useMicrophonePermissions.mockClear();
  scanFromURLAsync.mockClear();
}
