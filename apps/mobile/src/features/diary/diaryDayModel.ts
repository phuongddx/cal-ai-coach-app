/**
 * DiaryDayModel.swift — the observable state of the day sheet: the target, the
 * meal sections of the selected day (live-diary join), the day's exercise rows
 * and the delete / re-log-undo / exercise writes. Constructor injection only
 * (standing-order rule 19): the snapshot loader is built from the injected
 * repositories, writes go through the injected repositories, and after every
 * write the injected `notify` fans out before the model re-reads itself.
 */
import { fetchDiaryEntry } from '../../data/repos/diaryEntryRepository';

import type { DiaryDeps } from './deps';
import { dayString } from './diaryMath';
import { createDiaryDayLoader, type DiaryDayExercise, type DiaryDaySection, type DiaryDaySnapshotData } from './diarySnapshot';

export type DiaryDaySnapshot = DiaryDaySnapshotData;
export type { DiaryDayExercise, DiaryDaySection };

export type DiaryDayModel = {
  /** The observed snapshot — `useSyncExternalStore(model.subscribe, model.getSnapshot)`. */
  getSnapshot(): DiaryDaySnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-reads the day from the database and publishes. */
  refresh(): Promise<void>;
  getDay(): Date;
  /** Moves to another local day and re-reads; same-day calls are a no-op. */
  selectDay(date: Date): void;
  dayHeading(): string;
  isToday(): boolean;
  eatenKcal(): number;
  goalKcal(): number | null;
  leftKcal(): number | null;
  sectionKcal(section: DiaryDaySection): number;
  /** The day's burned-kcal sum (the exercise header figure); null without exercise rows. */
  burnedKcal(): number | null;
  items(slot: string): DiaryDaySnapshot['sections'][number]['items'];
  /** Tombstone + detail delete — the delete of the food row. */
  delete(item: DiaryDaySnapshot['sections'][number]['items'][number]): Promise<void>;
  /** Undo path: tombstone by id without needing the observed item. */
  deleteEntry(id: string): Promise<void>;
  /** Local-only exercise write (I4), then notify so Today re-reads. */
  addExercise(type: string, durationMin: number, kcalBurned: number | null): Promise<void>;
};

export function createDiaryDayModel(deps: DiaryDeps, initialDay: Date): DiaryDayModel {
  const loadDay = createDiaryDayLoader({
    db: deps.db,
    targets: deps.targets,
    tracking: deps.tracking,
    ownerId: deps.ownerId,
  });

  let day = initialDay;
  let snapshot: DiaryDaySnapshot = {
    target: null,
    sections: ['breakfast', 'lunch', 'dinner', 'snacks'].map((slot) => ({ slot, items: [] })),
    exercises: [],
  };

  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  // The re-read signal: every local write and sync run elsewhere re-reads here.
  const unsubscribeExternal = deps.subscribe(() => {
    void refresh();
  });

  async function refresh(): Promise<void> {
    snapshot = await loadDay(dayString(day));
    emit();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    getDay: () => day,
    selectDay(date: Date) {
      if (dayString(date) === dayString(day)) {
        return;
      }
      day = date;
      void refresh();
    },
    dayHeading: () =>
      day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    isToday: () => dayString(day) === dayString(deps.now()),
    eatenKcal: () =>
      snapshot.sections.reduce((total, section) => total + sectionKcalOf(section), 0),
    goalKcal: () => snapshot.target?.dailyKcal ?? null,
    leftKcal: () => {
      const goal = snapshot.target?.dailyKcal;
      return goal === undefined ? null : Math.max(goal - eatenKcalOf(), 0);
    },
    sectionKcal: sectionKcalOf,
    burnedKcal: () => {
      if (snapshot.exercises.length === 0) {
        return null;
      }
      return snapshot.exercises.reduce((total, exercise) => total + (exercise.kcalBurned ?? 0), 0);
    },
    items: (slot: string) => snapshot.sections.find((section) => section.slot === slot)?.items ?? [],
    async delete(item) {
      // Tombstone (not hard delete) keeps the sync history; the detail row
      // goes with it — Swift's two writes, in the same order.
      await deps.diaryEntries.recordTombstone(item.entry, { now: deps.now() });
      await deps.diaryDetails.delete(item.id);
      deps.notify();
      await refresh();
    },
    async deleteEntry(id) {
      const entry = await fetchDiaryEntry(deps.db, id);
      if (entry === null) {
        return;
      }
      await deps.diaryEntries.recordTombstone(entry, { now: deps.now() });
      await deps.diaryDetails.delete(id);
      deps.notify();
      await refresh();
    },
    async addExercise(type, durationMin, kcalBurned) {
      await deps.tracking.addExercise({
        id: deps.newId(),
        userId: deps.ownerId,
        day: dayString(day),
        exerciseType: type,
        durationMin,
        kcalBurned,
        createdAt: deps.now(),
      });
      // Local-only write (I4): notify still fires so Today re-reads.
      deps.notify();
      await refresh();
    },
  };

  function sectionKcalOf(section: DiaryDaySection): number {
    return section.items.reduce((total, item) => total + (item.kcal ?? 0), 0);
  }

  function eatenKcalOf(): number {
    return snapshot.sections.reduce((total, section) => total + sectionKcalOf(section), 0);
  }
}
