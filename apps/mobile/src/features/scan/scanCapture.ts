/**
 * CameraCaptureService.swift — the capture seam (RESEARCH Pattern 6). One interface, two services:
 *
 * - the fixture service: no camera, always "granted", returns the bundled meal photo and the
 *   `fixture:chicken-rice` marker the API's fixture provider sniffs;
 * - the device service: `expo-camera` for the still and the barcode photo, `expo-image-picker` for
 *   the library, `expo-image-manipulator` to shrink the upload.
 *
 * The decision (fixture or device) is taken by the route, never here: this file reads no process
 * arguments and no debug flags (standing-order rule 19).
 */
import { Camera, scanFromURLAsync, type BarcodeType } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { buildScanRequest } from '../../data/api/scanClient';
import type { ScanCapture, ScanMode } from './scanTypes';

/** The bundled fixture photo, loaded with `require` (Metro resolves it to an asset id). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const FIXTURE_MEAL_IMAGE: number = require('./assets/fixture-meal.png');

export class ScanCaptureError extends Error {
  constructor(readonly reason: 'emptyFrame' | 'noBarcode' | 'cancelled') {
    super(reason);
    this.name = 'ScanCaptureError';
  }
}

/** The handle the device viewfinder gives the service once its `CameraView` is mounted. */
export type CameraHandle = {
  takePictureAsync: (options: { quality: number; base64: boolean; skipProcessing: boolean }) => Promise<{ uri: string; base64?: string } | undefined>;
};

export interface ScanCaptureService {
  /** `fixture` renders the bundled photo as the feed; `device` renders the live `CameraView`. */
  readonly kind: 'fixture' | 'device';
  readonly mode: ScanMode;
  /** Resolves video permission before the session starts; false feeds the permission card. */
  requestAccessIfNeeded(): Promise<boolean>;
  /** Device only: the mounted camera. */
  attachCamera(handle: CameraHandle | null): void;
  capture(): Promise<ScanCapture>;
  /** A barcode the live reticle read: a request, no still. */
  captureBarcode(data: string): ScanCapture;
  /** The library fallback: null when the person cancelled. Throws `ScanCaptureError` for an unreadable pick. */
  pickFromLibrary(): Promise<ScanCapture | null>;
}

/** Photo mode and label mode both upload the image: the contract has no OCR-text label request. */
function imageKind(mode: ScanMode): 'photo' | 'label' {
  return mode === 'label' ? 'label' : 'photo';
}

export function createFixtureCaptureService(mode: ScanMode): ScanCaptureService {
  return {
    kind: 'fixture',
    mode,
    // The fixture seam never touches the camera, so it is always "granted".
    requestAccessIfNeeded: async () => true,
    attachCamera: () => undefined,
    async capture(): Promise<ScanCapture> {
      // Stand-in for AE/AF settling so the shutter press has visible work.
      await new Promise((resolve) => setTimeout(resolve, 120));
      return {
        thumb: FIXTURE_MEAL_IMAGE,
        request: buildScanRequest({ kind: imageKind(mode), imageBase64: 'fixture:chicken-rice' }),
      };
    },
    captureBarcode: (data) => ({ thumb: FIXTURE_MEAL_IMAGE, request: buildScanRequest({ kind: 'barcode', barcode: data }) }),
    async pickFromLibrary(): Promise<ScanCapture | null> {
      const request =
        mode === 'barcode'
          ? buildScanRequest({ kind: 'barcode', barcode: '4006381333931' })
          : buildScanRequest({ kind: imageKind(mode), imageBase64: 'fixture:chicken-rice' });
      return { thumb: FIXTURE_MEAL_IMAGE, request };
    },
  };
}

/** Longest edge sent to the API: a phone photo is 12 MP; the model needs far less. */
const UPLOAD_WIDTH = 1024;
const UPLOAD_QUALITY = 0.7;
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'];

async function shrink(uri: string): Promise<{ uri: string; base64: string }> {
  // `manipulateAsync` is the one-shot call of expo-image-manipulator 58 (deprecated in favor of the context API,
  // which has no Jest mock yet); it still resizes and encodes.
  const result = await manipulateAsync(uri, [{ resize: { width: UPLOAD_WIDTH } }], {
    compress: UPLOAD_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (result.base64 === undefined || result.base64.length === 0) throw new ScanCaptureError('emptyFrame');
  return { uri: result.uri, base64: result.base64 };
}

export type DeviceCaptureDeps = {
  requestCameraPermission?: () => Promise<boolean>;
};

export function createDeviceCaptureService(mode: ScanMode, deps: DeviceCaptureDeps = {}): ScanCaptureService {
  let camera: CameraHandle | null = null;
  const requestCameraPermission =
    deps.requestCameraPermission ?? (async () => (await Camera.requestCameraPermissionsAsync()).granted);

  async function fromImage(uri: string): Promise<ScanCapture> {
    if (mode === 'barcode') {
      const found = await scanFromURLAsync(uri, BARCODE_TYPES);
      const barcode = found[0]?.data;
      if (barcode === undefined || barcode.length === 0) throw new ScanCaptureError('noBarcode');
      return { thumb: { uri }, request: buildScanRequest({ kind: 'barcode', barcode }) };
    }
    const shrunk = await shrink(uri);
    return { thumb: { uri: shrunk.uri }, request: buildScanRequest({ kind: imageKind(mode), imageBase64: shrunk.base64 }) };
  }

  return {
    kind: 'device',
    mode,
    requestAccessIfNeeded: requestCameraPermission,
    attachCamera(handle) {
      camera = handle;
    },
    async capture(): Promise<ScanCapture> {
      if (camera === null) throw new ScanCaptureError('emptyFrame');
      const picture = await camera.takePictureAsync({ quality: 1, base64: false, skipProcessing: false });
      if (picture === undefined) throw new ScanCaptureError('emptyFrame');
      return fromImage(picture.uri);
    },
    captureBarcode: (data) => ({ thumb: null, request: buildScanRequest({ kind: 'barcode', barcode: data }) }),
    async pickFromLibrary(): Promise<ScanCapture | null> {
      const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, base64: false });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset === undefined) return null;
      return fromImage(asset.uri);
    },
  };
}
