/**
 * The paywall's state (U-77, frame "Plans / paywall" + round-3 states): the
 * shell loads the store's plan options and ends in one of three states —
 * loading, failed, ready. This build connects no store, so the route injects a
 * loader that always rejects and the screen always ends in the failed state;
 * the model itself is store-shaped so the future store port drops in.
 *
 * Prices never come from this feature: an option's price, trial flag and trial
 * detail are whatever the injected loader returned (`null` renders "Price
 * unavailable"), so the screen can never show a sample price (D13).
 *
 * React surface: the model bumps a `revision` on every mutation, so the screen
 * subscribes with `useSyncExternalStore(model.subscribe, model.getRevision)`.
 */

/** One plan option exactly as the store reported it — no invented fields. */
export interface PlanOption {
  /** The store's product id (`plans.option.<id>`). */
  id: string;
  /** The store's display name ("Yearly", "Monthly"). */
  title: string;
  /** The store's trial/subtitle line; null when the product has none. */
  detail: string | null;
  /** The store's display price; null renders "Price unavailable". */
  price: string | null;
  /** Whether the store reported an introductory offer (drives the CTA's label). */
  trial: boolean;
}

export type PaywallState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; options: readonly PlanOption[]; selectedId: string | null };

/** Constructor-injected dependencies (standing order 19); the route binds the real (missing) store. */
export interface PaywallModelDeps {
  /** The store's product read; rejects while no store is connected. */
  loadOptions: () => Promise<readonly PlanOption[]>;
  /** The store's restore (`AppStore.sync()`'s future port). */
  restore: () => Promise<void>;
  /** The store's purchase; only reachable in the ready state. */
  purchase: (optionId: string) => Promise<void>;
}

export class PaywallModel {
  state: PaywallState = { kind: 'loading' };

  private readonly deps: PaywallModelDeps;

  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  constructor(deps: PaywallModelDeps) {
    this.deps = deps;
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

  // -- Loads -------------------------------------------------------------------

  /**
   * The load the screen runs on appear and on "Try again": loading → ready
   * (the store's options, the first plan preselected — nothing is selected
   * apart from the plan choice) or failed. Restore and close stay available in
   * every state.
   */
  async load(): Promise<void> {
    this.state = { kind: 'loading' };
    this.touch();
    try {
      const options = await this.deps.loadOptions();
      this.state = { kind: 'ready', options, selectedId: options[0]?.id ?? null };
    } catch {
      this.state = { kind: 'failed' };
    }
    this.touch();
  }

  /** "Try again" on the failed card. */
  retry(): void {
    void this.load();
  }

  /** Selects a plan option (ready state only). */
  select(optionId: string): void {
    if (this.state.kind !== 'ready') return;
    this.state = { ...this.state, selectedId: optionId };
    this.touch();
  }

  /** The nav bar's Restore — available in every state. */
  async restore(): Promise<void> {
    await this.deps.restore();
    this.touch();
  }

  /** The dock's primary (ready state only): the store's purchase. */
  async purchaseSelected(): Promise<void> {
    if (this.state.kind !== 'ready' || this.state.selectedId === null) return;
    await this.deps.purchase(this.state.selectedId);
    this.touch();
  }
}

export function createPaywallModel(deps: PaywallModelDeps): PaywallModel {
  return new PaywallModel(deps);
}
