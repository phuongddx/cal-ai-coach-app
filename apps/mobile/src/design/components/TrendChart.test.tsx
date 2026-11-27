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

import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  TrendChart,
  trendAxis,
  trendDateLabel,
  trendDateLabelIndexes,
  trendTickLabel,
  trendTime,
  type TrendPoint,
} from './TrendChart';

const points: TrendPoint[] = [
  { at: '2026-10-27', value: 83.4 },
  { at: '2026-11-03', value: 82.9 },
  { at: '2026-11-10', value: 82.2 },
  { at: '2026-11-17', value: 81.8 },
  { at: '2026-11-24', value: 81.2 },
];

describe('trendAxis', () => {
  it('fits round ticks around the data', () => {
    const axis = trendAxis(points.map((point) => point.value));
    expect(axis.min).toBeLessThanOrEqual(81.2);
    expect(axis.max).toBeGreaterThanOrEqual(83.4);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axis.ticks.length).toBeLessThanOrEqual(6);
  });

  it('gives a flat series a symmetric span and an empty one a unit axis', () => {
    const flat = trendAxis([70, 70]);
    expect(flat.min).toBeLessThan(70);
    expect(flat.max).toBeGreaterThan(70);
    expect(trendAxis([]).ticks).toEqual([0, 1]);
  });

  it('writes one decimal when the step is below one', () => {
    expect(trendTickLabel(81.5, 0.5)).toBe('81.5');
    expect(trendTickLabel(82, 1)).toBe('82');
  });
});

describe('trend dates', () => {
  it('reads a day string as a local day and labels it "27 Oct"', () => {
    expect(trendDateLabel('2026-10-27')).toBe('27 Oct');
    expect(trendDateLabel(new Date(2026, 10, 3))).toBe('3 Nov');
    expect(trendTime('2026-10-27')).toBe(new Date(2026, 9, 27).getTime());
    expect(trendDateLabel('nonsense')).toBe('nonsense');
  });

  it('picks first, last and evenly spaced indexes, at most four', () => {
    expect(trendDateLabelIndexes(0)).toEqual([]);
    expect(trendDateLabelIndexes(1)).toEqual([0]);
    expect(trendDateLabelIndexes(2)).toEqual([0, 1]);
    expect(trendDateLabelIndexes(30)).toEqual([0, 10, 19, 29]);
  });
});

describe('TrendChart', () => {
  const layout = { nativeEvent: { layout: { width: 320, height: 170, x: 0, y: 0 } } };

  it('is one image element carrying the label of the caller', async () => {
    await render(<TrendChart points={points} unit="kg" accessibilityLabel="Weight, down 2.2 kg over 4 weeks" testID="weight.chart" />);
    const chart = screen.getByTestId('weight.chart');
    expect(chart).toHaveProp('accessibilityLabel', 'Weight, down 2.2 kg over 4 weeks');
    expect(chart).toHaveProp('accessibilityRole', 'image');
    expect(chart).toHaveProp('accessible', true);
  });

  it('draws the date labels along the bottom and the fitted axis labels once laid out', async () => {
    await render(<TrendChart points={points} unit="kg" accessibilityLabel="Weight" testID="weight.chart" />);
    await fireEvent(screen.getByTestId('weight.chart'), 'layout', layout);
    expect(screen.getByText('27 Oct', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('24 Nov', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('17 Nov', { includeHiddenElements: true })).toBeOnTheScreen();
    const axis = trendAxis(points.map((point) => point.value));
    const top = axis.ticks.length - 1;
    expect(
      screen.getByTestId(`weight.chart:tick:${top}`, { includeHiddenElements: true }),
    ).toHaveTextContent(`${trendTickLabel(axis.max, axis.step)} kg`);
    expect(
      screen.getByTestId('weight.chart:tick:0', { includeHiddenElements: true }),
    ).toHaveTextContent(trendTickLabel(axis.min, axis.step));
  });

  it('draws the line, the area and the end dot with svg', async () => {
    await render(<TrendChart points={points} unit="kg" accessibilityLabel="Weight" testID="weight.chart" />);
    await fireEvent(screen.getByTestId('weight.chart'), 'layout', layout);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('"RNSVGPath"');
    expect(tree).toContain('"RNSVGCircle"');
  });

  it('draws only the dot for a single point and nothing for none', async () => {
    await render(<TrendChart points={[points[0] as TrendPoint]} unit="kg" accessibilityLabel="Weight" testID="one" />);
    await fireEvent(screen.getByTestId('one'), 'layout', layout);
    expect(JSON.stringify(screen.toJSON())).toContain('"RNSVGCircle"');
    expect(JSON.stringify(screen.toJSON())).not.toContain('"RNSVGPath"');
    await render(<TrendChart points={[]} unit="kg" accessibilityLabel="Weight" testID="none" />);
    await fireEvent(screen.getByTestId('none'), 'layout', layout);
    expect(screen.getByTestId('none')).toBeOnTheScreen();
  });
});
