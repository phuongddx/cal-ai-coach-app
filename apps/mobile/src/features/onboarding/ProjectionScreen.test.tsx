/**
 * RNTL screen test of ProjectionView.swift (OB-10): kg + weeks framing only —
 * a test keeps every calorie unit out of the screen's rendered strings.
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

import { render, screen } from '@testing-library/react-native';

import { ProjectionScreen } from './ProjectionScreen';
import { createOnboardingModel } from './onboardingModel';

function makeModel() {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    disableAnimations: true,
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
}

/** Every rendered string: text children plus accessibility labels, walking the JSON tree. */
function renderedStrings(): string[] {
  const strings: string[] = [];
  const visit = (node: unknown): void => {
    if (node == null || typeof node === 'boolean') return;
    if (typeof node === 'string' || typeof node === 'number') {
      strings.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as { children?: unknown; props?: { accessibilityLabel?: unknown } };
    if (typeof record.props?.accessibilityLabel === 'string') {
      strings.push(record.props.accessibilityLabel);
    }
    if (record.children !== undefined) visit(record.children);
  };
  visit(screen.toJSON());
  return strings;
}

describe('projection screen', () => {
  it('shows the locked copy, the kg stats and the projection identifiers', async () => {
    await render(<ProjectionScreen model={makeModel()} />);

    expect(screen.getByText('Your projection')).toBeOnTheScreen();
    expect(screen.getByText('Based on your inputs')).toBeOnTheScreen();
    expect(screen.getByText('Starting')).toBeOnTheScreen();
    expect(screen.getByText('70 kg')).toBeOnTheScreen();
    expect(screen.getByText(/Goal by .+/)).toBeOnTheScreen();
    expect(screen.getByText('65 kg')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.projectionStart')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.projectionGoal')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.projectionChart')).toBeOnTheScreen();
    // The "Today … N weeks" caption row is a11y-hidden in the Swift view.
    expect(screen.getByText('Today')).toBeOnTheScreen();
    // pace 0.45 kg/week over a 5 kg delta: ceil(5/0.45) = 12 weeks.
    expect(screen.getByText('12 weeks')).toBeOnTheScreen();
    // Stat cards: kg to lose and the weeks, with their identifiers.
    expect(screen.getByTestId('onboarding.projectionKg')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.projectionWeeks')).toBeOnTheScreen();
    expect(screen.getByLabelText('5 kg to lose')).toBeOnTheScreen();
    expect(screen.getByLabelText('12 weeks')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.projectionDisclaimer')).toBeOnTheScreen();
    expect(screen.getByText(/Individual results vary\./)).toBeOnTheScreen();
  });

  // The OB-10 contract: grep the screen's strings for the forbidden unit — zero.
  it('renders no calorie unit anywhere on the screen', async () => {
    await render(<ProjectionScreen model={makeModel()} />);

    const strings = renderedStrings();
    expect(strings.length).toBeGreaterThan(0);
    for (const text of strings) {
      expect(text.toLowerCase()).not.toContain('kcal');
      expect(text.toLowerCase()).not.toContain('calorie');
    }
  });

  it('frames a gain goal as kg to gain', async () => {
    const model = makeModel();
    model.selectGoal('gain');
    model.setGoalWeightKg(75);
    await render(<ProjectionScreen model={model} />);

    expect(screen.getByLabelText('5 kg to gain')).toBeOnTheScreen();
  });
});
