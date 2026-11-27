# T3 findings — sync: contract, API, local store, engine (spike item 4)

Worker-G1, 2026-11-27. Branch `spike/rn-expo-sync`. Spec `docs/spec.md` D4, plan `docs/plan.md` T3.

## Result

- `packages/api-contract`: D4 schemas as Zod 4 `strictObject`, inferred types re-exported from `src/index.ts`. 22 tests.
- `apps/api`: push/pull routes, `query(sql, params)` port, postgres.js store, `schema.sql` (`meals`, `sync_ops`, `sync_changes` with `seq BIGSERIAL`), bearer-token auth from `apps/api/dev-tokens.json`, D4 error envelope. 11 tests, all on PGlite. The whole curl-only e2e ran green against a real throwaway PostgreSQL 17 (transcript in `evidence/item4/e2e-transcript.txt`).
- `apps/mobile`: Drizzle schema + WAL client + bundled migrations, fetch transport (`src/data/api/syncClient.ts`), `SyncStore`/`SyncTransport` ports, repository (one transaction per local write), engine (FIFO ≤ 50, paged pull, pending-intent skip, one transaction per batch/page, backoff, quarantine on 400, stop on 401, coalescing, `setForcedOffline`), triggers, runtime. 16 engine/repository tests on an in-memory store + a fake server, plus the skeleton suite. `tsc --noEmit` clean in all three workspaces.

## What was easy / hard

### Drizzle
- `drizzle-orm/expo-sqlite/migrator`'s `migrate()` takes **bundled migrations** — a `{ journal, migrations: Record<'mNNNN', sqlText> }` object, no filesystem. Good shape for RN.
- `drizzle-kit generate` with `driver: 'expo'` emits a `migrations.js` that does `import m0000 from './0000_*.sql'`. Metro cannot import `.sql` without an `assetExts` config change, which is outside T3's file ownership. Workaround: `src/data/db/migrations.ts` inlines the generated SQL verbatim and imports the generated `meta/_journal.json`. **After regenerating migrations, copy the new statements into `migrations.ts`** (or T6 adds `'sql'` to Metro `assetExts` in a `metro.config.js` and drops the inline copy — both are one-line changes; I could not do either from my file set).
- drizzle-kit would not run through `npx drizzle-kit@0.31.11` from the repo ("Please install latest version of drizzle-orm" — it resolves `drizzle-orm` from its own install sandbox). Fixed by installing drizzle-kit + drizzle-orm 0.45.4 together in a throwaway folder outside the repo and running that binary with cwd = `apps/mobile`. Nothing was added to any package.json.
- `db.transaction(...)` on expo-sqlite: untested here (needs the native module); it is the load-bearing guarantee behind "one transaction per pull page" in `store.sqlite.ts`. T6 should confirm on device.

### PGlite
- Made the API test suite trivial: real Postgres SQL in-memory inside Jest, same statements as the postgres.js store.
- **Jest quirk (cost ~15 min):** PGlite resolves internal resources with dynamic `import()`, which Jest's CJS VM refuses without a flag. The api workspace's test script is now `NODE_OPTIONS=--experimental-vm-modules jest` (works on Node 24 and 26). Jest also hung at exit until every `PGlite` was closed in `afterEach`.

### postgres.js vs PGlite jsonb (the one real bug e2e caught)
- The pull route initially returned `record` **as a JSON string** on real PostgreSQL 17 (postgres.js returns `jsonb` columns unparsed) while PGlite returned an object — the wire violated the contract on exactly the machine the spike says is the runtime evidence. Fixed by normalising (`typeof raw === 'string' ? JSON.parse(raw) : raw`) in the route; both drivers now speak identical JSON. Lesson recorded for T6: PGlite test parity is *not* automatic for result-shape questions.

### Docs that were wrong / misleading
- `@react-native-community/netinfo` types: `addEventListener` returns a `NetInfoSubscription` (a `() => void`), not a `NetInfoChangeHandler` — the handler type name looks right and is wrong.
- postgres.js types: `unsafe(text, params)` needs `never[]`-style casts for `readonly unknown[]` params, and `sql.begin`'s `UnwrapPromiseArray<T>` return does not line up with a plain generic — hence the small adapter functions in `store.postgres.ts`.
- Nothing in the Expo docs mentions that `expo-constants` `extra` is the sanctioned place for the dev API base URL/token; that came from the plan (it works: `resolveApiConfig()`).

## Registration lines for T6 (src/spike/)

```ts
import { syncSpikeActions } from '../data/sync/spikeActions';
// then, once:
for (const action of syncSpikeActions) registerSpikeAction(action);
```

`syncSpikeActions` exports, in console order: `seed`, `add-meal`, `edit-meal` (A → 450 kcal), `delete-meal` (C), `sync`, `force-offline`, `force-online`, `reset` — all `item: 'sync'`, all typed `SpikeAction` from the frozen `src/spike/types.ts`. Fixture ids are deterministic for curl cross-checks: A `aaaaaaaa-…`, B `bbbbbbbb-…` (add-meal), C `cccccccc-…` — same ids as `scripts/e2e-sync.sh`.

`getSyncRuntime()` (in `src/data/sync/runtime.ts`) is async and memoized: `const runtime = await getSyncRuntime();` then `runtime.startTriggers()` at app start (T6). It exposes `engine`, `repository`, `transport`, `store` (for the Sync card: `store.cursor()`, `store.outboxCount()`, `store.quarantinedOperations()`, `engine.isForcedOffline()`). For Jest/preview use there is no sync-only shortcut by design — the real path opens SQLite and runs migrations.

## Engine semantics worth knowing before T6

- On push failure with a network/5xx error the engine stops the run, keeps ops pending, and schedules one backoff retry (1 s, doubling, 30 s cap) via the injected scheduler. A manual/triggered `sync()` ignores backoff and runs immediately.
- A 400 quarantines **the whole batch** (spec: "a 400 quarantines the batch") — with ≤ 50 ops per batch that is the intended blast radius.
- Pull **runs only after the push phase kept going**; a quarantined record is skipped on pull because its outbox row still counts as pending local intent (spec: "an outbox row exists").
- Coalescing: callers of a running `sync()` share the in-flight promise; exactly one follow-up run starts afterwards (this is what makes a local write during a sync get pushed).
- `reset` empties meals, outbox and sync_state (cursor + device id) and clears forced-offline.

## Left for the device run (T6)

1. Everything on a simulator: this task never builds native (`expo run:ios`, `pod install` forbidden by plan) — the engine, Drizzle migrations and expo-sqlite WAL have compiled and unit-tested, not run on-device.
2. `db.transaction()` atomicity on real expo-sqlite (the pull-page rollback guarantee).
3. NetInfo behaviour on the simulator (airplane mode toggling) vs the scripted `force-offline`.
4. The app-driven e2e steps (commented at the bottom of `scripts/e2e-sync.sh`): offline add/edit/delete survive a kill, 3 ops push on reconnect, second-device edit of B.
5. If migrations are regenerated, re-inline the SQL in `src/data/db/migrations.ts` (see Drizzle above).

## Dependency changes (the only ones made)

`apps/api/package.json`: `postgres` `^3.4.9` (dependency — branch 3.x on purpose, the well-documented API; v4 is new major), `@electric-sql/pglite` `^0.6.0` (devDependency), and the test script gained `NODE_OPTIONS=--experimental-vm-modules` (needed by PGlite under Jest; not a dependency change but recorded here). One `npm install` ran from `rn-spike/`; the lockfile change is committed. `apps/mobile/package.json` untouched; drizzle-kit ran from an external throwaway install, not from the workspace.
