/**
 * RNTL screen test of BodyMetricsView.swift (OB-06): the locked copy, the
 * wheel identifiers, the sex chips and the under-18 gate.
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

import { BodyMetricsScreen } from './BodyMetricsScreen';
import { createOnboardingModel } from './onboardingModel';

function makeModel(birthYear = 1995) {
  const model = createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
  model.birthYear = birthYear;
  return model;
}

describe('body metrics screen', () => {
  it('shows the locked copy, the sex chips and the three wheel fields with identifiers', async () => {
    await render(<BodyMetricsScreen model={makeModel()} />);

    expect(screen.getByText('About you')).toBeOnTheScreen();
    expect(screen.getByText('Used to calculate your targets')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.sexFemale')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.sexMale')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.heightField')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.weightField')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.dobField')).toBeOnTheScreen();
    // Wheel labels and default selections (draft 165 cm / 70 kg, born 1995);
    // each value shows twice: the wheel's value line and its selected row.
    expect(screen.getByText('Height')).toBeOnTheScreen();
    expect(screen.getByText('Current weight')).toBeOnTheScreen();
    expect(screen.getByText('Date of birth')).toBeOnTheScreen();
    expect(screen.getAllByText('165 cm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('70 kg').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1995').length).toBeGreaterThanOrEqual(1);
    // No gate footnote for an adult.
    expect(screen.queryByText('Must be 18+ to use CoachCal')).toBeNull();
  });

  it('the sex chips write through the model', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await userEvent.press(screen.getByText('Male'));
    expect(model.draft.sex).toBe('male');
    await userEvent.press(screen.getByText('Female'));
    expect(model.draft.sex).toBe('female');
  });

  it('an under-18 birth year shows the verbatim footnote and disables the CTA', async () => {
    const model = makeModel(2014);
    await render(<BodyMetricsScreen model={model} />);

    expect(screen.getByText('Must be 18+ to use CoachCal')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.dobGate')).toBeOnTheScreen();
    const cta = screen.getByRole('button', { name: 'Continue' });
    expect(cta.props.accessibilityState?.disabled).toBe(true);
    // Pressing the disabled CTA must not advance.
    await userEvent.press(cta);
    expect(model.path[model.path.length - 1]).toBe('valueHero');
  });

  it('an adult birth year keeps the CTA enabled and it advances', async () => {
    const model = makeModel(1995);
    await render(<BodyMetricsScreen model={model} />);

    const cta = screen.getByRole('button', { name: 'Continue' });
    expect(cta.props.accessibilityState?.disabled).toBe(false);
    await userEvent.press(cta);
    expect(model.path[model.path.length - 1]).toBe('goal');
  });
});
