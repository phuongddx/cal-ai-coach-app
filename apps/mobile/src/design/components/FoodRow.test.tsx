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

import { FoodRow } from './FoodRow';
import { setEdSafeMode } from '../edSafe';

beforeEach(() => setEdSafeMode(false));

describe('FoodRow', () => {
  it('renders title, meta and the kcal value', async () => {
    await render(<FoodRow title="Chicken Rice" meta="Lunch · 320 g" kcal={464} />);
    const row = screen.getByTestId('food-row:Chicken Rice');
    expect(screen.getByText('Chicken Rice', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Lunch · 320 g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('464 kcal', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('shows the sync-pending chip only when asked', async () => {
    const { rerender } = await render(<FoodRow title="Oats" />);
    expect(screen.queryByText('Syncs later', { includeHiddenElements: true })).toBeNull();
    await rerender(<FoodRow title="Oats" syncPending />);
    expect(screen.getByText('Syncs later', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('renders a compact badge node', async () => {
    await render(
      <FoodRow
        title="Salad"
        compactBadge={<Text testID="compact">High confidence</Text>}
      />,
    );
    expect(screen.getByTestId('compact', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('hides the kcal value while ED-safe mode is on', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={464} />);
    expect(screen.getByText('464 kcal', { includeHiddenElements: true })).toBeOnTheScreen();

    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByText('464 kcal', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Chicken Rice', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('never shows a kcal cell without a kcal value', async () => {
    await render(<FoodRow title="Coffee" />);
    expect(screen.queryByText(/kcal/, { includeHiddenElements: true })).toBeNull();
  });

  it('draws no chip by default and the chip label when given', async () => {
    const { rerender } = await render(<FoodRow title="Oats" />);
    expect(screen.queryByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toBeNull();
    await rerender(<FoodRow title="Oats" chip="Edited" />);
    expect(screen.getByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toHaveTextContent('Edited');
  });

  it('keeps the chip of the caller identifier and shows the chip under ED-safe', async () => {
    await render(<FoodRow title="Oats" kcal={300} chip="Edited" chipTestID="diary.editedChip.7" />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('diary.editedChip.7', { includeHiddenElements: true })).toHaveTextContent('Edited');
    expect(screen.queryByText('300 kcal', { includeHiddenElements: true })).toBeNull();
  });

  it('ignores an empty chip', async () => {
    await render(<FoodRow title="Oats" chip="" />);
    expect(screen.queryByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toBeNull();
  });
});
