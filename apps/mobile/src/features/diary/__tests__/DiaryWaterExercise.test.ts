/**
 * Jest twin of native/App/CoachCalTests/DiaryWaterExerciseTests.swift — one
 * case per Swift test, the same behavior sentence. Runs on a fresh seeded
 * sql.js database per test (the Swift tests use a fresh GRDB pool), the real
 * repositories over it, and the real snapshot loader (the live-diary join and
 * its localtime day grouping are part of the behavior under test).
 *
 * Two documented adaptations (see findings/U-32.md):
 *  - The Swift water test drives TodayModel.logWaterDelta; Today is U-33's, so
 *    the same rule runs through the water model of this feature (the clamp is
 *    the same code path DY-07 ships).
 *  - The concurrent re-log test drives the model's write queue instead of two
 *    raw performRelog calls: the shared inTransaction seam does not serialize
 *    overlapping callers (U-12 finding, fix owned by U-23), and the Swift test
 *    relies on GRDB serializing at the pool.
 */
import {
  countRows,
  createDiaryEntryRepository,
  fetchDiaryEntry,
  fetchDiaryEntryDetail,
  type DiaryEntryDetail,
} from '../../../data/repos/diaryEntryRepository';
import { createDiaryDetailRepository } from '../../../data/repos/diaryDetailRepository';
import { createCatalogRepository } from '../../../data/repos/catalogRepository';
import { pendingOps } from '../../../data/db/schema';
import { inTransaction } from '../../../data/repos/sqlDb';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { dayKey, roundKcal } from '@coachcal/core';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';

import { createDiaryDayModel } from '../diaryDayModel';
import { createFoodSearchModel } from '../foodSearchModel';
import { manualKcal, servingKcal, dayString, linkDate } from '../diaryMath';
import { decodeSavedMealItems, performRelog } from '../addFoodModel';
import { createAddFoodModel } from '../addFoodModel';
import { createWaterModel } from '../waterModel';
import type { DiaryDeps } from '../deps';

const USER_ID = DEMO_USER_ID;

type Harness = {
  fixture: RepoFixture;
  deps: DiaryDeps;
  notifyCount: () => number;
};

async function makeHarness(): Promise<Harness> {
  const fixture = await createRepoFixture();
  const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
  await seeder.ensureSeeded();
  let notifies = 0;
  const deps: DiaryDeps = {
    db: fixture.db,
    catalog: createCatalogRepository(fixture.db),
    diaryEntries: createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock }),
    diaryDetails: createDiaryDetailRepository(fixture.db),
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    notify: () => {
      notifies += 1;
    },
    ownerId: USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
  return { fixture, deps, notifyCount: () => notifies };
}

async function makeDiaryModel(harness: Harness, day?: Date) {
  const model = createDiaryDayModel(harness.deps, day ?? harness.fixture.clock());
  await model.refresh();
  return model;
}

describe('DiaryWaterExerciseTests twins', () => {
  // testWaterQuickAddDayTotalAndClampAtZero
  it('water quick add day total and clamp at zero', async () => {
    const harness = await makeHarness();
    const clock = harness.fixture.clock();
    const day = dayString(clock);
    const tracking = harness.deps.tracking;

    const seededTotal = await tracking.water(day);
    expect(seededTotal).toBe(1250); // the seed carries 5×250 ml

    await tracking.addWater(250, day, USER_ID, clock);
    const afterAdd = await tracking.water(day);
    expect(afterAdd).toBe(1500);

    const model = createWaterModel({
      tracking,
      targets: harness.deps.targets,
      ownerId: USER_ID,
      notify: harness.deps.notify,
      subscribe: harness.deps.subscribe,
      now: harness.deps.now,
      day: () => day,
    });
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(1500);

    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(1250);

    // Drain to zero, then subtract again — the clamp must hold at exactly 0.
    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(1000);
    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(750);
    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(500);
    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(250);
    await model.logWaterDelta(-250);
    await model.refresh();
    expect(model.getSnapshot().totalMl).toBe(0);
    await model.logWaterDelta(-250);
    const final = await tracking.water(day);
    expect(final).toBe(0); // the water total must clamp at 0 ml
  });

  // testExerciseAddPersistsAndDayQueryReturnsIt
  it('exercise add persists and day query returns it', async () => {
    const harness = await makeHarness();
    const clock = harness.fixture.clock();
    const day = dayString(clock);
    const model = await makeDiaryModel(harness);

    await model.addExercise('cycling', 45, 420);
    expect(model.getSnapshot().exercises.some((row) => row.type === 'cycling')).toBe(true);

    const exercises = await harness.deps.tracking.exercises(day);
    const added = exercises.find((row) => row.exerciseType === 'cycling');
    expect(added?.durationMin).toBe(45);
    expect(added?.kcalBurned).toBe(420);
    // Seeded exercises remain untouched.
    expect(exercises.some((row) => row.exerciseType === 'running')).toBe(true);
  });

  // testTombstoneRemovesJoinRowAndEnqueuesExactlyOnePendingOp
  it('tombstone removes join row and enqueues exactly one pending op', async () => {
    const harness = await makeHarness();
    const day = dayString(harness.fixture.clock());
    const model = await makeDiaryModel(harness);
    expect(model.items('dinner').length).toBeGreaterThan(0);

    // Today's seed carries exactly one meal (Spaghetti Bolognese, dinner).
    const dinner = model.items('dinner')[0];
    expect(dinner.title).toBe('Spaghetti Bolognese');

    await model.delete(dinner);

    // The detail join loses the row and the mirror row is tombstoned (not
    // hard deleted); exactly one outbox op is enqueued on top of the seed's zero.
    const details = await harness.deps.diaryDetails.details(day, 'dinner');
    expect(details).toEqual([]); // the deleted entry must vanish from the details join

    const entry = await fetchDiaryEntry(harness.deps.db, dinner.id);
    expect(entry?.deletedAt).not.toBeNull(); // the delete must tombstone, not hard-delete

    const pendingOps = await countRows(harness.deps.db, 'pending_ops');
    expect(pendingOps).toBe(1); // the tombstone must enqueue exactly one pending op

    expect(model.items('dinner')).toEqual([]);
  });

  // testSectionKcalSumsDetailValuesProducedByKcalArithmetic
  it('section kcal sums detail values produced by KcalArithmetic', async () => {
    const harness = await makeHarness();
    const model = await makeDiaryModel(harness);
    expect(model.items('dinner').length).toBeGreaterThan(0);

    const dinner = model.items('dinner')[0];
    // The seed writes kcal via KcalArithmetic — 155 per100g × 350 g → 543.
    expect(dinner.kcal).toBe(roundKcal(155, 350));
    const dinnerSection = model.getSnapshot().sections.find((section) => section.slot === 'dinner');
    expect(dinnerSection).toBeDefined();
    expect(model.sectionKcal(dinnerSection as NonNullable<typeof dinnerSection>)).toBe(dinner.kcal);
    expect(model.eatenKcal()).toBe(dinner.kcal as number); // today carries exactly one seeded meal
  });

  // DY-08 (Ember edit sheet): the edit recomputes the kcal from the entry's
  // own per-100g basis and writes mirror + detail + exactly one pending op in
  // one batch, then notifies.
  it('editing a food recomputes the kcal and writes one batch with one pending op', async () => {
    const harness = await makeHarness();
    const model = await makeDiaryModel(harness);
    const dinner = model.items('dinner')[0];
    expect(dinner.kcal).toBe(roundKcal(155, 350)); // the seeded basis is 155 per100g

    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(0); // the seed enqueues no ops

    await model.updateEntry(dinner, 300);

    const stored = await fetchDiaryEntryDetail(harness.deps.db, dinner.id);
    expect(stored?.grams).toBe(300);
    expect(stored?.kcal).toBe(roundKcal(155, 300)); // 155 × 300 / 100 → 465
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1); // exactly one outbox op
    expect(harness.notifyCount()).toBeGreaterThan(0); // the notify fans out after the write

    // The model re-read itself: the day query returns the edited row.
    expect(model.items('dinner')[0]?.kcal).toBe(roundKcal(155, 300));
    expect(model.items('dinner')[0]?.grams).toBe(300);
  });

  // The delete-undo (DY-08, the d-deleted frames): inside the window the
  // tombstone's pending op is cancelled and the rows come back silently.
  it('the undo of a delete inside the window restores the entry and its detail', async () => {
    const harness = await makeHarness();
    const model = await makeDiaryModel(harness);
    const dinner = model.items('dinner')[0];

    await model.delete(dinner);
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);
    expect(await fetchDiaryEntryDetail(harness.deps.db, dinner.id)).toBeNull();

    await model.undoDelete(dinner);

    const stored = await fetchDiaryEntryDetail(harness.deps.db, dinner.id);
    expect(stored?.kcal).toBe(roundKcal(155, 350));
    expect(stored?.grams).toBe(350);
    const entry = await fetchDiaryEntry(harness.deps.db, dinner.id);
    expect(entry?.deletedAt).toBeNull();
    // The second correction's design: the undo replaces the tombstone op by
    // ONE upsert op of the restored entry — the record never sits with zero
    // ops, so a server tombstone can never out-argue the restore.
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);
    expect(model.items('dinner')[0]?.title).toBe('Spaghetti Bolognese');
  });

  // An undo after the sync has pushed: the entry is recorded again the way a
  // save records it — one new op.
  it('an undo after the sync has pushed records the entry again', async () => {
    const harness = await makeHarness();
    const model = await makeDiaryModel(harness);
    const dinner = model.items('dinner')[0];

    await model.delete(dinner);
    // The ack takes the op: the outbox row leaves.
    await harness.deps.db.delete(pendingOps);

    await model.undoDelete(dinner);

    const stored = await fetchDiaryEntryDetail(harness.deps.db, dinner.id);
    expect(stored?.kcal).toBe(roundKcal(155, 350));
    const entry = await fetchDiaryEntry(harness.deps.db, dinner.id);
    expect(entry?.deletedAt).toBeNull();
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);
  });

  // The review correction's race: the sync takes the op in the gap between
  // the tap and the undo's write. The undo's one transaction re-checks the op
  // inside itself and falls back to the re-record — the restored row never
  // sits with no op while the server holds the tombstone.
  it('an undo whose op the sync takes between the tap and the write re-records the entry', async () => {
    const harness = await makeHarness();
    const model = await makeDiaryModel(harness);
    const dinner = model.items('dinner')[0];

    await model.delete(dinner);
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);

    // The take lands in the gap: queued on the same handle ahead of the
    // undo's write, it deletes the op before the undo's transaction begins.
    const take = inTransaction(harness.deps.db, (tx) => tx.delete(pendingOps));
    const undoing = model.undoDelete(dinner);
    await take;
    await undoing;

    const entry = await fetchDiaryEntry(harness.deps.db, dinner.id);
    expect(entry?.deletedAt).toBeNull();
    const stored = await fetchDiaryEntryDetail(harness.deps.db, dinner.id);
    expect(stored?.kcal).toBe(roundKcal(155, 350));
    // The re-record, not a silent restore: exactly one new op waits, and it
    // is an upsert.
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);
    const ops = await harness.deps.db.select({ kind: pendingOps.kind }).from(pendingOps);
    expect(ops.map((op) => op.kind)).toEqual(['upsert']);
  });

  // testManualLogKcalMatchesKcalArithmeticAtEveryStepperValue — manual-log
  // kcal must equal round(per100g × grams / 100) at every stepper value,
  // never a user-typed or stored display value (T-P04-01).
  it('manual log kcal matches KcalArithmetic at every stepper value', async () => {
    const harness = await makeHarness();
    for (let grams = 0; grams <= 500; grams += 50) {
      expect(manualKcal(165, grams)).toBe(roundKcal(165, grams)); // grams=<n>
    }
    // Chicken Breast row: default grams 150 → 165 × 150 / 100 → 248.
    expect(manualKcal(165, 150)).toBe(248);

    // Integration: the manual-log write stores exactly the computed kcal.
    const clock = harness.fixture.clock();
    const detail: DiaryEntryDetail = {
      entryId: harness.deps.newId(),
      mealSlot: 'lunch',
      title: 'Chicken Breast',
      grams: 150,
      kcal: manualKcal(165, 150),
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      confidence: null,
      hiddenFatLikely: false,
      source: 'manual',
      unresolved: false,
      scanId: null,
    };
    await harness.deps.diaryEntries.recordUpsert(
      {
        id: detail.entryId,
        userId: USER_ID,
        displayText: detail.title,
        createdAt: clock,
        updatedAt: clock,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
        serverUpdatedAt: clock,
      },
      { now: clock },
    );
    await harness.deps.diaryDetails.upsert(detail);

    const stored = await fetchDiaryEntryDetail(harness.deps.db, detail.entryId);
    expect(stored?.kcal).toBe(248);
    const pendingOps = await countRows(harness.deps.db, 'pending_ops');
    expect(pendingOps).toBe(1); // the manual log enqueues exactly one diary outbox op
  });

  // testServingKcalScalesByServings
  it('serving kcal scales by servings', () => {
    expect(servingKcal(240, 1)).toBe(240);
    expect(servingKcal(240, 2)).toBe(480);
  });

  // testRelogPayloadDecodesPerItemKcalLeniently — CR-01 contract: re-log
  // decodes each saved row's own kcal; legacy [{name, grams}] payloads decode
  // with null kcal (unresolved), never the meal's aggregate on the first row.
  it('relog payload decodes per item kcal leniently', () => {
    const current =
      '[{"name":"Chicken Rice Bowl","grams":320,"kcal":464},{"name":"House Dressing","grams":20,"kcal":86}]';
    const decoded = decodeSavedMealItems(current, 'Chicken Rice Bowl');
    expect(decoded.map((item) => item.kcal)).toEqual([464, 86]);

    const legacy = '[{"name":"Protein Oats","grams":250}]';
    const legacyDecoded = decodeSavedMealItems(legacy, 'Protein Oats');
    expect(legacyDecoded.map((item) => item.grams)).toEqual([250]);
    expect(legacyDecoded.map((item) => item.kcal)).toEqual([null]); // legacy rows log unresolved
  });

  // testDiaryDayBoundaryGroupsByLocalCalendarDay — CR-02: diary grouping
  // follows the user's LOCAL calendar day at every edge — local midnight and
  // the 19:00-local instant that UTC grouping flipped to the next day west of
  // UTC — consistently with the Today surface.
  it('diary day boundary groups by local calendar day', async () => {
    const harness = await makeHarness();
    const noon = new Date(harness.fixture.clock());
    noon.setHours(12, 0, 0, 0);
    const eveningBoundary = new Date(noon.getTime() + 7 * 3_600_000);
    const lateNight = new Date(noon.getTime() + (11 * 60 + 30) * 60_000);
    const afterMidnight = new Date(noon.getTime() + (12 * 60 + 30) * 60_000);

    const rows: Array<{ title: string; at: Date; slot: string }> = [
      { title: 'boundary-noon', at: noon, slot: 'lunch' },
      { title: 'boundary-evening', at: eveningBoundary, slot: 'lunch' },
      { title: 'boundary-latenight', at: lateNight, slot: 'lunch' },
      { title: 'boundary-nextday', at: afterMidnight, slot: 'breakfast' },
    ];
    for (const row of rows) {
      const entryId = harness.deps.newId();
      await harness.deps.diaryEntries.recordUpsert(
        {
          id: entryId,
          userId: USER_ID,
          displayText: row.title,
          createdAt: row.at,
          updatedAt: row.at,
          deletedAt: null,
          serverVersion: 0,
          acceptedOpId: null,
          serverUpdatedAt: row.at,
        },
        { now: row.at },
      );
      await harness.deps.diaryDetails.upsert({
        entryId,
        mealSlot: row.slot,
        title: row.title,
        grams: 100,
        kcal: 100,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
        confidence: null,
        hiddenFatLikely: false,
        source: 'manual',
        unresolved: false,
        scanId: null,
      });
    }

    const localDay = dayString(noon);
    const sameDayRows = await harness.deps.diaryDetails.details(localDay, 'lunch');
    expect(sameDayRows.map((row) => row.title)).toEqual([
      'boundary-noon',
      'boundary-evening',
      'boundary-latenight',
    ]); // noon, 19:00 and 23:30 local share one local day even when their UTC days differ

    const nextDayRows = await harness.deps.diaryDetails.details(dayString(afterMidnight), 'breakfast');
    expect(nextDayRows.map((row) => row.title)).toEqual(['boundary-nextday']);

    // The day surface (which selects days on the local calendar) shows the
    // same set: the three boundary lunches under today's lunch section and no
    // boundary row leaking into breakfast. The seeded Spaghetti Bolognese
    // dinner is today too, so today's items are those three plus dinner — the
    // Swift literal asserted meals.count == 3 against the same seed + rows;
    // see findings/U-32.md for the reconciliation.
    const model = await makeDiaryModel(harness, noon);
    expect(model.items('lunch').map((item) => item.title)).toEqual([
      'boundary-noon',
      'boundary-evening',
      'boundary-latenight',
    ]);
    expect(model.items('breakfast')).toEqual([]);
    expect(model.items('dinner').map((item) => item.title)).toEqual(['Spaghetti Bolognese']);
  });

  // testDiaryDeepLinkDateParsesToLocalCalendarDay — WR-08: the
  // coachcal://diary?date= deep link resolves to the LOCAL day the diary
  // queries with; the noon anchor discriminates the parse in every timezone.
  it('diary deep link date parses to local calendar day', () => {
    const parsed = linkDate('2026-09-15');
    expect(parsed).not.toBeNull();
    expect(dayString(parsed as Date)).toBe('2026-09-15');
    expect(dayKey(parsed as Date)).toBe('2026-09-15');
    expect((parsed as Date).getHours()).toBe(12); // local noon, never UTC midnight

    // Malformed or absent day strings fall back to the route's today default.
    expect(linkDate(undefined)).toBeNull();
    expect(linkDate('not-a-date')).toBeNull();
  });

  // testRelogBatchWritesPerItemKcalAndOneOpPerEntry — WR-09: the re-log write
  // is one transactional batch — per-item kcal rows, exactly one outbox op per
  // entry, never k-of-n partials.
  it('relog batch writes per item kcal and one op per entry', async () => {
    const harness = await makeHarness();
    const itemsJson =
      '[{"name":"Chicken Rice Bowl","grams":320,"kcal":464},{"name":"House Dressing","grams":20,"kcal":86}]';
    const stamp = harness.fixture.clock();

    const entryIds = await performRelog({
      itemsJson,
      mealName: 'Chicken Rice Bowl',
      mealSlot: 'lunch',
      userId: USER_ID,
      diaryEntries: harness.deps.diaryEntries,
      now: () => stamp,
      newId: harness.deps.newId,
    });

    expect(entryIds).toHaveLength(2);
    const details = await harness.deps.diaryDetails.details(dayString(stamp), 'lunch');
    expect(details).toHaveLength(2);
    expect(details.map((row) => row.kcal).filter((kcal) => kcal !== null).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      86, 464,
    ]); // each re-logged row carries its own per-item kcal
    expect(details.every((row) => row.source === 'relog')).toBe(true);
    const pendingOps = await countRows(harness.deps.db, 'pending_ops');
    expect(pendingOps).toBe(2); // exactly one outbox op per re-logged entry
  });

  // testConcurrentRelogBatchesLeaveNoPartialState — WR-09 mirror of
  // concurrentSaveTapsProduceExactlyOneBatch: overlapping batches complete
  // whole and never half-written.
  it('concurrent relog batches leave no partial state', async () => {
    const harness = await makeHarness();
    const catalog = createCatalogRepository(harness.fixture.db);
    const stamp = harness.fixture.clock();
    // Batch A carries two payload rows, batch B one — the Swift test's shapes.
    const mealA = {
      id: harness.deps.newId(),
      userId: USER_ID,
      name: 'Chicken Rice Bowl',
      symbol: null,
      kcal: 550,
      itemsJson:
        '[{"name":"Chicken Rice Bowl","grams":320,"kcal":464},{"name":"House Dressing","grams":20,"kcal":86}]',
      createdAt: stamp,
    };
    const mealB = {
      id: harness.deps.newId(),
      userId: USER_ID,
      name: 'Protein Oats',
      symbol: null,
      kcal: 380,
      itemsJson: '[{"name":"Protein Oats","grams":250,"kcal":380}]',
      createdAt: stamp,
    };

    const model = createAddFoodModel({
      catalog,
      diaryEntries: harness.deps.diaryEntries,
      mealSlot: 'lunch',
      userId: USER_ID,
      notify: harness.deps.notify,
      now: harness.deps.now,
      newId: harness.deps.newId,
    });

    const [receiptA, receiptB] = await Promise.all([model.relog(mealA), model.relog(mealB)]);

    expect(receiptA?.entryIds).toHaveLength(2);
    expect(receiptB?.entryIds).toHaveLength(1);
    const details = await harness.deps.diaryDetails.details(
      dayString(harness.fixture.clock()),
      'lunch',
    );
    expect(details).toHaveLength(3);
    expect(details.map((row) => row.kcal).filter((kcal) => kcal !== null).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      86, 380, 464,
    ]); // both batches must land complete — no half-written batch
    const pendingOps = await countRows(harness.deps.db, 'pending_ops');
    expect(pendingOps).toBe(3);
  });

  // testSeededRailRelogWritesKcalArithmeticRows — WR-10: re-logging a seeded
  // rail meal must land real per-item kcal rows — seed → re-log round trip.
  it('seeded rail relog writes KcalArithmetic rows', async () => {
    const harness = await makeHarness();
    const catalog = createCatalogRepository(harness.fixture.db);
    const meals = await catalog.savedMeals();
    const chicken = meals.find((meal) => meal.name === 'Chicken Rice Bowl');
    expect(chicken).toBeDefined();
    expect((chicken as NonNullable<typeof chicken>).kcal).toBe(roundKcal(145, 320));

    const entryIds = await performRelog({
      itemsJson: (chicken as NonNullable<typeof chicken>).itemsJson,
      mealName: (chicken as NonNullable<typeof chicken>).name,
      mealSlot: 'lunch',
      userId: USER_ID,
      diaryEntries: harness.deps.diaryEntries,
      now: harness.deps.now,
      newId: harness.deps.newId,
    });
    expect(entryIds).toHaveLength(1);

    const details = await harness.deps.diaryDetails.details(dayString(harness.deps.now()), 'lunch');
    expect(details.map((row) => row.title)).toEqual(['Chicken Rice Bowl']);
    expect(details.map((row) => row.kcal)).toEqual([464]); // the KcalArithmetic kcal, not a 0-kcal row
    // The receipt and the diary row tell the same story.
    expect(details[0]?.kcal).toBe((chicken as NonNullable<typeof chicken>).kcal);
  });

  // testCustomFoodSaveThenSearchFindsIt
  it('custom food save then search finds it', async () => {
    const harness = await makeHarness();
    const catalog = createCatalogRepository(harness.fixture.db);
    await catalog.saveCustomFood({
      id: harness.deps.newId(),
      userId: USER_ID,
      name: 'Mila Punch',
      basis: 'per100g',
      kcal: 120,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      servingGrams: null,
      createdAt: harness.deps.now(),
    });

    const stored = await catalog.customFoods();
    expect(stored.some((food) => food.name === 'Mila Punch')).toBe(true); // saveCustomFood must persist

    const model = createFoodSearchModel({ catalog });
    await model.applySearch('punch');
    expect(model.getResults().some((row) => row.name === 'Mila Punch')).toBe(true); // search surfaces saved custom foods
  });
});
