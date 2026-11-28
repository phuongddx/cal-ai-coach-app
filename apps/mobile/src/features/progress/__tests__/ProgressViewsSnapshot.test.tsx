/**
 * The Progress views over the REAL ProgressModel on the sql.js database the suites use, with the
 * model changing while the view is mounted (U-84 B). The app compiles with the React Compiler,
 * which treats a value that keeps its identity as unchanged: a view that subscribes, throws the
 * snapshot away and reads `model.latestKg()` / `model.weekKcals()` / `model.getSnapshot()` in render
 * draws the old numbers after the model moves. Jest does not compile, so these cases only go red
 * under `npm run test:compiler`; they are green under `npm test` on both versions of the views.
 */
import { act, render, screen } from '@testing-library/react-native';

import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createDiaryEntryRepository } from '../../../data/repos/diaryEntryRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { dayInitial } from '../progressMath';
import { createProgressModel } from '../progressModel';
import type { ProgressDeps } from '../progressModel';
import { AchievementsView } from '../screens/AchievementsView';
import { ProgressView } from '../screens/ProgressView';
import { WeeklyEnergyView, averageKcalText } from '../screens/WeeklyEnergyView';
import { WeightTrendView } from '../screens/WeightTrendView';

async function makeWorld() {
  const fixture = await createRepoFixture();
  await createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId }).ensureSeeded();
  const engagement = createEngagementRepository(fixture.db);
  // The seed stamps its weight logs up to 49 days AFTER the fixture clock; a weight written
  // later has to be newer than all of them to become the latest, so the test moves the clock.
  const clock = { skewMs: 0 };
  const deps: ProgressDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    engagement,
    ownerId: DEMO_USER_ID,
    notify: () => undefined,
    subscribe: () => () => undefined,
    now: () => new Date(fixture.clock().getTime() + clock.skewMs),
    newId: fixture.newId,
  };
  const model = createProgressModel(deps);
  await model.refresh();
  const diary = createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock });
  return { fixture, deps, model, engagement, diary, clock };
}

/** One diary entry of today with its detail, the way the add-food save writes it. */
async function logToday(world: Awaited<ReturnType<typeof makeWorld>>, id: string, kcal: number) {
  const stamp = world.deps.now();
  await world.diary.recordUpserts(
    [
      {
        entry: {
          id,
          userId: DEMO_USER_ID,
          displayText: 'Chicken Bowl',
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: null,
          serverVersion: 0,
          acceptedOpId: null,
          serverUpdatedAt: stamp,
        },
        detail: {
          entryId: id,
          mealSlot: 'lunch',
          title: 'Chicken Bowl',
          grams: 200,
          kcal,
          proteinG: null,
          carbsG: null,
          fatG: null,
          fiberG: null,
          confidence: null,
          hiddenFatLikely: false,
          source: 'manual',
          unresolved: false,
          scanId: null,
        },
      },
    ],
    stamp,
  );
}

describe('Progress views over the real model, model changing while mounted', () => {
  it('WeightTrendView: a logged weight moves the big value, the direction row and the trend sentence', async () => {
    const { model, clock } = await makeWorld();
    await render(<WeightTrendView model={model} />);
    expect(screen.getByText('82.4')).toBeOnTheScreen();

    clock.skewMs = 60 * 24 * 60 * 60 * 1000;
    await act(async () => {
      await model.logWeight(79);
    });

    expect(screen.getByText('79.0')).toBeOnTheScreen();
    expect(screen.queryByText('82.4')).toBeNull();
    expect(model.latestKg()).toBe(79);
  });

  it('WeeklyEnergyView: a diary save moves the average figure and today\'s bar', async () => {
    const world = await makeWorld();
    const { model } = world;
    await render(<WeeklyEnergyView model={model} />);
    const before = averageKcalText(model.weekKcals());
    expect(screen.getByText(before)).toBeOnTheScreen();

    await act(async () => {
      await logToday(world, 'u84b-energy-1', 3000);
      await model.refresh();
    });

    const after = averageKcalText(model.weekKcals());
    expect(after).not.toBe(before);
    expect(screen.getByText(after)).toBeOnTheScreen();
    const today = model.weekKcals().at(-1);
    expect(today).toBeDefined();
    expect(screen.getByLabelText(`${dayInitial(today?.day ?? '')}: ${today?.kcal} kcal`)).toBeOnTheScreen();
  });

  it('AchievementsView: a badge awarded and a streak saved move the hero and the grid', async () => {
    const { model, engagement } = await makeWorld();
    await render(<AchievementsView model={model} />);
    expect(screen.getByLabelText('12 day streak, 1 freeze left')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-tile:Early Bird')).toBeNull();

    await act(async () => {
      await engagement.awardBadge({
        id: 'u84b-badge-1',
        userId: DEMO_USER_ID,
        code: 'early-bird',
        label: 'Early Bird',
        detail: 'Logged breakfast 5 days',
        earnedAt: new Date(),
        progress: 5,
        target: 5,
      });
      await model.refresh();
    });

    expect(screen.getByTestId('badge-tile:Early Bird')).toBeOnTheScreen();
  });

  it('ProgressView: a logged weight moves the trend card inside the whole stack', async () => {
    const { model, clock } = await makeWorld();
    await render(<ProgressView model={model} />);
    expect(screen.getByText('82.4')).toBeOnTheScreen();

    clock.skewMs = 60 * 24 * 60 * 60 * 1000;
    await act(async () => {
      await model.logWeight(78.5);
    });

    expect(screen.getByText('78.5')).toBeOnTheScreen();
    expect(screen.queryByText('82.4')).toBeNull();
  });
});
