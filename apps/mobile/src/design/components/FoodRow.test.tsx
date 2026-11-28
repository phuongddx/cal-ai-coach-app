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

import { FoodRow, foodRowVisibleChip } from './FoodRow';
import { setEdSafeMode } from '../edSafe';

beforeEach(() => setEdSafeMode(false));

/** The table of the U-71f brief, the same rows as Toast.test.tsx and calorieFigure.test.ts. */
const HIDDEN_CHIPS = [
  'Calories today: 1,850',
  '640 kcal',
  'kJ',
  '220 cals',
  '5 kilojoules',
  '640kJs',
  '220cals',
  '1,850 Calories',
  '6CAL',
  'Cal 640',
  '640kcal',
  'kcal.',
  'calories,',
  'kilojoule',
  'About 300 cal',
  'About 500 kilocalories',
  'kilocalorie',
];
const SHOWN_CHIPS = [
  'Changes saved',
  'Chicken · 180 g',
  'Edited',
  'Calm bowl',
  'calcium 220 mg',
  'December',
  'escalate',
  'scalable',
  'Calzone',
  '150 g · 2 pieces',
];

describe('FoodRow ED-safe screen of the chip, every form of the calorie words', () => {
  it.each(HIDDEN_CHIPS)('draws the chip %j in every mode and drops the chip and its testID under ED-safe', async (text) => {
    expect(foodRowVisibleChip(text, true)).toBeUndefined();
    expect(foodRowVisibleChip(text, false)).toBe(text);
    await render(<FoodRow title="Oats" chip={text} />);
    expect(screen.getByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toHaveTextContent(text);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText(text, { includeHiddenElements: true })).toBeNull();
  });

  it.each(SHOWN_CHIPS)('keeps the chip %j under ED-safe', async (text) => {
    expect(foodRowVisibleChip(text, true)).toBe(text);
    await render(<FoodRow title="Oats" chip={text} />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toHaveTextContent(text);
  });

  it('drops the chip of a caller identifier too when the chip is hidden', async () => {
    await render(<FoodRow title="Oats" chip="220 cals" chipTestID="diary.editedChip.7" />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByTestId('diary.editedChip.7', { includeHiddenElements: true })).toBeNull();
  });
});

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

  it('hides a chip with a calorie word or figure under ED-safe and keeps a plain one', async () => {
    const { rerender } = await render(<FoodRow title="Oats" chip="Calories today: 1,850" />);
    expect(screen.getByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toHaveTextContent('Calories today: 1,850');
    await act(async () => {
      setEdSafeMode(true);
    });
    for (const hidden of ['Calories today: 1,850', '640 kcal', 'kJ']) {
      await rerender(<FoodRow title="Oats" chip={hidden} />);
      expect(screen.queryByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByText(hidden, { includeHiddenElements: true })).toBeNull();
    }
    for (const shown of ['Changes saved', 'Chicken · 180 g', 'Edited']) {
      await rerender(<FoodRow title="Oats" chip={shown} />);
      expect(screen.getByTestId('food-row-chip:Oats', { includeHiddenElements: true })).toHaveTextContent(shown);
    }
  });

  it('foodRowVisibleChip: every mode keeps a plain chip, only ED-safe drops a calorie one', () => {
    expect(foodRowVisibleChip('Edited', true)).toBe('Edited');
    expect(foodRowVisibleChip('640 kcal', false)).toBe('640 kcal');
    expect(foodRowVisibleChip('640 kcal', true)).toBeUndefined();
    expect(foodRowVisibleChip('', false)).toBeUndefined();
    expect(foodRowVisibleChip(undefined, true)).toBeUndefined();
  });
});

describe('FoodRow chevron and unit (U-71g, meal rows of Today)', () => {
  it('draws the chevron and the unit by default', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={624} />);
    expect(screen.getByTestId('food-row-chevron:Chicken Rice', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('food-row-kcal:Chicken Rice', { includeHiddenElements: true })).toHaveTextContent('624 kcal');
    expect(screen.getByTestId('food-row-kcal:Chicken Rice', { includeHiddenElements: true }).props.accessibilityLabel).toBeUndefined();
  });

  it('draws no chevron with chevron={false} and keeps the rest of the row', async () => {
    await render(<FoodRow title="Chicken Rice" meta="Lunch" kcal={624} chevron={false} />);
    expect(screen.queryByTestId('food-row-chevron:Chicken Rice', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('624 kcal', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Lunch', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('draws the number alone with unitHidden and says the unit in the accessibility label', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={624} unitHidden />);
    const number = screen.getByTestId('food-row-kcal:Chicken Rice', { includeHiddenElements: true });
    expect(number).toHaveTextContent('624');
    expect(number).not.toHaveTextContent('kcal');
    expect(number).toHaveProp('accessibilityLabel', '624 kcal');
    expect(screen.queryByText(/kcal/, { includeHiddenElements: true })).toBeNull();
  });

  it('works with both props together: number alone, no chevron', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={624} chevron={false} unitHidden />);
    expect(screen.queryByTestId('food-row-chevron:Chicken Rice', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('food-row-kcal:Chicken Rice', { includeHiddenElements: true })).toHaveTextContent('624');
  });

  it('keeps a hidden number hidden under ED-safe, with either prop', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={624} chevron={false} unitHidden />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByTestId('food-row-kcal:Chicken Rice', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText('624', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByLabelText('624 kcal', { includeHiddenElements: true })).toBeNull();
  });

  it('still draws the chevron under ED-safe by default, as before', async () => {
    await render(<FoodRow title="Chicken Rice" kcal={624} />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('food-row-chevron:Chicken Rice', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
