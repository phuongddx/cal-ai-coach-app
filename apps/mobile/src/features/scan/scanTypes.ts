/**
 * The vocabulary of the scan flow (`ScanModel.swift`, `AppEnvironment.swift`): meal slots, scan modes,
 * the phase machine and the seams the model is built from. Pure types, no runtime imports.
 */
import type { EntitlementState, ScanRequest, ScanResponse } from '@coachcal/api-contract';

import type { DiaryEntry, EntryDetailUpsert } from '../../data/repos/diaryEntryRepository';
import type { PendingOp } from '../../data/repos/pendingOp';
import type { SavedMeal } from '../../data/repos/catalogRepository';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

/** `ScanMode` of the Swift app: the viewfinder pills plus the describe (text) path. */
export type ScanMode = 'photo' | 'barcode' | 'label' | 'text';

export type AnalyzingStep = 'detecting' | 'reading' | 'checking' | 'confirming';
export const ANALYZING_STEPS: readonly AnalyzingStep[] = ['detecting', 'reading', 'checking', 'confirming'];

export const ANALYZING_STEP_TITLE: Record<AnalyzingStep, string> = {
  detecting: 'Detecting food',
  reading: 'Reading nutrition',
  checking: 'Checking accuracy',
  confirming: 'Confirming with a second pass',
};

export type ScanFailure = 'barcodeNotFound' | 'analysisFailure';

export type ScanPhase =
  | { kind: 'capture' }
  | { kind: 'analyzing'; step: AnalyzingStep }
  | { kind: 'review' }
  | { kind: 'saved' }
  | { kind: 'quotaReached'; entitlement: EntitlementState }
  | { kind: 'failed'; failure: ScanFailure };

export type CorrectionKind = 'wrongFood' | 'portionOff' | 'missingItem' | 'other';
export const CORRECTION_KINDS: readonly CorrectionKind[] = ['wrongFood', 'portionOff', 'missingItem', 'other'];
export const CORRECTION_KIND_TITLE: Record<CorrectionKind, string> = {
  wrongFood: 'Wrong food',
  portionOff: 'Portion way off',
  missingItem: 'Missing item',
  other: 'Something else',
};

export type Correction = { kind: CorrectionKind; note: string };

export type ScanItem = ScanResponse['items'][number];

export type ResultItem = {
  id: number;
  source: ScanItem;
  grams: number;
  isUnresolved: boolean;
  correction: Correction | null;
};

export type ScanResult = {
  scanId: string;
  items: ResultItem[];
  scanConfidence: number;
};

/** An image the screens can draw: the bundled fixture (`require`) or a file the camera/library wrote. */
export type ThumbSource = number | { uri: string };

/** One capture result for every seam: the still for the analyzing/review thumb plus the request it implies. */
export type ScanCapture = {
  thumb: ThumbSource | null;
  request: ScanRequest;
};

export type ScanState = {
  phase: ScanPhase;
  result: ScanResult | null;
  isAnalyzing: boolean;
  captureThumb: ThumbSource | null;
  mealTitle: string;
  mealSlot: MealSlot;
  describeText: string;
  savedEntryIds: string[];
  isSaving: boolean;
  savedKcal: number | null;
  todayKcal: number | null;
  goalKcal: number | null;
  streakCount: number | null;
  freezesLeft: number;
};

/** What the saved card shows besides the toast. */
export type SavedContext = {
  todayKcal: number | null;
  goalKcal: number | null;
  streakCount: number | null;
  freezesLeft: number;
};

/**
 * The persistence seam (`ScanModel.Persistence`). `save` is the diary repository's `recordUpserts`: mirror
 * rows, details and one pending op per entry in ONE transaction. `tombstone` is its `recordTombstone`.
 */
export interface ScanPersistence {
  save(upserts: EntryDetailUpsert[], now: Date): Promise<PendingOp[]>;
  fetchEntry(id: string): Promise<DiaryEntry | null>;
  tombstone(entry: DiaryEntry, options: { now: Date }): Promise<unknown>;
  deleteDetail(entryId: string): Promise<void>;
  saveMeal(meal: SavedMeal): Promise<void>;
  loadSavedContext(day: string): Promise<SavedContext>;
}

/** `CoachCalLiveActivityAttributes` content: calories left plus the ED-safe flag, read at save time. */
export type ScanActivityContent = { caloriesRemaining: number; isEdSafe: boolean };
export type ScanActivityAttributes = { mealSlot: MealSlot };

/** The Live Activity port (PL-12). The real implementation is U-43; the model only calls it. */
export interface ScanActivityPort {
  start(attributes: ScanActivityAttributes, content: ScanActivityContent): Promise<string | null>;
  update(activityId: string, content: ScanActivityContent): Promise<void>;
  end(activityId: string): Promise<void>;
}
