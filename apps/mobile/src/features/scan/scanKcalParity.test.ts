/**
 * Jest twin of native/App/CoachCalTests/ScanKcalParityTests.swift — one case per Swift test, the same
 * behavior sentences (the Swift function names). T-P05-02 at its most user-visible point: displayed and
 * stored kcal is ALWAYS KcalArithmetic(current grams); the fixture's kcal only feeds these assertions.
 */
import { KcalArithmetic } from '@coachcal/core';

import { buildScanRequest } from '../../data/api/scanClient';
import { createDiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import { countRows } from '../../data/repos/diaryEntryRepository';
import { FixtureScanApi } from '../../testing';
import { createScanModel } from './scanModel';
import { GateApi, item, makeModel, makeRealPersistence, OWNER_ID, FIXED_NOW, twoItemResponse, waitUntil } from './scanTestKit';

async function goldenResponse() {
  return new FixtureScanApi('200').analyzeFood(buildScanRequest({ kind: 'photo', imageBase64: 'fixture:chicken-rice' }));
}

describe('ScanKcalParityTests twins', () => {
  it('goldenParityAtFixtureGrams', async () => {
    const response = await goldenResponse();
    const model = makeModel();
    model.receive(response);

    expect(response.items).toHaveLength(1);
    expect(response.items[0].kcal).toBe(464);
    expect(model.itemKcal(0)).toBe(464);
    expect(model.itemKcal(0)).toBe(KcalArithmetic.mealKcal(response.items[0].per100g.kcal, response.items[0].grams));
    expect(model.mealKcal()).toBe(464);
  });

  it('editedGramsNeverEchoFixtureKcal', async () => {
    const model = makeModel();
    model.receive(await goldenResponse());

    model.setGrams(200, 0);
    expect(model.itemKcal(0)).toBe(290); // 145 × 200 / 100 = 290
    expect(model.itemKcal(0)).not.toBe(464); // an edited row must never display the fixture's kcal
    expect(model.mealKcal()).toBe(290);
  });

  it('mealKcalIsSumOfRecomputedItemKcal', () => {
    const model = makeModel();
    model.receive(twoItemResponse());

    expect(model.itemKcal(0)).toBe(464);
    expect(model.itemKcal(1)).toBe(86);
    expect(model.mealKcal()).toBe(464 + 86);

    model.setGrams(40, 1);
    expect(model.itemKcal(1)).toBe(172);
    expect(model.mealKcal()).toBe(model.itemKcal(0) + model.itemKcal(1));
  });

  it('unresolvedItemGatesSaveUntilResolved', () => {
    const items = twoItemResponse().items;
    items[1] = item({ label: 'house-dressing', grams: 20, per100gKcal: 430, confidence: 0.42, hiddenFatLikely: true, unresolved: true });
    const model = makeModel();
    model.receive({
      scanId: 'aa000000-0000-4000-8000-00000000aa02',
      kind: 'photo',
      items,
      mealKcal: 550,
      scanConfidence: 0.61,
      note: null,
    });

    expect(model.hasUnresolved()).toBe(true);
    // save must stay disabled while any item is unresolved. The persistence seam is absent here, so
    // `isSaveEnabled` is the pure gate (result, unresolved, analyzing, saving, saved).
    expect(model.isSaveEnabled()).toBe(false);

    model.captureCorrection('portionOff', 'dressing was half the portion', 1);
    expect(model.hasUnresolved()).toBe(false);
    expect(model.isSaveEnabled()).toBe(true);
  });

  // WR-01: a second Save while one is in flight must be rejected — both taps resolve to exactly one
  // batch (two entries, two ops), never duplicates.
  it('concurrentSaveTapsProduceExactlyOneBatch', async () => {
    const real = await makeRealPersistence();
    const model = makeModel({ persistence: real.persistence, notify: real.notify });
    model.receive(twoItemResponse());

    const first = model.save();
    const second = model.save();
    await Promise.all([first, second]);

    expect(model.getState().phase).toEqual({ kind: 'saved' });
    expect(real.save).toHaveBeenCalledTimes(1);
    expect(await countRows(real.fixture.db, 'pending_ops')).toBe(2); // a double-tap must not enqueue duplicate ops
    expect(await countRows(real.fixture.db, 'diary_entries')).toBe(2); // a double-tap must not write duplicate entries
  });

  // WR-02: a stale analyze task resumed after cancelAnalyzing must not touch phase/isAnalyzing — neither
  // resurrecting the cancelled scan nor opening the re-entrancy gate under a new in-flight analysis.
  it('cancelledAnalyzingStaysCancelledWhenStaleWorkCompletes', async () => {
    const api = new GateApi();
    const model = makeModel({ api });
    model.analyzeDescription('parked scan');
    await waitUntil(() => model.getState().isAnalyzing);

    model.cancelAnalyzing();
    expect(model.getState().phase).toEqual({ kind: 'capture' });

    // The stale work completes only after the user cancelled.
    api.resumeAll(twoItemResponse());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(model.getState().phase).toEqual({ kind: 'capture' }); // a stale resume must not resurrect the review phase
    expect(model.getState().isAnalyzing).toBe(false);
  });

  it('staleResumeCannotClobberANewAnalysis', async () => {
    const api = new GateApi();
    const model = makeModel({ api });
    model.analyzeDescription('first scan');
    await waitUntil(() => model.getState().isAnalyzing);
    model.cancelAnalyzing();

    model.analyzeDescription('second scan');
    await waitUntil(() => model.getState().isAnalyzing);

    // The cancelled scan's work now completes while the new one is parked — the stale task must not
    // reset phase/isAnalyzing mid-flight. Only the stale call is resumed: with no dwell timer a resumed new call would
    // reach review at once and hide the very thing under test.
    api.resumeFirst(twoItemResponse());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(model.getState().isAnalyzing).toBe(true); // stale resume must not open the re-entrancy gate
    expect(model.getState().phase.kind).not.toBe('capture');

    // Cleanup: let the new analysis run to review.
    api.resumeAll(twoItemResponse());
    await waitUntil(() => model.getState().phase.kind === 'review');
  });

  it('saveEnqueuesOnePendingOpPerEntryAndUndoTombstones', async () => {
    const real = await makeRealPersistence();
    const model = makeModel({ persistence: real.persistence, notify: real.notify });
    const response = twoItemResponse();
    model.receive(response);
    model.setGrams(200, 0);

    await model.save();

    expect(model.getState().phase).toEqual({ kind: 'saved' });
    expect(model.getState().savedKcal).toBe(290 + 86);
    expect(real.save).toHaveBeenCalledTimes(1); // the whole save is ONE recordUpserts call
    expect(real.calls).toEqual(['save', 'notify']); // then the injected notify
    expect(await countRows(real.fixture.db, 'pending_ops')).toBe(2); // exactly one pending op per saved entry

    // The sql.js fixture's relational query hands back raw column names: read through the real repository.
    const rawDetails = await real.fixture.db.query.diaryEntryDetails.findMany();
    expect(rawDetails).toHaveLength(2);
    const detailRepository = createDiaryDetailRepository(real.fixture.db);
    const details = (await Promise.all(rawDetails.map((raw) => detailRepository.detail(String((raw as Record<string, unknown>).entry_id)))))
      .filter((detail): detail is NonNullable<typeof detail> => detail !== null);
    expect(details).toHaveLength(2);
    const firstDetail = details.find((detail) => detail.title === model.getState().mealTitle);
    expect(firstDetail).toBeDefined();
    expect(firstDetail?.kcal).toBe(290); // stored kcal is the recomputed figure, never the fixture's 464
    expect(firstDetail?.grams).toBe(200);
    expect(firstDetail?.scanId).toBe(response.scanId);
    expect(firstDetail?.source).toBe('scan');
    expect(details.every((detail) => detail.entryId.length > 0)).toBe(true);

    // LOG-07: the save feeds the saved-meals rail contract 03-04 re-logs from.
    const savedMeals = await real.catalog.savedMeals();
    const railMeal = savedMeals.find((meal) => meal.name === model.getState().mealTitle);
    expect(railMeal?.kcal).toBe(290 + 86);
    const railItems = JSON.parse(railMeal?.itemsJson ?? '[]') as { name: string; grams: number; kcal: number }[];
    expect(railItems.map((railItem) => railItem.grams)).toEqual([200, 20]);
    // each payload row carries its own KcalArithmetic figure, never the aggregate
    expect(railItems.map((railItem) => railItem.kcal)).toEqual([290, 86]);

    await model.undo();

    expect(model.getState().phase).toEqual({ kind: 'review' });
    expect(real.calls).toEqual(['save', 'notify', 'notify']); // undo notifies again
    expect(await countRows(real.fixture.db, 'pending_ops')).toBe(4); // undo tombstones both entries (2 more ops)
    expect(await countRows(real.fixture.db, 'diary_entry_details')).toBe(0);
    const entries = await real.fixture.db.query.diaryEntries.findMany();
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => (entry as Record<string, unknown>).deleted_at !== null)).toBe(true);
  });
});

// The factory is exercised directly once so a wrong export name fails here, not in a screen test.
describe('createScanModel', () => {
  it('starts in capture with the Swift defaults', () => {
    const model = createScanModel({ api: new GateApi(), ownerId: OWNER_ID, now: () => FIXED_NOW, mealSlot: 'dinner' });
    const state = model.getState();
    expect(state.phase).toEqual({ kind: 'capture' });
    expect(state.mealTitle).toBe('Scanned meal');
    expect(state.mealSlot).toBe('dinner');
    expect(state.result).toBeNull();
  });
});
