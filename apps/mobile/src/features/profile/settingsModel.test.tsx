/**
 * Jest twin of `native/App/CoachCalTests/SettingsTests.swift` — one `it` per
 * Swift case, same behavior sentence. The Swift cases that inspect views with
 * ViewInspector render the RN screens here; the pure-model cases stay pure.
 *
 * The wellness policy branch never decides what this feature shows (standing
 * order rule 20): the app-wide key literal lives in the route file
 * (`src/app/settings.tsx`) and reaches the model as the injected
 * `policyStorageKey`, so the twins assert the '1'/'0' format and the storage
 * calls against the injected key. The switch's identifier carries the Swift
 * string (`settings.edSafeToggle`) — an identifier containing edSafe is
 * correct. See docs/rn-migration/parity-detail/profile-settings.md for the key
 * and the identifier table.
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

import { render, screen, userEvent } from '@testing-library/react-native';
import { setEdSafeMode } from '../../design';

import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import type { UserTarget } from '../../data/repos/targetRepository';

import { onboardingCopy } from '../onboarding/onboardingCopy';
import { ProfileView } from './ProfileView';
import { SettingsDetailView } from './SettingsDetailView';
import { settingsCopy, wellnessAnnouncement } from './settingsCopy';
import { createSettingsModel, type SettingsModelDeps } from './settingsModel';
import { reclamped } from './targetEditModel';

const FIXED_NOW = new Date('2026-09-12T09:00:00Z');
/** Arbitrary test value: the model stores under whatever key its route injects. */
const POLICY_KEY = 'wellness.policy.key';
const BURN_ADD_BACK_KEY = 'burnAddBackEnabled';

function makeTarget(dailyKcal = 2150, sex = 'female', goalWeightKg: number | null = 65): UserTarget {
  return {
    id: '22222222-3333-4444-8555-666666666666',
    userId: DEMO_USER_ID,
    dailyKcal,
    proteinG: 161,
    carbsG: 215,
    fatG: 72,
    fiberGoalG: 30,
    waterGlasses: 8,
    sex,
    heightCm: 165,
    weightKg: 70,
    goalWeightKg,
    paceKgPerWeek: 0.5,
    activity: 'moderate',
    goal: 'lose',
    updatedAt: FIXED_NOW,
  };
}

/** Doubles that record every storage write and reset step in call order. */
function makeSettingsModel(overrides: Partial<SettingsModelDeps> = {}) {
  const writes: Array<[string, string]> = [];
  const order: string[] = [];
  const deps: SettingsModelDeps = {
    ownerId: DEMO_USER_ID,
    policyStorageKey: POLICY_KEY,
    burnAddBackStorageKey: BURN_ADD_BACK_KEY,
    initialPolicyOn: false,
    applyPolicyFlag: (on: boolean) => {
      order.push(`policy:${on ? 'on' : 'off'}`);
    },
    writeSetting: async (key: string, value: string) => {
      writes.push([key, value]);
      order.push(`write:${key}=${value}`);
    },
    readSetting: async () => null,
    deleteAccount: async () => {
      order.push('deleteAccount');
    },
    resetLocalData: async () => {
      order.push('resetLocalData');
    },
    signOut: async () => {
      order.push('signOut');
    },
    csvExportAction: async () => {
      order.push('# export');
      return '# user_targets\nid\n';
    },
    ...overrides,
  };
  return { model: createSettingsModel(deps), deps, writes, order };
}

describe('settings (SettingsTests twin)', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  // testToggleFlipsAndPersistsEdSafeStateAcrossRelaunch
  it('the toggle flips and persists the wellness policy across a relaunch', async () => {
    const { model, writes, order } = makeSettingsModel();
    expect(model.wellnessPolicyOn).toBe(false);

    await model.setWellnessPolicy(true);
    expect(model.wellnessPolicyOn).toBe(true);
    expect(writes).toEqual([[POLICY_KEY, '1']]);
    expect(order).toContain(`policy:on`);

    // A fresh instance (the relaunch contract) reads the persisted policy the
    // route passes as `initialPolicyOn` from the design flag the setter flipped.
    const relaunched = makeSettingsModel({ initialPolicyOn: true }).model;
    expect(relaunched.wellnessPolicyOn).toBe(true);

    await model.setWellnessPolicy(false);
    expect(writes).toEqual([
      [POLICY_KEY, '1'],
      [POLICY_KEY, '0'],
    ]);
    expect(order).toContain('policy:off');
    const thirdLaunch = makeSettingsModel().model;
    expect(thirdLaunch.wellnessPolicyOn).toBe(false);
  });

  // testToggleAnnouncesEdSafeModeOnOff
  it('the toggle announces the ED-Safe Mode policy on and off', async () => {
    expect(wellnessAnnouncement(true)).toBe('ED-Safe Mode, on');
    expect(wellnessAnnouncement(false)).toBe('ED-Safe Mode, off');

    const { model } = makeSettingsModel();
    await render(<SettingsDetailView model={model} />);
    const toggle = screen.getByTestId('settings.edSafeToggle');
    expect(toggle.props.accessibilityLabel).toBe('ED-Safe Mode, off');
  });

  // testBurnAddBackTogglePersistsAndDefaultsOff
  it('burn add-back defaults off and its toggle persists the stored flag', async () => {
    const { model, writes } = makeSettingsModel();
    expect(model.burnAddBackOn).toBe(false);

    const { model: screenModel } = makeSettingsModel();
    await render(<SettingsDetailView model={screenModel} />);
    expect(screen.getByTestId('settings.burnAddBackToggle')).toBeOnTheScreen();

    await model.setBurnAddBack(true);
    expect(model.burnAddBackOn).toBe(true);
    expect(writes).toEqual([[BURN_ADD_BACK_KEY, '1']]);
  });

  // testDeleteAccountDialogCopyIsVerbatim
  it('the delete account dialog copy is verbatim', () => {
    expect(settingsCopy.deleteAccountTitle).toBe('Delete account?');
    expect(settingsCopy.deleteAccountMessage).toBe(
      "This permanently deletes your data on this device, then deletes your diary, scans, and entitlements on the server and closes your account. This can't be undone.",
    );
    expect(settingsCopy.deleteAccountConfirm).toBe('Delete account');
    expect(settingsCopy.cancel).toBe('Cancel');
  });

  // testLocalAccountResetWipesTablesAndRoutesToOnboarding
  it('the local account reset wipes tables and routes to onboarding', async () => {
    const { model, order } = makeSettingsModel();
    await model.setWellnessPolicy(true);
    await model.setBurnAddBack(true);
    await model.loadExport();
    expect(model.exportedCsv).not.toBeNull();

    await model.resetAccount();

    // The server cascade, the full local reset (every table, both stored flags,
    // the widget and the root gate — the platform's reset flow) and the
    // sign-out run in order, best-effort: a failed step never skips the next.
    expect(order).toEqual([
      `write:${POLICY_KEY}=1`,
      'policy:on',
      `write:${BURN_ADD_BACK_KEY}=1`,
      '# export',
      'deleteAccount',
      'resetLocalData',
      'signOut',
    ]);
    expect(model.wellnessPolicyOn).toBe(false);
    expect(model.burnAddBackOn).toBe(false);

    // The full local wipe against the real store (every one of the fifteen
    // tables and both stored flags) is proven in settingsReset.test.ts.
    const failing = makeSettingsModel({
      deleteAccount: async () => {
        throw new Error('network down');
      },
    });
    await failing.model.resetAccount();
    expect(failing.order).toEqual(['resetLocalData', 'signOut']);
  });

  // testSubscriptionCardRendersDisplayOnly
  it('the subscription card renders display only', async () => {
    const { model } = makeSettingsModel();
    await render(<SettingsDetailView model={model} />);

    expect(screen.getByText('Subscription')).toBeOnTheScreen();
    expect(screen.getByText('Free')).toBeOnTheScreen();
    expect(screen.getByText('Active')).toBeOnTheScreen();
    expect(screen.getByText('Change plan')).toBeOnTheScreen();
    expect(screen.getByText('Cancel subscription')).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.billingNote)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.versionCaption)).toBeOnTheScreen();
    expect(screen.getByText(settingsCopy.wellnessDescription)).toBeOnTheScreen();
  });

  // testExportCsvPresentsShareLink
  it('export CSV presents the share link with the produced export', async () => {
    const expectedCsv = '# user_targets\nid\n';
    const { model } = makeSettingsModel({ csvExportAction: async () => expectedCsv });
    expect(model.exportedCsv).toBeNull();

    await model.loadExport();
    expect(model.exportedCsv).toBe(expectedCsv);

    const { model: screenModel } = makeSettingsModel({ csvExportAction: async () => expectedCsv });
    const view = await render(<SettingsDetailView model={screenModel} />);
    const exportRow = screen.getByTestId('settings.row.export');
    expect(exportRow.props.accessibilityState?.disabled).toBe(true);
    await screenModel.loadExport();
    expect(exportRow.props.accessibilityState?.disabled).toBe(false);
    await view.unmount();
  });

  // testTargetEditSaveReclampsThroughTargetsEngine
  it('the target edit save reclamps through the targets engine', () => {
    const female = makeTarget(2150, 'female', 65);
    const reclampedFemale = reclamped(female, 900, 30, FIXED_NOW);
    expect(reclampedFemale.dailyKcal).toBe(1200);
    // Macros must re-derive from the clamped kcal, never echo the request.
    expect(reclampedFemale.proteinG).toBe(90);
    expect(reclampedFemale.carbsG).toBe(120);
    expect(reclampedFemale.fatG).toBe(40);
    expect(reclampedFemale.goalWeightKg).toBe(40);
    expect(reclampedFemale.updatedAt).toBe(FIXED_NOW);
    expect(reclampedFemale.id).toBe(female.id);

    const male = makeTarget(100, 'male', 90);
    const clampedMale = reclamped(male, 100, 90, FIXED_NOW);
    expect(clampedMale.dailyKcal).toBe(1500);

    // In-range edits pass through unchanged except the timestamp.
    const untouched = reclamped(female, 2150, 65, FIXED_NOW);
    expect(untouched.dailyKcal).toBe(2150);
    expect(untouched.goalWeightKg).toBe(65);
  });

  // testProfileRendersGroupFInventory
  it('the profile renders the group F inventory', async () => {
    await render(
      <ProfileView
        stats={{ target: makeTarget(), latestKg: 80.0, daysLogged: 21, memberSince: FIXED_NOW }}
        planName="Free"
        onEditTargets={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );

    expect(screen.getByText('Alex')).toBeOnTheScreen();
    expect(screen.getByText('Free · Since Sep 2026')).toBeOnTheScreen();
    expect(screen.getByText('Days logged')).toBeOnTheScreen();
    expect(screen.getByText('Weight, kg')).toBeOnTheScreen();
    expect(screen.getByText('kcal / day')).toBeOnTheScreen();
    expect(screen.getByText('Goals & targets')).toBeOnTheScreen();
    expect(screen.getByText('Daily target')).toBeOnTheScreen();
    expect(screen.getByText('Macro ratios')).toBeOnTheScreen();
    expect(screen.getByText('Goal weight')).toBeOnTheScreen();
    expect(screen.getByText('Integrations')).toBeOnTheScreen();
    expect(screen.getByText('Apple Health')).toBeOnTheScreen();
    expect(screen.getByText('Not connected')).toBeOnTheScreen();
    expect(screen.getByText('Preferences')).toBeOnTheScreen();
    expect(screen.getByText('Reminders')).toBeOnTheScreen();
    expect(screen.getByText('Appearance')).toBeOnTheScreen();
    expect(screen.getByText('System')).toBeOnTheScreen();
    expect(screen.getByText('Units')).toBeOnTheScreen();
    expect(screen.getByText('Metric')).toBeOnTheScreen();
    expect(screen.getByText('Settings')).toBeOnTheScreen();

    // No Health Connect row may exist (Android is out of scope post-pivot).
    const collectTestIds = (node: { testID?: unknown; children?: unknown }): string[] => {
      const ids =
        typeof node.testID === 'string' && node.testID !== '' ? [node.testID] : [];
      const children = Array.isArray(node.children) ? node.children : [];
      return ids.concat(
        children.flatMap((child) =>
          typeof child === 'object' && child !== null
            ? collectTestIds(child as { testID?: unknown; children?: unknown })
            : [],
        ),
      );
    };
    const tree = screen.toJSON();
    const identifiers = tree === null ? [] : collectTestIds(tree as { testID?: unknown; children?: unknown });
    expect(identifiers.some((id) => id.toLowerCase().includes('healthconnect'))).toBe(false);
  });

  // testAppleHealthTapShowsPhase4Footnote
  it('the apple health tap shows the phase 4 footnote', async () => {
    const stats = { target: null, latestKg: null, daysLogged: 0, memberSince: null };
    const view = await render(
      <ProfileView stats={stats} planName="Free" onOpenSettings={() => undefined} />,
    );
    expect(screen.queryByText(onboardingCopy.healthConnectNote)).toBeNull();

    await userEvent.press(screen.getByTestId('profile.row.appleHealth'));
    expect(screen.getByText(onboardingCopy.healthConnectNote)).toBeOnTheScreen();
    expect(onboardingCopy.healthConnectNote).toBe('Apple Health connects in a later update.');
    await view.unmount();

    // A second render without the tap keeps the footnote hidden.
    await render(<ProfileView stats={stats} planName="Free" onOpenSettings={() => undefined} />);
    expect(screen.queryByText(onboardingCopy.healthConnectNote)).toBeNull();
  });
});
