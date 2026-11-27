/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
jest.mock('react', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { act, render, screen } from '@testing-library/react-native';

import {
  calorieProgressFraction,
  CalorieRing,
  dayPercentText,
  defaultDayProgress,
} from './CalorieRing';
import { setEdSafeMode } from '../edSafe';

beforeEach(() => setEdSafeMode(false));

// Port of ComponentContractTests.testCalorieRingEDSafeShowsPercentOfDayNotKcal.
describe('CalorieRing ED-safe percent of day', () => {
  it('formats the day percent without kcal meaning', () => {
    expect(dayPercentText(0.0)).toBe('0% of day');
    expect(dayPercentText(0.583)).toBe('58% of day');
    expect(dayPercentText(1.4)).toBe('100% of day');
  });

  it('replaces the consumed fraction with fraction-of-day in ED-safe mode', () => {
    expect(calorieProgressFraction(true, 543, 2150, 0.4)).toBe(0.4);
    expect(calorieProgressFraction(true, undefined, undefined, 2)).toBe(1);
    expect(calorieProgressFraction(true, undefined, undefined, undefined)).toBeGreaterThanOrEqual(0);
    expect(calorieProgressFraction(true, undefined, undefined, undefined)).toBeLessThanOrEqual(1);
  });

  it('uses the consumed fraction with the mode off and clamps it', () => {
    expect(calorieProgressFraction(false, 543, 2150, undefined)).toBeCloseTo(543 / 2150);
    expect(calorieProgressFraction(false, 3000, 2150, undefined)).toBe(1);
    expect(calorieProgressFraction(false, 100, 0, undefined)).toBe(0);
    expect(calorieProgressFraction(false, undefined, 2150, undefined)).toBe(0);
  });
});

// Port of ComponentContractTests.testCalorieRingDefaultEnvShowsRemaining.
describe('CalorieRing rendering', () => {
  it('shows the remaining number for the hero ring', async () => {
    await render(<CalorieRing consumed={543} goal={2150} variant="hero" />);
    const ring = screen.getByTestId('calorie-ring:hero');
    expect(ring).toHaveProp('accessibilityLabel', '1607 calories remaining of 2150 goal');
    expect(screen.getByText('1607', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('remaining', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('renders compact and goal variants', async () => {
    await render(
      <>
        <CalorieRing consumed={543} goal={2150} variant="compact" />
        <CalorieRing consumed={543} goal={2150} variant="goal" />
      </>,
    );
    expect(screen.getByTestId('calorie-ring:compact')).toBeOnTheScreen();
    expect(screen.getByTestId('calorie-ring:goal')).toBeOnTheScreen();
  });

  it('carries a neutral label without data', async () => {
    await render(<CalorieRing />);
    expect(screen.getByTestId('calorie-ring:hero')).toHaveProp(
      'accessibilityLabel',
      'Calorie ring',
    );
  });

  it('shows the day percent instead of remaining under ED-safe mode', async () => {
    await render(
      <CalorieRing consumed={543} goal={2150} variant="hero" dayProgress={0.5} />,
    );
    expect(screen.getByTestId('calorie-ring:hero')).toHaveProp(
      'accessibilityLabel',
      '1607 calories remaining of 2150 goal',
    );
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('calorie-ring:hero')).toHaveProp(
      'accessibilityLabel',
      'On track',
    );
    expect(screen.getByText('50% of day', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('remaining', { includeHiddenElements: true })).toBeNull();
  });

  it('computes the default day progress inside the unit interval', () => {
    const progress = defaultDayProgress(new Date(2026, 10, 27, 12, 0, 0));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });
});
