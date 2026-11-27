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

import { render, screen } from '@testing-library/react-native';

import { makeChartDescriptor, ChartCard, type ChartPoint } from './ChartCard';

function makePoints(): ChartPoint[] {
  return [0, 1, 2, 3].map((index) => ({
    date: new Date(Date.UTC(2026, 10, 24 + index)),
    value: 82.4 - index * 0.35,
    label: `Day ${index}`,
  }));
}

// Port of ComponentContractTests.testChartCardProducesChartDescriptor.
describe('ChartCard descriptor', () => {
  it('produces one continuous series with a data point per input', () => {
    const points = makePoints();
    const descriptor = makeChartDescriptor(points);
    expect(descriptor.series).toHaveLength(1);
    expect(descriptor.series[0]?.dataPoints).toHaveLength(points.length);
    expect(descriptor.series[0]?.name).toBe('Series');
    expect(descriptor.series[0]?.isContinuous).toBe(true);
    expect(descriptor.title).toBe('Trend');
    expect(descriptor.xAxis.categoryOrder).toEqual(['Day 0', 'Day 1', 'Day 2', 'Day 3']);
    expect(descriptor.yAxis.minimum).toBeCloseTo(81.35);
    expect(descriptor.yAxis.maximum).toBeCloseTo(82.4);
  });
});

describe('ChartCard rendering', () => {
  it('renders the line chart with the default (empty) title', async () => {
    await render(<ChartCard points={makePoints()} />);
    expect(screen.getByTestId('chart-card')).toBeOnTheScreen();
  });

  it('renders a given title and the accessibility summary', async () => {
    await render(<ChartCard points={makePoints()} title="Weight" />);
    expect(screen.getByText('Weight', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('chart-card')).toHaveProp(
      'accessibilityLabel',
      'Trend. Day 0: 82.4, Day 1: 82.05, Day 2: 81.7, Day 3: 81.35',
    );
  });

  it('renders without points', async () => {
    await render(<ChartCard points={[]} />);
    expect(screen.getByTestId('chart-card')).toBeOnTheScreen();
  });
});
