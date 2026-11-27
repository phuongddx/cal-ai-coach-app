/**
 * RNTL screen test of PrivacyHealthView.swift (OB-03): the locked copy, the
 * settings rows, the privacy promise, and the granted / denied connect paths.
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

import { PrivacyHealthScreen } from './PrivacyHealthScreen';
import { onboardingCopy } from './onboardingCopy';
import { createOnboardingModel, type OnboardingModelDeps } from './onboardingModel';

function makeModel(
  requestHealthAccess: () => Promise<'granted' | 'denied'>,
  overrides: Partial<OnboardingModelDeps> = {},
) {
  const model = createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(requestHealthAccess),
    ...overrides,
  });
  // Walk the quiz so this step's CTA leads to the generating step, as in the flow.
  for (let index = 0; index < 6; index += 1) model.advance();
  return model;
}

describe('privacy and health screen', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('shows the locked copy, the settings rows and the privacy promise identifier', async () => {
    await render(<PrivacyHealthScreen model={makeModel(async () => 'denied')} />);

    expect(screen.getByText('Privacy & Health')).toBeOnTheScreen();
    expect(screen.getByText('Your data, your choice')).toBeOnTheScreen();
    // The settings rows carry combined labels, like the Swift CCSettingsRow.
    expect(screen.getByLabelText('Connect Apple Health, Sync steps, workouts, and weight automatically')).toBeOnTheScreen();
    expect(screen.getByLabelText('Activity calories, Auto-adjust your daily target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Weight sync, Track progress without logging')).toBeOnTheScreen();
    // The label shows twice: the settings row and the connect button.
    expect(screen.getAllByText('Connect Apple Health')).toHaveLength(2);
    expect(screen.getByText('Sync steps, workouts, and weight automatically')).toBeOnTheScreen();
    expect(screen.getByText('Privacy promise')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.privacyPromise')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.privacyPromiseBanner)).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.healthConnect')).toBeOnTheScreen();
    // The pinned CTA of this step is "Skip for now" with the continue identifier.
    expect(screen.getByText('Skip for now')).toBeOnTheScreen();
    // No footnote until a denial happens.
    expect(screen.queryByTestId('onboarding.healthConnectNote')).toBeNull();
    expect(screen.queryByText(onboardingCopy.healthConnectNote)).toBeNull();
  });

  it('a denial shows the verbatim footnote and the user can continue', async () => {
    const model = makeModel(async () => 'denied');
    await render(<PrivacyHealthScreen model={model} />);

    await userEvent.press(screen.getByRole('button', { name: 'Connect Apple Health' }));
    expect(await screen.findByTestId('onboarding.healthConnectNote')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.healthConnectNote)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(model.path[model.path.length - 1]).toBe('generating');
  });

  it('a grant shows no footnote: it advances silently', async () => {
    const model = makeModel(async () => 'granted');
    await render(<PrivacyHealthScreen model={model} />);

    await userEvent.press(screen.getByRole('button', { name: 'Connect Apple Health' }));
    expect(await screen.findByTestId('onboarding.privacyPromise')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding.healthConnectNote')).toBeNull();

    await userEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(model.path[model.path.length - 1]).toBe('generating');
  });

  it('the ED-safe switch stores the policy and applies the mode at once', async () => {
    const writeSetting = jest.fn(async () => undefined);
    // The real design-system setter: the Switch's value IS the design flag, so
    // the flip proves the route-shaped wiring end to end (as in Settings).
    const model = makeModel(async () => 'denied', { writeSetting, applyPolicyFlag: setEdSafeMode });
    await render(<PrivacyHealthScreen model={model} />);

    const edSafeSwitch = screen.getByTestId('onboarding.edSafeToggle');
    expect(edSafeSwitch.props.value).toBe(false);
    await act(async () => {
      fireEvent(edSafeSwitch, 'valueChange', true);
    });
    // The stored write lands first, under the injected key, as '1'.
    expect(writeSetting).toHaveBeenCalledWith('onboarding.policy.key', '1');
    // The design flag applied at once: the switch's value follows the live flag.
    await waitFor(() => expect(edSafeSwitch.props.value).toBe(true));
  });
});
