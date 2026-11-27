/**
 * Jest twin of native/App/CoachCalTests/TodayDiarySnapshotTests.swift `todayScreenSnapshotMatrix` and of
 * the three UI tests of native/App/CoachCalUITests/TodayScreenTests.swift — one case per Swift test,
 * the same sentence. The screen runs over a fresh seeded sql.js database (the Swift snapshot test uses a
 * fresh seeded GRDB pool), the real readers and the real repositories; only the clock is fixed.
 *
 * Documented adaptations (parity-detail/today.md):
 *  - A pixel snapshot cannot run in Jest. The matrix asserts what the Swift snapshot shows in each of the
 *    four states (the ring label, the goal line, the Health Score card, the meals with and without kcal);
 *    the pixels are the Simulator screenshots of TD-01.
 *  - The Swift UI tests launch the app with `--cc*` arguments; here the seed is the same persona
 *    (`createSeedDataManager`) and the ED-safe launch argument is the design setter.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Appearance } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { DEMO_USER_ID, createSeedDataManager } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { setEdSafeMode } from '../../../design';
import { createTodayModel, type TodayModel } from '../todayModel';
import { createTodayReaders } from '../todayReaders';
import { TodayView } from '../TodayView';

const metrics = { frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } };
const inProvider = (ui: ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;

/** 2026-09-12 09:00 local — the clock of the Swift snapshot tests' seeded day. */
const NOW = new Date(2026, 8, 12, 9, 0, 0, 0);

type Screen = { fixture: RepoFixture; model: TodayModel; notifies: () => number };

async function makeScreen(opts: { seed?: boolean } = {}): Promise<Screen> {
  const fixture = await createRepoFixture();
  fixture.setClock(NOW.getTime());
  if (opts.seed !== false) {
    await createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId }).ensureSeeded();
  }
  const tracking = createTrackingRepository(fixture.db, { newId: fixture.newId });
  let notifies = 0;
  const listeners = new Set<() => void>();
  const model = createTodayModel({
    readers: createTodayReaders({
      db: fixture.db,
      targets: createTargetRepository(fixture.db),
      tracking,
      engagement: createEngagementRepository(fixture.db),
    }),
    addWater: (ml, day, owner, at) => tracking.addWater(ml, day, owner, at),
    notify: () => {
      notifies += 1;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    now: fixture.clock,
    ownerId: DEMO_USER_ID,
  });
  await model.refresh();
  return { fixture, model, notifies: () => notifies };
}

afterEach(() => {
  setEdSafeMode(false);
  Appearance.setColorScheme('unspecified');
});

describe('TodayDiarySnapshotTests twins', () => {
  // todayScreenSnapshotMatrix
  it('todayScreenSnapshotMatrix', async () => {
    const { model } = await makeScreen();
    const states: Array<{ name: string; safeMode: boolean; scheme: 'light' | 'dark' }> = [
      { name: 'today-light', safeMode: false, scheme: 'light' },
      { name: 'today-dark', safeMode: false, scheme: 'dark' },
      { name: 'today-edsafe-light', safeMode: true, scheme: 'light' },
      { name: 'today-edsafe-dark', safeMode: true, scheme: 'dark' },
    ];
    for (const state of states) {
      setEdSafeMode(state.safeMode);
      Appearance.setColorScheme(state.scheme);
      const view = await render(inProvider(<TodayView model={model} />));

      // The seeded day: today carries Spaghetti Bolognese (350 g × 155 kcal/100 g = 543).
      expect(screen.getByText('Spaghetti Bolognese')).toBeOnTheScreen();
      expect(screen.getByTestId('today.streakCard')).toBeOnTheScreen();
      expect(screen.getByTestId('today.weekStrip')).toBeOnTheScreen();
      expect(screen.getAllByTestId('today.dayCell')).toHaveLength(7);

      const ring = within(screen.getByTestId('today.ring'));
      if (state.safeMode) {
        expect(ring.getByLabelText('On track')).toBeOnTheScreen();
        expect(screen.queryByTestId('today.healthScore')).toBeNull();
        expect(screen.queryByText(/kcal goal/)).toBeNull();
        expect(screen.queryByTestId('food-row-kcal:Spaghetti Bolognese')).toBeNull(); // the row drops its kcal
      } else {
        expect(ring.getByLabelText(/calories remaining of 2150 goal/)).toBeOnTheScreen();
        expect(screen.getByTestId('today.healthScore')).toBeOnTheScreen();
        expect(screen.getByText('of 2,150 kcal goal')).toBeOnTheScreen();
        expect(screen.getByTestId('food-row-kcal:Spaghetti Bolognese')).toHaveTextContent('543 kcal');
      }
      await view.unmount();
    }
  });
});

describe('TodayScreenTests twins', () => {
  // testEDSafeRemovesHealthScoreAndSwitchesRingToWeeklyFraming
  it('testEDSafeRemovesHealthScoreAndSwitchesRingToWeeklyFraming', async () => {
    const { model } = await makeScreen();
    setEdSafeMode(true);
    await render(inProvider(<TodayView model={model} />));

    const ring = screen.getByTestId('today.ring');
    expect(ring).toBeOnTheScreen(); // "ring must stay visible under ED-Safe"
    expect(within(ring).getByLabelText('On track')).toBeOnTheScreen(); // "ED-Safe ring must drop the kcal framing"

    expect(screen.queryByTestId('today.healthScore')).toBeNull(); // "Health Score card must be removed entirely under ED-Safe"

    const streak = screen.getByTestId('today.streakCard'); // "streak card must stay visible under ED-Safe"
    expect(within(streak).getByLabelText('12 day streak, 1 freeze left')).toBeOnTheScreen();
  });

  // testNoTargetsLaunchShowsVerbatimEmptyStateNeverBlank
  it('testNoTargetsLaunchShowsVerbatimEmptyStateNeverBlank', async () => {
    const { model } = await makeScreen({ seed: false });
    const onStartSetup = jest.fn();
    await render(inProvider(<TodayView model={model} onStartSetup={onStartSetup} />));

    const emptyState = screen.getByTestId('today.emptyState'); // "--ccSeedNoTargets must render the empty state, never a blank screen"
    expect(within(emptyState).getByText('Set up your plan')).toBeOnTheScreen(); // "verbatim empty-state heading missing"
    expect(
      within(emptyState).getByText("Answer a few questions and we'll calculate your daily calorie and macro targets."),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('today.startSetup')).toBeOnTheScreen(); // "Start setup CTA missing from the empty state"
    expect(screen.queryByTestId('today.ring')).toBeNull(); // "ring must not render without targets"

    await fireEvent.press(screen.getByText('Start setup'));
    expect(onStartSetup).toHaveBeenCalledTimes(1);
  });

  // testSeededLaunchShowsRingWeekStripAndSelectionRequeriesDiary
  it('testSeededLaunchShowsRingWeekStripAndSelectionRequeriesDiary', async () => {
    const { model } = await makeScreen();
    await render(inProvider(<TodayView model={model} />));

    const ring = within(screen.getByTestId('today.ring')); // "today.ring missing on seeded launch"
    const ringLabel = ring.getByLabelText(/calories remaining/).props.accessibilityLabel as string;
    expect(ringLabel).toContain('calories remaining'); // "ring must carry the combined remaining/goal VoiceOver label"
    expect(ringLabel).toContain('goal');

    const strip = within(screen.getByTestId('today.weekStrip')); // "today.weekStrip missing"
    const cells = strip.getAllByTestId('today.dayCell');
    expect(cells.length).toBeGreaterThanOrEqual(4); // "week strip must expose selectable day cells"

    // Selecting yesterday must re-query the diary for that day (Caesar Salad is the seeded yesterday
    // lunch; today only carries Spaghetti Bolognese).
    const yesterdayCell = cells[cells.length - 2]!;
    expect(yesterdayCell.props.accessibilityLabel).toBe('Friday, September 11'); // "second-to-last cell must be yesterday"
    expect(screen.getByText('Spaghetti Bolognese')).toBeOnTheScreen();

    await fireEvent.press(yesterdayCell);
    await waitFor(() => expect(screen.getByText('Caesar Salad with Dressing')).toBeOnTheScreen());
    const rows = screen.getAllByTestId('today.foodRow');
    expect(rows[0]!.props.accessibilityLabel).toContain('Caesar Salad'); // "selecting yesterday must re-render Recent meals with that day's diary data"
    expect(screen.queryByText('Spaghetti Bolognese')).toBeNull();
  });
});
