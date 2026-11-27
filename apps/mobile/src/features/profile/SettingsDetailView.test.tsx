/**
 * RNTL screen test of SettingsDetailView.swift (PR-02): the locked copy, the
 * identifiers, the switch wiring through the model, the confirmation-gated
 * account deletion and the disabled-until-loaded export row. The Jest twin in
 * settingsModel.test.tsx carries the Swift SettingsTests sentences; this file
 * covers the screen-level interactions.
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
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

import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { setEdSafeMode } from '../../design';

import { DEMO_USER_ID } from '../../data/repos/seedDataManager';

import { SettingsDetailView } from './SettingsDetailView';
import { settingsCopy } from './settingsCopy';
import { createSettingsModel, type SettingsModelDeps } from './settingsModel';

const BURN_ADD_BACK_KEY = 'burnAddBackEnabled';

function makeModel(overrides: Partial<SettingsModelDeps> = {}) {
  const deps: SettingsModelDeps = {
    ownerId: DEMO_USER_ID,
    // The app-wide wellness key literal lives in the route file (the feature
    // never spells it — see parity-detail/profile-settings.md).
    policyStorageKey: 'wellness.policy.key',
    burnAddBackStorageKey: BURN_ADD_BACK_KEY,
    initialPolicyOn: false,
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    readSetting: jest.fn(async () => null),
    deleteAccount: jest.fn(async () => undefined),
    resetLocalData: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    csvExportAction: jest.fn(async () => '# user_targets\nid\n'),
    ...overrides,
  };
  return { model: createSettingsModel(deps), deps };
}

describe('settings screen', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('renders the locked copy and every identifier of the Swift screen', async () => {
    const { model } = makeModel();
    await render(<SettingsDetailView model={model} />);

    expect(screen.getByText(settingsCopy.wellnessTitle)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.wellnessDescription)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.burnAddBackTitle)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.burnAddBackNote)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.deleteAccountConfirm)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.billingNote)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.versionCaption)).toBeOnTheScreen();
    expect(screen.getByText('Export CSV')).toBeOnTheScreen();
    expect(screen.getByText('Subscription')).toBeOnTheScreen();
    expect(screen.getByText('Help & FAQ')).toBeOnTheScreen();
    expect(screen.getByText('Contact us')).toBeOnTheScreen();

    expect(screen.getByTestId('settings.wellnessCard')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.edSafeToggle')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.burnAddBackToggle')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.burnAddBackNote')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.row.export')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.row.deleteAccount')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.subscriptionCard')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.planValue')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.changePlan')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.cancelSubscription')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.billingNote')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.row.help')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.row.contact')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.version')).toBeOnTheScreen();
  });

  it('flips the wellness switch through the model: stored then applied', async () => {
    // The real design-system setter: the Switch's value IS the design flag, so
    // the flip proves the route-shaped wiring end to end.
    const { model, deps } = makeModel({ applyPolicyFlag: setEdSafeMode });
    await render(<SettingsDetailView model={model} />);

    await act(async () => {
      fireEvent(screen.getByTestId('settings.edSafeToggle'), 'valueChange', true);
    });
    expect(deps.writeSetting).toHaveBeenCalledWith('wellness.policy.key', '1');
    await waitFor(() => expect(screen.getByTestId('settings.edSafeToggle').props.value).toBe(true));

    await act(async () => {
      fireEvent(screen.getByTestId('settings.edSafeToggle'), 'valueChange', false);
    });
    expect(deps.writeSetting).toHaveBeenCalledWith('wellness.policy.key', '0');
    await waitFor(() => expect(screen.getByTestId('settings.edSafeToggle').props.value).toBe(false));
  });

  it('shows the model error and keeps the switch off when the wellness write fails', async () => {
    const { model, deps } = makeModel({
      writeSetting: jest.fn(async () => {
        throw new Error('disk full');
      }),
    });
    await render(<SettingsDetailView model={model} />);

    // The handler catches the rejection (no unhandled rejection escapes), the
    // model records the error, the screen shows it, and the failed write never
    // shows an applied policy.
    await act(async () => {
      fireEvent(screen.getByTestId('settings.edSafeToggle'), 'valueChange', true);
    });
    expect(deps.applyPolicyFlag).not.toHaveBeenCalled();
    expect(model.wellnessWriteError).toBe('disk full');
    await waitFor(() => expect(screen.getByTestId('settings.wellnessError')).toBeOnTheScreen());
    expect(screen.getByText('disk full')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.edSafeToggle').props.value).toBe(false);
  });

  it('persists the burn add-back switch under its storage key', async () => {
    const { model, deps } = makeModel();
    await render(<SettingsDetailView model={model} />);

    await act(async () => {
      fireEvent(screen.getByTestId('settings.burnAddBackToggle'), 'valueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('settings.burnAddBackToggle').props.value).toBe(true));
    expect(deps.writeSetting).toHaveBeenCalledWith(BURN_ADD_BACK_KEY, '1');
  });

  it('deletes the account only after the confirmation with the locked copy', async () => {
    const { model, deps } = makeModel();
    await render(<SettingsDetailView model={model} />);

    // No dialog yet; pressing the entry opens it.
    expect(screen.queryByText(settingsCopy.deleteAccountTitle)).toBeNull();
    await userEvent.press(screen.getByTestId('settings.row.deleteAccount'));
    expect(screen.getByText(settingsCopy.deleteAccountTitle)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.deleteAccountMessage)).toBeOnTheScreen();
    expect(deps.deleteAccount).not.toHaveBeenCalled();

    // Cancel keeps everything untouched.
    await userEvent.press(screen.getByTestId('settings.cancelDelete'));
    expect(screen.queryByText(settingsCopy.deleteAccountTitle)).toBeNull();
    expect(deps.deleteAccount).not.toHaveBeenCalled();

    // The confirmed action runs the best-effort chain once.
    await userEvent.press(screen.getByTestId('settings.row.deleteAccount'));
    await userEvent.press(screen.getByTestId('settings.deleteConfirm'));
    expect(deps.deleteAccount).toHaveBeenCalledTimes(1);
    expect(deps.resetLocalData).toHaveBeenCalledTimes(1);
    expect(deps.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(settingsCopy.deleteAccountTitle)).toBeNull();
  });

  it('enables Export CSV only after the load resolves and shares the produced export', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'dismissedAction', activityType: undefined });
    const { model } = makeModel();
    await render(<SettingsDetailView model={model} />);

    const exportRow = screen.getByTestId('settings.row.export');
    expect(exportRow.props.accessibilityState?.disabled).toBe(true);

    await model.loadExport();
    expect(exportRow.props.accessibilityState?.disabled).toBe(false);
    await userEvent.press(exportRow);
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy.mock.calls[0]?.[0]).toEqual({
      title: 'CoachCal Data.csv',
      message: '# user_targets\nid\n',
    });
    shareSpy.mockRestore();
  });
});
