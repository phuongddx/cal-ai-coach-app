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
import { StyleSheet } from 'react-native';

import { InsightCard } from './InsightCard';

describe('InsightCard', () => {
  it('renders title and text in the accent variant by default', async () => {
    await render(<InsightCard title="Streak saved" text="You logged every meal." />);
    expect(screen.getByTestId('insight-card:accent')).toBeOnTheScreen();
    expect(screen.getByText('Streak saved', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('You logged every meal.', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('renders the info variant on demand', async () => {
    await render(
      <InsightCard
        title="Trend"
        text="Protein is up this week."
        icon="chart.line.uptrend.xyaxis"
        variant="info"
      />,
    );
    expect(screen.getByTestId('insight-card:info')).toBeOnTheScreen();
    expect(screen.getByText('Protein is up this week.', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('draws an Ember icon in the tile when iconName is given', async () => {
    await render(<InsightCard title="Trend" text="Up." iconName="chart" />);
    expect(screen.getByTestId('icon:chart', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('shows no action row by default', async () => {
    await render(<InsightCard title="Trend" text="Up." />);
    expect(screen.queryByTestId('insight-card:accent:action')).toBeNull();
  });

  it('renders one action row: label, role, testID, 44 pt target, calls onPress', async () => {
    const onPress = jest.fn();
    await render(
      <InsightCard title="Trend" text="Up." action={{ label: 'See weekly review', onPress, testID: 'insight.open' }} />,
    );
    const action = screen.getByTestId('insight.open');
    expect(action).toHaveProp('accessibilityRole', 'button');
    expect(action).toHaveProp('accessibilityLabel', 'See weekly review');
    expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
