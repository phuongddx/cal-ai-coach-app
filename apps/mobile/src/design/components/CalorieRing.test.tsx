/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
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

import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  calorieProgressFraction,
  CalorieRing,
  dayPercentText,
  defaultDayProgress,
  remainingNumberProps,
} from './CalorieRing';
import { lightColors, size } from '../tokens';
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

  // U-71 acceptance: the ring passes fitWidth, so "1607" never wraps as "16" over "07".
  it('passes fitWidth to the remaining number so four digits stay on one line', async () => {
    expect(remainingNumberProps).toEqual({ role: 'hero', fitWidth: true });
    await render(<CalorieRing consumed={543} goal={2150} variant="hero" />);
    const number = screen.getByText('1607', { includeHiddenElements: true });
    expect(number).toHaveProp('numberOfLines', 1);
    expect(number).toHaveProp('adjustsFontSizeToFit', true);
    expect(number).toHaveProp('minimumFontScale', 0.5);
  });

  it('draws the plain ring on card tokens and the Ember ring on ember tokens', async () => {
    const { rerender } = await render(<CalorieRing consumed={543} goal={2150} variant="hero" />);
    expect(screen.getByText('1607', { includeHiddenElements: true })).toHaveStyle({ color: lightColors.text });
    expect(screen.getByText('remaining', { includeHiddenElements: true })).toHaveStyle({ color: lightColors.text2 });
    await rerender(<CalorieRing consumed={543} goal={2150} variant="hero" onEmber />);
    expect(screen.getByText('1607', { includeHiddenElements: true })).toHaveStyle({ color: lightColors.emberText });
    expect(screen.getByText('remaining', { includeHiddenElements: true })).toHaveStyle({ color: lightColors.emberText2 });
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

  // U-76: the 150 pt ring of the Today ember card (`size.ringMd`, `size.ringMdStroke`).
  describe('md variant (U-76)', () => {
    it('draws at the ring-md size and shows the number and the label "kcal left"', async () => {
      await render(<CalorieRing consumed={1284} goal={2100} variant="md" centerLabel="kcal left" onEmber />);
      const ring = screen.getByTestId('calorie-ring:md');
      expect(ring).toHaveProp('accessibilityLabel', '816 calories remaining of 2100 goal');
      expect(ring).toHaveStyle({ width: size.ringMd, height: size.ringMd });
      expect(screen.getByText('816', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.getByText('kcal left', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByText('remaining', { includeHiddenElements: true })).toBeNull();
    });

    it('keeps a four-digit number on one line: fitWidth props and a size below the hero numeral', async () => {
      await render(<CalorieRing consumed={0} goal={2150} variant="md" centerLabel="kcal left" onEmber />);
      const number = screen.getByText('2150', { includeHiddenElements: true });
      expect(number).toHaveProp('numberOfLines', 1);
      expect(number).toHaveProp('adjustsFontSizeToFit', true);
      expect(number).toHaveProp('minimumFontScale', 0.5);
      // the frame's numLg (36) so four tabular digits (about 86 pt) fit the 108 pt inside the stroke
      expect(number).toHaveStyle({ fontSize: 36 });
    });

    it('defaults the label to "remaining" like the other variants', async () => {
      await render(<CalorieRing consumed={543} goal={2150} variant="md" />);
      expect(screen.getByText('remaining', { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it('under ED-safe shows "On track" and the day percent, with no number', async () => {
      await render(<CalorieRing consumed={1284} goal={2100} variant="md" centerLabel="kcal left" dayProgress={0.5} onEmber />);
      await act(async () => {
        setEdSafeMode(true);
      });
      expect(screen.getByTestId('calorie-ring:md')).toHaveProp('accessibilityLabel', 'On track');
      expect(screen.getByText('On track', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.getByText('50% of day', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByText('816', { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText('kcal left', { includeHiddenElements: true })).toBeNull();
    });
  });

  // U-76: the right column of the ember card; the policy branch stays in the ring (invariant I7).
  describe('aside and edSafeAside (U-76)', () => {
    it('shows the aside beside the ring and not the ED-safe aside while the mode is off', async () => {
      await render(
        <CalorieRing
          consumed={543}
          goal={2150}
          variant="md"
          aside={<Text>eaten and goal</Text>}
          edSafeAside={<Text>guidance</Text>}
        />,
      );
      expect(screen.getByText('eaten and goal', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByText('guidance', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId('calorie-ring:md')).toBeOnTheScreen();
    });

    it('swaps to the ED-safe aside under ED-safe mode', async () => {
      await render(
        <CalorieRing
          consumed={543}
          goal={2150}
          variant="md"
          aside={<Text>eaten and goal</Text>}
          edSafeAside={<Text>guidance</Text>}
        />,
      );
      await act(async () => {
        setEdSafeMode(true);
      });
      expect(screen.queryByText('eaten and goal', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('guidance', { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it('draws no aside column when neither prop is given', async () => {
      await render(<CalorieRing consumed={543} goal={2150} variant="hero" />);
      expect(screen.queryByTestId('calorie-ring:aside')).toBeNull();
    });
  });

  it('computes the default day progress inside the unit interval', () => {
    const progress = defaultDayProgress(new Date(2026, 10, 27, 12, 0, 0));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });
});
