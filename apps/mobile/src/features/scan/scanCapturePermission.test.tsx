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

import { render, screen } from '@testing-library/react-native';

import { createFixtureCaptureService } from './scanCapture';
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
