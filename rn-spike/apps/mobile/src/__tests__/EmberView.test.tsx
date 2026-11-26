import { render, screen } from '@testing-library/react-native';

import { EmberView } from '../features/ember/EmberView';
import { buildFixtureMeals, fixtureTargets } from '../features/ember/fixture';
import { formatHeaderDate, weekStrip } from '../features/ember/format';

// Tuesday 24 Nov 2026, local time.
const NOW = new Date(2026, 10, 24, 18, 0, 0);

// RNTL 14: render is async (it builds on `test-renderer`), so every render is awaited.
describe('EmberView', () => {
  it('shows the totals computed from the meals it is given', async () => {
    await render(<EmberView meals={buildFixtureMeals(NOW)} targets={fixtureTargets} now={NOW} isOffline={false} colorScheme="light" />);
    expect(screen.getByTestId('ember:eaten')).toHaveTextContent('1,284');
    expect(screen.getByTestId('ember:goal')).toHaveTextContent('2,100');
    expect(screen.getByTestId('ember:kcal-left')).toHaveTextContent('816');
    expect(screen.getByTestId('ember:macro:protein')).toHaveTextContent(/82 \/ 130 g/);
    expect(screen.getByTestId('ember:macro:carbs')).toHaveTextContent(/140 \/ 210 g/);
    expect(screen.getByTestId('ember:macro:fat')).toHaveTextContent(/38 \/ 70 g/);
    expect(screen.getByTestId('ember:macro:fiber')).toHaveTextContent(/14 \/ 30 g/);
  });

  it('follows different meals instead of fixed numbers', async () => {
    const [oats] = buildFixtureMeals(NOW);
    await render(<EmberView meals={[oats]} targets={fixtureTargets} now={NOW} isOffline={false} colorScheme="dark" />);
    expect(screen.getByTestId('ember:eaten')).toHaveTextContent('410');
    expect(screen.getByTestId('ember:kcal-left')).toHaveTextContent('1,690');
    expect(screen.getByTestId(`ember:meal-kcal:${oats.id}`)).toHaveTextContent('410');
  });

  it('counts only meals eaten on the shown day', async () => {
    const yesterday = buildFixtureMeals(new Date(2026, 10, 23, 18, 0, 0));
    await render(<EmberView meals={yesterday} targets={fixtureTargets} now={NOW} isOffline={false} colorScheme="light" />);
    expect(screen.getByTestId('ember:eaten')).toHaveTextContent('0');
    expect(screen.getByTestId('ember:kcal-left')).toHaveTextContent('2,100');
    expect(screen.getByTestId('ember:empty')).toBeOnTheScreen();
  });

  it('shows the offline chip only when offline', async () => {
    const { rerender } = await render(
      <EmberView meals={[]} targets={fixtureTargets} now={NOW} isOffline={false} colorScheme="light" />,
    );
    expect(screen.queryByTestId('ember:offline')).toBeNull();
    await rerender(<EmberView meals={[]} targets={fixtureTargets} now={NOW} isOffline colorScheme="light" />);
    expect(screen.getByTestId('ember:offline')).toHaveTextContent('Offline · syncs later');
  });

  it('renders the week strip with today selected and the streak card', async () => {
    await render(<EmberView meals={[]} targets={fixtureTargets} now={NOW} isOffline={false} streakDays={0} colorScheme="light" />);
    expect(screen.getByTestId('ember:date')).toHaveTextContent('Tuesday, 24 Nov');
    expect(screen.getByTestId('ember:week:2026-11-24')).toHaveTextContent('T24');
    expect(screen.getByTestId('ember:streak')).toHaveTextContent('0-day streak');
  });
});

describe('ember formatting', () => {
  it('builds a Monday-first week containing the given day', () => {
    const days = weekStrip(NOW);
    expect(days.map((d) => d.day)).toEqual([23, 24, 25, 26, 27, 28, 29]);
    expect(days.map((d) => d.letter).join('')).toBe('MTWTFSS');
    expect(days.filter((d) => d.selected).map((d) => d.day)).toEqual([24]);
  });

  it('formats the header date', () => {
    expect(formatHeaderDate(NOW)).toBe('Tuesday, 24 Nov');
  });
});
