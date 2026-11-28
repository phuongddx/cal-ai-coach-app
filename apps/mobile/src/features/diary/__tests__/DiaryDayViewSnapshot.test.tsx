/**
 * DiaryDayView (DY-01) over the REAL DiaryDayModel on the sql.js database the suites use. The app
 * compiles with the React Compiler, which treats a value that keeps its identity as unchanged: a
 * view that subscribes to the model, throws the snapshot away and reads `model.eatenKcal()` in
 * render draws the old numbers after a save or a delete (seen on the Simulator in U-74e). Jest
 * does not compile, so these two cases only go red under `npm run test:compiler`; they are green
 * under `npm test` on both versions of the view.
 */
import { act, render, screen, within } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { createCatalogRepository } from '../../../data/repos/catalogRepository';
import { createDiaryDetailRepository } from '../../../data/repos/diaryDetailRepository';
import { createDiaryEntryRepository } from '../../../data/repos/diaryEntryRepository';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';

import type { DiaryDeps } from '../deps';
import { createDiaryDayModel } from '../diaryDayModel';
import { DiaryDayView } from '../screens/DiaryDayView';

async function makeDeps(): Promise<DiaryDeps> {
  const fixture = await createRepoFixture();
  await createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId }).ensureSeeded();
  return {
    db: fixture.db,
    catalog: createCatalogRepository(fixture.db),
    diaryEntries: createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock }),
    diaryDetails: createDiaryDetailRepository(fixture.db),
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    notify: () => undefined,
    ownerId: DEMO_USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
}

/** One lunch entry of the day, as the add-food save writes it. */
function lunchEntry(deps: DiaryDeps, id: string, title: string, kcal: number) {
  const stamp = deps.now();
  return {
    entry: {
      id,
      userId: DEMO_USER_ID,
      displayText: title,
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
      title,
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
  };
}

function summaryLabel(eaten: number, goal: number): string {
  return `Eaten ${eaten} of ${goal}, ${Math.max(goal - eaten, 0)} remaining`;
}

async function renderDay(deps: DiaryDeps) {
  const model = createDiaryDayModel(deps, deps.now());
  await model.refresh();
  await render(<DiaryDayView model={model} deps={deps} onCapture={() => undefined} />);
  return model;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DiaryDayView over the real model', () => {
  it('a save through the model moves the row, the section kilocalories and the totals', async () => {
    const deps = await makeDeps();
    const model = await renderDay(deps);
    const eaten = model.eatenKcal();
    const goal = model.goalKcal() ?? 0;
    const lunchBefore = model.sectionKcal({ slot: 'lunch', items: model.items('lunch') });
    expect(screen.getByLabelText(summaryLabel(eaten, goal))).toBeOnTheScreen();
    expect(screen.queryByText('Chicken Bowl')).toBeNull();

    const { entry, detail } = lunchEntry(deps, 'u84-save-1', 'Chicken Bowl', 437);
    await act(async () => {
      await model.writeEntry(entry, detail);
    });

    expect(screen.getByText('Chicken Bowl')).toBeOnTheScreen();
    expect(screen.getByLabelText(summaryLabel(eaten + 437, goal))).toBeOnTheScreen();
    // Eaten, Goal and Left columns: the figures drawn from the new totals.
    const summary = screen.getByLabelText(summaryLabel(eaten + 437, goal));
    expect(within(summary).getByText((eaten + 437).toLocaleString('en-US'))).toBeOnTheScreen();
    expect(within(summary).getByText(Math.max(goal - eaten - 437, 0).toLocaleString('en-US'))).toBeOnTheScreen();
    // The lunch header shows the new section figure; the new row shows its own 437 kcal (the same
    // text node twice when the lunch was empty before).
    expect(screen.getAllByText(`${lunchBefore + 437} kcal`)).toHaveLength(lunchBefore === 0 ? 2 : 1);
    expect(screen.getAllByText('437 kcal')).toHaveLength(lunchBefore === 0 ? 2 : 1);
  });

  it('a delete through the model removes the row and moves the section kilocalories and the totals', async () => {
    const deps = await makeDeps();
    const model = await renderDay(deps);
    const { entry, detail } = lunchEntry(deps, 'u84-delete-1', 'Chicken Bowl', 437);
    await act(async () => {
      await model.writeEntry(entry, detail);
    });
    const eaten = model.eatenKcal();
    const goal = model.goalKcal() ?? 0;
    expect(screen.getByLabelText(summaryLabel(eaten, goal))).toBeOnTheScreen();
    expect(screen.getByText('Chicken Bowl')).toBeOnTheScreen();

    const item = model.items('lunch').find((candidate) => candidate.id === 'u84-delete-1');
    expect(item).toBeDefined();
    // The delete path of the sheet: the system action sheet, then the model delete.
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => undefined);
    await act(async () => {
      await model.delete(item as NonNullable<typeof item>);
    });

    expect(screen.queryByText('Chicken Bowl')).toBeNull();
    expect(screen.getByLabelText(summaryLabel(eaten - 437, goal))).toBeOnTheScreen();
    expect(screen.queryByText('437 kcal')).toBeNull();
  });
});
