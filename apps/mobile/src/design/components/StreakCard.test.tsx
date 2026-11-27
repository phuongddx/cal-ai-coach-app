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

import { StreakCard, streakA11yLabel, streakChipText } from './StreakCard';

describe('StreakCard', () => {
  it('renders streak number, title and freeze chip', async () => {
    await render(<StreakCard emoji="🔥" streak={12} title="Day streak" freezesLeft={2} />);
    expect(screen.getByText('12', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Day streak', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('2 freezes left', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('streak-card')).toHaveProp(
      'accessibilityLabel',
      '12 day streak, 2 freezes left',
    );
  });

  it('uses the singular freeze text for one freeze', async () => {
    await render(<StreakCard emoji="🔥" streak={3} title="Day streak" freezesLeft={1} />);
    expect(screen.getByText('1 freeze left', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(streakA11yLabel(3, 1)).toBe('3 day streak, 1 freeze left');
    expect(streakChipText(1)).toBe('1 freeze left');
  });
});
