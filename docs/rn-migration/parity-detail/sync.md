# Parity detail: sync engine, triggers, outbox, merge, transport, wire validation (U-23)

Rows PL-04, NW-02, DB-02, DB-03 and CO-07 of `docs/rn-migration/parity.tsv`. Paths are relative to the repository root; TypeScript
under `apps/mobile/src/data/` unless it starts with `packages/`. Swift sources under `native/Modules/`. Jest cases are named
`<file> > <case sentence>`. The integration cases skip loudly (`[api-skip]`) when `scripts/rn/start-api.sh` has not written its env file.

The five Swift test files of `CoachCalSync` and their twins (same behavior sentence, in the Swift camelCase turned into a sentence):

| Swift test | Jest twin |
|---|---|
| `SyncEngineDispatchTests` (7 tests) | `sync/syncEngineDispatch.test.ts` (7 cases) |
| `AckIntegrityTests` (3 tests) | `sync/ackIntegrity.test.ts` (3 cases) |
| `LifecycleBarrierTests` (2 tests) | `sync/lifecycleBarrier.test.ts` (2 cases) |
| `TriggerTests` (1 test) | `sync/triggerSeams.test.ts > foreground, network and BGTask seams invoke engine dispatch` (+3 extra cases) |
| `CoachCalSyncTests` (1 test) | `sync/coachCalSync.test.ts > module name is exposed` |

## PL-04 Sync engine, backoff, triggers (`SyncEngine.swift`, `Backoff.swift`, `SyncTriggers.swift`)

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Overlapping dispatch calls push the same batch once | `SyncEngine.swift` `dispatch()` | `sync/engine.ts` | `sync/syncEngineDispatch.test.ts > overlapping dispatch calls push the same batch only once` |
| Acknowledgements delete operations and bump canonical rows | `SyncEngine.swift` `runDispatch` (ack merge) | `sync/engine.ts`, `sync/store.sqlite.ts` | `sync/syncEngineDispatch.test.ts > successful acknowledgements delete operations and bump canonical rows` |
| Transport failure: attempt counted, deterministic backoff, later replay is safe | `SyncEngine.swift`, `Backoff.swift` | `sync/engine.ts`, `sync/backoff.ts` (1, 2, 4, 8, 16, 30, 30 s) | `sync/syncEngineDispatch.test.ts > transport failure schedules deterministic backoff and later replay is safe` |
| (RN addition) Quarantine after 5 dispatch attempts (transport and server errors count; an undecodable operation too) | none: Swift dead-letters only an undecodable operation (`SyncEngine.swift`); the brief ordered five dispatch attempts | `sync/engine.ts` `MAX_OP_ATTEMPTS`, `sync/store.sqlite.ts` `dueOperations` | `sync/syncEngineDispatch.test.ts > permanently undecodable operation is dead-lettered without losing the row`; `sync/engine.test.ts > a server failure keeps operations pending and retries with backoff` |
| A 400 on the push quarantines the batch (RN wire rule; never retried by itself) | (RN addition: the server answers 400 for a malformed batch) | `sync/engine.ts` | `sync/engine.test.ts > a 400 quarantines the batch and it is never retried automatically` |
| (RN addition) 401 stops the sync, operations stay pending and uncounted | none: Swift counts an attempt on every push error (`SyncEngine.swift`) | `sync/engine.ts` | `sync/engine.test.ts > an unauthorized push stops the sync and keeps the operations pending` |
| Thrown errors of a debounced dispatch reach the error sink, also `poisonedOperations(count:)` | `SyncEngine.swift` `setOnError`, `reportError` | `sync/engine.ts` `setOnError`, `SyncEngineError` | `sync/syncEngineDispatch.test.ts > debounced dispatch surfaces thrown errors through sink`; `... > debounced dispatch surfaces poisoned operations through sink` |
| Pull skips a record with a newer pending local op, applies the others, advances the cursor | `SyncEngine.swift`, `SyncMergeRepository.swift` | `sync/engine.ts`, `sync/store.sqlite.ts` | `sync/syncEngineDispatch.test.ts > pull skips newer pending intent but applies other rows and advances cursor` |
| Pull pages until `hasMore` is false (Swift pulls one page) | (RN wire has `hasMore`) | `sync/engine.ts` | `sync/engine.test.ts > applying the same pull page twice changes nothing`; `sync/e2e.integration.test.ts` (whole histories pulled) |
| Exact acknowledgement set: a foreign, a duplicate or a partial acknowledgement rejects the whole batch | `AckIntegrityTests.swift` | `sync/engine.ts` calling `validateAcknowledgementSet` | `sync/ackIntegrity.test.ts > foreign acknowledgement rejects the whole batch`; `> duplicate acknowledgement rejects the whole batch`; `> partial acknowledgement rejects the whole batch` |
| `stop()` drains the in-flight dispatch before a new owner can bind (generation tokens) | `LifecycleBarrierTests.swift` | `sync/engine.ts` | `sync/lifecycleBarrier.test.ts > stop drains in-flight dispatch before a new owner can bind` |
| A burst of local writes coalesces into one trailing dispatch (500 ms trailing debounce) | `LifecycleBarrierTests.swift` | `sync/engine.ts` `notifyLocalMutation`, `DEFAULT_DEBOUNCE_MS` | `sync/lifecycleBarrier.test.ts > mutation burst coalesces into one trailing dispatch` |
| Batches of 50 in FIFO order | `SyncEngine.swift` `batchSize`, `runDispatch` | `sync/engine.ts` `BATCH_SIZE`, `sync/store.sqlite.ts` | `repos/outboxRepository.test.ts` (U-12, batch of 50 FIFO); `sync/syncEngineDispatch.test.ts > overlapping dispatch calls push the same batch only once` |
| A new engine over the same store drains what a previous run left; forced offline touches no server | `SyncEngine.swift` | `sync/engine.ts` | `sync/engine.test.ts > a new engine over the same store drains what a previous run left`; `> forced offline makes isOnline false without touching the server` |
| Foreground, network (rising edge) and background-task triggers each call dispatch | `SyncTriggers.swift` (`ForegroundTrigger`, `NWPathTrigger`, `BGTaskTrigger`) | `sync/triggerSeams.ts`, `sync/triggers.ts` | `sync/triggerSeams.test.ts > foreground, network and BGTask seams invoke engine dispatch`; `> the foreground trigger fires when the app becomes active and not on other changes`; `> the network trigger fires on the rising edge only`; `> the BGTask seam submits the request and then fires` |
| The module exposes `moduleName` = `CoachCalSync` | `CoachCalSync.swift` | `sync/index.ts` | `sync/coachCalSync.test.ts > module name is exposed` |
| Ids are v4 UUIDs from a secure source (no `Math.random`; Hermes has no `globalThis.crypto`) | (RN addition) | `sync/uuid.ts`, `__mocks__/expo-crypto.ts` | `sync/uuid.test.ts > takes its 16 bytes from expo-crypto getRandomValues, never from Math.random` and four more |
| Runtime acts for the signed-in user: no session, no request; sign-in binds; sign-out stops | `AppEnvironment.swift` `handleSignIn`, `restoreSession` | `sync/runtime.ts` | the six cases of `sync/runtime.session.test.ts` |
| Real engine + SQLite store against the real API: two stores converge, a tombstone propagates, a conflict loser holds the server record | `E2ESyncConvergenceTests` (UI test) | `sync/e2e.integration.test.ts`, `scripts/rn/e2e-sync.sh` | `sync/e2e.integration.test.ts > two stores converge through edit, push, pull, edit, push, pull`; `> a tombstone propagates to the other store`; `> in an offline conflict the loser store holds the server record after its acknowledgement` |

Not ported: the Swift `BGTaskScheduler` registration. `BGTaskTrigger` takes a submit seam; no RN consumer (expo-background-task) is wired yet.

## DB-02 Outbox and PendingOp

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Due batch: FIFO, at most 50, rows whose retry time has passed | `OutboxRepository.swift` `dueOps` | `sync/store.sqlite.ts` `dueOperations` | `sync/syncEngineDispatch.test.ts > transport failure schedules deterministic backoff and later replay is safe` |
| Attempts counted per op; quarantined at 5 | `OutboxRepository.swift` `quarantine`, `SyncEngine.swift` `markBatchFailed` | `sync/store.sqlite.ts` `markAttempts`, `sync/engine.ts` | `sync/syncEngineDispatch.test.ts > permanently undecodable operation is dead-lettered without losing the row` |
| An operation whose snapshot does not decode is dead-lettered, its mirror row stays | `SyncEngine.swift` | `sync/store.sqlite.ts` (undecodable detection) | same case |
| Writes on one database handle are serialized; only the owner rolls back | (RN addition: raw `BEGIN`/`COMMIT` on one handle) | `repos/sqlDb.ts` `inTransaction` | `repos/sqlDb.test.ts > two overlapping calls on one handle both complete whole`; `> a throw inside one call leaves nothing of that one and the other completes whole`; `> the next call still runs after a failed one`; `> a different handle has its own queue` |

## DB-03 Sync merge (LWW, pending-intent skip, cursor)

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| A winning acknowledgement keeps the local content and stamps the canonical version | `SyncMergeRepository.swift` `applyAcknowledgement` | `repos/syncMergeRepository.ts` `applyAcknowledgedRecord` | `sync/store.sqlite.test.ts > a winning ack keeps the local content and stamps the version` |
| A losing upsert acknowledgement applies the record the server keeps | (RN addition: the server answers `applied` with the winner's record) | `repos/syncMergeRepository.ts` | `sync/store.sqlite.test.ts > a losing upsert ack applies the server record`; `> a losing ack applies the server record even when its version is not newer than the mirror` |
| A losing tombstone acknowledgement restores the live record | same | same | `sync/store.sqlite.test.ts > a losing tombstone ack restores the live record` |
| An acknowledgement with a newer pending op leaves the mirror alone | `SyncMergeRepository.swift` pending-intent rule | same | `sync/store.sqlite.test.ts > an ack with a newer pending op leaves the mirror alone` |
| An acknowledgement for an op not in the outbox changes nothing | `SyncMergeRepository.swift` | same | `sync/store.sqlite.test.ts > an ack for an op that is not in the outbox changes nothing` |
| Pulled rows skip records with a pending local op; LWW by `compareCanonicalVersions`; the cursor advances after all rows merge | `SyncMergeRepository.swift` `applyPulledRow` | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` (U-12); `sync/engine.test.ts > pull skips records with pending local intent and keeps the local edit`; `> a crash while applying a pull page rolls the cursor and the writes back together` |
| A newer server record wins on ack and overwrites the local row | same | `sync/store.sqlite.ts` | `sync/engine.test.ts > a newer server record wins on ack and overwrites the local row` |
| Mirror rows carry the session user id; the demo owner only without a session | `AppEnvironment.swift` `currentUserId` | `sync/store.sqlite.ts` `ownerId`, `repos/seedDataManager.ts` | `sync/store.sqlite.test.ts > writes and pulls carry the owner the runtime reads at write time`; `> falls back to the demo owner when no session user is given (fixture and debug mode)`; `sync/runtime.session.test.ts > a different user signing in rebinds the engine and new rows carry the new user id` |

## NW-02 Sync transport

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Push and pull over `POST /v1/sync/push` and `/pull` with the shared contract; strict responses | `SupabaseSyncTransport.swift` | `api/syncClient.ts` | `api/syncTransport.test.ts` (U-20), re-run |
| One refresh and one retry on 401; no token means `unauthorized` and nothing is sent | `SupabaseSyncTransport.swift`, `AuthSessionStore` | `api/syncClient.ts`, `sync/runtime.ts` (token provider and refresh from `getSessionStore()`) | `api/syncTransport.test.ts`; `sync/runtime.session.test.ts > without a session the engine makes no request and reports unauthorized`; `> signing in binds the engine to the session user and the push carries its token` |
| The ack set of a push response must equal the submitted set | `SupabaseSyncTransport.swift` | `api/syncClient.ts`, `sync/engine.ts` | `sync/ackIntegrity.test.ts` (three cases) |
| A pull response whose cursor moves backwards is refused | `PullResponse.validate` | `sync/engine.ts` calling `validatePullResponse` (contract rows `{seq, record}` mapped to `{snapshot:{serverVersion}}`) | `sync/engine.test.ts` (cursor expectations 2 and 4); `sync/e2e.integration.test.ts` |
| Against the real server | `E2ESyncConvergenceTests` | `scripts/rn/e2e-sync.sh` | the script's steps 1 to 6 (versions 1 and 2, cursor 2, duplicates, isolation, 401, 400) |

## CO-07 SyncEnvelope (wire validation used by the engine)

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Exact acknowledgement set (`validateAcknowledgementSet`) is called by the engine on every push | `SyncEnvelope.swift` | `packages/core/src/syncEnvelope.ts` called from `sync/engine.ts` | `sync/ackIntegrity.test.ts > foreign acknowledgement rejects the whole batch` and two more; `packages/core/src/syncEnvelope.test.ts` (U-10) |
| Pull cursor rules (`validatePullResponse`) are called by the engine on every pulled page | `SyncEnvelope.swift` | same | `sync/engine.test.ts` (pull cases); `packages/core/src/syncEnvelope.test.ts` |
| Unknown keys in a response are a typed error (zod `strictObject` in the transport) | `SyncEnvelopeDecoder.rejectUnknownKeys` | `packages/api-contract/src/sync.ts`, `api/syncClient.ts` | `api/syncTransport.test.ts`; `packages/api-contract/src/sync.test.ts` |
