/**
 * RNTL screen test of SettingsDetailView.swift (PR-02): the locked copy, the
 * identifiers, the switch wiring through the model, the confirmation-gated
 * account deletion and the disabled-until-loaded export row. The Jest twin in
 * settingsModel.test.tsx carries the Swift SettingsTests sentences; this file
 * covers the screen-level interactions.
 *
 * U-77 (frame 14 + round-3 export frames): the plan buttons are visibly
 * disabled with the note that says why, and the export tap opens the share
 * sheet with the file — the three states (write failed, nothing logged,
 * cancelled share) render as rows under the export row.
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
    shareExport: jest.fn(async () => 'shared' as const),
    ...overrides,
  };
  return { model: createSettingsModel(deps), deps };
}

describe('settings screen', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('renders the locked copy and every identifier of the Swift screen', async () => {
    const { model } = makeModel();
    await render(<SettingsDetailView model={model} planName="Free" />);

    expect(screen.getByText(settingsCopy.wellnessTitle)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.wellnessDescription)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.burnAddBackTitle)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.burnAddBackNote)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.deleteAccountConfirm)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.billingNote)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.versionCaption)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.exportRowTitle)).toBeOnTheScreen();
    expect(screen.getByText('Subscription')).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.supportRowTitle)).toBeOnTheScreen();
    expect(screen.getByText('Contact us')).toBeOnTheScreen();
    // The plan line of the display-only entitlement state.
    expect(screen.getByText('Free plan')).toBeOnTheScreen();

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
    // No billing history or restore row exists (the frame's ghost line is not
    // drawn in this build), and no "Active" badge on a Free plan.
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText('Billing history')).toBeNull();
    expect(screen.queryByText('Restore purchases')).toBeNull();
  });

  it('keeps the two billing buttons visibly disabled with the note that says why', async () => {
    const { model } = makeModel();
    await render(<SettingsDetailView model={model} planName="Free" />);

    for (const testID of ['settings.changePlan', 'settings.cancelSubscription']) {
      const button = screen.getByTestId(testID);
      expect(button.props.accessibilityState?.disabled).toBe(true);
    }
    // The design component dims a disabled button (secondaryDisabledOpacity)
    // and the note names the reason.
    expect(screen.getByText(settingsCopy.billingNote)).toBeOnTheScreen();
  });

  it('flips the wellness switch through the model: stored then applied', async () => {
    // The real design-system setter: the Switch's value IS the design flag, so
    // the flip proves the route-shaped wiring end to end.
    const { model, deps } = makeModel({ applyPolicyFlag: setEdSafeMode });
    await render(<SettingsDetailView model={model} planName="Free" />);

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
    await render(<SettingsDetailView model={model} planName="Free" />);

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
    await render(<SettingsDetailView model={model} planName="Free" />);

    await act(async () => {
      fireEvent(screen.getByTestId('settings.burnAddBackToggle'), 'valueChange', true);
    });
    await waitFor(() => expect(screen.getByTestId('settings.burnAddBackToggle').props.value).toBe(true));
    expect(deps.writeSetting).toHaveBeenCalledWith(BURN_ADD_BACK_KEY, '1');
  });

  it('deletes the account only after the confirmation with the locked copy', async () => {
    const { model, deps } = makeModel();
    await render(<SettingsDetailView model={model} planName="Free" />);

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

  it('enables the export row after the load and opens the share sheet only on tap', async () => {
    const { model, deps } = makeModel();
    const view = await render(<SettingsDetailView model={model} planName="Free" />);

    const exportRow = screen.getByTestId('settings.row.export');
    // Preparing on open: the row is disabled and no share sheet has been
    // presented.
    expect(exportRow.props.accessibilityState?.disabled).toBe(true);
    expect(deps.shareExport).not.toHaveBeenCalled();

    await model.loadExport();
    expect(exportRow.props.accessibilityState?.disabled).toBe(false);

    // The tap calls the injected `exportCsvAndShare` binding once.
    await userEvent.press(exportRow);
    await waitFor(() => expect(deps.shareExport).toHaveBeenCalledTimes(1));
    // A completed share leaves no row behind.
    await waitFor(() => expect(screen.queryByTestId('settings.exportCancelled')).toBeNull());
    await view.unmount();
  });

  it('shows the write failure with its reason, the EXP-WRITE code, a retry and Contact us', async () => {
    const { model, deps } = makeModel({
      shareExport: jest.fn(async () => {
        throw new Error('The file could not be written.');
      }),
    });
    await render(<SettingsDetailView model={model} planName="Free" />);
    await model.loadExport();

    await userEvent.press(screen.getByTestId('settings.row.export'));
    await waitFor(() => expect(screen.getByTestId('settings.exportError')).toBeOnTheScreen());
    expect(screen.getByText("Couldn't create the file.")).toBeOnTheScreen();
    expect(screen.getByText('The file could not be written.')).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.exportFailedCode)).toBeOnTheScreen();

    // The retry calls the binding again; a good attempt clears the row.
    (deps.shareExport as jest.Mock).mockResolvedValueOnce('shared');
    await userEvent.press(screen.getByTestId('settings.exportRetry'));
    await waitFor(() => expect(deps.shareExport).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('settings.exportError')).toBeNull());
  });

  it('renders Contact us on the failed row inert: no support path exists in the app', async () => {
    const { model } = makeModel({
      shareExport: jest.fn(async () => {
        throw new Error('disk full');
      }),
    });
    await render(<SettingsDetailView model={model} planName="Free" />);
    await model.loadExport();
    await userEvent.press(screen.getByTestId('settings.row.export'));

    // No support e-mail address exists in the app (Swift included) and the
    // contact row has no action, so the button is present and inert — it
    // neither opens anything nor prints an invented address.
    const contact = screen.getByTestId('settings.exportContact');
    expect(contact.props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText(/@\w+\.\w+/)).toBeNull();
  });

  it('says so and keeps the row disabled when there is nothing to export', async () => {
    const { model, deps } = makeModel({
      // The generator's empty shape: comment sections and blank lines only.
      csvExportAction: jest.fn(async () => '# user_targets\n\n# weight_logs\n\n'),
    });
    await render(<SettingsDetailView model={model} planName="Free" />);

    await model.loadExport();
    expect(model.exportEmpty).toBe(true);
    expect(screen.getByTestId('settings.exportEmpty')).toBeOnTheScreen();
    expect(screen.getByText('Nothing logged yet.')).toBeOnTheScreen();
    // No share sheet without a file to share.
    const exportRow = screen.getByTestId('settings.row.export');
    expect(exportRow.props.accessibilityState?.disabled).toBe(true);
    await userEvent.press(exportRow);
    expect(deps.shareExport).not.toHaveBeenCalled();
  });

  it('treats a cancelled share as not an error: the file stays with Share again and Done', async () => {
    const { model, deps } = makeModel({ shareExport: jest.fn(async () => 'cancelled' as const) });
    await render(<SettingsDetailView model={model} planName="Free" />);
    await model.loadExport();

    await userEvent.press(screen.getByTestId('settings.row.export'));
    await waitFor(() => expect(screen.getByTestId('settings.exportCancelled')).toBeOnTheScreen());
    expect(screen.getByText('Not shared.')).toBeOnTheScreen();
    // The export row stays enabled — the prepared file is still there.
    expect(screen.getByTestId('settings.row.export').props.accessibilityState?.disabled).toBe(false);

    // "Share again" calls the binding again; "Done" dismisses the row.
    (deps.shareExport as jest.Mock).mockResolvedValueOnce('shared');
    await userEvent.press(screen.getByTestId('settings.exportRetry'));
    await waitFor(() => expect(deps.shareExport).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('settings.exportCancelled')).toBeNull());

    (deps.shareExport as jest.Mock).mockResolvedValueOnce('cancelled');
    await userEvent.press(screen.getByTestId('settings.row.export'));
    await waitFor(() => expect(screen.getByTestId('settings.exportCancelled')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('settings.exportDone'));
    await waitFor(() => expect(screen.queryByTestId('settings.exportCancelled')).toBeNull());
    expect(deps.shareExport).toHaveBeenCalledTimes(3);
  });
});
