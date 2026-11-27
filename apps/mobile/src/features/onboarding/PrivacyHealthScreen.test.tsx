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

import { render, screen, userEvent } from '@testing-library/react-native';

import { PrivacyHealthScreen } from './PrivacyHealthScreen';
import { onboardingCopy } from './onboardingCopy';
import { createOnboardingModel } from './onboardingModel';

function makeModel(requestHealthAccess: () => Promise<'granted' | 'denied'>) {
  const model = createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    disableAnimations: true,
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(requestHealthAccess),
  });
  // Walk the quiz so this step's CTA leads to the generating step, as in the flow.
  for (let index = 0; index < 6; index += 1) model.advance();
  return model;
}

describe('privacy and health screen', () => {
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
});
