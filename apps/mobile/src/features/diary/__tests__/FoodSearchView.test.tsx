/**
 * RNTL screen test of FoodSearchView (DY-03): the Search / Saved / Recent
 * segment, recents on open, results for a query, the verbatim empty state,
 * the per-row add button, the escape card, the persistent create-custom row
 * and the manual-log flow into the diary write. The catalog is a test double
 * over the seeded-food values the Swift UI tests rely on (Chicken Breast 165).
 */
import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { setEdSafeMode } from '../../../design';

import type { CatalogRepository, CustomFood, Food } from '../../../data/repos/catalogRepository';
import type { DiaryEntryDetail } from '../../../data/repos/diaryEntryRepository';
import type { DiaryDeps } from '../deps';
import { FoodSearchView } from '../screens/FoodSearchView';

const NOON = new Date(2026, 8, 12, 9, 0, 0, 0);

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Chicken Breast',
    brand: null,
    per100gKcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    fiberG: 0,
    servingGrams: 150,
    isCustom: false,
    createdAt: NOON,
    ...overrides,
  };
}

function makeCustom(overrides: Partial<CustomFood> = {}): CustomFood {
  return {
    id: 'custom-1',
    userId: 'user-1',
    name: 'Mila Punch',
    basis: 'per_serving',
    kcal: 120,
    proteinG: 0,
    carbsG: 20,
    fatG: 0,
    fiberG: 0,
    servingGrams: 330,
    createdAt: NOON,
    ...overrides,
  };
}

function makeCatalog(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    searchFoods: async () => [makeFood()],
    recentFoods: async () => [makeFood({ name: 'Overnight Oats', per100gKcal: 150, proteinG: 6, servingGrams: null })],
    customFoods: async () => [],
    saveCustomFood: async () => undefined,
    ...overrides,
  } as unknown as CatalogRepository;
}

function makeDeps(overrides: Partial<DiaryDeps> = {}): DiaryDeps {
  return {
    db: {} as DiaryDeps['db'],
    catalog: makeCatalog(),
    diaryEntries: {
      recordUpsert: async () => ({ opId: 'op-1', recordId: 'entry-1' }),
    } as unknown as DiaryDeps['diaryEntries'],
    diaryDetails: { upsert: async () => undefined } as unknown as DiaryDeps['diaryDetails'],
    targets: {} as DiaryDeps['targets'],
    tracking: {} as DiaryDeps['tracking'],
    notify: () => undefined,
    ownerId: 'user-1',
    subscribe: () => () => undefined,
    now: () => NOON,
    newId: () => '00000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

async function renderSearch(deps: DiaryDeps, onSaved = jest.fn(), onDismiss = jest.fn(), onDescribe = jest.fn()) {
  return await render(
    <FoodSearchView
      mealSlot="breakfast"
      catalog={deps.catalog}
      userId={deps.ownerId}
      diaryEntries={deps.diaryEntries}
      diaryDetails={deps.diaryDetails}
      notify={deps.notify}
      now={deps.now}
      newId={deps.newId}
      onDescribe={onDescribe}
      onSaved={onSaved}
      onDismiss={onDismiss}
    />,
  );
}

afterEach(() => {
  setEdSafeMode(false);
});

describe('FoodSearchView screen', () => {
  it('the search screen shows the Recent card before a query', async () => {
    await renderSearch(makeDeps());

    expect(screen.getByTestId('search.back')).toBeOnTheScreen();
    expect(screen.getByTestId('search.field')).toBeOnTheScreen();
    // The screen opens on the Recent segment.
    expect(screen.getByTestId('search.segment.recent').props.accessibilityState.selected).toBe(true);
    expect((await screen.findAllByText('Recent')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Add food, Overnight Oats')).toBeOnTheScreen();
    expect(screen.getByText('150 kcal · 6g protein · 100g')).toBeOnTheScreen();
    expect(screen.getByTestId('search.createCustom')).toBeOnTheScreen();
  });

  it('the segment switches between the search results, the saved customs and the recents', async () => {
    const catalog = makeCatalog({ customFoods: async () => [makeCustom()] });
    await renderSearch(makeDeps({ catalog }));

    await userEvent.press(screen.getByTestId('search.segment.saved'));
    expect(await screen.findByText('Mila Punch')).toBeOnTheScreen();
    expect(screen.queryByText('150 kcal · 6g protein · 100g')).toBeNull();

    await userEvent.press(screen.getByTestId('search.segment.search'));
    // No query yet: the search segment holds no list.
    expect(screen.queryByText('Mila Punch')).toBeNull();
    expect(screen.queryByText('150 kcal · 6g protein · 100g')).toBeNull();

    await userEvent.type(screen.getByPlaceholderText('Search foods'), 'chicken');
    expect(await screen.findByText('Results for “chicken”')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('search.segment.recent'));
    expect(await screen.findByText('150 kcal · 6g protein · 100g')).toBeOnTheScreen();
  });

  it('a query surfaces the results card', async () => {
    await renderSearch(makeDeps());
    await userEvent.type(screen.getByPlaceholderText('Search foods'), 'chicken');

    expect(await screen.findByText('Results for “chicken”')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add food, Chicken Breast')).toBeOnTheScreen();
    // The recent row made way for the results.
    expect(screen.queryByLabelText('Add food, Overnight Oats')).toBeNull();
  });

  it('a query with no matches shows the verbatim empty state and the create entry', async () => {
    await renderSearch(makeDeps());
    await userEvent.type(screen.getByPlaceholderText('Search foods'), 'qqzzxx');

    expect(await screen.findByTestId('search.emptyState')).toBeOnTheScreen();
    expect(screen.getByText('No results for “qqzzxx”')).toBeOnTheScreen();
    expect(screen.getByText('Try a different search or create a custom food.')).toBeOnTheScreen();
    expect(screen.getByTestId('search.createCustom')).toBeOnTheScreen();
  });

  it('the add button logs the row like the row tap itself', async () => {
    await renderSearch(makeDeps());

    await userEvent.press(await screen.findByTestId('search.addRow.food-1'));
    expect(await screen.findByText('Log Overnight Oats')).toBeOnTheScreen();
  });

  it('the escape card hands over to the describe flow and to the manual entry', async () => {
    const onDescribe = jest.fn();
    await renderSearch(makeDeps(), jest.fn(), jest.fn(), onDescribe);

    expect(screen.getByText("Can't find it? Describe it or log manually")).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('search.escape.describe'));
    expect(onDescribe).toHaveBeenCalledTimes(1);

    await userEvent.press(screen.getByTestId('search.escape.manual'));
    expect(await screen.findByTestId('custom.nameField')).toBeOnTheScreen();
  });

  it('the search row shows the serving size in the ED-safe mode and the kcal figure when off', async () => {
    setEdSafeMode(true);
    await renderSearch(makeDeps());

    // The recent row carries no serving, so the basis string takes the slot.
    expect(await screen.findByText('100g')).toBeOnTheScreen();
    expect(screen.queryByText('150 kcal · 6g protein · 100g')).toBeNull();

    // The result row shows its serving size.
    await userEvent.type(screen.getByPlaceholderText('Search foods'), 'chicken');
    expect(await screen.findByText('150 g')).toBeOnTheScreen();
    expect(screen.queryByText('165 kcal · 31g protein · 100g')).toBeNull();

    setEdSafeMode(false);
    await waitFor(() => expect(screen.getByText('165 kcal · 31g protein · 100g')).toBeOnTheScreen());
    expect(screen.queryByText('150 g')).toBeNull();
  });

  it('a row opens the manual-log sheet with the derived kcal of the default grams', async () => {
    await renderSearch(makeDeps());

    fireEvent.press(await screen.findByLabelText('Add food, Overnight Oats'));
    expect(await screen.findByText('Log Overnight Oats')).toBeOnTheScreen();
    expect(screen.getByText('Per 100 g values')).toBeOnTheScreen();
    // The row carries no serving size, so the default 100 g applies: 150 kcal.
    expect(screen.getByTestId('manual.kcal')).toHaveTextContent('150');
  });

  it('saving a manual log writes the derived kcal, notifies and reports the receipt', async () => {
    const notify = jest.fn();
    const recordUpsert = jest.fn(async () => ({ opId: 'op-1', recordId: 'entry-1' }));
    const upsert = jest.fn(async (_detail: DiaryEntryDetail) => undefined);
    const onSaved = jest.fn();
    const deps = makeDeps({
      notify,
      diaryEntries: { recordUpsert } as unknown as DiaryDeps['diaryEntries'],
      diaryDetails: { upsert } as unknown as DiaryDeps['diaryDetails'],
    });
    await renderSearch(deps, onSaved);

    await userEvent.press(await screen.findByLabelText('Add food, Overnight Oats'));
    // The role+name query misses modal content; the wrapper's single button is the save.
    await userEvent.press(
      within(await screen.findByTestId('manual.save')).getByRole('button'),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [receipt] = onSaved.mock.calls[0];
    expect(receipt.mealName).toBe('Breakfast');
    expect(receipt.kcalText).toBe('150 kcal added');
    expect(receipt.entryIds).toHaveLength(1);
    // The stored kcal is the derived figure, the source is manual.
    const detail = upsert.mock.calls[0][0];
    expect(detail.kcal).toBe(150);
    expect(detail.source).toBe('manual');
    expect(detail.grams).toBe(100);
    expect(recordUpsert).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalled();
    // The manual sheet closed with the save.
    await waitFor(() => expect(screen.queryByTestId('manual.save')).toBeNull());
  });

  it('the create-custom row opens the custom food sheet', async () => {
    await renderSearch(makeDeps());

    fireEvent.press(await screen.findByTestId('search.createCustom'));
    expect(await screen.findByText('Create custom food')).toBeOnTheScreen();
    expect(screen.getByTestId('custom.nameField')).toBeOnTheScreen();
  });

  it('Back dismisses the search', async () => {
    const onDismiss = jest.fn();
    await renderSearch(makeDeps(), jest.fn(), onDismiss);
    fireEvent.press(screen.getByTestId('search.back'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
