/**
 * ProgressFlow.swift's ProgressModel — the observable state of the Progress
 * tab: the observed snapshot (target, weights, week energy, streak, badges,
 * diary day-sets), the weight log write and the ENG-01 streak reconcile.
 * Constructor injection only (standing-order rule 19): Jest builds it with
 * test doubles over sql.js; the route wires the real seams. After the local
 * write the injected `notify` fans out and the model re-reads itself.
 */
import { StreakEngine } from '@coachcal/core';

import type { StreakState } from '../../data/repos/engagementRepository';
import type { Clock, IdGenerator, SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository } from '../../data/repos/targetRepository';
import type { TrackingRepository } from '../../data/repos/trackingRepository';
import type { ChartPoint } from '../../design';

import { addDays, clampKg, dateFromDay, dayString, RANGE_WINDOW_DAYS, type ProgressRange } from './progressMath';
import { createProgressSnapshotLoader, type DayKcal, type ProgressSnapshotData } from './progressSnapshot';
import type { EngagementRepository } from '../../data/repos/engagementRepository';

export type { DayKcal };

export type ProgressDeps = {
  /** The open database handle — Swift's DatabasePool, read-only uses. */
  db: SqlDb;
  targets: TargetRepository;
  tracking: TrackingRepository;
  engagement: EngagementRepository;
  ownerId: string;
  /** `notifyLocalMutation()` — called after the weight write so other tabs re-read. */
  notify: () => void;
  /** The re-read signal: fires after every local write and sync run. */
  subscribe: (listener: () => void) => () => void;
  now: Clock;
  newId: IdGenerator;
};

export type ProgressSnapshot = ProgressSnapshotData;

export type ProgressModel = {
  /** The observed snapshot — `useSyncExternalStore(model.subscribe, model.getSnapshot)`. */
  getSnapshot(): ProgressSnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-reads the database and publishes, then reconciles the streak. */
  refresh(): Promise<void>;
  /**
   * The logged weight series, oldest first. Without a range the full
   * observed series; with one, the trailing window's slice of it.
   */
  weightPoints(range?: ProgressRange): ChartPoint[];
  latestKg(): number | null;
  goalKg(): number | null;
  startKg(): number | null;
  weekKcals(): DayKcal[];
  targetKcal(): number | null;
  /** Clamps and snaps at this boundary, writes local-only (I4), notifies, re-reads. */
  logWeight(kg: number): Promise<void>;
};

export function createProgressModel(deps: ProgressDeps): ProgressModel {
  const load = createProgressSnapshotLoader({
    db: deps.db,
    targets: deps.targets,
    tracking: deps.tracking,
    engagement: deps.engagement,
    ownerId: deps.ownerId,
  });

  let snapshot: ProgressSnapshot = {
    target: null,
    weights: [],
    weekKcals: [],
    streak: null,
    badges: [],
    diaryDays: new Set<string>(),
    streakDiaryDays: new Set<string>(),
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
    snapshot = await load(deps.now());
    emit();
    await reconcileStreak();
  }

  // ENG-01: recompute the streak from the observed diary day-set + persisted
  // state; persist through EngagementRepository whenever the outcome changes.
  // The diary day-set is a trailing-window observation, so while the persisted
  // streak is still alive (lastLoggedDay yesterday-or-today) it stays the
  // floor for the current streak.
  async function reconcileStreak(): Promise<void> {
    const persisted = snapshot.streak;
    if (persisted === null) {
      return;
    }
    const now = deps.now();
    const outcome = StreakEngine.evaluate({
      loggedDays: snapshot.streakDiaryDays,
      freezesLeft: persisted.freezesLeft,
      bestStreak: persisted.bestStreak,
      freezeUsedOn: persisted.freezeUsedOn,
      now,
    });
    const today = dayString(now);
    const yesterday = dayString(addDays(now, -1));
    const alive = persisted.lastLoggedDay === today || persisted.lastLoggedDay === yesterday;
    const lastLoggedDay = maxDay(snapshot.streakDiaryDays) ?? persisted.lastLoggedDay;
    const updated: StreakState = {
      id: persisted.id,
      currentStreak: alive ? Math.max(outcome.currentStreak, persisted.currentStreak) : outcome.currentStreak,
      bestStreak: Math.max(persisted.bestStreak, outcome.bestStreak),
      freezesLeft: outcome.freezesLeft,
      freezeUsedOn: outcome.freezeUsedOn,
      lastLoggedDay,
    };
    if (!streakStatesEqual(updated, persisted)) {
      // Best effort, as the Swift `try?`: a failed local save keeps the read snapshot.
      try {
        await deps.engagement.saveStreakState(updated);
      } catch {
        // keep the last snapshot
      }
      snapshot = { ...snapshot, streak: updated };
      emit();
    }
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
    weightPoints: (range?: ProgressRange) => {
      const all = snapshot.weights.flatMap((log) => {
        const date = dateFromDay(log.day);
        return date === null ? [] : [{ date, value: log.kg, label: log.day }];
      });
      if (range === undefined) {
        return all;
      }
      // The trailing window in local days (a day key compares lexicographically).
      const windowStart = dayString(addDays(deps.now(), -(RANGE_WINDOW_DAYS[range] - 1)));
      return all.filter((point) => point.label >= windowStart);
    },
    latestKg: () => snapshot.weights.at(-1)?.kg ?? null,
    goalKg: () => snapshot.target?.goalWeightKg ?? null,
    startKg: () => snapshot.weights[0]?.kg ?? null,
    weekKcals: () => snapshot.weekKcals,
    targetKcal: () => snapshot.target?.dailyKcal ?? null,
    async logWeight(kg) {
      await deps.tracking.addWeight({
        id: deps.newId(),
        userId: deps.ownerId,
        day: dayString(deps.now()),
        kg: clampKg(kg),
        createdAt: deps.now(),
      });
      // Local-only write (I4): notify still fires so Today and Coach re-read.
      deps.notify();
      await refresh();
    },
  };
}

/** Lexicographic max of `YYYY-MM-DD` keys (Swift Set.max() over comparable strings). */
function maxDay(days: ReadonlySet<string>): string | null {
  let max: string | null = null;
  for (const day of days) {
    if (max === null || day > max) {
      max = day;
    }
  }
  return max;
}

function streakStatesEqual(a: StreakState, b: StreakState): boolean {
  return (
    a.id === b.id &&
    a.currentStreak === b.currentStreak &&
    a.bestStreak === b.bestStreak &&
    a.freezesLeft === b.freezesLeft &&
    a.freezeUsedOn === b.freezeUsedOn &&
    a.lastLoggedDay === b.lastLoggedDay
  );
}
