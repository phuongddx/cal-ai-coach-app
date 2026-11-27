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

import { render, screen } from '@testing-library/react-native';

import { BadgeTile, badgeA11yLabel } from './BadgeTile';

describe('BadgeTile', () => {
  it('renders an earned badge with its accessibility label', async () => {
    await render(<BadgeTile emoji="🔥" name="On fire" detail="7-day streak" />);
    expect(screen.getByText('On fire', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('7-day streak', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:On fire')).toHaveProp(
      'accessibilityLabel',
      'On fire, earned',
    );
  });

  it('marks a locked badge as locked and dimmed', async () => {
    await render(
      <BadgeTile emoji="🏆" name="Marathon" detail="30-day streak" isLocked />,
    );
    expect(screen.getByTestId('badge-tile:Marathon')).toHaveProp(
      'accessibilityLabel',
      'Marathon, locked, 30-day streak',
    );
    expect(screen.getByText('Marathon', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(badgeA11yLabel('Marathon', true, '30-day streak')).toBe(
      'Marathon, locked, 30-day streak',
    );
  });
});
