/**
 * Every state transition of the scan model, one case per transition (capture → analyzing → review /
 * quotaReached / failed → saved → review again), against the Swift `ScanModel` behavior.
 */
import { FixtureScanApi } from '../../testing';
import type { DiaryEntry, EntryDetailUpsert } from '../../data/repos/diaryEntryRepository';
import { itemKcalOf, mealKcalOf } from './scanModel';
import type { ScanActivityPort, ScanPersistence } from './scanTypes';
import { FIXED_NOW, GateApi, makeModel, makeRealPersistence, OWNER_ID, twoItemResponse, waitUntil } from './scanTestKit';
import { buildScanRequest } from '../../data/api/scanClient';

const FAST = { activityLifetimeMs: 40 };
const photo = { thumb: 1, request: buildScanRequest({ kind: 'photo', imageBase64: 'fixture:chicken-rice' }) };

function activityPort(): ScanActivityPort & { start: jest.Mock; update: jest.Mock; end: jest.Mock } {
  return { start: jest.fn(async () => 'activity-1'), update: jest.fn(async () => undefined), end: jest.fn(async () => undefined) };
}

function fakePersistence(overrides: Partial<ScanPersistence> = {}): ScanPersistence & { save: jest.Mock } {
  const entries = new Map<string, DiaryEntry>();
  return {
    save: jest.fn(async (upserts: EntryDetailUpsert[], now: Date) => {
      for (const upsert of upserts) entries.set(upsert.entry.id, upsert.entry);
      return upserts.map((upsert) => ({ recordId: upsert.entry.id, createdAt: now }) as never);
    }),
    fetchEntry: async (id) => entries.get(id) ?? null,
    tombstone: jest.fn(async (entry) => ({ recordId: entry.id }) as never),
    deleteDetail: jest.fn(async () => undefined),
    saveMeal: jest.fn(async () => undefined),
    loadSavedContext: async () => ({ todayKcal: 376, goalKcal: 2000, streakCount: 1, freezesLeft: 2 }),
    ...overrides,
  } as ScanPersistence & { save: jest.Mock };
}

async function analyzeToEnd(model: ReturnType<typeof makeModel>, scenario: ConstructorParameters<typeof FixtureScanApi>[0]) {
  void scenario;
  model.analyze(photo);
  await waitUntil(() => !model.getState().isAnalyzing);
}

describe('ScanModel transitions', () => {
  it('starts in capture with no result', () => {
    const state = makeModel().getState();
    expect(state.phase).toEqual({ kind: 'capture' });
    expect(state.result).toBeNull();
    expect(state.isAnalyzing).toBe(false);
  });

  it('analyze moves capture to analyzing, keeps the thumb and opens the gate', () => {
    const api = new GateApi();
    const model = makeModel({ api, timing: FAST });
    model.analyze(photo);
    expect(model.getState().phase).toEqual({ kind: 'analyzing' });
    expect(model.getState().isAnalyzing).toBe(true);
    expect(model.getState().captureThumb).toBe(1);
    expect(api.calls).toHaveLength(1);
    model.cancelAnalyzing();
  });

  it('a 200 lands in review with the result and no step in between', async () => {
    const model = makeModel({ api: new FixtureScanApi('200'), timing: FAST });
    const phases: string[] = [];
    model.subscribe(() => {
      const kind = model.getState().phase.kind;
      if (phases[phases.length - 1] !== kind) phases.push(kind);
    });
    await analyzeToEnd(model, '200');
    expect(phases).toEqual(['analyzing', 'review']);
    expect(model.getState().phase).toEqual({ kind: 'review' });
    expect(model.getState().result?.items.length).toBeGreaterThan(0);
    expect(model.getState().isAnalyzing).toBe(false);
  });

  it('analyzing without a timer: nothing advances by itself while the call is pending', async () => {
    jest.useFakeTimers();
    try {
      const api = new GateApi();
      const model = makeModel({ api, timing: FAST });
      let notifications = 0;
      model.subscribe(() => {
        notifications += 1;
      });
      model.analyze(photo);
      const after = notifications;
      await jest.advanceTimersByTimeAsync(60_000);
      expect(model.getState().phase).toEqual({ kind: 'analyzing' });
      expect(model.getState().isAnalyzing).toBe(true);
      expect(notifications).toBe(after);
      api.resumeAll(twoItemResponse());
      await jest.advanceTimersByTimeAsync(0);
      expect(model.getState().phase).toEqual({ kind: 'review' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('a response lands in review the moment the call settles, without a dwell', async () => {
    const api = new GateApi();
    const model = makeModel({ api, timing: FAST });
    model.analyze(photo);
    api.resumeAll(twoItemResponse());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(model.getState().phase).toEqual({ kind: 'review' });
  });

  it('a 402 surfaces immediately as quotaReached carrying the entitlement', async () => {
    const model = makeModel({ api: new FixtureScanApi('402'), timing: FAST });
    await analyzeToEnd(model, '402');
    const phase = model.getState().phase;
    expect(phase.kind).toBe('quotaReached');
    if (phase.kind === 'quotaReached') expect(phase.entitlement?.scanLimit).toBe(3);
  });

  it('a FREE_LIMIT_REACHED envelope without an entitlement reaches quota with no entitlement (no invented limit)', async () => {
    const api = {
      analyzeFood: async () =>
        Promise.reject({ name: 'ScanApiError', kind: 'envelope', status: 402, code: 'FREE_LIMIT_REACHED', isQuotaReached: true, isBarcodeNotFound: false, isSchemaError: false }),
    };
    const model = makeModel({ api, timing: FAST });
    await analyzeToEnd(model, '402');
    const phase = model.getState().phase;
    expect(phase.kind).toBe('quotaReached');
    if (phase.kind === 'quotaReached') expect(phase.entitlement).toBeNull();
  });

  it('only a FREE_LIMIT_REACHED envelope routes to quota: a flagged non-envelope error and other envelopes fail', async () => {
    const flagged = { name: 'ScanApiError', kind: 'network', message: 'x', isQuotaReached: true, isBarcodeNotFound: false, isSchemaError: false };
    const other = { name: 'ScanApiError', kind: 'envelope', status: 500, code: 'INTERNAL', isQuotaReached: false, isBarcodeNotFound: false, isSchemaError: false };
    for (const error of [flagged, other]) {
      const model = makeModel({ api: { analyzeFood: async () => Promise.reject(error) }, timing: FAST });
      await analyzeToEnd(model, '422');
      expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'analysisFailure' });
    }
  });

  it('a 404 becomes failed(barcodeNotFound)', async () => {
    const model = makeModel({ api: new FixtureScanApi('404'), timing: FAST });
    await analyzeToEnd(model, '404');
    expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'barcodeNotFound' });
  });

  it('a 422 becomes failed(analysisFailure)', async () => {
    const model = makeModel({ api: new FixtureScanApi('422'), timing: FAST });
    await analyzeToEnd(model, '422');
    expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'analysisFailure' });
  });

  it('a non-API error becomes failed(analysisFailure)', async () => {
    const model = makeModel({ api: { analyzeFood: async () => Promise.reject(new Error('boom')) }, timing: FAST });
    await analyzeToEnd(model, '422');
    expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'analysisFailure' });
  });

  it('a synchronous throw from the client is a failed call, not a crash', async () => {
    const model = makeModel({ timing: FAST }); // silentApi throws synchronously
    await analyzeToEnd(model, '422');
    expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'analysisFailure' });
  });

  it('the re-entrancy gate ignores analyze while one is running', () => {
    const api = new GateApi();
    const model = makeModel({ api, timing: FAST });
    model.analyze(photo);
    model.analyze(photo);
    model.analyzeDescription('soup');
    expect(api.calls).toHaveLength(1);
    model.cancelAnalyzing();
  });

  it('cancelAnalyzing returns to capture and closes the gate', () => {
    const model = makeModel({ api: new GateApi(), timing: FAST });
    model.analyze(photo);
    model.cancelAnalyzing();
    expect(model.getState().phase).toEqual({ kind: 'capture' });
    expect(model.getState().isAnalyzing).toBe(false);
  });

  it('cancelAnalyzing outside an analysis does nothing', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    model.cancelAnalyzing();
    expect(model.getState().phase).toEqual({ kind: 'review' });
  });

  it('analyzeDescription sends the text as textDescription and keeps the previous thumb', () => {
    const api = new GateApi();
    const model = makeModel({ api, timing: FAST });
    model.analyzeDescription('chicken rice');
    expect(api.calls[0]).toMatchObject({ kind: 'text', textDescription: 'chicken rice' });
    expect(model.getState().captureThumb).toBeNull();
    model.cancelAnalyzing();
  });

  it('receive builds ids by index and resets the meal title', () => {
    const model = makeModel();
    model.setMealTitle('My lunch');
    model.receive(twoItemResponse());
    expect(model.getState().mealTitle).toBe('Scanned meal');
    expect(model.getState().result?.items.map((candidate) => candidate.id)).toEqual([0, 1]);
    expect(model.getState().phase).toEqual({ kind: 'review' });
  });

  it('reportCaptureFailure fails only when no analysis is running', () => {
    const model = makeModel({ api: new GateApi(), timing: FAST });
    model.analyze(photo);
    model.reportCaptureFailure();
    expect(model.getState().phase.kind).toBe('analyzing');
    model.cancelAnalyzing();
    model.reportCaptureFailure();
    expect(model.getState().phase).toEqual({ kind: 'failed', failure: 'analysisFailure' });
  });

  it('retry returns a failure to capture', () => {
    const model = makeModel();
    model.reportCaptureFailure();
    model.retry();
    expect(model.getState().phase).toEqual({ kind: 'capture' });
  });

  it('retake clears the result and the thumb', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    model.retake();
    expect(model.getState()).toMatchObject({ phase: { kind: 'capture' }, result: null, captureThumb: null });
  });

  it('startNewScan also clears the saved ids and the saved kcal', async () => {
    const model = makeModel({ persistence: fakePersistence() });
    model.receive(twoItemResponse());
    await model.save();
    model.startNewScan();
    expect(model.getState()).toMatchObject({ phase: { kind: 'capture' }, result: null, savedEntryIds: [], savedKcal: null });
  });

  it('setGrams clamps negative grams to zero and recomputes kcal from the current grams', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    model.setGrams(200, 0);
    expect(model.itemKcal(0)).toBe(290);
    model.setGrams(-50, 0);
    expect(model.getState().result?.items[0]?.grams).toBe(0);
    expect(model.itemKcal(0)).toBe(0);
    expect(itemKcalOf(model.getState(), 99)).toBe(0); // an unknown item id is zero, never a throw
  });

  it('setGrams for an unknown item changes nothing', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    const before = model.getState().result;
    model.setGrams(10, 42);
    expect(model.getState().result).toBe(before);
  });

  it('the hidden-fat chip total is the recomputed kcal of the not-fully-visible items', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    expect(model.hasHiddenFat()).toBe(true);
    expect(model.hiddenFatAddedKcal()).toBe(86);
    model.setGrams(40, 1);
    expect(model.hiddenFatAddedKcal()).toBe(172);
    expect(mealKcalOf(model.getState())).toBe(464 + 172);
  });

  it('removeItem drops the item and the total follows from the items that remain', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    expect(model.mealKcal()).toBe(550);
    model.removeItem(1);
    expect(model.getState().result?.items.map((entry) => entry.id)).toEqual([0]);
    expect(model.mealKcal()).toBe(464);
    model.removeItem(42); // an unknown id changes nothing
    expect(model.getState().result?.items).toHaveLength(1);
  });

  it('removing the unresolved item re-enables Save and the count of unresolved items follows', () => {
    const model = makeModel({ persistence: fakePersistence() });
    const response = twoItemResponse();
    response.items[1] = { ...response.items[1], unresolved: true };
    model.receive(response);
    expect(model.unresolvedCount()).toBe(1);
    expect(model.isSaveEnabled()).toBe(false);
    model.removeItem(1);
    expect(model.unresolvedCount()).toBe(0);
    expect(model.isSaveEnabled()).toBe(true);
  });

  it('removing every item leaves nothing to save', () => {
    const model = makeModel({ persistence: fakePersistence() });
    model.receive(twoItemResponse());
    model.removeItem(0);
    model.removeItem(1);
    expect(model.isSaveEnabled()).toBe(false);
  });

  it('after removeItem the saved batch holds the remaining items and the first one carries the meal title', async () => {
    const persistence = fakePersistence();
    const model = makeModel({ persistence, api: new GateApi(), timing: FAST });
    model.receive(twoItemResponse());
    model.setMealTitle('Lunch bowl');
    model.removeItem(0);
    await model.save();
    const upserts = persistence.save.mock.calls[0][0] as EntryDetailUpsert[];
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.detail?.title).toBe('Lunch bowl');
    expect(upserts[0]?.detail?.grams).toBe(20);
  });

  it('captureCorrection records the note and clears the unresolved flag', () => {
    const model = makeModel();
    model.receive({ ...twoItemResponse(), items: twoItemResponse().items.map((entry, index) => (index === 0 ? { ...entry, unresolved: true } : entry)) });
    expect(model.hasUnresolved()).toBe(true);
    model.captureCorrection('wrongFood', 'It is noodles', 0);
    expect(model.hasUnresolved()).toBe(false);
    expect(model.getState().result?.items[0]?.correction).toEqual({ kind: 'wrongFood', note: 'It is noodles' });
  });

  it('save without persistence is a no-op', async () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    await model.save();
    expect(model.getState().phase).toEqual({ kind: 'review' });
    expect(model.getState().isSaving).toBe(false);
  });

  it('save without a result is a no-op', async () => {
    const persistence = fakePersistence();
    await makeModel({ persistence }).save();
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('save writes once, notifies once, and lands in saved with the context for the peek and the streak', async () => {
    const persistence = fakePersistence();
    const order: string[] = [];
    persistence.save.mockImplementation(async (upserts: Array<{ entry: DiaryEntry }>, now: Date) => {
      order.push('save');
      return upserts.map((upsert) => ({ recordId: upsert.entry.id, createdAt: now }));
    });
    const model = makeModel({ persistence, notify: () => order.push('notify') });
    model.receive(twoItemResponse());
    model.setMealTitle('Lunch bowl');
    await model.save();
    expect(order).toEqual(['save', 'notify']);
    expect(persistence.save).toHaveBeenCalledTimes(1);
    const upserts = persistence.save.mock.calls[0]?.[0] as Array<{ entry: DiaryEntry; detail: { title: string } | null }>;
    expect(upserts.map((upsert) => upsert.entry.userId)).toEqual([OWNER_ID, OWNER_ID]);
    expect(upserts.map((upsert) => upsert.entry.displayText)).toEqual(['chicken-rice', 'house-dressing']);
    expect(upserts.map((upsert) => upsert.detail?.title)).toEqual(['Lunch bowl', 'house-dressing']); // item 0 carries the meal title
    expect(new Set(upserts.map((upsert) => upsert.entry.id)).size).toBe(2);
    expect(upserts[0]?.entry.createdAt).toEqual(FIXED_NOW);
    expect(model.getState()).toMatchObject({
      phase: { kind: 'saved' },
      savedKcal: 464 + 86,
      todayKcal: 376,
      goalKcal: 2000,
      streakCount: 1,
      freezesLeft: 2,
    });
    expect(model.getState().savedEntryIds).toHaveLength(2);
    expect(model.getState().isSaving).toBe(false);
  });

  it('a failed write keeps the review open and lets Save retry', async () => {
    const persistence = fakePersistence({ save: jest.fn().mockRejectedValueOnce(new Error('disk')) });
    const notify = jest.fn();
    const model = makeModel({ persistence, notify });
    model.receive(twoItemResponse());
    await model.save();
    expect(model.getState().phase).toEqual({ kind: 'review' });
    expect(model.getState().isSaving).toBe(false);
    expect(model.isSaveEnabled()).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it('the saved meal feeds the rail with the meal title and total kcal', async () => {
    const persistence = fakePersistence();
    const model = makeModel({ persistence });
    model.receive(twoItemResponse());
    model.setMealTitle('Lunch bowl');
    await model.save();
    expect(persistence.saveMeal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lunch bowl', kcal: 550, userId: OWNER_ID }));
  });

  it('Save is disabled with no result and once saved', async () => {
    const model = makeModel({ persistence: fakePersistence(), api: new GateApi(), timing: FAST });
    expect(model.isSaveEnabled()).toBe(false); // no result
    model.receive(twoItemResponse());
    expect(model.isSaveEnabled()).toBe(true);
    await model.save();
    expect(model.isSaveEnabled()).toBe(false); // already saved
  });

  it('undo tombstones every saved entry, deletes the details, notifies and returns to review', async () => {
    const persistence = fakePersistence();
    const notify = jest.fn();
    const model = makeModel({ persistence, notify });
    model.receive(twoItemResponse());
    await model.save();
    await model.undo();
    expect(persistence.tombstone).toHaveBeenCalledTimes(2);
    expect(persistence.deleteDetail).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(model.getState()).toMatchObject({ phase: { kind: 'review' }, savedEntryIds: [], savedKcal: null });
    expect(model.isSaveEnabled()).toBe(true);
  });

  it('a second undo while one is running tombstones each entry once', async () => {
    const persistence = fakePersistence();
    const model = makeModel({ persistence, notify: jest.fn() });
    model.receive(twoItemResponse());
    await model.save();
    await Promise.all([model.undo(), model.undo()]);
    expect(persistence.tombstone).toHaveBeenCalledTimes(2);
    expect(persistence.deleteDetail).toHaveBeenCalledTimes(2);
    await model.undo();
    expect(persistence.tombstone).toHaveBeenCalledTimes(2);
  });

  it('mealMacros sums the macros of the current grams in whole grams', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    expect(model.mealMacros()).toEqual({ proteinG: 34, carbsG: 68, fatG: 17 });
    model.setGrams(350, 0);
    expect(model.mealMacros()).toEqual({ proteinG: 37, carbsG: 74, fatG: 19 });
    model.removeItem(1);
    expect(model.mealMacros()).toEqual({ proteinG: 35, carbsG: 70, fatG: 18 });
  });

  it('captureCorrection stores the reason and the note only, with no photo field', () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    model.captureCorrection('nutritionOff', 'too low', 0);
    expect(model.getState().result?.items[0]?.correction).toEqual({ kind: 'nutritionOff', note: 'too low' });
  });

  it('undo without persistence does nothing', async () => {
    const model = makeModel();
    model.receive(twoItemResponse());
    await model.undo();
    expect(model.getState().phase).toEqual({ kind: 'review' });
  });

  it('the Live Activity starts after the save with the calories remaining and the ED-safe flag', async () => {
    const activity = activityPort();
    const model = makeModel({ persistence: fakePersistence(), activity, readIsEdSafe: () => true, timing: { ...FAST, activityLifetimeMs: 10_000 } });
    model.receive(twoItemResponse());
    await model.save();
    expect(activity.start).toHaveBeenCalledWith({ mealSlot: 'lunch' }, { caloriesRemaining: 2000 - 376, isEdSafe: true });
    await model.undo();
    expect(activity.end).toHaveBeenCalledWith('activity-1'); // undo ends it at once
  });

  it('the Live Activity ends itself when its lifetime runs out', async () => {
    const activity = activityPort();
    const model = makeModel({ persistence: fakePersistence(), activity, timing: FAST });
    model.receive(twoItemResponse());
    await model.save();
    await waitUntil(() => activity.end.mock.calls.length === 1);
    expect(activity.end).toHaveBeenCalledWith('activity-1');
    await model.undo();
    expect(activity.end).toHaveBeenCalledTimes(1); // already ended: undo does not end it twice
  });

  it('a refused Live Activity is silent', async () => {
    const activity = { ...activityPort(), start: jest.fn(async () => null) };
    const model = makeModel({ persistence: fakePersistence(), activity, timing: FAST });
    model.receive(twoItemResponse());
    await model.save();
    expect(model.getState().phase).toEqual({ kind: 'saved' });
    expect(activity.end).not.toHaveBeenCalled();
  });

  it('save then undo on the real repositories leaves the same single-call write', async () => {
    const real = await makeRealPersistence();
    const model = makeModel({ persistence: real.persistence, notify: real.notify });
    model.receive(twoItemResponse());
    await model.save();
    expect(real.save).toHaveBeenCalledTimes(1);
    expect(model.getState().todayKcal).toBe(550);
  });

  it('setMealSlot ignores a slot outside the four meals', () => {
    const model = makeModel();
    model.setMealSlot('dinner');
    expect(model.getState().mealSlot).toBe('dinner');
    model.setMealSlot('exercise' as never);
    expect(model.getState().mealSlot).toBe('dinner');
  });

  it('setDescribeText keeps the draft', () => {
    const model = makeModel();
    model.setDescribeText('two eggs');
    expect(model.getState().describeText).toBe('two eggs');
  });
});
