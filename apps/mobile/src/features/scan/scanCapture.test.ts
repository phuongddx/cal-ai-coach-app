/**
 * The capture seam: the fixture service (what the Simulator runs) and the device service (expo-camera still,
 * barcode-from-photo, library pick, manipulator resize). The native modules are the manual mocks in `src/__mocks__`.
 */
import * as camera from 'expo-camera';
import * as manipulator from 'expo-image-manipulator';
import * as picker from 'expo-image-picker';

import { FIXTURE_MEAL_IMAGE, ScanCaptureError, createDeviceCaptureService, createFixtureCaptureService } from './scanCapture';

const pickNext = (picker as unknown as { __pickNext: (assets: { uri: string; width: number; height: number }[]) => void }).__pickNext;
const asset = { uri: 'file:///pick.jpg', width: 4000, height: 3000 };

describe('fixture capture service', () => {
  it('captures the bundled photo with the fixture marker', async () => {
    const shot = await createFixtureCaptureService('photo').capture();
    expect(shot.thumb).toBe(FIXTURE_MEAL_IMAGE);
    expect(shot.request).toMatchObject({ kind: 'photo', imageBase64: 'fixture:chicken-rice' });
  });

  it('label mode uploads the image as a label request', async () => {
    const shot = await createFixtureCaptureService('label').capture();
    expect(shot.request).toMatchObject({ kind: 'label', imageBase64: 'fixture:chicken-rice' });
  });

  it('a barcode read becomes a barcode request and the library pick in barcode mode uses the fixture code', async () => {
    const service = createFixtureCaptureService('barcode');
    expect(service.captureBarcode('4006381333931').request).toMatchObject({ kind: 'barcode', barcode: '4006381333931' });
    expect((await service.pickFromLibrary())?.request).toMatchObject({ kind: 'barcode', barcode: '4006381333931' });
  });
});

describe('device capture service', () => {
  it('asks the camera permission API and reports its answer', async () => {
    jest.spyOn(camera.Camera, 'requestCameraPermissionsAsync').mockResolvedValueOnce({ granted: false } as never);
    expect(await createDeviceCaptureService('photo').requestAccessIfNeeded()).toBe(false);
  });

  it('capture without a mounted camera is an empty frame', async () => {
    await expect(createDeviceCaptureService('photo').capture()).rejects.toMatchObject({ name: 'ScanCaptureError', reason: 'emptyFrame' });
  });

  it('capture shrinks the still to a 1024 wide JPEG and uploads its base64', async () => {
    const service = createDeviceCaptureService('photo');
    service.attachCamera({ takePictureAsync: jest.fn(async () => ({ uri: 'file:///still.jpg' })) });
    const shot = await service.capture();
    expect(manipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///still.jpg',
      [{ resize: { width: 1024 } }],
      expect.objectContaining({ compress: 0.7, base64: true }),
    );
    expect(shot.request).toMatchObject({ kind: 'photo', imageBase64: 'bW9jaw==' });
  });

  it('a library pick is shrunk the same way and a cancelled pick is null', async () => {
    const service = createDeviceCaptureService('label');
    expect(await service.pickFromLibrary()).toBeNull();
    pickNext([asset]);
    const shot = await service.pickFromLibrary();
    expect(shot?.request).toMatchObject({ kind: 'label', imageBase64: 'bW9jaw==' });
  });

  it('barcode mode reads the code from the photo and an unreadable photo is noBarcode', async () => {
    const service = createDeviceCaptureService('barcode');
    jest.mocked(camera.scanFromURLAsync).mockResolvedValueOnce([{ data: '4006381333931', type: 'ean13' }] as never);
    pickNext([asset]);
    expect((await service.pickFromLibrary())?.request).toMatchObject({ kind: 'barcode', barcode: '4006381333931' });
    pickNext([asset]);
    await expect(service.pickFromLibrary()).rejects.toBeInstanceOf(ScanCaptureError);
  });

  it('a live barcode read yields a request without a still', () => {
    expect(createDeviceCaptureService('barcode').captureBarcode('4006381333931')).toMatchObject({
      thumb: null,
      request: { kind: 'barcode', barcode: '4006381333931' },
    });
  });
});
