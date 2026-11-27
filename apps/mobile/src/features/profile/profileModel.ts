/**
 * ProfileModel.swift — the profile tab's stats snapshot. Swift observes the
 * database with a ValueObservation; here the route binds one `loadStats` query
 * bundle (the same SQL) and the model holds the latest snapshot, refreshed on
 * demand. Dependencies are constructor-injected (standing order 19): the route
 * file builds them from the data environment; Jest builds them with doubles.
 *
 * React surface: the model bumps a `revision` on every mutation, so screens
 * subscribe with `useSyncExternalStore(model.subscribe, model.getRevision)`
 * and read the fields directly — the RN counterpart of Swift's `@Observable`.
 */
import type { UserTarget } from '../../data/repos/targetRepository';

/** ProfileModel.Stats: the target, the latest weight, the 30-day logged days and the member-since date. */
export interface ProfileStats {
  target: UserTarget | null;
  latestKg: number | null;
  daysLogged: number;
  memberSince: Date | null;
}

export const EMPTY_STATS: ProfileStats = {
  target: null,
  latestKg: null,
  daysLogged: 0,
  memberSince: null,
};

/** Constructor-injected dependencies (`ProfileModel.init`). */
export interface ProfileModelDeps {
  /** The user of the session when one exists, else the demo user; the route passes it. */
  ownerId: string;
  /** The injected clock (`now: @Sendable () -> Date` in the Swift app). */
  now: () => Date;
  /** The route binds this to the stats queries over the data environment. */
  loadStats: () => Promise<ProfileStats>;
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The display-only plan line (ProfileView.planLine): "Free · Since Sep 2026",
 * or "<plan> plan" before the first target exists. The month is pinned en-US
 * (abbreviated month + year) without Intl, like the other pinned-en-US
 * formatters of this port, so host locales cannot drift the copy.
 */
export function planLine(planName: string, memberSince: Date | null): string {
  if (memberSince === null) return `${planName} plan`;
  const month = MONTH_ABBREVIATIONS[memberSince.getMonth()] ?? '';
  return `${planName} · Since ${month} ${memberSince.getFullYear()}`;
}

export class ProfileModel {
  readonly ownerId: string;
  stats: ProfileStats = EMPTY_STATS;

  private readonly now: () => Date;
  private readonly loadStats: () => Promise<ProfileStats>;

  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  constructor(deps: ProfileModelDeps) {
    this.ownerId = deps.ownerId;
    this.now = deps.now;
    this.loadStats = deps.loadStats;
  }

  // -- React seam ------------------------------------------------------------

  /** Re-renders subscribers on every mutation; snapshot is a stable number. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  readonly getRevision = (): number => this.revision;

  private touch(): void {
    this.revision += 1;
    for (const listener of [...this.subscribers]) listener();
  }

  currentDate(): Date {
    return this.now();
  }

  /** The 30-day window start as a day key (ProfileModel.dayString over now−29d). */
  monthStartDay(): string {
    const start = new Date(this.now().getTime() - 29 * 24 * 60 * 60 * 1000);
    const y = String(start.getFullYear()).padStart(4, '0');
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Re-reads the stats snapshot; the route calls it when the screen appears. */
  async refresh(): Promise<void> {
    this.stats = await this.loadStats();
    this.touch();
  }
}

export function createProfileModel(deps: ProfileModelDeps): ProfileModel {
  return new ProfileModel(deps);
}
