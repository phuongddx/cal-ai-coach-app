/**
 * Jest twin of native/App/CoachCalTests/ScanCapturePermissionTests.swift — one case per Swift test, the
 * same behavior sentences (the XCTest method names). WR-03: the device seam resolves permission before the
 * session is configured, and a denied session renders the permission card with a Settings escape and the
 * library fallback — never a dead reticle with no prompt.
 */
jest.mock('react', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen, userEvent } from '@testing-library/react-native';

import { createDeviceCaptureService, createFixtureCaptureService } from './scanCapture';
import { CaptureViewfinderView } from './CaptureViewfinderView';
import { GateApi, makeModel } from './scanTestKit';

function viewfinder(isCameraAccessDenied?: boolean) {
  const model = makeModel({ api: new GateApi() });
  return (
    <CaptureViewfinderView
      model={model}
      mode="photo"
      onModeChange={() => {}}
      onLoggedElsewhere={() => {}}
      capture={createFixtureCaptureService('photo')}
      isCameraAccessDenied={isCameraAccessDenied}
    />
  );
}

describe('ScanCapturePermissionTests twins', () => {
  it('testFixtureCaptureSeamAlwaysReportsAccessGranted', async () => {
    const service = createFixtureCaptureService('photo');
    const granted = await service.requestAccessIfNeeded();
    expect(granted).toBe(true); // the fixture seam never touches the camera, so it is always granted
  });

  it('testDeniedPermissionCardRendersCopyAndSettingsEscape', async () => {
    await render(viewfinder(true));
    expect(screen.getByText('Camera access is off')).toBeOnTheScreen();
    // the library fallback must be offered alongside Settings
    expect(screen.getByText(/pick a photo from your library/)).toBeOnTheScreen();
    const settingsButton = screen.getByRole('button', { name: 'Open Settings' });
    expect(settingsButton).toBeOnTheScreen();
    expect(screen.getByTestId('scan.openSettings')).toBeOnTheScreen();
  });

  it('testGrantedStateHidesPermissionCard', async () => {
    await render(viewfinder());
    // the permission card must stay hidden while access is granted
    expect(screen.queryByText('Camera access is off')).not.toBeOnTheScreen();
  });
});

/** The `facing` prop on the one live camera node in the rendered tree (the native view has no test id). */
function liveCameraFacing(): unknown {
  const found: unknown[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const { props, children } = node as { props?: Record<string, unknown>; children?: unknown[] };
    if (props !== undefined && 'facing' in props) found.push(props.facing);
    if (Array.isArray(children)) children.forEach(walk);
  };
  const tree = screen.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  expect(found).toHaveLength(1);
  return found[0];
}

describe('Flip camera (CameraService.flipCamera)', () => {
  function viewfinderWith(capture: ReturnType<typeof createFixtureCaptureService>) {
    return (
      <CaptureViewfinderView
        model={makeModel({ api: new GateApi() })}
        mode="photo"
        onModeChange={() => {}}
        onLoggedElsewhere={() => {}}
        capture={capture}
      />
    );
  }

  it('pressing Flip camera switches the fixture service from back to front and back again', async () => {
    const capture = createFixtureCaptureService('photo');
    await render(viewfinderWith(capture));
    const flip = screen.getByTestId('scan.flip');
    expect(capture.facing).toBe('back');
    expect(flip.props.accessibilityValue).toEqual({ text: 'Back camera' });
    await userEvent.press(flip);
    expect(capture.facing).toBe('front');
    expect(screen.getByTestId('scan.flip').props.accessibilityValue).toEqual({ text: 'Front camera' });
    await userEvent.press(screen.getByTestId('scan.flip'));
    expect(capture.facing).toBe('back');
    // the fixture feed stays the bundled photo
    expect(screen.getByTestId('scan.fixtureFeed', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('the device viewfinder passes the new facing to the live CameraView', async () => {
    const capture = createDeviceCaptureService('photo', { requestCameraPermission: async () => true });
    await render(viewfinderWith(capture));
    expect(liveCameraFacing()).toBe('back');
    await userEvent.press(screen.getByTestId('scan.flip'));
    expect(capture.facing).toBe('front');
    expect(liveCameraFacing()).toBe('front');
  });
});
