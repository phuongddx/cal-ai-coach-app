/**
 * CoachFlow.swift's CoachModel — the observable state of the Coach tab: the
 * weekly review stats, the day's insights (seeded rows only — no adaptive
 * nudge generation, COA2-01 v2) and the greeting. Local rules only, no
 * network call. Constructor injection only (standing-order rule 19).
 */
import type { Clock, SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository } from '../../data/repos/targetRepository';
import type { Insight } from '../../data/repos/engagementRepository';
import type { EngagementRepository } from '../../data/repos/engagementRepository';

import { createCoachSnapshotLoader, type WeekStats } from './coachSnapshot';
import { dayString } from '../progress/progressMath';

export type { WeekStats };

export type CoachDeps = {
  /** The open database handle — Swift's DatabasePool, read-only uses. */
  db: SqlDb;
  targets: TargetRepository;
  engagement: EngagementRepository;
  ownerId: string;
  /** The re-read signal: fires after every local write and sync run. */
  subscribe: (listener: () => void) => () => void;
  now: Clock;
};

export type CoachSnapshot = {
  insights: Insight[];
  weekStats: WeekStats;
  targetKcal: number | null;
};

export type CoachModel = {
  /** The observed snapshot — `useSyncExternalStore(model.subscribe, model.getSnapshot)`. */
  getSnapshot(): CoachSnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-reads the database and the day's insights, then publishes. */
  refresh(): Promise<void>;
};

export function createCoachModel(deps: CoachDeps): CoachModel {
  const load = createCoachSnapshotLoader({
    db: deps.db,
    targets: deps.targets,
    ownerId: deps.ownerId,
  });

  let snapshot: CoachSnapshot = {
    insights: [],
    weekStats: { daysLogged: 0, daysOnTarget: 0, weeksAllLogged: 0, kgThisWeek: 0 },
    targetKcal: null,
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
    const data = await load(deps.now());
    const insights = await deps.engagement.insights(dayString(deps.now()));
    snapshot = { insights, weekStats: data.stats, targetKcal: data.targetKcal };
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
  };
}

/**
 * CoachModel.greeting — the hour buckets of the Swift static. The `timeZone`
 * argument is the calendar seam: the UI passes none (the process zone, like
 * `Calendar.current`); tests can pin a zone as their fixture.
 */
export function greeting(date: Date, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    ...(timeZone === undefined ? {} : { timeZone }),
  });
  const hour = Number(formatter.format(date));
  if (hour < 12) {
    return 'Good morning! 👋';
  }
  if (hour < 17) {
    return 'Good afternoon! 👋';
  }
  return 'Good evening! 👋';
}
