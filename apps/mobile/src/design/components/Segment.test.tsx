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

import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, withAlpha } from '../tokens';

import { Segment } from './Segment';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
afterEach(() => mockUseColorScheme.mockReturnValue('light'));

const meals = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function Harness({ variant, initial = 'lunch' }: { variant: 'chips' | 'text'; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Segment
      options={meals}
      value={value}
      onChange={setValue}
      variant={variant}
      accessibilityLabel="Meal"
      testID="meal"
    />
  );
}

describe('Segment', () => {
  it.each(['chips', 'text'] as const)('is a radio group of radio buttons (%s)', async (variant) => {
    await render(<Harness variant={variant} />);
    expect(screen.getByTestId('meal')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByTestId('meal')).toHaveProp('accessibilityLabel', 'Meal');
    for (const option of meals) {
      const radio = screen.getByTestId(`meal.${option.value}`);
      expect(radio).toHaveProp('accessibilityRole', 'radio');
      expect(radio).toHaveProp('accessibilityLabel', option.label);
      expect(radio).toHaveStyle({ minHeight: 44 });
    }
  });

  it.each(['chips', 'text'] as const)('announces the selected option as selected (%s)', async (variant) => {
    await render(<Harness variant={variant} />);
    expect(screen.getByTestId('meal.lunch')).toHaveProp('accessibilityState', { selected: true, checked: true });
    expect(screen.getByTestId('meal.dinner')).toHaveProp('accessibilityState', { selected: false, checked: false });
    expect(screen.getByRole('radio', { name: 'Lunch', selected: true })).toBeOnTheScreen();
  });

  it.each(['chips', 'text'] as const)('moves the selection and calls onChange with the value (%s)', async (variant) => {
    await render(<Harness variant={variant} />);
    await userEvent.press(screen.getByTestId('meal.dinner'));
    expect(screen.getByTestId('meal.dinner')).toHaveProp('accessibilityState', { selected: true, checked: true });
    expect(screen.getByTestId('meal.lunch')).toHaveProp('accessibilityState', { selected: false, checked: false });
  });

  it('draws the selected chip black on orange and the others on the dark chip', async () => {
    await render(<Harness variant="chips" />);
    const selected = screen.getByTestId('meal.lunch');
    const selectedChip = selected.children[0] as unknown as { props: { style: unknown } };
    expect(selectedChip).toBeTruthy();
    expect(screen.getByText('Lunch')).toHaveStyle({ color: lightColors.onAccent });
    expect(screen.getByText('Dinner')).toHaveStyle({ color: lightColors.emberText });
    expect(screen.getByTestId('meal.lunch')).toHaveProp('accessibilityLabel', 'Lunch');
    // Backgrounds: the chip View is the first child of the radio button.
    const chipOf = (id: string) => screen.getByTestId(id).children[0] as never;
    expect(chipOf('meal.lunch')).toHaveStyle({ backgroundColor: lightColors.accent });
    expect(chipOf('meal.dinner')).toHaveStyle({ backgroundColor: withAlpha(darkColors.elevated, 0.85) });
  });

  it('draws the text variant on a fill track with the selected label in accent ink', async () => {
    await render(<Harness variant="text" />);
    expect(screen.getByTestId('meal')).toHaveStyle({ backgroundColor: lightColors.fill });
    expect(screen.getByText('Lunch')).toHaveStyle({ color: lightColors.accentInk });
    expect(screen.getByText('Dinner')).toHaveStyle({ color: lightColors.text });
    const pillOf = (id: string) => screen.getByTestId(id).children[0] as never;
    expect(pillOf('meal.lunch')).toHaveStyle({ backgroundColor: lightColors.segmentSelected });
  });

  it('draws the selected pill with segmentSelected in dark', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await render(<Harness variant="text" />);
    const pill = screen.getByTestId('meal.lunch').children[0] as never;
    expect(pill).toHaveStyle({ backgroundColor: darkColors.segmentSelected });
    expect(screen.getByText('Lunch')).toHaveStyle({ color: darkColors.accentInk });
  });
});
