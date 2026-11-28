/**
 * The undo-toast QUEUE of DiaryDayView (the review correction): a second
 * delete or edit must not cut the five-second window of the first — each
 * undo waits its turn, its window counts from the moment its toast appears,
 * the oldest shows first, and Undo undoes that one. The model is a test
 * double; the ActionSheetIOS callback drives the deletes. Real timers: the
 * windows are the real five seconds, bracketed by waitFor timeouts, so no
 * fake clock sits between React and the scheduler.
 */
import { ActionSheetIOS } from 'react-native';
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import type { DiaryDeps } from '../deps';

/**
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; the
 * app-side renders and the test-side acts must share one React copy, or the
 * act scopes split and commits go missing. See findings/U-22.md.
 */
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
import type { DiaryDayItem, DiaryDaySnapshotData as DiaryDaySnapshot } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';
import { DiaryDayView } from '../screens/DiaryDayView';

const NOON = new Date(2026, 8, 12, 9, 0, 0, 0);

/** One undo window, in wall-clock milliseconds (the view's own constant is 5000). */
const WINDOW = 5000;
const CASE_TIMEOUT = 30_000;

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
    exercises: [],
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
    burnedKcal: () => null,
    items: (slot) => snapshot.sections.find((section) => section.slot === slot)?.items ?? [],
    delete: async () => undefined,
    deleteEntry: async () => undefined,
    updateEntry: async () => undefined,
    undoDelete: async () => undefined,
    writeEntry: async () => undefined,
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
    diaryEntries: {} as DiaryDeps['diaryEntries'],
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

/** Two deletable rows: Overnight Oats (breakfast) and Avocado Toast (lunch). */
function twoItemSnapshot(): DiaryDaySnapshot {
  return makeSnapshot({
    sections: [
      { slot: 'breakfast', items: [makeItem()] },
      {
        slot: 'lunch',
        items: [makeItem({ id: 'entry-2', title: 'Avocado Toast', kcal: 250, grams: null, confidence: null, source: 'manual' })],
      },
      { slot: 'dinner', items: [] },
      { slot: 'snacks', items: [] },
    ],
  });
}


async function renderQueue(model: DiaryDayModel): Promise<void> {
  await render(<DiaryDayView model={model} deps={makeDeps()} onCapture={() => undefined} />);
}

beforeAll(() => {
  // The enqueue microtasks and the five-second window timers fire outside
  // fireEvent's act scope; with the act environment on, their commits land
  // through the scheduler and waitFor observes them.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DiaryDayView undo queue', () => {
  it('the edit sheet Delete item opens the delete confirmation after the sheet closes', async () => {
    const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    const model = makeModel(makeSnapshot(), { delete: jest.fn(async () => undefined) });
    await renderQueue(model);

    fireEvent.press(await screen.findByTestId('diary.foodRow'));
    fireEvent.press(await screen.findByText('Delete item'));
    // The press must not present the sheet in the same tick that closes the
    // sheet on this iOS (the stage-B finding): nothing presents until the
    // deferred tick.
    expect(showActionSheet).not.toHaveBeenCalled();
    await waitFor(() => expect(showActionSheet).toHaveBeenCalledTimes(1));
    const [options] = showActionSheet.mock.calls[0] as unknown as [
      { title: string; message: string },
      (index: number) => void,
    ];
    expect(options.title).toBe('Delete Overnight Oats?');
    expect(model.delete).not.toHaveBeenCalled();
  }, CASE_TIMEOUT);

  it('an edit saved behind a delete queues its undo toast the same way', async () => {
    const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    const updateEntry = jest.fn(async () => undefined);
    const writeEntry = jest.fn(async () => undefined);
    const model = makeModel(twoItemSnapshot(), { delete: jest.fn(async () => undefined), updateEntry, writeEntry });
    await renderQueue(model);

    const rows = await screen.findAllByTestId('diary.foodRow');
    fireEvent(rows[0], 'longPress');
    const [, callback] = showActionSheet.mock.calls[0] as unknown as [(index: number) => void, (index: number) => void];
    callback(0);
    await waitFor(() => expect(screen.getByTestId('diary.toast.undo')).toBeOnTheScreen());

    // An edit saved while the delete toast waits queues behind it.
    fireEvent.press(rows[1]);
    fireEvent.press(within(await screen.findByTestId('diary.edit.save')).getByRole('button'));
    await waitFor(() => expect(screen.getByText('Overnight Oats deleted')).toBeOnTheScreen());
    expect(screen.queryByText('Changes saved')).toBeNull();

    // The delete window ends; the edit toast appears and counts its own five.
    await waitFor(() => expect(screen.getByTestId('diary.toast.undoEdit')).toBeOnTheScreen(), { timeout: WINDOW + 2000 });
    expect(screen.getByText('Changes saved')).toBeOnTheScreen();

    await waitFor(() => expect(screen.queryByTestId('diary.toast.undoEdit')).toBeNull(), { timeout: WINDOW + 2000 });
  }, CASE_TIMEOUT);

  it('a second delete queues its undo window behind the first: two full windows in order', async () => {
    const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    const undoDelete = jest.fn(async () => undefined);
    const model = makeModel(twoItemSnapshot(), { delete: jest.fn(async () => undefined), undoDelete });
    await renderQueue(model);

    const rows = await screen.findAllByTestId('diary.foodRow');
    fireEvent(rows[0], 'longPress');
    const [, firstCallback] = showActionSheet.mock.calls[0] as unknown as [(index: number) => void, (index: number) => void];
    firstCallback(0);
    await waitFor(() => expect(screen.getByTestId('diary.toast.undo')).toBeOnTheScreen());
    expect(screen.getByText('Overnight Oats deleted')).toBeOnTheScreen();

    // The second delete queues: the first toast keeps its window.
    fireEvent(rows[1], 'longPress');
    const [, secondCallback] = showActionSheet.mock.calls[1] as unknown as [(index: number) => void, (index: number) => void];
    secondCallback(0);
    // The second delete's enqueue lands its microtask before the assertions.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await waitFor(() => expect(screen.getByText('Overnight Oats deleted')).toBeOnTheScreen());
    expect(screen.queryByText('Avocado Toast deleted')).toBeNull();

    // The first window runs its full five seconds; the queued toast appears
    // then and counts its own five from its appearance.
    await waitFor(() => expect(screen.getByText('Avocado Toast deleted')).toBeOnTheScreen(), { timeout: WINDOW + 2000 });
    expect(screen.queryByText('Overnight Oats deleted')).toBeNull();

    await waitFor(() => expect(screen.queryByTestId('diary.toast.undo')).toBeNull(), { timeout: WINDOW + 2000 });
  }, CASE_TIMEOUT);

  it('the undo undoes the oldest toast first: the first deleted entry, not the queued one', async () => {
    const showActionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    const undoDelete = jest.fn(async () => undefined);
    const model = makeModel(twoItemSnapshot(), { delete: jest.fn(async () => undefined), undoDelete });
    await renderQueue(model);

    const rows = await screen.findAllByTestId('diary.foodRow');
    fireEvent(rows[0], 'longPress');
    fireEvent(rows[1], 'longPress');
    const [, firstCallback] = showActionSheet.mock.calls[0] as unknown as [(index: number) => void, (index: number) => void];
    const [, secondCallback] = showActionSheet.mock.calls[1] as unknown as [(index: number) => void, (index: number) => void];
    await act(async () => {
      firstCallback(0);
      await waitFor(() => expect(screen.getByTestId('diary.toast.undo')).toBeOnTheScreen());
    });
    await act(async () => {
      secondCallback(0);
      await waitFor(() => expect(screen.getByText('Overnight Oats deleted')).toBeOnTheScreen());
    });

    // The visible toast is the oldest: its Undo undoes the first deleted
    // entry, and only that one — the queued second entry waits its turn.
    await userEvent.press(within(screen.getByTestId('diary.toast.undo')).getByText('Undo'));
    await waitFor(() => expect(undoDelete).toHaveBeenCalledTimes(1));
    expect(undoDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' }));
    expect(undoDelete).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-2' }));

    // Drain the queue's pending renders before the test ends.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }, CASE_TIMEOUT);
});
