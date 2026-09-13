import { act, create as createRenderer, type ReactTestRenderer } from 'react-test-renderer';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { migrationsBundle } from '@/db/migrations';
import { openNodeSqliteTestDb, type NodeSqliteTestClient } from '@/db/testing/nodeSqlite';
import { pendingOps } from '@/db/schema';
import {
  createDiaryEntry,
  listDiaryEntries,
} from '@/db/repositories/diaryEntries';
import * as FoundationControllerModule from './FoundationController';
import type { FoundationController } from './FoundationController';
import { FoundationSession } from './FoundationSession';

/**
 * Plan 01-07 Task 2 integration regression: the REAL session boundary,
 * controller, lifecycle scheduler, dispatcher, and merge run against a real
 * migrated Node SQLite database; only the native/Supabase boundaries are
 * faked. The fake Supabase client owns one mutable JWT identity that flips
 * when signInWithPassword executes — exactly the shared-client hazard the
 * owner-handoff barrier must serialize.
 */

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const PULLED_OP_ID = '7c1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e';
const PULLED_REC_ID = 'dddddddd-ddd4-4ddd-8ddd-ddddddddddd4';

// --- Native / Supabase boundary mocks (hoisted; holders are lazily read) ----

const mockSupabase = { current: null as never as FakeSupabase };
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase.current.client,
}));

const mockNetInfo = {
  current: {
    addEventListener(
      _listener: (state: { isConnected: boolean | null }) => void
    ): () => void {
      return () => undefined;
    },
  },
};
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (
    listener: (state: { isConnected: boolean | null }) => void
  ) => mockNetInfo.current.addEventListener(listener),
}));

const mockTestDb = { current: null as never as { db: ExpoSQLiteDatabase } };
jest.mock('@/db/client', () => ({
  get db() {
    return mockTestDb.current.db;
  },
}));

interface RpcCall {
  identity: string | null;
  args: { p_ops?: { opId: string }[]; p_cursor?: number };
  deferred: PromiseWithResolvers<unknown>;
  resolved: boolean;
}

/** Fake shared Supabase client: one mutable session identity + deferred RPCs. */
class FakeSupabase {
  /** The current JWT identity the shared client would attach to RPC calls. */
  identity: string | null = null;
  authEmails: string[] = [];
  signOutCalls = 0;
  rpcCalls: RpcCall[] = [];
  failAuthFor: string | null = null;
  private readonly authGates = new Map<string, PromiseWithResolvers<void>>();
  private readonly heldKinds = new Set<string>();

  readonly client = {
    auth: {
      signInWithPassword: async ({
        email,
      }: {
        email: string;
        password: string;
      }) => {
        this.authEmails.push(email);
        const gate = this.authGates.get(email);
        if (gate) await gate.promise;
        if (this.failAuthFor === email) {
          this.failAuthFor = null;
          return { data: { user: null }, error: { message: 'invalid credentials' } };
        }
        // Executing the sign-in swaps the shared client's session identity.
        this.identity = email.startsWith('a@') ? OWNER_A : OWNER_B;
        return { data: { user: { id: this.identity } }, error: null };
      },
      signOut: async () => {
        this.signOutCalls += 1;
        return { error: null };
      },
    },
    rpc: (name: string, args: RpcCall['args']) => {
      const call: RpcCall = {
        name,
        identity: this.identity,
        args,
        deferred: Promise.withResolvers<unknown>(),
        resolved: false,
      };
      this.rpcCalls.push(call);
      if (this.heldKinds.has(name)) {
        // Hold exactly the next call of this kind for the test to release.
        this.heldKinds.delete(name);
      } else {
        this.settle(call);
      }
      return call.deferred.promise.then((data) => ({ data, error: null }));
    },
  };

  holdNextPush(): void {
    this.heldKinds.add('sync_push');
  }

  holdNextPull(): void {
    this.heldKinds.add('sync_pull');
  }

  holdAuth(email: string): void {
    this.authGates.set(email, Promise.withResolvers<void>());
  }

  releaseAuth(email: string): void {
    this.authGates.get(email)?.resolve();
  }

  heldCalls(kind: string): RpcCall[] {
    return this.rpcCalls.filter((call) => call.name === kind && !call.resolved);
  }

  /** Releases the first held push with a contract-valid acknowledgement. */
  releasePush(): void {
    const call = this.heldCalls('sync_push')[0];
    if (!call) throw new Error('no held sync_push call to release');
    call.deferred.resolve(this.defaultResponse(call));
    call.resolved = true;
  }

  /** Releases the first held pull, optionally delivering remote rows. */
  releasePull(rows: unknown[] = [], cursor?: number): void {
    const call = this.heldCalls('sync_pull')[0];
    if (!call) throw new Error('no held sync_pull call to release');
    call.deferred.resolve({ rows, cursor: cursor ?? call.args.p_cursor ?? 0 });
    call.resolved = true;
  }

  /** Test teardown: settle everything still pending with valid defaults. */
  settleAll(): void {
    for (const call of this.rpcCalls) {
      if (!call.resolved) {
        this.settle(call);
      }
    }
    for (const gate of this.authGates.values()) gate.resolve();
    this.authGates.clear();
  }

  private settle(call: RpcCall): void {
    call.deferred.resolve(this.defaultResponse(call));
    call.resolved = true;
  }

  private defaultResponse(call: RpcCall): unknown {
    if (call.name === 'sync_push') {
      const ops = call.args.p_ops ?? [];
      return {
        accepted: ops.map((op) => ({
          opId: op.opId,
          serverVersion: 10,
          acceptedOpId: op.opId,
          duplicate: false,
        })),
      };
    }
    return { rows: [], cursor: call.args.p_cursor ?? 0 };
  }
}

// --- Harness -----------------------------------------------------------------

const actualCreateFoundationController = (
  jest.requireActual('./FoundationController') as typeof FoundationControllerModule
).createFoundationController;

// Delegating spy: FoundationSession creates the REAL controller; tests keep
// the instance to drive transitions while the component stays mounted.
const createControllerSpy = jest.spyOn(
  FoundationControllerModule,
  'createFoundationController'
);

let fake: FakeSupabase;
let dbClient: NodeSqliteTestClient;
let realDb: ExpoSQLiteDatabase;
let renderer: ReactTestRenderer | null = null;
let capturedController: FoundationController | null = null;
/** globalThis with the React act flag visible (unchecked cast: host global). */
type ActEnvironmentHost = { IS_REACT_ACT_ENVIRONMENT?: boolean };
const actHost = globalThis as ActEnvironmentHost;
const previousActEnvironment = actHost.IS_REACT_ACT_ENVIRONMENT;

async function drainMicrotasks(hops = 12): Promise<void> {
  for (let i = 0; i < hops; i += 1) {
    await Promise.resolve();
  }
}

async function renderSession(): Promise<FoundationController> {
  await act(async () => {
    renderer = createRenderer(<FoundationSession />);
  });
  if (!capturedController) throw new Error('controller was not captured');
  return capturedController;
}

describe('FoundationSession owner-handoff barrier (Plan 01-07 Task 2)', () => {
  beforeAll(() => {
    actHost.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    actHost.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    createControllerSpy.mockRestore();
  });

  beforeEach(async () => {
    fake = new FakeSupabase();
    mockSupabase.current = fake;
    dbClient = openNodeSqliteTestDb();
    realDb = drizzle(dbClient as never);
    await migrate(realDb, migrationsBundle);
    mockTestDb.current = { db: realDb };
    capturedController = null;
    createControllerSpy.mockReset();
    createControllerSpy.mockImplementation((deps) => {
      const controller = actualCreateFoundationController(deps);
      capturedController = controller;
      return controller;
    });
  });

  afterEach(async () => {
    // Release every held RPC/auth gate, then let any still-settling
    // transition finish WHILE the database is still open.
    fake.settleAll();
    await act(async () => {
      await drainMicrotasks(25);
    });
    // A final sign-out is serialized after every pending transition (FIFO
    // queue in GREEN; drained microtasks in RED) and stops the bound
    // owner's lifecycle — no retry timer survives teardown.
    try {
      await act(async () => {
        await capturedController?.signOut();
      });
    } catch {
      // transition already rejected — nothing left to stop
    }
    await act(async () => {
      renderer?.unmount();
    });
    renderer = null;
    dbClient.closeSync();
  });

  it('keeps User B unauthenticated while User A push is held, then binds B only after A drains', async () => {
    // Seed A's mirror + outbox BEFORE sign-in so the initial A dispatch is a push.
    createDiaryEntry(realDb, OWNER_A, 'A row');
    const seededOp = realDb.select().from(pendingOps).all()[0];
    expect(seededOp).toBeDefined();
    fake.holdNextPush();

    const controller = await renderSession();
    await act(async () => {
      await controller.signIn('a@proof.invalid', 'pw');
    });
    const heldPush = fake.heldCalls('sync_push')[0];
    expect(heldPush).toBeDefined();
    expect(heldPush.identity).toBe(OWNER_A);

    let toB!: Promise<void>;
    await act(async () => {
      toB = controller.signIn('b@proof.invalid', 'pw');
    });
    await drainMicrotasks();
    // RED target: B's authenticator must not run and B must stay unbound
    // while A's dispatch is still pending under A's JWT.
    expect(fake.authEmails).not.toContain('b@proof.invalid');
    expect(controller.getState().owner).not.toBe(OWNER_B);
    expect(fake.rpcCalls.some((call) => call.identity === OWNER_B)).toBe(false);

    await act(async () => {
      fake.releasePush();
    });
    await act(async () => {
      await toB;
    });

    expect(fake.authEmails).toStrictEqual(['a@proof.invalid', 'b@proof.invalid']);
    expect(controller.getState().owner).toBe(OWNER_B);

    // A's acknowledgement merged ONLY into A's local partition, A's outbox
    // drained, and B's next dispatch runs under B's identity.
    const aRows = listDiaryEntries(realDb, OWNER_A);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].serverVersion).toBe(10);
    expect(aRows[0].acceptedOpId).toBe(seededOp.opId);
    expect(listDiaryEntries(realDb, OWNER_B)).toHaveLength(0);
    expect(realDb.select().from(pendingOps).all()).toHaveLength(0);
    const bDispatch = fake.rpcCalls.find((call) => call.identity === OWNER_B);
    expect(bDispatch).toBeDefined();
    expect(bDispatch?.name).toBe('sync_pull');
  });

  it('keeps User B unauthenticated while User A pull is held, then merges A only to A', async () => {
    fake.holdNextPull();

    const controller = await renderSession();
    await act(async () => {
      await controller.signIn('a@proof.invalid', 'pw');
    });
    const heldPull = fake.heldCalls('sync_pull')[0];
    expect(heldPull).toBeDefined();
    expect(heldPull.identity).toBe(OWNER_A);

    let toB!: Promise<void>;
    await act(async () => {
      toB = controller.signIn('b@proof.invalid', 'pw');
    });
    await drainMicrotasks();
    expect(fake.authEmails).not.toContain('b@proof.invalid');
    expect(controller.getState().owner).not.toBe(OWNER_B);

    await act(async () => {
      fake.releasePull(
        [
          {
            table: 'diary_entries',
            recordId: PULLED_REC_ID,
            snapshot: {
              id: PULLED_REC_ID,
              displayText: 'from server',
              deletedAt: null,
              serverVersion: 12,
              acceptedOpId: PULLED_OP_ID,
            },
          },
        ],
        12
      );
    });
    await act(async () => {
      await toB;
    });

    expect(fake.authEmails).toStrictEqual(['a@proof.invalid', 'b@proof.invalid']);
    expect(controller.getState().owner).toBe(OWNER_B);

    // The A pull merged only into A's partition; B stays empty and B's next
    // dispatch carries B's identity.
    expect(
      listDiaryEntries(realDb, OWNER_A).map((row) => row.displayText)
    ).toStrictEqual(['from server']);
    expect(listDiaryEntries(realDb, OWNER_B)).toHaveLength(0);
    const bDispatch = fake.rpcCalls.find((call) => call.identity === OWNER_B);
    expect(bDispatch).toBeDefined();
    expect(bDispatch?.name).toBe('sync_pull');
  });

  it('waits for the active A dispatch before supabase.auth.signOut clears the session', async () => {
    createDiaryEntry(realDb, OWNER_A, 'A row');
    fake.holdNextPush();

    const controller = await renderSession();
    await act(async () => {
      await controller.signIn('a@proof.invalid', 'pw');
    });

    let signOutPromise!: Promise<void>;
    await act(async () => {
      signOutPromise = controller.signOut();
    });
    await drainMicrotasks();
    expect(fake.signOutCalls).toBe(0);
    expect(controller.getState().owner).not.toBe(OWNER_A);

    await act(async () => {
      fake.releasePush();
    });
    await act(async () => {
      await signOutPromise;
    });
    expect(fake.signOutCalls).toBe(1);
    expect(controller.getState().owner).toBeNull();
  });

  it('a failed B authentication leaves no bound owner or running A lifecycle, and later sign-ins still work', async () => {
    const controller = await renderSession();
    await act(async () => {
      await controller.signIn('a@proof.invalid', 'pw');
    });
    const rpcCountAfterA = fake.rpcCalls.length;

    fake.failAuthFor = 'b@proof.invalid';
    await act(async () => {
      await expect(
        controller.signIn('b@proof.invalid', 'pw')
      ).rejects.toThrow('proof sign-in failed');
    });

    expect(controller.getState().owner).toBeNull();
    await drainMicrotasks();
    // No further A-identity RPC ever happens after the failed transition.
    expect(
      fake.rpcCalls.slice(rpcCountAfterA).every((call) => call.identity !== OWNER_A)
    ).toBe(true);

    await act(async () => {
      await controller.signIn('a@proof.invalid', 'pw');
    });
    expect(controller.getState().owner).toBe(OWNER_A);
    expect(fake.rpcCalls.some((call) => call.identity === OWNER_A)).toBe(true);
  });

  it('serializes concurrent sign-ins so the second authenticates only after the first transition completes', async () => {
    const controller = await renderSession();
    fake.holdAuth('a@proof.invalid');

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = controller.signIn('a@proof.invalid', 'pw');
      second = controller.signIn('b@proof.invalid', 'pw');
    });
    await drainMicrotasks();
    expect(fake.authEmails).toStrictEqual(['a@proof.invalid']);

    await act(async () => {
      fake.releaseAuth('a@proof.invalid');
    });
    await act(async () => {
      await first;
      await second;
    });

    expect(fake.authEmails).toStrictEqual(['a@proof.invalid', 'b@proof.invalid']);
    expect(controller.getState().owner).toBe(OWNER_B);
    // A's lifecycle ran and was stopped before B bound; every push stayed
    // under its own owner's identity.
    expect(
      fake.rpcCalls
        .filter((call) => call.name === 'sync_push')
        .every((call) => call.identity === OWNER_A)
    ).toBe(true);
  });
});
