/**
 * RNTL screen test of CustomFoodSheet (DY-04): the basis chips, the fields,
 * the Swift sheet's clamps and the disabled Save. Mirrors the FoodSearchTests
 * UI flow (Mila Punch, 120 kcal).
 */
import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import type { CatalogRepository, CustomFood } from '../../../data/repos/catalogRepository';
import { CustomFoodSheet } from '../screens/CustomFoodSheet';

const NOON = new Date(2026, 8, 12, 9, 0, 0, 0);

function makeCatalog(saveCustomFood = jest.fn(async (_food: CustomFood) => undefined)): CatalogRepository {
  return {
    saveCustomFood,
  } as unknown as CatalogRepository;
}

async function renderSheet(catalog = makeCatalog(), onCreated = jest.fn(), onDismiss = jest.fn()) {
  await render(
    <CustomFoodSheet
      catalog={catalog}
      userId="user-1"
      onCreated={onCreated}
      onDismiss={onDismiss}
      now={() => NOON}
      newId={() => '00000000-0000-4000-8000-000000000001'}
    />,
  );
  return { catalog, onCreated, onDismiss };
}

describe('CustomFoodSheet screen', () => {
  it('the sheet shows the fields and the basis chips, per-100g selected first', async () => {
    await renderSheet();

    expect(screen.getByText('Create custom food')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.close')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.nameField')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.kcalField')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.proteinField')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.carbsField')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.fatField')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.fiberField')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('custom.basis.per100g')).getByRole('button').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('custom.basis.per_serving')).toBeOnTheScreen();
    // The serving grams field belongs to the per-serving basis only.
    expect(screen.queryByTestId('custom.servingGramsField')).toBeNull();
  });

  it('the per-serving basis reveals the serving grams field', async () => {
    await renderSheet();
    await userEvent.press(
      within(screen.getByTestId('custom.basis.per_serving')).getByRole('button'),
    );
    expect(await screen.findByTestId('custom.servingGramsField')).toBeOnTheScreen();
    // The chips swap the selected trait.
    expect(
      within(screen.getByTestId('custom.basis.per_serving')).getByRole('button').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      within(screen.getByTestId('custom.basis.per100g')).getByRole('button').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('Save stays disabled without a name or a parsable kcal', async () => {
    await renderSheet();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);

    await userEvent.type(screen.getByTestId('custom.nameField'), 'Mila Punch');
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);

    await userEvent.type(screen.getByTestId('custom.kcalField'), '120');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(false),
    );
  });

  it('saving clamps the kcal figure and reports the created row', async () => {
    const saveCustomFood = jest.fn(async (_food: CustomFood) => undefined);
    const { onCreated, onDismiss } = await renderSheet(makeCatalog(saveCustomFood));

    await userEvent.type(screen.getByTestId('custom.nameField'), '  Mila Punch  ');
    await userEvent.type(screen.getByTestId('custom.kcalField'), '9999');
    await userEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saveCustomFood).toHaveBeenCalledTimes(1));
    const saved = saveCustomFood.mock.calls[0][0];
    expect(saved.name).toBe('Mila Punch'); // trimmed
    expect(saved.basis).toBe('per100g');
    expect(saved.kcal).toBe(2000); // clamped into 0…2000
    expect(saved.userId).toBe('user-1');
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mila Punch', kcal: 2000, basis: 'per100g', isCustom: true }),
    ));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a failed local write keeps the sheet open for a retry', async () => {
    const saveCustomFood = jest.fn(async (_food: CustomFood) => {
      throw new Error('disk full');
    });
    const { onCreated, onDismiss } = await renderSheet(makeCatalog(saveCustomFood));

    await userEvent.type(screen.getByTestId('custom.nameField'), 'Mila Punch');
    await userEvent.type(screen.getByTestId('custom.kcalField'), '120');
    await userEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saveCustomFood).toHaveBeenCalledTimes(1));
    expect(onCreated).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Create custom food')).toBeOnTheScreen();
  });
});
