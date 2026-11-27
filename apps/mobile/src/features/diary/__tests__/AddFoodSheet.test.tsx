/**
 * RNTL screen test of AddFoodSheet (DY-02): the five quick-action tiles, the
 * saved-meals rail and its empty card, and the Swift identifiers.
 */
import { render, screen, userEvent, within } from '@testing-library/react-native';

import { AddFoodSheet } from '../screens/AddFoodSheet';
import type { SavedMeal } from '../../../data/repos/catalogRepository';

const NOON = new Date(2026, 8, 12, 9, 0, 0, 0);

function makeMeal(overrides: Partial<SavedMeal> = {}): SavedMeal {
  return {
    id: 'meal-1',
    userId: 'user-1',
    name: 'Chicken Rice Bowl',
    symbol: 'fork.knife',
    kcal: 464,
    itemsJson: '[{"name":"Chicken Rice Bowl","grams":320,"kcal":464}]',
    createdAt: NOON,
    ...overrides,
  };
}

async function renderSheet(savedMeals: SavedMeal[]) {
  const onCapture = jest.fn();
  const onSearch = jest.fn();
  const onRelog = jest.fn();
  const onDismiss = jest.fn();
  await render(
    <AddFoodSheet
      mealSlot="lunch"
      savedMeals={savedMeals}
      onCapture={onCapture}
      onSearch={onSearch}
      onRelog={onRelog}
      onDismiss={onDismiss}
    />,
  );
  return { onCapture, onSearch, onRelog, onDismiss };
}

describe('AddFoodSheet screen', () => {
  it('the sheet opens on Lunch with the five quick-action tiles', async () => {
    await renderSheet([]);

    expect(screen.getByText('Add food')).toBeOnTheScreen();
    expect(screen.getByText('to Lunch')).toBeOnTheScreen();
    expect(screen.getByTestId('addfood.close')).toBeOnTheScreen();
    for (const tile of ['photo', 'barcode', 'label', 'describe', 'search']) {
      expect(screen.getByTestId(`addfood.tile.${tile}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('Photo')).toBeOnTheScreen();
    expect(screen.getByText('Barcode')).toBeOnTheScreen();
    expect(screen.getByText('Label')).toBeOnTheScreen();
    expect(screen.getByText('Describe')).toBeOnTheScreen();
    expect(screen.getByText('Search')).toBeOnTheScreen();
    expect(screen.getByText('Saved meals')).toBeOnTheScreen();
  });

  it('an empty rail renders the backstop card', async () => {
    await renderSheet([]);
    expect(screen.getByTestId('addfood.savedMealsEmpty')).toBeOnTheScreen();
    expect(screen.getByText('Save a meal and re-log it here in one tap.')).toBeOnTheScreen();
  });

  it('the rail renders one card per saved meal with the log label', async () => {
    await renderSheet([
      makeMeal(),
      makeMeal({ id: 'meal-2', name: 'Protein Oats', symbol: null, kcal: 380 }),
    ]);

    const cards = screen.getAllByTestId('addfood.savedMeal');
    expect(cards).toHaveLength(2);
    expect(screen.getByLabelText('Log saved meal, Chicken Rice Bowl')).toBeOnTheScreen();
    expect(screen.getByLabelText('Log saved meal, Protein Oats')).toBeOnTheScreen();
    expect(screen.getByText('464 kcal')).toBeOnTheScreen();
    expect(screen.getByText('380 kcal')).toBeOnTheScreen();
  });

  it('the capture tiles hand the scan mode over and Search opens the search', async () => {
    const { onCapture, onSearch } = await renderSheet([]);

    const pressTile = async (tile: string) =>
      userEvent.press(within(screen.getByTestId(`addfood.tile.${tile}`)).getByRole('button'));

    await pressTile('photo');
    expect(onCapture).toHaveBeenCalledWith('photo');
    await pressTile('barcode');
    expect(onCapture).toHaveBeenCalledWith('barcode');
    await pressTile('label');
    expect(onCapture).toHaveBeenCalledWith('label');
    await pressTile('describe');
    expect(onCapture).toHaveBeenCalledWith('text');
    await pressTile('search');
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onCapture).not.toHaveBeenCalledWith('search');
  });

  it('a rail card tap hands the meal to the re-log and Close dismisses', async () => {
    const meal = makeMeal();
    const { onRelog, onDismiss } = await renderSheet([meal]);

    await userEvent.press(screen.getByLabelText('Log saved meal, Chicken Rice Bowl'));
    expect(onRelog).toHaveBeenCalledWith(meal);

    await userEvent.press(screen.getByTestId('addfood.close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
