/**
 * RNTL screen test of ManualLogSheet (DY-05): per-100g and per-serving bases,
 * the live-derived kcal (never typed), the steppers and the save payload.
 * The manual-log rule test lives in DiaryWaterExercise.test.ts; this file is
 * the screen.
 */
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { ManualLogSheet } from '../screens/ManualLogSheet';
import type { FoodSearchRow } from '../foodSearchModel';

const ROW_PER_100G: FoodSearchRow = {
  id: 'food-1',
  name: 'Chicken Breast',
  kcal: 165,
  proteinG: 31,
  basis: 'per_100g',
  servingGrams: 150,
  isCustom: false,
};

const ROW_PER_SERVING: FoodSearchRow = {
  id: 'food-2',
  name: 'Homemade Protein Shake',
  kcal: 240,
  proteinG: 30,
  basis: 'per_serving',
  servingGrams: 400,
  isCustom: true,
};

async function renderSheet(row: FoodSearchRow, onSave = jest.fn(), onDismiss = jest.fn()) {
  await render(
    <ManualLogSheet
      row={row}
      mealSlot="lunch"
      onSave={onSave}
      onDismiss={onDismiss}
      newId={() => '00000000-0000-4000-8000-000000000001'}
    />,
  );
  return { onSave, onDismiss };
}

describe('ManualLogSheet screen', () => {
  it('the per-100g sheet shows the stepper and the derived kcal of the default grams', async () => {
    await renderSheet(ROW_PER_100G);

    expect(screen.getByText('Log Chicken Breast')).toBeOnTheScreen();
    expect(screen.getByText('Per 100 g values')).toBeOnTheScreen();
    expect(screen.getByTestId('manual.stepper')).toBeOnTheScreen();
    expect(screen.getByTestId('ccstepper.decrement')).toBeOnTheScreen();
    expect(screen.getByTestId('ccstepper.increment')).toBeOnTheScreen();
    // 165 × 150 / 100 → 248, the Swift UI test's figure.
    expect(screen.getByTestId('manual.kcal')).toHaveTextContent('248');
    expect(screen.getByRole('button', { name: 'Save to Lunch' })).toBeOnTheScreen();
    expect(screen.getByTestId('manual.save')).toBeOnTheScreen();
  });

  it('the kcal live-recomputes through DiaryMath at every stepper value', async () => {
    await renderSheet(ROW_PER_100G);

    // +10 g → 165 × 160 / 100 → 264.
    await userEvent.press(screen.getByTestId('ccstepper.increment'));
    await waitFor(() => expect(screen.getByTestId('manual.kcal')).toHaveTextContent('264'));
    // −20 g → 165 × 140 / 100 → 231.
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    await waitFor(() => expect(screen.getByTestId('manual.kcal')).toHaveTextContent('231'));
  });

  it('saving passes the detail with the derived kcal, the grams and the slot', async () => {
    const { onSave } = await renderSheet(ROW_PER_100G);
    await userEvent.press(screen.getByRole('button', { name: 'Save to Lunch' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const detail = onSave.mock.calls[0][0];
    expect(detail.entryId).toBe('00000000-0000-4000-8000-000000000001');
    expect(detail.mealSlot).toBe('lunch');
    expect(detail.title).toBe('Chicken Breast');
    expect(detail.grams).toBe(150);
    expect(detail.kcal).toBe(248);
    expect(detail.source).toBe('manual');
  });

  it('the per-serving sheet steppers servings and scales the kcal', async () => {
    await renderSheet(ROW_PER_SERVING);

    expect(screen.getByText('Per serving values')).toBeOnTheScreen();
    expect(screen.queryByTestId('manual.stepper')).toBeNull();
    expect(screen.getByText('1 serving')).toBeOnTheScreen();
    expect(screen.getByTestId('manual.kcal')).toHaveTextContent('240');

    await userEvent.press(screen.getByTestId('ccstepper.increment'));
    await waitFor(() => expect(screen.getByText('2 servings')).toBeOnTheScreen());
    expect(screen.getByTestId('manual.kcal')).toHaveTextContent('480');

    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    // Clamped at the lower bound of 1 serving.
    await waitFor(() => expect(screen.getByText('1 serving')).toBeOnTheScreen());
    expect(screen.getByTestId('manual.kcal')).toHaveTextContent('240');
  });

  it('the per-serving save stores servingGrams × servings as grams', async () => {
    const { onSave } = await renderSheet(ROW_PER_SERVING);
    await userEvent.press(screen.getByTestId('ccstepper.increment'));
    await userEvent.press(screen.getByRole('button', { name: 'Save to Lunch' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const detail = onSave.mock.calls[0][0];
    expect(detail.grams).toBe(800); // 400 × 2
    expect(detail.kcal).toBe(480);
  });

  it('Close dismisses the sheet', async () => {
    const { onDismiss } = await renderSheet(ROW_PER_100G);
    await userEvent.press(screen.getByTestId('manual.close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
