/**
 * RNTL screen test of TodayView (TD-01): the identifiers of the Swift TodayView, the copy, the offline
 * banner, the Diary entry points, the water sheet and the Scan button. The model is the real one over
 * test-double readers; the ED-safe assertions prove the design components own the branch (I7).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { lightColors, setEdSafeMode } from '../../../design';
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
    expect(ring.getByText('kcal left')).toBeOnTheScreen(); // U-76: the frame's label (was "remaining")
    expect(within(screen.getByTestId('today.eaten')).getByText('784')).toBeOnTheScreen();
    expect(within(screen.getByTestId('today.goalKcal')).getByText('2,150')).toBeOnTheScreen(); // U-76: was the line "of 2,150 kcal goal"
    expect(screen.getByText('12 / 30 g')).toBeOnTheScreen(); // fiber 6 + 6 (U-76: was "12/30g")
  });

  it('lists the meals as today.foodRow with the title-only label, newest data from the model', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320), meal('b', 'Chicken Bowl', 464, { mealSlot: 'lunch' })]);
    await render(inProvider(<TodayView model={model} />));
    const rows = within(screen.getByTestId('today.recentMeals')).getAllByTestId('today.foodRow');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Meal: Oats', 'Meal: Chicken Bowl']);
    expect(screen.getByText('Breakfast · 9:00 AM')).toBeOnTheScreen();
  });

  it('shows the offline chip in the header only when offline', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} isOffline />));
    // U-76 (frame 08): a caution chip in the header; the info banner of the earlier screen is gone
    expect(within(screen.getByTestId('offline.badge')).getByText('Offline · syncs later')).toBeOnTheScreen();
    expect(screen.queryByText("You're offline — logging still works. Changes sync when you're back online.")).toBeNull();
    await screen.rerender(inProvider(<TodayView model={model} isOffline={false} />));
    expect(screen.queryByTestId('offline.badge')).toBeNull();
    expect(screen.queryByText('Offline · syncs later')).toBeNull();
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

  // U-76: the header of the frame
  it('puts the date over the title and the calendar glass button on the right', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    expect(within(screen.getByTestId('today.dateSelector')).getByText('Saturday, 12 Sep')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    const button = screen.getByTestId('today.openDiary');
    expect(button.props.accessibilityLabel).toBe('Open diary');
    expect(within(button).getByTestId('icon:cal')).toBeOnTheScreen();
  });

  it('the Diary link of the Meals head opens the diary for the selected day', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    const onOpenDiary = jest.fn();
    await render(inProvider(<TodayView model={model} onOpenDiary={onOpenDiary} />));
    expect(screen.getByRole('header', { name: 'Meals' })).toBeOnTheScreen();
    const link = screen.getByTestId('today.mealsDiary');
    expect(within(link).getByText('Diary')).toBeOnTheScreen();
    await fireEvent.press(link);
    expect(onOpenDiary.mock.calls[0]![0]).toBe(model.getSnapshot().selectedDay);
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

  // U-76: the two placeholder cards are not in the frames; both showed a dash.
  it('draws no Health Score card and no Steps card', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.queryByTestId('today.healthScore')).toBeNull();
    expect(screen.queryByTestId('today.stepsCard')).toBeNull();
    expect(screen.queryByText('Health Score')).toBeNull();
    expect(screen.queryByText('Steps')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('does not ask HealthKit for the steps when the screen appears', async () => {
    const { model } = await makeModel([]);
    const spy = jest.spyOn(model, 'loadStepsIfNeeded');
    await render(inProvider(<TodayView model={model} />));
    expect(spy).not.toHaveBeenCalled();
  });

  // U-76: the ember card
  it('shows Eaten and Goal beside the ring, with the grouped numbers of the frame', async () => {
    const { model } = await makeModel([meal('a', 'Big lunch', 1284, { mealSlot: 'lunch' })], {
      target: { ...TARGET, dailyKcal: 2100 },
    });
    await render(inProvider(<TodayView model={model} />));
    const ring = within(screen.getByTestId('today.ring'));
    expect(ring.getByText('816')).toBeOnTheScreen();
    expect(within(screen.getByTestId('today.eaten')).getByText('Eaten')).toBeOnTheScreen();
    expect(within(screen.getByTestId('today.eaten')).getByText('1,284')).toBeOnTheScreen();
    expect(within(screen.getByTestId('today.goalKcal')).getByText('Goal')).toBeOnTheScreen();
    expect(within(screen.getByTestId('today.goalKcal')).getByText('2,100')).toBeOnTheScreen();
    expect(screen.queryByText('Burned')).toBeNull(); // needs the Apple Health steps, which the app does not read yet
  });

  it('keeps a four-digit number left on one line (props the ring passes; the pixels are stage B)', async () => {
    const { model } = await makeModel([], { target: { ...TARGET, dailyKcal: 2150 } });
    await render(inProvider(<TodayView model={model} />));
    const number = within(screen.getByTestId('today.ring')).getByText('2150');
    expect(number).toHaveProp('numberOfLines', 1);
    expect(number).toHaveProp('adjustsFontSizeToFit', true);
  });

  // U-76: the macro grid
  it('lays the four macros out as a 2 by 2 grid whose labels and values never wrap', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320, { proteinG: 82, carbsG: 140, fatG: 38, fiberG: 14 })]);
    await render(inProvider(<TodayView model={model} />));
    const expected = { protein: ['Protein', '82 / 130 g'], carbs: ['Carbs', '140 / 220 g'], fat: ['Fat', '38 / 70 g'], fiber: ['Fiber', '14 / 30 g'] };
    for (const [key, [label, value]] of Object.entries(expected)) {
      const cell = within(screen.getByTestId(`today.macroCard.${key}`));
      expect(cell.getByText(label!)).toHaveProp('numberOfLines', 1);
      const valueText = cell.getByText(value!);
      expect(valueText).toHaveProp('numberOfLines', 1);
      expect(valueText).toHaveProp('adjustsFontSizeToFit', true);
    }
    expect(screen.getByTestId('today.macroCard.protein').props.accessibilityLabel).toBe('Protein 82 of 130 grams');
    expect(screen.getAllByTestId(/^today\.macroCard\./)).toHaveLength(4);
    // two rows of two cells: the grid never holds a third column
    const rows = screen.getAllByTestId('today.macroRow');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getAllByTestId(/^today\.macroCard\./)).toHaveLength(2);
    expect(within(rows[1]!).getAllByTestId(/^today\.macroCard\./)).toHaveLength(2);
  });

  // U-76: the streak card and the meals
  it('shows the streak as the frame does: flame tile, title and freeze line', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    const streak = within(screen.getByTestId('today.streakCard'));
    expect(streak.getByTestId('icon:flame')).toBeOnTheScreen();
    expect(streak.getByText('12-day streak')).toBeOnTheScreen();
    expect(streak.getByText('1 freeze available')).toBeOnTheScreen();
    expect(streak.getByLabelText('12 day streak, 1 freeze left')).toBeOnTheScreen();
  });

  it('adds "syncs later" to a meal that waits for the sync and to no other', async () => {
    const { model } = await makeModel([
      meal('a', 'Oats', 320, { isSynced: true }),
      meal('b', 'Chicken Bowl', 464, { mealSlot: 'lunch', isSynced: false }),
    ]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.getByText('Breakfast · 9:00 AM')).toBeOnTheScreen();
    expect(screen.getByText('Lunch · 9:00 AM · syncs later')).toBeOnTheScreen();
    expect(screen.getAllByText(/syncs later/)).toHaveLength(1);
  });

  it('says so under Meals when the day has none', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    expect(within(screen.getByTestId('today.recentMeals')).getByText('No meals logged yet')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('today.foodRow')).toHaveLength(0);
  });

  it('keeps the water card mounted in the normal mode and the ED-safe mode', async () => {
    const { model } = await makeModel([]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.getByTestId('today.waterCard')).toBeOnTheScreen();
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('today.waterCard')).toBeOnTheScreen();
  });

  it('under ED-safe the components drop Eaten and Goal, the number left and the meal kcal; the streak stays', async () => {
    setEdSafeMode(true);
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    expect(within(screen.getByTestId('today.ring')).getByLabelText('On track')).toBeOnTheScreen();
    // U-76: was the goal line "of N kcal goal". The identifiers stay on empty wrappers (frame 09).
    expect(within(screen.getByTestId('today.eaten')).queryByText(/./)).toBeNull();
    expect(within(screen.getByTestId('today.goalKcal')).queryByText(/./)).toBeNull();
    expect(screen.queryByText('Eaten')).toBeNull();
    expect(screen.queryByText('Goal')).toBeNull();
    expect(screen.queryByText('kcal left')).toBeNull();
    expect(screen.queryByTestId('today.healthScore')).toBeNull();
    expect(screen.queryByTestId('food-row-kcal:Oats')).toBeNull();
    expect(screen.getByTestId('today.streakCard')).toBeOnTheScreen();
  });

  // U-76 (frame 09): the guidance sentence replaces the numbers; the meal comes from the clock (09:00: breakfast)
  it('under ED-safe shows the guidance sentence naming the next meal by the clock, and no number', async () => {
    setEdSafeMode(true);
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    const guidance = screen.getByTestId('today.edSafeGuidance');
    expect(within(guidance).getByText(/Steady meals keep energy even\./)).toBeOnTheScreen();
    expect(within(guidance).getByText('Breakfast is next.')).toBeOnTheScreen();
    expect(guidance.props.accessibilityLabel).toBe('Steady meals keep energy even. Breakfast is next.');
    expect(within(screen.getByTestId('today.ring')).queryByText(/\d{3,}/)).toBeNull(); // no kcal figure inside the card
  });

  it('shows no guidance sentence while ED-safe is off', async () => {
    const { model } = await makeModel([meal('a', 'Oats', 320)]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.queryByTestId('today.edSafeGuidance')).toBeNull();
    expect(screen.queryByText(/Steady meals keep energy even/)).toBeNull();
  });

  it('under ED-safe the macro grid, the water card and the badges stay and no red over state is drawn', async () => {
    setEdSafeMode(true);
    const { model } = await makeModel([meal('a', 'Oats', 5000, { proteinG: 400 })]);
    await render(inProvider(<TodayView model={model} />));
    expect(screen.getAllByTestId(/^today\.macroCard\./)).toHaveLength(4);
    expect(screen.getByTestId('today.waterCard')).toBeOnTheScreen();
    expect(screen.queryByText(/over/i)).toBeNull();
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

  it('draws a camera glyph on the accent fill at the fab size (U-76, frame: orange with a camera)', async () => {
    await render(inProvider(<ScanFab onPress={jest.fn()} />));
    const fab = screen.getByTestId('shell.fab');
    expect(within(fab).getByTestId('icon:camera')).toBeOnTheScreen();
    expect(fab).toHaveStyle({ width: 62, height: 62, backgroundColor: lightColors.accent });
  });
});
