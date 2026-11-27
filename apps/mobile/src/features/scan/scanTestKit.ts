/**
 * Shared builders for the scan tests: synthetic responses (the Swift `twoItemResponse`), a gated API
 * (the Swift `GateAPI` actor) and a model wired to real repositories on an in-memory sql.js database.
 * Test-only: nothing in the app imports this file.
 */
import { KcalArithmetic } from '@coachcal/core';
import type { ScanRequest, ScanResponse } from '@coachcal/api-contract';

import type { CoachCalApi } from '../../data/api/scanClient';
import { createCatalogRepository } from '../../data/repos/catalogRepository';
import { createDiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import { createDiaryEntryRepository, fetchDiaryEntry } from '../../data/repos/diaryEntryRepository';
import { createEngagementRepository } from '../../data/repos/engagementRepository';
import { createTargetRepository } from '../../data/repos/targetRepository';
import { createRepoFixture, FIXED_NOW_MS, type RepoFixture } from '../../data/repos/testing/fixtures';
import { createScanModel, type ScanModel, type ScanModelOptions } from './scanModel';
import { createScanPersistence } from './scanPersistence';

export const OWNER_ID = 'de000000-0000-4000-8000-000000000001';
export const FIXED_NOW = new Date(1_760_000_000_000);

type ScanItem = ScanResponse['items'][number];

export function item(input: {
  label: string;
  grams: number;
  per100gKcal: number;
  confidence: number;
  hiddenFatLikely: boolean;
  unresolved: boolean;
}): ScanItem {
  const per100g = { kcal: input.per100gKcal, proteinG: 10, carbsG: 20, fatG: 5, fiberG: 1 };
  return {
    label: input.label,
    grams: input.grams,
    gramsBasis: 'estimated',
    confidence: input.confidence,
    hiddenFatLikely: input.hiddenFatLikely,
    source: 'cache',
    per100g,
    kcal: KcalArithmetic.mealKcal(input.per100gKcal, input.grams),
    proteinG: (per100g.proteinG * input.grams) / 100,
    carbsG: (per100g.carbsG * input.grams) / 100,
    fatG: (per100g.fatG * input.grams) / 100,
    fiberG: (per100g.fiberG * input.grams) / 100,
    unresolved: input.unresolved,
  };
}

export function twoItemResponse(): ScanResponse {
  return {
    scanId: 'aa000000-0000-4000-8000-00000000aa01',
    kind: 'photo',
    items: [
      item({ label: 'chicken-rice', grams: 320, per100gKcal: 145, confidence: 0.92, hiddenFatLikely: false, unresolved: false }),
      item({ label: 'house-dressing', grams: 20, per100gKcal: 430, confidence: 0.42, hiddenFatLikely: true, unresolved: false }),
    ],
    mealKcal: 550,
    scanConfidence: 0.92,
    note: null,
  };
}

/** The Swift `GateAPI`: every call parks until a test resumes them all. */
export class GateApi implements CoachCalApi {
  private resolvers: Array<(response: ScanResponse) => void> = [];
  calls: ScanRequest[] = [];

  analyzeFood(request: ScanRequest): Promise<ScanResponse> {
    this.calls.push(request);
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  resumeAll(response: ScanResponse): void {
    for (const resolve of this.resolvers) resolve(response);
    this.resolvers = [];
  }
}

/** A polling wait for the async cases (real timers); fails loudly instead of hanging. */
export async function waitUntil(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`condition never became true within ${timeoutMs}ms`);
}

export function silentApi(): CoachCalApi {
  return {
    analyzeFood: () => {
      throw new Error('silentApi: this test must not reach the API');
    },
  };
}

export function makeModel(options: Partial<ScanModelOptions> = {}): ScanModel {
  return createScanModel({
    api: silentApi(),
    ownerId: OWNER_ID,
    now: () => FIXED_NOW,
    mealSlot: 'lunch',
    ...options,
  });
}

export type RealPersistence = {
  fixture: RepoFixture;
  save: jest.Mock;
  persistence: ReturnType<typeof createScanPersistence>;
  catalog: ReturnType<typeof createCatalogRepository>;
  notify: jest.Mock;
  calls: string[];
};

/** Real repositories over sql.js; `save` and `notify` record into one ordered call log. */
export async function makeRealPersistence(): Promise<RealPersistence> {
  const fixture = await createRepoFixture();
  const entries = createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: () => new Date(FIXED_NOW_MS) });
  const catalog = createCatalogRepository(fixture.db);
  const calls: string[] = [];
  const save = jest.fn(async (...args: Parameters<typeof entries.recordUpserts>) => {
    calls.push('save');
    return entries.recordUpserts(...args);
  });
  const notify = jest.fn(() => {
    calls.push('notify');
  });
  const persistence = createScanPersistence({
    entries: { recordUpserts: save, recordTombstone: entries.recordTombstone },
    details: createDiaryDetailRepository(fixture.db),
    catalog,
    targets: createTargetRepository(fixture.db),
    engagement: createEngagementRepository(fixture.db),
    fetchEntry: (id) => fetchDiaryEntry(fixture.db, id),
    ownerId: OWNER_ID,
  });
  return { fixture, save, persistence, catalog, notify, calls };
}
