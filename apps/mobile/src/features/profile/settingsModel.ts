/**
 * SettingsModel — the settings detail's state and the single write paths of its
 * two toggles (SettingsDetailView.swift's bindings over AppEnvironment's
 * didSet persistence). Dependencies are constructor-injected (standing order
 * 19): the route file binds the real seams — the app-settings writer over the
 * data environment, the design system's policy flag, the account-deletion API,
 * the sync store and the auth sign-out; Jest builds them with test doubles.
 *
 * The wellness policy value is stored as '1'/'0' in the app_settings table
 * under the app-wide key the route injects; U-51 reads the same key at launch.
 * The design flag is applied through the injected setter so the policy branch
 * never enters this feature (invariant I7) and every screen re-renders through
 * the design hooks.
 *
 * React surface: the model bumps a `revision` on every mutation, so screens
 * subscribe with `useSyncExternalStore(model.subscribe, model.getRevision)`
 * and read the fields directly — the RN counterpart of Swift's `@Observable`.
 */

/** Constructor-injected dependencies (SettingsDetailView's injected closures). */
export interface SettingsModelDeps {
  /** The user of the session when one exists, else the demo user; the route passes it. */
  ownerId: string;
  /** The app-wide storage key of the wellness policy; the route passes it (U-51 reads the same key at launch). */
  policyStorageKey: string;
  /** The storage key of the burn add-back flag (Swift `HealthKitSettingsKey.burnAddBackEnabled`). */
  burnAddBackStorageKey: string;
  /** Whether the wellness policy is on at construction; the route passes the design flag's live value. */
  initialPolicyOn: boolean;
  /** The route binds the design system's single policy-flag setter. */
  applyPolicyFlag: (on: boolean) => void;
  /** The route binds the app-settings write over the data environment's database. */
  writeSetting: (key: string, value: string) => Promise<void>;
  /** The route binds the app-settings read over the data environment's database. */
  readSetting: (key: string) => Promise<string | null>;
  /** The route binds the account-deletion API call (best-effort cascade step 1). */
  deleteAccount: () => Promise<void>;
  /** The route binds the platform's full local reset with the remote step off (best-effort cascade step 2: every table, both stored flags, the widget, the root gate). */
  resetLocalData: () => Promise<void>;
  /** The route binds the auth services' sign-out (best-effort cascade step 3). */
  signOut: () => Promise<void>;
  /** The route binds the CSV export service; the model shares exactly what it produces. */
  csvExportAction: () => Promise<string>;
}

export class SettingsModel {
  readonly ownerId: string;
  readonly policyStorageKey: string;
  readonly burnAddBackStorageKey: string;
  wellnessPolicyOn: boolean;
  burnAddBackOn = false;
  /** The failed wellness write's message, shown by the screen; null after a good write. */
  wellnessWriteError: string | null = null;
  /** The loaded export; null until the injected action resolves (the row stays disabled). */
  exportedCsv: string | null = null;

  private readonly deps: SettingsModelDeps;

  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  constructor(deps: SettingsModelDeps) {
    this.deps = deps;
    this.ownerId = deps.ownerId;
    this.policyStorageKey = deps.policyStorageKey;
    this.burnAddBackStorageKey = deps.burnAddBackStorageKey;
    this.wellnessPolicyOn = deps.initialPolicyOn;
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

  // -- Wellness policy (the write half of PL-08) ------------------------------

  /**
   * The toggle's single mutation path: persist '1'/'0' first, then apply the
   * design flag (the Switch flips when the flag applies, so a failed write
   * never shows an applied policy). A failed write is recorded for the screen
   * (wellnessWriteError) and rethrown: the view's handler catches it, so no
   * rejection is ever unhandled.
   */
  async setWellnessPolicy(on: boolean): Promise<void> {
    try {
      await this.deps.writeSetting(this.deps.policyStorageKey, on ? '1' : '0');
    } catch (error) {
      this.wellnessWriteError = error instanceof Error ? error.message : 'The setting could not be saved.';
      this.touch();
      throw error;
    }
    this.wellnessWriteError = null;
    this.deps.applyPolicyFlag(on);
    this.wellnessPolicyOn = on;
    this.touch();
  }

  // -- Burn add-back (TRK-03) -------------------------------------------------

  /** Reads the persisted burn add-back flag for display; defaults off. No consumer reads it yet (IN-01). */
  async loadBurnAddBack(): Promise<void> {
    const stored = await this.deps.readSetting(this.deps.burnAddBackStorageKey);
    this.burnAddBackOn = stored === '1';
    this.touch();
  }

  /** Persists the exact flag a future HealthKit consumer reads ('1'/'0', same key). */
  async setBurnAddBack(on: boolean): Promise<void> {
    await this.deps.writeSetting(this.deps.burnAddBackStorageKey, on ? '1' : '0');
    this.burnAddBackOn = on;
    this.touch();
  }

  // -- Account reset (T-P07-04) ----------------------------------------------
  // The confirmed destructive action. The chain keeps the order the dialog
  // promises: server cascade → the platform's full local reset (every table,
  // both stored flags, the widget, the root gate — PR-22's flow, which the
  // route binds with the remote step off) → sign-out. Every step is
  // best-effort and unconditional — a cascade failure (offline, already
  // deleted, …) must never skip the next, since the user-visible promise is
  // "this device forgets you". The reset against the real store is proven in
  // settingsReset.test.ts.

  /** The confirmed reset: server cascade → full local reset → sign-out, then the in-memory flags clear. */
  async resetAccount(): Promise<void> {
    await this.step(this.deps.deleteAccount);
    await this.step(this.deps.resetLocalData);
    await this.step(this.deps.signOut);
    this.wellnessPolicyOn = false;
    this.burnAddBackOn = false;
    this.wellnessWriteError = null;
    this.exportedCsv = null;
    this.touch();
  }

  private async step(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      // Best-effort by contract (Swift `try?`): the chain continues.
    }
  }

  // -- CSV export (TRU-03) ----------------------------------------------------

  /**
   * Loads in the background as soon as Settings appears (Swift `.task`), once.
   * On failure the export stays null and the row stays disabled.
   */
  async loadExport(): Promise<void> {
    if (this.exportedCsv !== null) return;
    try {
      this.exportedCsv = await this.deps.csvExportAction();
    } catch {
      return;
    }
    this.touch();
  }
}

export function createSettingsModel(deps: SettingsModelDeps): SettingsModel {
  return new SettingsModel(deps);
}
