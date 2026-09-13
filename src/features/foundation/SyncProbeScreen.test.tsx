import { createFoundationController } from './FoundationController';
import type { FoundationDeps, QueueStatus } from './FoundationDeps';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

interface Row {
  id: string;
  ownerId: string;
  displayText: string;
  deletedAt: string | null;
  serverVersion: number;
  acceptedOpId: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

interface HarnessDeps extends FoundationDeps {
  setRows(rows: Row[]): void;
  setQueueStatus(status: QueueStatus): void;
  notifyCount(): number;
  lifecycleOwner(): string | null;
  stoppedOwners(): string[];
  startedOwners(): string[];
  signInEmails(): string[];
  /** Makes the NEXT stopLifecycle call wait on a gate the test releases. */
  holdNextStop(): void;
  releaseStop(): void;
  /** Gates the authenticator for one email until releaseAuth. */
  holdNextAuth(email: string): void;
  releaseAuth(): void;
  failAuthFor(email: string): void;
}

function makeDeps(): HarnessDeps {
  const listeners = new Set<() => void>();
  let rows: Row[] = [];
  let queueStatus: QueueStatus = 'idle';
  let notifyCount = 0;
  let lifecycleOwner: string | null = null;
  const stopped: string[] = [];
  const started: string[] = [];
  const signInEmails: string[] = [];
  let stopGate: PromiseWithResolvers<void> | null = null;
  let authGateEmail: string | null = null;
  let authGate: PromiseWithResolvers<void> | null = null;
  let failEmail: string | null = null;

  const deps: HarnessDeps = {
    signIn: async (email: string) => {
      signInEmails.push(email);
      if (authGate && authGateEmail === email) await authGate.promise;
      if (failEmail === email) {
        failEmail = null;
        throw new Error('proof sign-in failed');
      }
      return email.startsWith('a@') ? USER_A : USER_B;
    },
    signOut: async () => undefined,
    listRows: (ownerId: string) => rows.filter((r) => r.ownerId === ownerId),
    createRow: async (ownerId: string, text: string) => {
      const row: Row = {
        id: `${ownerId.slice(0, 8)}-0000-4000-8000-000000000000`,
        ownerId,
        displayText: text,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
        syncedAt: null,
      };
      rows = [...rows, row];
      listeners.forEach((l) => l());
      return row;
    },
    updateRow: async (ownerId: string, id: string, text: string) => {
      let updated: Row | undefined;
      rows = rows.map((r) => {
        if (r.id === id && r.ownerId === ownerId) {
          updated = { ...r, displayText: text };
          return updated;
        }
        return r;
      });
      listeners.forEach((l) => l());
      return updated;
    },
    subscribeRows: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getQueueStatus: () => queueStatus,
    startLifecycle: (ownerId: string) => {
      started.push(ownerId);
      lifecycleOwner = ownerId;
    },
    stopLifecycle: async (ownerId: string) => {
      stopped.push(ownerId);
      if (lifecycleOwner === ownerId) lifecycleOwner = null;
      if (stopGate) await stopGate.promise;
    },
    notifyLocalMutation: (ownerId: string) => {
      if (lifecycleOwner === ownerId) notifyCount += 1;
    },
    setQueueStatus(status: QueueStatus) {
      queueStatus = status;
    },
    notifyCount() {
      return notifyCount;
    },
    lifecycleOwner() {
      return lifecycleOwner;
    },
    stoppedOwners() {
      return stopped;
    },
    startedOwners() {
      return started;
    },
    signInEmails() {
      return signInEmails;
    },
    holdNextStop() {
      stopGate = Promise.withResolvers<void>();
    },
    releaseStop() {
      stopGate?.resolve();
    },
    holdNextAuth(email: string) {
      authGateEmail = email;
      authGate = Promise.withResolvers<void>();
    },
    releaseAuth() {
      authGate?.resolve();
    },
    failAuthFor(email: string) {
      failEmail = email;
    },
  };
  return deps;
}

async function drain(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('foundation controller (Plan 01-05 Task 1)', () => {
  it('sign-in binds the owner, seeds one row, and exposes only that owner rows', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);

    await controller.signIn('a@proof.local', 'runtime-entered-password');
    expect(deps.lifecycleOwner()).toBe(USER_A);

    await controller.seedIfEmpty('seed entry');
    await drain();
    expect(controller.getState().rows).toHaveLength(1);
    expect(controller.getState().rows[0].ownerId).toBe(USER_A);
  });

  it('editing goes through the repository then notifies lifecycle — never network', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    await controller.signIn('a@proof.local', 'pw');
    await controller.seedIfEmpty('seed entry');
    await drain();

    await controller.editRow('edited entry');
    await drain();

    expect(controller.getState().rows[0].displayText).toBe('edited entry');
    expect(deps.notifyCount()).toBe(1);
  });

  it('User A → User B → User A transition stops lifecycle, partitions state, and restores A', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    await controller.signIn('a@proof.local', 'pw');
    await controller.seedIfEmpty('A row');
    await drain();

    await controller.signIn('b@proof.local', 'pw');
    await controller.seedIfEmpty('B row');
    await drain();

    expect(deps.stoppedOwners()).toContain(USER_A);
    expect(deps.lifecycleOwner()).toBe(USER_B);
    expect(controller.getState().rows.map((r) => r.displayText)).toStrictEqual(['B row']);

    await controller.signIn('a@proof.local', 'pw');
    await drain();
    expect(controller.getState().rows.map((r) => r.displayText)).toStrictEqual(['A row']);
  });

  it('offline queue status is observable and proof payloads stay redacted', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    await controller.signIn('a@proof.local', 'pw');
    await controller.seedIfEmpty('seed entry');
    await drain();

    deps.setQueueStatus('offline');
    await drain();
    expect(controller.getState().queueStatus).toBe('offline');

    const proof = controller.buildRedactedProof('offline-reconnect', {
      rowId: 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
      opId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
      serverVersion: 3,
      acceptedOpId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
      deletedAt: null,
      pendingCount: 0,
      submittedAtMs: 1000,
      acknowledgedAtMs: 2500,
      tombstone: false,
    });
    const serialized = JSON.stringify(proof);
    expect(serialized).not.toMatch(/password|token|secret|@proof\.local|publishable/i);
    expect(proof.scenario).toBe('offline-reconnect');
  });
});

describe('foundation controller session-handoff barrier (Plan 01-07 Task 2)', () => {
  it('holds the next sign-in behind the previous owner draining lifecycle stop', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    await controller.signIn('a@proof.local', 'pw');

    deps.holdNextStop();
    const toB = controller.signIn('b@proof.local', 'pw');
    await drain();
    // While User A's lifecycle stop is still draining, User B's
    // authenticator must not have been called, B must not be bound, and no
    // B lifecycle work may have started.
    expect(deps.signInEmails()).not.toContain('b@proof.local');
    expect(controller.getState().owner).not.toBe(USER_B);
    expect(deps.startedOwners()).not.toContain(USER_B);

    deps.releaseStop();
    await toB;
    expect(deps.signInEmails()).toContain('b@proof.local');
    expect(controller.getState().owner).toBe(USER_B);
    expect(deps.startedOwners().filter((owner) => owner === USER_B)).toHaveLength(1);
  });

  it('serializes overlapping sign-ins through one transition queue even before any owner binds', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    deps.holdNextAuth('a@proof.local');

    const first = controller.signIn('a@proof.local', 'pw');
    const second = controller.signIn('b@proof.local', 'pw');
    await drain();
    expect(deps.signInEmails()).toStrictEqual(['a@proof.local']);

    deps.releaseAuth();
    await Promise.all([first, second]);
    expect(deps.signInEmails()).toStrictEqual(['a@proof.local', 'b@proof.local']);
    expect(deps.stoppedOwners()).toContain(USER_A);
    expect(controller.getState().owner).toBe(USER_B);
  });

  it('a failed next-owner authentication leaves no bound owner or running lifecycle and the queue stays usable', async () => {
    const deps = makeDeps();
    const controller = createFoundationController(deps);
    await controller.signIn('a@proof.local', 'pw');

    deps.failAuthFor('b@proof.local');
    await expect(controller.signIn('b@proof.local', 'pw')).rejects.toThrow(
      'proof sign-in failed'
    );

    expect(controller.getState().owner).toBeNull();
    expect(deps.lifecycleOwner()).toBeNull();

    // Queued transitions remain usable after the failure.
    await controller.signIn('a@proof.local', 'pw');
    expect(controller.getState().owner).toBe(USER_A);
    expect(deps.lifecycleOwner()).toBe(USER_A);
  });
});
