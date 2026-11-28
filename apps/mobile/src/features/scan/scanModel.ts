/**
 * ScanModel.swift — the scan flow state machine (RESEARCH Pattern 1): capture → analyzing →
 * review / saved / quota / failed. A framework-free store with injected dependencies, the way the Swift
 * model takes `api`, `persistence`, `userId` and `now` in its `init` (standing-order rule 19): nothing in
 * this file opens the database, reads process arguments or imports the sync runtime.
 *
 * Invariant I6: displayed kcal is ALWAYS recomputed through `KcalArithmetic` from the CURRENT grams; the
 * response's kcal fields are never the display source after an edit.
 *
 * Swift `Task`s become a generation counter: `cancelAnalyzing` bumps it, and every continuation of an
 * older generation returns without touching state (a stale resume must never clobber a newer analysis).
 */
import { dayKey, KcalArithmetic } from '@coachcal/core';
import type { ScanResponse } from '@coachcal/api-contract';

import type { CoachCalApi } from '../../data/api/scanClient';
import { buildScanRequest, isScanApiError } from '../../data/api/scanClient';
import type { DiaryEntry, EntryDetailUpsert } from '../../data/repos/diaryEntryRepository';
import { newUuid } from '../../data/sync/uuid';
import { noopScanActivity } from './scanActivity';
import {
  MEAL_SLOTS,
  type CorrectionKind,
  type MealSlot,
  type ResultItem,
  type ScanActivityPort,
  type ScanCapture,
  type ScanPersistence,
  type ScanState,
  type ThumbSource,
} from './scanTypes';

export type ScanModelTiming = {
  /** The Live Activity ends itself this long after the save (60 s). */
  activityLifetimeMs: number;
};

export const DEFAULT_TIMING: ScanModelTiming = { activityLifetimeMs: 60_000 };

export type ScanModelOptions = {
  api: CoachCalApi;
  ownerId: string;
  now: () => Date;
  mealSlot: MealSlot;
  /** Absent = nothing can be saved (the Swift `persistence: nil`). */
  persistence?: ScanPersistence;
  /** The sync/notification/widget fan-out, called after every repository write (`notifyMutation`). */
  notify?: () => void;
  activity?: ScanActivityPort;
  /** Read at save time only, to carry the ED-safe flag into the Live Activity content. */
  readIsEdSafe?: () => boolean;
  newId?: () => string;
  timing?: Partial<ScanModelTiming>;
};

type Listener = () => void;

const INITIAL_TITLE = 'Scanned meal';

// ---------------------------------------------------------------------------
// Pure derivations — the kcal rule lives here (T-P05-02).
// ---------------------------------------------------------------------------

/** Deterministic recompute from CURRENT grams — never the fixture's kcal. */
export function itemKcalOf(state: ScanState, itemId: number): number {
  const found = state.result?.items.find((candidate) => candidate.id === itemId);
  return found === undefined ? 0 : KcalArithmetic.mealKcal(found.source.per100g.kcal, found.grams);
}

export function mealKcalOf(state: ScanState): number {
  return (state.result?.items ?? []).reduce((total, candidate) => total + itemKcalOf(state, candidate.id), 0);
}

/** Protein, carbs and fat of the meal from the CURRENT grams, whole grams (the review's macro dots). */
export function mealMacrosOf(state: ScanState): { proteinG: number; carbsG: number; fatG: number } {
  const items = state.result?.items ?? [];
  const sum = (pick: (per100g: ResultItem['source']['per100g']) => number): number =>
    Math.round(items.reduce((total, candidate) => total + KcalArithmetic.macroGrams(pick(candidate.source.per100g), candidate.grams), 0));
  return { proteinG: sum((per100g) => per100g.proteinG), carbsG: sum((per100g) => per100g.carbsG), fatG: sum((per100g) => per100g.fatG) };
}

export function hasHiddenFat(state: ScanState): boolean {
  return state.result?.items.some((candidate) => candidate.source.hiddenFatLikely) ?? false;
}

/** The chip's "+{kcal} added": the recomputed contribution of the not-fully-visible items already in the total. */
export function hiddenFatAddedKcal(state: ScanState): number {
  return (state.result?.items ?? [])
    .filter((candidate) => candidate.source.hiddenFatLikely)
    .reduce((total, candidate) => total + itemKcalOf(state, candidate.id), 0);
}

export function hasUnresolved(state: ScanState): boolean {
  return state.result?.items.some((candidate) => candidate.isUnresolved) ?? false;
}

/** How many items still need the user's answer: the count the disabled Save names ("Resolve 1 item to save"). */
export function unresolvedCount(state: ScanState): number {
  return state.result?.items.filter((candidate) => candidate.isUnresolved).length ?? 0;
}

export function isSaveEnabled(state: ScanState): boolean {
  return state.result !== null && state.result.items.length > 0 && !hasUnresolved(state) && !state.isAnalyzing && !state.isSaving && state.savedEntryIds.length === 0;
}

function initialState(mealSlot: MealSlot): ScanState {
  return {
    phase: { kind: 'capture' },
    result: null,
    isAnalyzing: false,
    captureThumb: null,
    mealTitle: INITIAL_TITLE,
    mealSlot,
    describeText: '',
    savedEntryIds: [],
    isSaving: false,
    savedKcal: null,
    todayKcal: null,
    goalKcal: null,
    streakCount: null,
    freezesLeft: 0,
  };
}

export function createScanModel(options: ScanModelOptions) {
  const { api, ownerId, now, persistence, notify } = options;
  const activity = options.activity ?? noopScanActivity;
  const newId = options.newId ?? (() => newUuid().toLowerCase());
  const timing: ScanModelTiming = { ...DEFAULT_TIMING, ...options.timing };

  let state = initialState(options.mealSlot);
  const listeners = new Set<Listener>();
  // `analyzeTask`/`workTask` of the Swift model: a generation, bumped on cancel and on every start.
  let generation = 0;
  let activityId: string | null = null;

  function set(patch: Partial<ScanState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  // MARK: - Analyze

  function startAnalyzing(thumb: ThumbSource | null | undefined, request: ReturnType<typeof buildScanRequest>): void {
    if (state.isAnalyzing) return;
    generation += 1;
    const mine = generation;
    set({ isAnalyzing: true, phase: { kind: 'analyzing' }, ...(thumb === undefined ? {} : { captureThumb: thumb }) });
    // The API call starts at once; a synchronous throw is a failed call, like a thrown Swift Task.
    const work = (async () => api.analyzeFood(request))();
    void finishAnalyzing(work, mine);
  }

  /**
   * The scan API answers in one request, so the client observes no stage: no dwell, no timer. The result
   * (or the failure) lands the moment the call settles, unless a newer generation has taken over.
   */
  async function finishAnalyzing(work: Promise<ScanResponse>, mine: number): Promise<void> {
    const stale = () => mine !== generation;
    try {
      const response = await work;
      // A cancelled run must never touch state: cancelAnalyzing may already have started a new analysis.
      if (stale()) return;
      receive(response);
    } catch (error) {
      if (stale()) return;
      route(error);
    }
    if (!stale()) set({ isAnalyzing: false });
  }

  function analyze(capture: ScanCapture): void {
    startAnalyzing(capture.thumb, capture.request);
  }

  function analyzeDescription(description: string): void {
    startAnalyzing(undefined, buildScanRequest({ kind: 'text', text: description }));
  }

  function cancelAnalyzing(): void {
    if (!state.isAnalyzing) return;
    generation += 1;
    set({ phase: { kind: 'capture' }, isAnalyzing: false });
  }

  // MARK: - Result state

  function receive(response: ScanResponse): void {
    const items: ResultItem[] = response.items.map((source, index) => ({
      id: index,
      source,
      grams: source.grams,
      isUnresolved: source.unresolved,
      correction: null,
    }));
    set({
      result: { scanId: response.scanId, items, scanConfidence: response.scanConfidence },
      mealTitle: INITIAL_TITLE,
      phase: { kind: 'review' },
    });
  }

  function route(error: unknown): void {
    // Swift: `error.isQuotaReached, case .envelope` — only a decoded FREE_LIMIT_REACHED envelope reaches the quota state.
    if (isScanApiError(error) && error.kind === 'envelope' && error.code === 'FREE_LIMIT_REACHED') {
      // The limit and the reset day belong to the server: an envelope without an entitlement yields none.
      set({ phase: { kind: 'quotaReached', entitlement: error.entitlement ?? null } });
    } else if (isScanApiError(error) && error.isBarcodeNotFound) {
      set({ phase: { kind: 'failed', failure: 'barcodeNotFound' } });
    } else {
      set({ phase: { kind: 'failed', failure: 'analysisFailure' } });
    }
  }

  function reportCaptureFailure(): void {
    if (state.isAnalyzing) return;
    set({ phase: { kind: 'failed', failure: 'analysisFailure' } });
  }

  function retry(): void {
    set({ phase: { kind: 'capture' } });
  }

  function retake(): void {
    set({ result: null, captureThumb: null, phase: { kind: 'capture' } });
  }

  function startNewScan(): void {
    set({ result: null, captureThumb: null, savedEntryIds: [], savedKcal: null, phase: { kind: 'capture' } });
  }

  // MARK: - Review edits (kcal invariant lives here)

  function setGrams(grams: number, itemId: number): void {
    const result = state.result;
    if (result === null || !result.items.some((candidate) => candidate.id === itemId)) return;
    const clamped = Math.max(0, grams);
    set({
      result: { ...result, items: result.items.map((candidate) => (candidate.id === itemId ? { ...candidate, grams: clamped } : candidate)) },
    });
  }

  function captureCorrection(kind: CorrectionKind, note: string, itemId: number, options?: { includePhoto?: boolean }): void {
    const result = state.result;
    if (result === null || !result.items.some((candidate) => candidate.id === itemId)) return;
    set({
      result: {
        ...result,
        // Resolving the flagged concern is the only path off "Review needed".
        items: result.items.map((candidate) =>
          candidate.id === itemId
            ? { ...candidate, correction: options?.includePhoto ? { kind, note, includePhoto: true } : { kind, note }, isUnresolved: false }
            : candidate,
        ),
      },
    });
  }

  /** "Remove item": drops the item from the review; the total follows because it is recomputed from the rest. */
  function removeItem(itemId: number): void {
    const result = state.result;
    if (result === null || !result.items.some((candidate) => candidate.id === itemId)) return;
    set({ result: { ...result, items: result.items.filter((candidate) => candidate.id !== itemId) } });
  }

  // MARK: - Save / Undo

  async function save(): Promise<void> {
    const result = state.result;
    if (state.isSaving || result === null || persistence === undefined || !isSaveEnabled(state)) return;
    // Set before the first await: a second concurrent call sees isSaving and is rejected.
    set({ isSaving: true });
    const stamp = now();
    try {
      const upserts: EntryDetailUpsert[] = result.items.map((candidate, position) => {
        const entryId = newId();
        const per100g = candidate.source.per100g;
        return {
          entry: {
            id: entryId,
            userId: ownerId,
            displayText: candidate.source.label,
            createdAt: stamp,
            updatedAt: stamp,
            deletedAt: null,
            serverVersion: 0,
            acceptedOpId: null,
            serverUpdatedAt: stamp,
          },
          detail: {
            entryId,
            mealSlot: state.mealSlot,
            title: position === 0 ? state.mealTitle : candidate.source.label,
            grams: candidate.grams,
            kcal: itemKcalOf(state, candidate.id),
            proteinG: KcalArithmetic.macroGrams(per100g.proteinG, candidate.grams),
            carbsG: KcalArithmetic.macroGrams(per100g.carbsG, candidate.grams),
            fatG: KcalArithmetic.macroGrams(per100g.fatG, candidate.grams),
            fiberG: KcalArithmetic.macroGrams(per100g.fiberG, candidate.grams),
            confidence: candidate.source.confidence,
            hiddenFatLikely: candidate.source.hiddenFatLikely,
            source: 'scan',
            unresolved: candidate.isUnresolved,
            scanId: result.scanId,
          },
        };
      });
      // ONE call for the whole batch; then the fan-out.
      const operations = await persistence.save(upserts, stamp);
      set({ savedEntryIds: operations.map((operation) => operation.recordId) });
      notify?.();
      set({ savedKcal: mealKcalOf(state), phase: { kind: 'saved' } });
      await persistSavedMeal();
      await loadSavedContext();
      await startBoundedLiveActivity();
    } catch {
      // Local-first write failure keeps the review open so Save can retry from a clean slate: the
      // rolled-back transaction left nothing behind.
    } finally {
      set({ isSaving: false });
    }
  }

  /** A second Undo press while the first is still writing must not tombstone twice. */
  let isUndoing = false;

  /** Tombstones the just-written entries and deletes their detail rows. */
  async function undo(): Promise<void> {
    if (persistence === undefined || state.savedEntryIds.length === 0 || isUndoing) return;
    isUndoing = true;
    const entryIds = state.savedEntryIds;
    for (const entryId of entryIds) {
      const entry: DiaryEntry | null = await persistence.fetchEntry(entryId).catch(() => null);
      if (entry !== null) await persistence.tombstone(entry, { now: now() }).catch(() => undefined);
      await persistence.deleteDetail(entryId).catch(() => undefined);
    }
    notify?.();
    set({ savedEntryIds: [], savedKcal: null, phase: { kind: 'review' } });
    isUndoing = false;
    await endLiveActivityImmediately();
    await loadSavedContext();
  }

  /** LOG-07: itemsJson mirrors SavedMealItem's [{name, grams, kcal}] shape the one-tap re-log decodes. */
  async function persistSavedMeal(): Promise<void> {
    const result = state.result;
    if (persistence === undefined || result === null) return;
    const items = result.items.map((candidate) => ({
      name: candidate.source.label,
      grams: candidate.grams,
      kcal: itemKcalOf(state, candidate.id),
    }));
    try {
      await persistence.saveMeal({
        id: newId(),
        userId: ownerId,
        name: state.mealTitle,
        symbol: null,
        kcal: mealKcalOf(state),
        itemsJson: JSON.stringify(items),
        createdAt: now(),
      });
    } catch {
      // Best effort: the rail is a convenience, the diary write above already committed.
    }
  }

  async function loadSavedContext(): Promise<void> {
    if (persistence === undefined) return;
    try {
      const context = await persistence.loadSavedContext(dayKey(now()));
      set({
        todayKcal: context.todayKcal,
        goalKcal: context.goalKcal,
        streakCount: context.streakCount,
        freezesLeft: context.freezesLeft,
      });
    } catch {
      // Best effort: the saved card renders without the "Today so far" peek.
    }
  }

  /**
   * ENG-04: a bounded Live Activity right after a successful save that ends itself ~60 s later; undo
   * can shorten that window. A refusal is silent: Live Activities are optional.
   */
  async function startBoundedLiveActivity(): Promise<void> {
    const remaining = state.todayKcal === null ? 0 : (state.goalKcal ?? 0) - state.todayKcal;
    const started = await activity
      .start({ mealSlot: state.mealSlot }, { caloriesRemaining: remaining, isEdSafe: options.readIsEdSafe?.() ?? false })
      .catch(() => null);
    if (started === null) return;
    activityId = started;
    // Each activity ends itself on its own timer, independent of what the shared slot holds now: a
    // second scan saved before the timer fires must not orphan this one or end the newer one.
    const timer = setTimeout(() => {
      if (activityId === started) activityId = null;
      void activity.end(started).catch(() => undefined);
    }, timing.activityLifetimeMs);
    // A pending 60 s timer must never hold a Node process (tests, scripts) open.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  async function endLiveActivityImmediately(): Promise<void> {
    if (activityId === null) return;
    const current = activityId;
    activityId = null;
    await activity.end(current).catch(() => undefined);
  }

  return {
    getState: (): ScanState => state,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    analyze,
    analyzeDescription,
    cancelAnalyzing,
    receive,
    reportCaptureFailure,
    retry,
    retake,
    startNewScan,

    setGrams,
    captureCorrection,
    removeItem,
    setMealTitle: (title: string) => set({ mealTitle: title }),
    setMealSlot: (slot: MealSlot) => set({ mealSlot: MEAL_SLOTS.includes(slot) ? slot : state.mealSlot }),
    setDescribeText: (text: string) => set({ describeText: text }),

    save,
    undo,

    itemKcal: (itemId: number) => itemKcalOf(state, itemId),
    mealKcal: () => mealKcalOf(state),
    mealMacros: () => mealMacrosOf(state),
    hasHiddenFat: () => hasHiddenFat(state),
    hiddenFatAddedKcal: () => hiddenFatAddedKcal(state),
    hasUnresolved: () => hasUnresolved(state),
    unresolvedCount: () => unresolvedCount(state),
    isSaveEnabled: () => isSaveEnabled(state),
  };
}

export type ScanModel = ReturnType<typeof createScanModel>;
