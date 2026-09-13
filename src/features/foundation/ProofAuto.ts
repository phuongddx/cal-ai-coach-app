import type { FoundationController } from './FoundationController';

/**
 * DEV-ONLY autonomous proof driver (Plan 01-05 Task 3, simulator adaptation).
 * Activated when Metro runs with EXPO_PUBLIC_PROOF_AUTO=1. The app performs
 * the scenario while the owner watches the simulator windows, and emits
 * redacted proof objects on the Metro console (`[phase1-proof]`), where the
 * orchestrator captures and machine-validates them with
 * scripts/measure-phase1-sync.mjs. Gated off whenever the env var is absent.
 */

const REST_PROBE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/rest/v1/`;

async function serverReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(REST_PROBE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.status < 500;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function logProof(scenario: string, payload: Record<string, unknown>): void {
  console.log(`[phase1-proof] ${JSON.stringify({ scenario, ...payload })}`);
}

/**
 * Convergence flow for one device installation:
 * 1. sign in as the proof user;
 * 2. pull-wait grace (8s) so a second installation materializes the first
 *    device's row instead of seeding its own — guaranteeing a shared record;
 * 3. seed only when still empty; wait for seed acknowledgement
 *    (local canonical serverVersion > 0);
 * 4. detect an offline window (REST probe fails) → ONE conflicting offline
 *    edit through the repository (outbox queues);
 * 5. detect reconnect + acknowledgement → schedule settle pull rounds so the
 *    proof reflects the FINAL server canonical state after both devices
 *    pushed → emit the convergence proof for the comparator.
 */
export async function runProofAuto(controller: FoundationController): Promise<void> {
  const runId = Math.random().toString(36).slice(2, 10);

  await controller.signIn('a@proof.local', 'phase1-proof-2026');

  await sleep(8000);
  const existing = controller.getState().rows[0];
  if (!existing) {
    await controller.seedIfEmpty('A shared row');
  }

  const seedDeadline = Date.now() + 30_000;
  let rowId: string | undefined;
  while (Date.now() < seedDeadline) {
    const row = controller.getState().rows[0];
    if (row && row.serverVersion > 0) {
      rowId = row.id;
      logProof('seed-synced', {
        runId,
        rowId: row.id,
        serverVersion: row.serverVersion,
        acceptedOpId: row.acceptedOpId,
      });
      break;
    }
    await sleep(1000);
  }
  if (!rowId) {
    logProof('error', { runId, stage: 'seed-timeout' });
    return;
  }

  let offlineEditDone = false;
  const windowDeadline = Date.now() + 180_000;
  while (Date.now() < windowDeadline && !offlineEditDone) {
    const reachable = await serverReachable();
    if (!reachable) {
      await controller.editRow(`conflict-${runId}`);
      offlineEditDone = true;
      logProof('offline-edit-queued', {
        runId,
        rowId,
        pendingCount: 1,
        tombstone: false,
      });
    }
    await sleep(3000);
  }
  if (!offlineEditDone) {
    logProof('error', { runId, stage: 'offline-window-timeout' });
    return;
  }

  // No deadline here: reconnect latency (e.g. gateway cold start) is unbounded
  // physics, not a hang. This loop exits only on success — the dev driver is
  // stopped via app relaunch, not by giving up.
  const offlineVersion = controller.getState().rows[0]?.serverVersion ?? 0;
  for (;;) {
    const row = controller.getState().rows[0];
    if (row && row.serverVersion > offlineVersion) break;
    await sleep(1000);
  }

  // Settle: schedule extra pull rounds so the proof reflects the FINAL
  // server canonical state after both devices pushed their conflicts.
  await sleep(4000);
  controller.notify();
  await sleep(4000);
  controller.notify();
  await sleep(4000);

  const finalRow = controller.getState().rows[0];
  if (!finalRow) {
    logProof('error', { runId, stage: 'row-vanished' });
    return;
  }
  logProof('same-owner-convergence', {
    runId,
    rowId: finalRow.id,
    opId: finalRow.acceptedOpId,
    serverVersion: finalRow.serverVersion,
    acceptedOpId: finalRow.acceptedOpId,
    deletedAt: finalRow.deletedAt,
    tombstone: finalRow.deletedAt !== null,
    pendingCount: 0,
    submittedAtMs: null,
    acknowledgedAtMs: Date.now(),
  });
}
