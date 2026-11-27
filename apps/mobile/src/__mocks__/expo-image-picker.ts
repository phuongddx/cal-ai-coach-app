/**
 * Manual Jest mock for `expo-image-picker`: both launchers resolve "cancelled" until a test queues an
 * asset with `__pickNext`. Permissions report granted.
 */
const actual = jest.requireActual<typeof import('expo-image-picker')>('expo-image-picker');

type Asset = { uri: string; width: number; height: number; base64?: string | null; mimeType?: string };
let next: Asset[] | null = null;

const result = () => {
  const assets = next;
  next = null;
  return assets ? { canceled: false as const, assets } : { canceled: true as const, assets: null };
};

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as const;

export const launchImageLibraryAsync = jest.fn(async () => result());
export const launchCameraAsync = jest.fn(async () => result());
export const requestMediaLibraryPermissionsAsync = jest.fn(async () => granted);
export const requestCameraPermissionsAsync = jest.fn(async () => granted);
export const getCameraPermissionsAsync = jest.fn(async () => granted);

export const MediaTypeOptions = actual.MediaTypeOptions;
export const UIImagePickerPresentationStyle = actual.UIImagePickerPresentationStyle;
export const CameraType = actual.CameraType;

/** Test helper: the next launch returns these assets instead of "cancelled". */
export function __pickNext(assets: Asset[]): void {
  next = assets;
}

export function __reset(): void {
  next = null;
  for (const fn of [launchImageLibraryAsync, launchCameraAsync, requestMediaLibraryPermissionsAsync, requestCameraPermissionsAsync, getCameraPermissionsAsync]) {
    fn.mockClear();
  }
}
