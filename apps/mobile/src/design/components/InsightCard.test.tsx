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
});
