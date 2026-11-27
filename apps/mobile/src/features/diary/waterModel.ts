/**
 * The water card model — TodayModel's water half (waterMl, goal glasses and
 * the clamped quick-add delta). It lives in the diary feature because DY-07
 * owns the water card and the log sheet; the Today unit mounts them.
 */
import type { TargetRepository } from '../../data/repos/targetRepository';
import type { TrackingRepository } from '../../data/repos/trackingRepository';
import type { Clock } from '../../data/repos/sqlDb';

/** WaterCard.glassMl — the plus and minus tiles and the glasses count. */
export const GLASS_ML = 250;

/** The water goal when the user has no target yet (TodayModel.waterGlasses). */
export const DEFAULT_GLASSES = 8;

export type WaterModelDeps = {
  tracking: TrackingRepository;
  targets: TargetRepository;
  ownerId: string;
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
  now: Clock;
  /** The day the card reads and writes; the route injects today. */
  day: () => string;
};

export type WaterModel = {
  getSnapshot(): { totalMl: number; glasses: number };
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  /** Quick-add delta clamped so the day total never goes below 0 ml. */
  logWaterDelta(deltaMl: number): Promise<void>;
};

export function createWaterModel(deps: WaterModelDeps): WaterModel {
  let snapshot = { totalMl: 0, glasses: DEFAULT_GLASSES };
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  // The re-read signal: every local write and sync run elsewhere re-reads here.
  deps.subscribe(() => {
    void refresh();
  });

  async function refresh(): Promise<void> {
    const [totalMl, target] = await Promise.all([
      deps.tracking.water(deps.day()),
      deps.targets.activeTarget(deps.ownerId),
    ]);
    snapshot = { totalMl, glasses: target?.waterGlasses ?? DEFAULT_GLASSES };
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
    async logWaterDelta(deltaMl: number) {
      const current = snapshot.totalMl;
      // The applied delta lands as a water_logs row (additive ledger); the
      // clamp holds the day total at exactly 0 ml.
      const applied = Math.max(current + deltaMl, 0) - current;
      if (applied === 0) {
        return;
      }
      await deps.tracking.addWater(applied, deps.day(), deps.ownerId, deps.now());
      deps.notify();
      await refresh();
    },
  };
}

/** WaterCard.glassesLogged — whole glasses drunk (Int division of non-negatives). */
export function glassesLogged(totalMl: number): number {
  return Math.floor(totalMl / GLASS_ML);
}
