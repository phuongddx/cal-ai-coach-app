/**
 * RNTL screen test of TodayView (TD-01): the identifiers of the Swift TodayView, the copy, the offline
 * banner, the Diary entry points, the water sheet and the Scan button. The model is the real one over
 * test-double readers; the ED-safe assertions prove the design components own the branch (I7).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setEdSafeMode } from '../../../design';
import type { UserTarget } from '../../../data/repos/targetRepository';
import { ScanFab } from '../ScanFab';
import { FAB_BOTTOM_PADDING } from '../ScanFab';
import { TODAY_BOTTOM_INSET, TodayView, todayBottomPadding } from '../TodayView';
import { createTodayModel, type TodayMeal, type TodayModel, type TodayReaders } from '../todayModel';

const metrics = { frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } };
const inProvider = (ui: ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;

const NOW = new Date(2026, 8, 12, 9, 0, 0, 0);

const TARGET: UserTarget = {
  id: 't',
  userId: 'u',
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
  updatedAt: NOW,
};

function meal(id: string, title: string, kcal: number, overrides: Partial<TodayMeal> = {}): TodayMeal {
  return {
    id,
    title,
    mealSlot: 'breakfast',
    kcal,
    grams: 250,
    proteinG: 20,
    carbsG: 40,
    fatG: 10,
    fiberG: 6,
    confidence: 0.92,
    isSynced: true,
    loggedAt: NOW,
    ...overrides,
  };
}

async function makeModel(meals: TodayMeal[], opts: { target?: UserTarget | null; water?: number } = {}) {
  const addWater = jest.fn(async () => undefined);
  const notify = jest.fn();
  const readers: TodayReaders = {
    meals: async () => meals,
    activeTarget: async () => (opts.target === undefined ? TARGET : opts.target),
    waterMl: async () => opts.water ?? 1250,
    streakState: async () => ({
      currentStreak: 12,
      longestStreak: 20,
      freezesLeft: 1,
      lastLoggedDay: '2026-09-12',
    }) as never,
  };
  const model: TodayModel = createTodayModel({
    readers,
    addWater,
    notify,
    subscribe: () => () => undefined,
    now: () => NOW,
    ownerId: 'u',
  });
  await model.refresh();
  return { model, addWater, notify };
}

afterEach(() => setEdSafeMode(false));

describe('TodayView', () => {
  it('shows the totals computed from the meals through the core rule', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320), meal('b', 'Chicken Bowl', 464, { mealSlot: 'lunch' })]);
    await render(inProvider(<TodayView model={model} />));
    const ring = within(screen.getByTestId('today.ring'));
    // 2150 − (320 + 464) = 1366 remaining
    expect(ring.getByLabelText('1366 calories remaining of 2150 goal')).toBeOnTheScreen();
    expect(screen.getByText('of 2,150 kcal goal')).toBeOnTheScreen();
    expect(screen.getByText('12/30g')).toBeOnTheScreen(); // fiber 6 + 6
  });

  it('lists the meals as today.foodRow with the title-only label, newest data from the model', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320), meal('b', 'Chicken Bowl', 464, { mealSlot: 'lunch' })]);
    await render(inProvider(<TodayView model={model} />));
    const rows = within(screen.getByTestId('today.recentMeals')).getAllByTestId('today.foodRow');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Meal: Oats', 'Meal: Chicken Bowl']);
    expect(screen.getByText('Breakfast · 9:00 AM')).toBeOnTheScreen();
  });

  it('shows the offline banner and badge only when offline', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} isOffline />));
    expect(screen.getByText("You're offline — logging still works. Changes sync when you're back online.")).toBeOnTheScreen();
    expect(screen.getByTestId('offline.badge')).toBeOnTheScreen();
    await screen.rerender(inProvider(<TodayView model={model} isOffline={false} />));
    expect(screen.queryByTestId('offline.badge')).toBeNull();
  });

  it('the date selector toggles the week strip', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.getByTestId('today.weekStrip')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('today.dateSelector'));
    expect(screen.queryByTestId('today.weekStrip')).toBeNull();
    await fireEvent.press(screen.getByTestId('today.dateSelector'));
    expect(screen.getByTestId('today.weekStrip')).toBeOnTheScreen();
  });

  it('marks the selected day cell and exposes the weekday-and-date label', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    const cells = screen.getAllByTestId('today.dayCell');
    expect(cells[6]!.props.accessibilityLabel).toBe('Saturday, September 12');
    expect(cells[6]!.props.accessibilityState).toMatchObject({ selected: true });
    expect(cells[5]!.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('a meal row and the Open diary link open the diary for that day', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    const onOpenDiary = jest.fn();
    await render(inProvider(<TodayView model={model} onOpenDiary={onOpenDiary} />));
    await fireEvent.press(screen.getByTestId('today.foodRow'));
    expect(onOpenDiary).toHaveBeenLastCalledWith(NOW);
    await fireEvent.press(screen.getByTestId('today.openDiary'));
    expect(onOpenDiary).toHaveBeenCalledTimes(2);
    expect(onOpenDiary.mock.calls[1]![0]).toBe(model.getSnapshot().selectedDay);
  });

  it('the water card opens the water sheet and a quick add writes through the model', async () => {
    const { model, addWater, notify } = await makeModel([], { water: 1250 });
    await render(inProvider(<TodayView model={model} />));
    await fireEvent.press(screen.getByTestId('today.waterCard'));
    await waitFor(() => expect(screen.getByTestId('water.add')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('water.add'));
    expect(addWater).toHaveBeenCalledWith(250, '2026-09-12', 'u', NOW);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('the Steps card shows "—" while no HealthKit reader exists', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    const steps = screen.getByTestId('today.stepsCard');
    expect(within(steps).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('under ED-safe the components drop the goal line, the Health Score card and the meal kcal; the streak stays', async () => {
    setEdSafeMode(true);
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    expect(within(screen.getByTestId('today.ring')).getByLabelText('On track')).toBeOnTheScreen();
    expect(screen.queryByText(/kcal goal/)).toBeNull();
    expect(screen.queryByTestId('today.healthScore')).toBeNull();
    expect(screen.queryByTestId('food-row-kcal:Oats')).toBeNull();
    expect(screen.getByTestId('today.streakCard')).toBeOnTheScreen();
  });

  it('reserves the bottom inset below the last meal so the Scan button never covers a kcal', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    const style = screen.getByTestId('today.scroll').props.contentContainerStyle;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.flat()) : style;
    expect(flat.paddingBottom).toBe(todayBottomPadding(34)); // the jest safe-area mock has a 34pt bottom inset
    expect(TODAY_BOTTOM_INSET).toBe(48);
    // the list clears the whole Scan button (offset + height) plus the xl5 gap, and grows with the safe area
    // 62 is `--fab` of tokens.css (it was the hand-written 56 before U-71d)
    expect(todayBottomPadding(0)).toBe(FAB_BOTTOM_PADDING + 62 + 48);
    expect(todayBottomPadding(34)).toBe(34 + FAB_BOTTOM_PADDING + 62 + 48);
  });
});

describe('ScanFab', () => {
  it('is the shell.fab button labelled "Scan food" and fires onPress', async () => {
    const onPress = jest.fn();
    await render(inProvider(<ScanFab onPress={onPress} />));
    const fab = screen.getByTestId('shell.fab');
    expect(fab.props.accessibilityLabel).toBe('Scan food');
    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
