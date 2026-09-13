import type { DiaryEntry } from '@/db/schema';

/**
 * Injected dependencies for the Phase 1 walking skeleton. The screen and
 * controller consume this contract only — no direct Supabase, SQLite, or
 * network imports — which keeps the skeleton testable with fakes and the
 * real wiring in one place (Plan 01-05 Task 1).
 */

export type QueueStatus = 'idle' | 'pending' | 'offline';

export type ProofScenario =
  | 'online'
  | 'offline-reconnect'
  | 'user-b-denial'
  | 'same-owner-convergence';

export interface RedactedProof {
  schemaVersion: 1;
  scenario: ProofScenario;
  runId: string;
  rowId: string;
  opId: string | null;
  pendingCount: number;
  serverVersion: number | null;
  acceptedOpId: string | null;
  deletedAt: string | null;
  tombstone: boolean;
  submittedAtMs: number | null;
  acknowledgedAtMs: number | null;
  capturedAtMs: number;
}

export interface FoundationDeps {
  /** Development-only auth stub: derives the proof owner from runtime-entered credentials. */
  signIn(email: string, password: string): Promise<string>;
  signOut(): Promise<void>;

  /** Repository-bound read/write surface (owner-scoped). */
  listRows(ownerId: string): DiaryEntry[];
  createRow(ownerId: string, displayText: string): Promise<DiaryEntry>;
  updateRow(ownerId: string, id: string, displayText: string): Promise<DiaryEntry | undefined>;

  /** Live local-query subscription: re-read + notify on local writes. */
  subscribeRows(listener: () => void): () => void;

  /** Queue/sync status for testable UI labels. */
  getQueueStatus(): QueueStatus;

  /** Lifecycle bridge (Plan 01-04). */
  startLifecycle(ownerId: string): void;
  /**
   * Owner-handoff barrier (Plan 01-07): stops the owner's lifecycle and
   * resolves only after its active dispatch has settled. The controller
   * awaits this before any authentication changes the shared session.
   */
  stopLifecycle(ownerId: string): Promise<void>;
  notifyLocalMutation(ownerId: string): void;
}
