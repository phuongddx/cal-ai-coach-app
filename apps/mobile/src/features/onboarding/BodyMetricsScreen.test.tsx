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

import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

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
  model.setBirthYear(birthYear);
  return model;
}

describe('body metrics screen', () => {
  it('shows the locked copy, the sex chips, the typed fields and the DOB wheel with identifiers', async () => {
    await render(<BodyMetricsScreen model={makeModel()} />);

    expect(screen.getByText('About you')).toBeOnTheScreen();
    expect(screen.getByText('Used to calculate your targets')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.sexFemale')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.sexMale')).toBeOnTheScreen();
    // The typed fields hold the draft's values with their units (165 cm / 70 kg).
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('165');
    expect(screen.getByTestId('onboarding.heightField.label')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.heightField.unit')).toHaveTextContent('cm');
    expect(screen.getByTestId('onboarding.weightField')).toHaveDisplayValue('70');
    expect(screen.getByTestId('onboarding.weightField.label')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.weightField.unit')).toHaveTextContent('kg');
    // The DOB wheel stays with the under-18 gate (behavior the brief keeps).
    expect(screen.getByTestId('onboarding.dobField')).toBeOnTheScreen();
    expect(screen.getByText('Date of birth')).toBeOnTheScreen();
    expect(screen.getAllByText('1995').length).toBeGreaterThanOrEqual(1);
    // No gate footnote for an adult.
    expect(screen.queryByText('Must be 18+ to use CoachCal')).toBeNull();
  });

  it('the typed height and weight write through the model', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.heightField'), '172');
    expect(model.draft.heightCm).toBe(172);
    await fireEvent.changeText(screen.getByTestId('onboarding.weightField'), '80.6');
    expect(model.draft.weightKg).toBe(80.6);
    // The fields show exactly what was typed.
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('172');
    expect(screen.getByTestId('onboarding.weightField')).toHaveDisplayValue('80.6');
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

describe('the typed fields clamp on blur (the wheels\' ranges)', () => {
  it('nothing clamps while typing and a blur clamps 250 to 220', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.heightField'), '250');
    expect(model.draft.heightCm).toBe(250);
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('250');

    await fireEvent(screen.getByTestId('onboarding.heightField'), 'blur');
    expect(model.draft.heightCm).toBe(220);
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('220');
  });

  it('a blur clamps 9 to 120 for height', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.heightField'), '9');
    await fireEvent(screen.getByTestId('onboarding.heightField'), 'blur');
    expect(model.draft.heightCm).toBe(120);
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('120');
  });

  it('weight 35 and 200 stay on the blur and 172 inside the range is untouched', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.weightField'), '35');
    await fireEvent(screen.getByTestId('onboarding.weightField'), 'blur');
    expect(model.draft.weightKg).toBe(35);
    expect(screen.getByTestId('onboarding.weightField')).toHaveDisplayValue('35');

    await fireEvent.changeText(screen.getByTestId('onboarding.weightField'), '200');
    await fireEvent(screen.getByTestId('onboarding.weightField'), 'blur');
    expect(model.draft.weightKg).toBe(200);
    expect(screen.getByTestId('onboarding.weightField')).toHaveDisplayValue('200');

    await fireEvent.changeText(screen.getByTestId('onboarding.heightField'), '172');
    await fireEvent(screen.getByTestId('onboarding.heightField'), 'blur');
    expect(model.draft.heightCm).toBe(172);
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('172');
  });

  it('an empty field writes nothing on blur', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.heightField'), '');
    await fireEvent(screen.getByTestId('onboarding.heightField'), 'blur');
    expect(model.draft.heightCm).toBe(165);
    expect(screen.getByTestId('onboarding.heightField')).toHaveDisplayValue('');
  });
});
