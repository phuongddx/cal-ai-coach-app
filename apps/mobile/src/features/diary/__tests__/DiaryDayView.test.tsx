/**
 * RNTL screen test of DiaryDayView (DY-01) — the copy, the identifiers of the
 * Swift DiaryDayView, the delete confirmation, the saved toast with Undo and
 * the sheet stack. The model is a test double; the ED-safe policy assertions
 * prove the components own the branch (I7).
 */
import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { setEdSafeMode } from '../../../design';

import type { DiaryDeps } from '../deps';
import type { DiaryDayItem, DiaryDaySnapshotData as DiaryDaySnapshot } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';
import { DiaryDayView } from '../screens/DiaryDayView';

const NOON = new Date(2026, 8, 12, 9, 0, 0, 0);

function makeItem(overrides: Partial<DiaryDayItem> = {}): DiaryDayItem {
  return {
    id: 'entry-1',
    title: 'Overnight Oats',
    mealSlot: 'breakfast',
    kcal: 320,
    grams: 250,
    confidence: 0.92,
    source: null,
    isSynced: true,
    loggedAt: NOON,
    entry: {
      id: 'entry-1',
      userId: 'user-1',
      displayText: 'Overnight Oats',
      createdAt: NOON,
      updatedAt: NOON,
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
      serverUpdatedAt: NOON,
    },
    detail: {
      entryId: 'entry-1',
      mealSlot: 'breakfast',
      title: 'Overnight Oats',
      grams: 250,
      kcal: 320,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      confidence: 0.92,
      hiddenFatLikely: false,
      source: null,
      unresolved: false,
      scanId: null,
    },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<DiaryDaySnapshot> = {}): DiaryDaySnapshot {
  return {
    target: {
      id: 'target-1',
      userId: 'user-1',
      dailyKcal: 2150,
      proteinG: 130,
      carbsG: 220,
      fatG: 70,
      fiberGoalG: 30,
      waterGlasses: 8,
      sex: 'female',
      heightCm: 165,
      weightKg: 82.4,
      goalWeightKg: 74,
      paceKgPerWeek: 0.5,
      activity: 'moderate',
      goal: 'lose',
      updatedAt: NOON,
    },
    sections: [
      { slot: 'breakfast', items: [makeItem()] },
      { slot: 'lunch', items: [] },
      { slot: 'dinner', items: [] },
      { slot: 'snacks', items: [] },
    ],
    exercises: [{ id: 'ex-1', type: 'running', durationMin: 30, kcalBurned: 300 }],
    ...overrides,
  };
}

function makeModel(
  snapshot: DiaryDaySnapshot = makeSnapshot(),
  overrides: Partial<DiaryDayModel> = {},
): DiaryDayModel {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    refresh: async () => undefined,
    getDay: () => NOON,
    selectDay: () => undefined,
    dayHeading: () => 'Saturday, Sep 12',
    isToday: () => false,
    eatenKcal: () => 320,
    goalKcal: () => 2150,
    leftKcal: () => 1830,
    sectionKcal: (section) => section.items.reduce((total, item) => total + (item.kcal ?? 0), 0),
    burnedKcal: () =>
      snapshot.exercises.length === 0
        ? null
        : snapshot.exercises.reduce((total, exercise) => total + (exercise.kcalBurned ?? 0), 0),
    items: (slot) => snapshot.sections.find((section) => section.slot === slot)?.items ?? [],
    delete: async () => undefined,
    deleteEntry: async () => undefined,
    updateEntry: async () => undefined,
    addExercise: async () => undefined,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<DiaryDeps> = {}): DiaryDeps {
  return {
    db: {} as DiaryDeps['db'],
    catalog: {
      savedMeals: async () => [],
    } as unknown as DiaryDeps['catalog'],
    diaryEntries: {
      recordUpserts: async (upserts: unknown[]) =>
        upserts.map((upsert, index) => ({
          opId: `op-${index}`,
          recordId: (upsert as { entry: { id: string } }).entry.id,
        })),
    } as unknown as DiaryDeps['diaryEntries'],
    diaryDetails: {} as DiaryDeps['diaryDetails'],
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

async function renderDay(model = makeModel(), deps = makeDeps()) {
  await render(<DiaryDayView model={model} deps={deps} onCapture={() => undefined} />);
  return { model, deps };
}

afterEach(() => {
  setEdSafeMode(false);
});

describe('DiaryDayView screen', () => {
  it('the day sheet renders the date pager, the summary and the sections', async () => {
    await renderDay();

    expect(screen.getByText('Saturday, Sep 12')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.previousDay')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.nextDay')).toBeOnTheScreen();
    expect(screen.getByLabelText('Eaten 320 of 2150, 1830 remaining')).toBeOnTheScreen();
    expect(screen.getByText('Breakfast')).toBeOnTheScreen();
    expect(screen.getByText('Lunch')).toBeOnTheScreen();
    expect(screen.getByText('Dinner')).toBeOnTheScreen();
    expect(screen.getByText('Snacks')).toBeOnTheScreen();
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snacks']) {
      expect(screen.getByTestId(`diary.addFood.${slot}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('Add snacks')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.foodRow')).toBeOnTheScreen();
    expect(screen.getByText('Overnight Oats')).toBeOnTheScreen();
    // The section header and the food row both show the 320 kcal figure.
    expect(screen.getAllByText('320 kcal')).toHaveLength(2);
    expect(screen.getByText('−300 kcal')).toBeOnTheScreen();
    expect(screen.getByText('300')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.exerciseRow')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.addExercise')).toBeOnTheScreen();
  });

  it('the scanned food row shows its grams with the confidence badge', async () => {
    await renderDay();

    expect(screen.getByText('250 g')).toBeOnTheScreen();
    expect(screen.getByTestId('confidence-badge:compact')).toBeOnTheScreen();
    expect(screen.queryByText('from search')).toBeNull();
  });

  it('the search-logged food row shows the source caption when it has no confidence', async () => {
    const snapshot = makeSnapshot({
      sections: [
        { slot: 'breakfast', items: [] },
        {
          slot: 'lunch',
          items: [makeItem({ id: 'entry-2', title: 'Avocado Toast', kcal: 250, grams: null, confidence: null, source: 'manual' })],
        },
        { slot: 'dinner', items: [] },
        { slot: 'snacks', items: [] },
      ],
    });
    await renderDay(makeModel(snapshot));

    expect(screen.getByText('Avocado Toast')).toBeOnTheScreen();
    expect(screen.getByText('from search')).toBeOnTheScreen();
    expect(screen.queryByTestId('confidence-badge:compact')).not.toBeOnTheScreen();
  });

  it('the food row carries the confidence badge and the sync chip when pending', async () => {
    const snapshot = makeSnapshot({
      sections: [
        {
          slot: 'breakfast',
          items: [makeItem({ isSynced: false, confidence: 0.61 })],
        },
        { slot: 'lunch', items: [] },
        { slot: 'dinner', items: [] },
        { slot: 'snacks', items: [] },
      ],
    });
    await renderDay(makeModel(snapshot));

    expect(screen.getByTestId('confidence-badge:compact')).toBeOnTheScreen();
    expect(screen.getByText('Syncs later')).toBeOnTheScreen();
  });

  it('the next day pager button is disabled on today', async () => {
    await renderDay(makeModel(makeSnapshot(), { isToday: () => true }));
    expect(screen.getByTestId('diary.nextDay').props.accessibilityState.disabled).toBe(true);
    // GlassIconButton (the previous-day button) carries no disabled state; it
    // is never disabled.
    expect(screen.getByTestId('diary.previousDay').props.accessibilityState?.disabled ?? false).toBe(false);
  });

  it('a long press on the food row opens the delete confirmation and Delete tombstones', async () => {
    const model = makeModel(makeSnapshot(), { delete: jest.fn(async () => undefined) });
    await renderDay(model);

    fireEvent(screen.getByTestId('diary.foodRow'), 'longPress');
    expect(await screen.findByText('Delete Overnight Oats?')).toBeOnTheScreen();
    expect(screen.getByText('This removes 320 kcal from Breakfast.')).toBeOnTheScreen();

    await userEvent.press(screen.getByText('Delete item'));
    await waitFor(() => expect(model.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' })));
    await waitFor(() => expect(screen.queryByText('Delete Overnight Oats?')).toBeNull());
  });

  it('Cancel leaves the entry in place', async () => {
    const model = makeModel(makeSnapshot(), { delete: jest.fn(async () => undefined) });
    await renderDay(model);

    fireEvent(screen.getByTestId('diary.foodRow'), 'longPress');
    await userEvent.press(await screen.findByText('Cancel'));
    expect(model.delete).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Delete Overnight Oats?')).toBeNull());
  });

  it('Add food opens the add-food sheet with the empty rail', async () => {
    await renderDay();

    await userEvent.press(
      within(screen.getByTestId('diary.addFood.breakfast')).getByRole('button'),
    );
    expect(await screen.findByText('to Breakfast')).toBeOnTheScreen();
    expect(screen.getByTestId('addfood.savedMealsEmpty')).toBeOnTheScreen();
    expect(screen.getByText('Save a meal and re-log it here in one tap.')).toBeOnTheScreen();
  });

  it('a saved-meal re-log writes the batch, notifies, dismisses and toasts with Undo', async () => {
    const notify = jest.fn();
    const recordUpserts = jest.fn(async (upserts: unknown[]) =>
      upserts.map((upsert, index) => ({
        opId: `op-${index}`,
        recordId: (upsert as { entry: { id: string } }).entry.id,
      })),
    );
    const deps = makeDeps({
      notify,
      diaryEntries: { recordUpserts } as unknown as DiaryDeps['diaryEntries'],
      catalog: {
        savedMeals: async () => [
          {
            id: 'meal-1',
            userId: 'user-1',
            name: 'Chicken Rice Bowl',
            symbol: null,
            kcal: 464,
            itemsJson: '[{"name":"Chicken Rice Bowl","grams":320,"kcal":464}]',
            createdAt: NOON,
          },
        ],
      } as unknown as DiaryDeps['catalog'],
    });
    const model = makeModel(makeSnapshot(), { deleteEntry: jest.fn(async () => undefined) });
    await renderDay(model, deps);

    await userEvent.press(
      within(screen.getByTestId('diary.addFood.breakfast')).getByRole('button'),
    );
    const mealCard = await screen.findByTestId('addfood.savedMeal');
    await userEvent.press(mealCard);

    expect(await screen.findByTestId('diary.toast')).toBeOnTheScreen();
    expect(screen.getByText('Saved to Breakfast')).toBeOnTheScreen();
    expect(screen.getByText('464 kcal added')).toBeOnTheScreen();
    expect(recordUpserts).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalled();
    // The add-food sheet closed with the receipt (the dashed tiles remain).
    await waitFor(() => expect(screen.queryByText('to Breakfast')).toBeNull());

    // Undo tombstones every entry of the receipt.
    await userEvent.press(screen.getByText('Undo'));
    await waitFor(() => expect(model.deleteEntry).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001'));
  });

  it('Add exercise opens the exercise sheet', async () => {
    await renderDay();

    await userEvent.press(
      within(screen.getByTestId('diary.addExercise')).getByRole('button'),
    );
    expect(await screen.findByTestId('exercise.typeField')).toBeOnTheScreen();
  });

  it('the summary card and the kcal clauses hide in the ED-safe mode', async () => {
    setEdSafeMode(true);
    await renderDay();

    expect(screen.queryByLabelText(/Eaten 320/)).toBeNull();
    expect(screen.queryByText('320 kcal')).toBeNull();
    expect(screen.queryByText('−300 kcal')).toBeNull();
    expect(screen.queryByText('300')).toBeNull();
    // The water-independent surfaces stay.
    expect(screen.getByText('Breakfast')).toBeOnTheScreen();
  });

  it('a tap on the food row opens the edit sheet of the entry', async () => {
    const updateEntry = jest.fn(async () => undefined);
    const model = makeModel(makeSnapshot(), { updateEntry });
    await renderDay(model);

    await userEvent.press(screen.getByTestId('diary.foodRow'));
    expect(await screen.findByTestId('diary.edit')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.edit.close')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.edit.grams.entry-1')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.edit.save')).toBeOnTheScreen();
    // The total card: the stored kcal as the "was" figure, the recomputed figure beside it.
    const totalCard = screen.getByText(/Total · was/).parent as unknown as ReturnType<typeof screen.getByTestId>;
    expect(within(totalCard).getByText('320')).toBeOnTheScreen();

    // A gram change recomputes the kcal from the entry's per-100g basis:
    // 320/250 × 100 = 128 per100g → 128 × 260 / 100 → 333.
    await userEvent.press(within(screen.getByTestId('diary.edit.grams.entry-1')).getByTestId('ccstepper.increment'));
    await waitFor(() => expect(within(totalCard).getByText('333')).toBeOnTheScreen());

    await userEvent.press(within(screen.getByTestId('diary.edit.save')).getByRole('button'));
    await waitFor(() =>
      expect(updateEntry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entry-1' }),
        260,
        'Overnight Oats',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('diary.edit')).toBeNull());
  });

  it('the edit sheet renames the entry through the save', async () => {
    const updateEntry = jest.fn(async () => undefined);
    const model = makeModel(makeSnapshot(), { updateEntry });
    await renderDay(model);

    await userEvent.press(screen.getByTestId('diary.foodRow'));
    await userEvent.type(await screen.findByLabelText('Name'), ' overnight');

    await userEvent.press(within(screen.getByTestId('diary.edit.save')).getByRole('button'));
    await waitFor(() =>
      expect(updateEntry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entry-1' }),
        250,
        'Overnight Oats overnight',
      ),
    );
  });

  it('the edit sheet Delete item opens the delete confirmation', async () => {
    const model = makeModel(makeSnapshot(), { delete: jest.fn(async () => undefined) });
    await renderDay(model);

    await userEvent.press(screen.getByTestId('diary.foodRow'));
    await userEvent.press(await screen.findByText('Delete item'));
    expect(await screen.findByText('Delete Overnight Oats?')).toBeOnTheScreen();
    // Cancel leaves the entry in place.
    await userEvent.press(screen.getByText('Cancel'));
    expect(model.delete).not.toHaveBeenCalled();
  });

  it('the edit sheet Close changes nothing', async () => {
    const updateEntry = jest.fn(async () => undefined);
    const model = makeModel(makeSnapshot(), { updateEntry });
    await renderDay(model);

    await userEvent.press(screen.getByTestId('diary.foodRow'));
    await userEvent.press(await screen.findByTestId('diary.edit.close'));
    expect(updateEntry).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('diary.edit')).toBeNull());
  });

  it('the edit sheet kcal hides in the ED-safe mode and returns when it is off', async () => {
    await renderDay();
    await userEvent.press(screen.getByTestId('diary.foodRow'));
    expect(await screen.findByTestId('diary.edit')).toBeOnTheScreen();
    expect(screen.getByText('kcal')).toBeOnTheScreen();

    setEdSafeMode(true);
    await waitFor(() => expect(screen.queryByText('kcal')).toBeNull());
    // The leaf note takes the total card's place.
    expect(screen.getByText('Adjust the grams if the portion looks off.')).toBeOnTheScreen();
    expect(screen.getByText('Numbers are hidden in ED-Safe mode.')).toBeOnTheScreen();
    // Grams and Save stay.
    expect(screen.getByTestId('diary.edit.grams.entry-1')).toBeOnTheScreen();
    expect(screen.getByTestId('diary.edit.save')).toBeOnTheScreen();

    setEdSafeMode(false);
    await waitFor(() => expect(screen.getByText('kcal')).toBeOnTheScreen());
    expect(screen.queryByText('Numbers are hidden in ED-Safe mode.')).toBeNull();
  });
});
