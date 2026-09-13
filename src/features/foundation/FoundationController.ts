import { newId } from '@/lib/uuid';
import type { DiaryEntry } from '@/db/schema';
import type {
  FoundationDeps,
  ProofScenario,
  RedactedProof,
} from './FoundationDeps';

export interface FoundationState {
  owner: string | null;
  rows: DiaryEntry[];
  queueStatus: ReturnType<FoundationDeps['getQueueStatus']>;
}

/**
 * Walking-skeleton controller (Plan 01-05 Task 1). Owns the auth-stub →
 * owner-partition → repository → lifecycle flow. Framework-free: the screen
 * subscribes to state changes; tests inject every dependency. An owner
 * transition always stops the previous lifecycle before binding the new one.
 */
export function createFoundationController(deps: FoundationDeps) {
  let owner: string | null = null;
  const stateListeners = new Set<() => void>();
  // useSyncExternalStore requires a referentially stable snapshot between
  // changes — a fresh object per call would loop React forever.
  let cachedState: FoundationState | null = null;

  function emit(): void {
    cachedState = null;
    for (const listener of stateListeners) listener();
  }

  return {
    getState(): FoundationState {
      if (!cachedState) {
        cachedState = Object.freeze({
          owner,
          rows: owner ? deps.listRows(owner) : [],
          queueStatus: deps.getQueueStatus(),
        });
      }
      return cachedState;
    },
    subscribe(listener: () => void): () => void {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    async signIn(email: string, password: string): Promise<void> {
      // An owner transition always stops the previous lifecycle first.
      if (owner) deps.stopLifecycle(owner);
      owner = await deps.signIn(email, password);
      deps.startLifecycle(owner);
      emit();
    },
    async signOut(): Promise<void> {
      if (owner) deps.stopLifecycle(owner);
      owner = null;
      await deps.signOut();
      emit();
    },
    /** Seeds exactly one owned row through the repository when none exist. */
    async seedIfEmpty(displayText: string): Promise<void> {
      if (!owner) throw new Error('sign in before seeding');
      if (deps.listRows(owner).length === 0) {
        await deps.createRow(owner, displayText);
        emit();
      }
    },
    /** The only edit path: repository mutation, then lifecycle notification. */
    async editRow(displayText: string): Promise<void> {
      if (!owner) throw new Error('sign in before editing');
      const row = deps.listRows(owner)[0];
      if (!row) throw new Error('no row to edit');
      await deps.updateRow(owner, row.id, displayText);
      deps.notifyLocalMutation(owner);
      emit();
    },
    /**
     * Invalidates the cached snapshot after an out-of-band local mutation
     * (background dispatch acks/pulls) so useSyncExternalStore sees fresh data.
     */
    refresh(): void {
      cachedState = null;
      emit();
    },
    /** Triggers a debounced reconciliation dispatch for the bound owner. */
    notify(): void {
      if (!owner) throw new Error('sign in before notifying');
      deps.notifyLocalMutation(owner);
    },
    /** Builds the strictly-redacted proof object for the device checkpoint. */
    buildRedactedProof(
      scenario: ProofScenario,
      evidence: {
        rowId: string;
        opId: string | null;
        serverVersion: number | null;
        acceptedOpId: string | null;
        deletedAt: string | null;
        pendingCount: number;
        submittedAtMs: number | null;
        acknowledgedAtMs: number | null;
        tombstone: boolean;
      }
    ): RedactedProof {
      return {
        schemaVersion: 1,
        scenario,
        runId: newId(),
        rowId: evidence.rowId,
        opId: evidence.opId,
        pendingCount: evidence.pendingCount,
        serverVersion: evidence.serverVersion,
        acceptedOpId: evidence.acceptedOpId,
        deletedAt: evidence.deletedAt,
        tombstone: evidence.tombstone,
        submittedAtMs: evidence.submittedAtMs,
        acknowledgedAtMs: evidence.acknowledgedAtMs,
        capturedAtMs: Date.now(),
      };
    },
  };
}

export type FoundationController = ReturnType<typeof createFoundationController>;
