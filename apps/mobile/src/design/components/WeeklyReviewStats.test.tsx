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
import { StyleSheet, useColorScheme } from 'react-native';

import { getTokens } from '../tokens';

import { visibleStats, WeeklyReviewStats, kgValue } from './WeeklyReviewStats';
import { setEdSafeMode } from '../edSafe';
import { act } from '@testing-library/react-native';

beforeEach(() => setEdSafeMode(false));

describe('WeeklyReviewStats stat visibility', () => {
  it('shows % on target and kg framing with the mode off', () => {
    const stats = visibleStats(5, 4, 2, 0.42, false);
    expect(stats.map((stat) => stat.id)).toEqual(['days', 'target', 'kg']);
    expect(stats.find((stat) => stat.id === 'target')?.value).toBe('80%');
    expect(stats.find((stat) => stat.id === 'kg')?.value).toBe('+0.4');
  });

  it('swaps to weeks-all-logged with the mode on', () => {
    const stats = visibleStats(5, 4, 2, 0.42, true);
    expect(stats.map((stat) => stat.id)).toEqual(['days', 'weeks']);
    expect(stats.find((stat) => stat.id === 'weeks')?.value).toBe('2');
  });

  it('reads 0% without logged days', () => {
    const stats = visibleStats(0, 0, 1, 0, false);
    expect(stats.find((stat) => stat.id === 'target')?.value).toBe('0%');
  });
});

describe('kgValue', () => {
  it('formats one-decimal signed weights', () => {
    expect(kgValue(0.42)).toBe('+0.4');
    expect(kgValue(-0.45)).toBe('−0.5');
    expect(kgValue(0)).toBe('0.0');
    expect(kgValue(1.25)).toBe('+1.3');
  });
});

describe('WeeklyReviewStats rendering', () => {
  it('renders the stats with the mode off', async () => {
    await render(
      <WeeklyReviewStats daysLogged={5} daysOnTarget={4} weeksAllLogged={2} kgThisWeek={0.42} />,
    );
    expect(screen.getByTestId('weekly-stat:days')).toHaveTextContent('Days logged');
    expect(screen.getByTestId('weekly-stat:target', { includeHiddenElements: true })).toHaveTextContent('% on target');
    expect(screen.getByTestId('weekly-stat:kg', { includeHiddenElements: true })).toHaveTextContent('kg this week');
    expect(screen.queryByTestId('weekly-stat:weeks', { includeHiddenElements: true })).toBeNull();
  });

  it('swaps the stats while ED-safe mode is on', async () => {
    await render(
      <WeeklyReviewStats daysLogged={5} daysOnTarget={4} weeksAllLogged={2} kgThisWeek={0.42} />,
    );
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('weekly-stat:weeks', { includeHiddenElements: true })).toHaveTextContent(
      'Weeks with all meals logged',
    );
    expect(screen.queryByTestId('weekly-stat:kg', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('weekly-stat:target', { includeHiddenElements: true })).toBeNull();
  });
});

describe('WeeklyReviewStats onEmber', () => {
  const colorOf = (node: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(node.props.style as never) as { color?: string }).color;
  const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
  afterEach(() => mockScheme.mockReturnValue('light'));

  it.each(['light', 'dark'] as const)('reads accentInk / text2 on a plain card by default (%s)', async (scheme) => {
    mockScheme.mockReturnValue(scheme);
    await render(<WeeklyReviewStats daysLogged={5} daysOnTarget={4} weeksAllLogged={2} kgThisWeek={0.42} />);
    const colors = getTokens(scheme).colors;
    expect(colorOf(screen.getByTestId('weekly-stat:days'))).toBe(colors.text2);
    expect(colorOf(screen.getByText('5'))).toBe(colors.accentInk);
  });

  it.each(['light', 'dark'] as const)('reads accent / emberText2 on the ember card (%s)', async (scheme) => {
    mockScheme.mockReturnValue(scheme);
    await render(<WeeklyReviewStats daysLogged={5} daysOnTarget={4} weeksAllLogged={2} kgThisWeek={0.42} onEmber />);
    const colors = getTokens(scheme).colors;
    expect(colorOf(screen.getByTestId('weekly-stat:days'))).toBe(colors.emberText2);
    expect(colorOf(screen.getByText('5'))).toBe(colors.accent);
  });

  it('keeps the ED-safe swap on the ember card', async () => {
    await render(<WeeklyReviewStats daysLogged={5} daysOnTarget={4} weeksAllLogged={2} kgThisWeek={0.42} onEmber />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('weekly-stat:weeks', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('weekly-stat:kg', { includeHiddenElements: true })).toBeNull();
  });
});
