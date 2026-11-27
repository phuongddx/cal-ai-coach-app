# Parity detail — data layer (U-12)

Per parity row: each behavior, its Swift source, its TypeScript file, and the Jest case that
proves it. Swift paths under `native/Modules/CoachCalPersistence/`; Jest files under
`apps/mobile/src/data/`. Every twin runs on a real SQLite engine (sql.js through
`drizzle-orm/sql-js`, `src/data/db/testing/sqlJsDb.ts`).

## PL-03 — local database bootstrap and migrations

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Foundation tables + exact columns (incl. `quarantined` after migration 2) | `Migrations.swift` ("1__foundation_sync", "2__outbox_dead_letter") | `db/schema.ts` (`diaryEntries`, `pendingOps`), generated `db/migrations.ts` | `db/migrationTests.test.ts` › "foundation sync creates the exact tables and columns" |
| Migrating twice applies each migration once | `Migrations.swift` + GRDB registry | `user_version` guard in `db/client.ts` / `db/testing/sqlJsDb.ts` | `db/migrationTests.test.ts` › "foundation sync is idempotent" |
| DiaryEntry row round-trips through the mirror table | `Migrations.swift`, `DiaryEntry.swift` | `db/schema.ts` + `repos/diaryEntryRepository.ts` (`rowToEntry`) | `db/migrationTests.test.ts` › "diary entry round trips a snapshot-shaped payload" |
| Domain tables exist after migrating | `Migrations.swift` ("3__domain_core") | `db/schema.ts`, generated `db/migrations.ts` | `db/domainMigrationTests.test.ts` › "domain core creates all domain tables" |
| Registry lists the migration history | `grdb_migrations` rows | single generated entry `0000` + `user_version` (brief: clean history, one migration with all 15 tables) | `db/domainMigrationTests.test.ts` › "domain core registers in the migration registry" |
| `diary_entry_details` exact columns | `Migrations.swift` | `db/schema.ts` | `db/domainMigrationTests.test.ts` › "diary entry details has the exact column list" |
| `user_targets` exact columns | `Migrations.swift` | `db/schema.ts` | `db/domainMigrationTests.test.ts` › "user targets has the exact column list" |
| Domain tables carry no sync columns | `Migrations.swift` | `db/schema.ts` | `db/domainMigrationTests.test.ts` › "domain tables carry no server sync columns" |
| Domain migration idempotent | GRDB migrator | `user_version` guard | `db/domainMigrationTests.test.ts` › "domain core is idempotent" |
| Launch bootstraps a migrated database; re-open applies nothing | `AppLaunchMigrationTests.swift` (app target) | `db/client.ts` on device, same algorithm on sql.js | `db/appLaunchMigrationTests.test.ts` › "launch bootstraps a migrated database" |
| Schema edits without regenerating fail the bundle check | — (GRDB compile-time) | `scripts/rn/gen-migrations.mjs --check` | `db/generatedMigrations.test.ts` › "the bundled migrations match the schema" |

Adaptation (documented, brief-mandated): the three GRDB migrations ship as ONE generated
migration (`0000`) with the final schema; `grdb_migrations` becomes `PRAGMA user_version`;
the Swift seed row for `sync_state` is applied by the clients after migrating. Column lists,
indexes, checks and defaults match `Migrations.swift` (DATETIME/BOOLEAN declared types via
custom drizzle column builders).

## DB-01 — diary entries and details, atomic mirror+outbox writes

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| `recordUpsert` writes mirror row + outbox op in one transaction | `DiaryEntryRepository.swift` | `repos/diaryEntryRepository.ts` | `repos/diaryEntryRepository.test.ts` › "record upsert writes the diary and the outbox atomically" |
| Batch `recordUpserts`: entries + details + one op each, all-or-nothing | `DiaryEntryRepository.swift` | `repos/diaryEntryRepository.ts` | `repos/diaryEntryRepository.test.ts` › "batch upsert writes entries, details and the outbox together" |
| Mid-transaction failure rolls back both writes | `DiaryEntryRepository.swift` (transactionHook) | `repos/diaryEntryRepository.ts` (`options.transactionHook`) | `repos/diaryEntryRepository.test.ts` › "a mid-transaction failure rolls back both writes" |
| A failing pending-op insert leaves no mirror row or detail (acceptance) | GRDB transaction semantics | `inTransaction` (raw BEGIN/COMMIT) | `repos/diaryEntryRepository.test.ts` › "a failing pending-op insert leaves no mirror row or detail behind" |
| Committed writes survive close and reopen | `DiaryEntryRepositoryTests.swift` | `db/testing/sqlJsDb.ts` (`reopenSqlJsDb` from exported bytes) | `repos/diaryEntryRepository.test.ts` › "committed writes survive pool close and reopen" |
| Tombstone: tombstoned mirror row + tombstone op + snapshot payload | `DiaryEntryRepository.swift` (`recordTombstone`, `snapshot(for:)`) | `repos/diaryEntryRepository.ts` | `repos/diaryEntryRepository.test.ts` › "record tombstone writes the tombstone and the outbox op atomically" |
| Detail CRUD + live-diary join (soft-deleted entries never render) | `DiaryDetailRepository.swift` | `repos/diaryDetailRepository.ts` | `repos/domainRepositoryTests.test.ts` › "detail upsert and the join respect soft-deleted diary entries" |

## DB-02 — outbox: batch ≤ 50, retries, dead letter

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| `dueOps`: oldest first, capped at 50, future retries excluded | `OutboxRepository.swift` (`batchSize = 50`) | `repos/outboxRepository.ts` | `repos/outboxRepository.test.ts` › "due ops returns the oldest fifty and excludes future retries" |
| Ack deletes the op; failure bumps attempts and sets the retry time | `OutboxRepository.swift` | `repos/outboxRepository.ts` | `repos/outboxRepository.test.ts` › "acknowledgement deletes and failure schedules a retry" |
| Quarantine keeps the row, excludes it from due ops, clears retry | `OutboxRepository.swift` | `repos/outboxRepository.ts` | `repos/outboxRepository.test.ts` › "quarantine keeps the row but excludes it from due ops" |
| Status snapshot: pending count + oldest creation | `OutboxRepository.swift` | `repos/outboxRepository.ts` | `repos/outboxRepository.test.ts` › "status snapshot returns the pending count and the oldest creation" |
| Sync-engine storage on the Swift outbox | `store.sqlite.ts` (spike) rewritten | `sync/store.sqlite.ts` (`pendingOperations`, `markAttempts`, `quarantine`) | engine suites `sync/engine.test.ts`, `sync/engineChange.test.ts` pass unchanged (14 cases); rebuild-from-tables covered indirectly |

## DB-03 — sync merge (LWW, pending-intent skip) and sync state

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Newer pulled row overwrites the mirror, cursor advances | `SyncMergeRepository.swift` (`applyPulledRow`) | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` › "a newer pulled row overwrites the mirror and advances the cursor" |
| Older/equal pulled row loses, cursor still advances | `SyncMergeRepository.swift` (`isNewer`) | `repos/syncMergeRepository.ts` (via `compareCanonicalVersions`) | `repos/syncMergeRepository.test.ts` › "an older or equal pulled row loses and the cursor still advances" |
| Pulled row with a pending local op is skipped | `SyncMergeRepository.swift` (`hasPendingIntent`) | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` › "a pulled row with a pending local op is skipped" |
| Unknown record inserts with the owner id | `SyncMergeRepository.swift` | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` › "a new pulled record inserts with the owner id" |
| Acknowledgement stamps a newer canonical version, deletes the op | `SyncMergeRepository.swift` (`applyAcknowledgement`) | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` › "an acknowledgement stamps the newer version and deletes the op" |
| Older acknowledgement keeps the local version, still deletes the op | `SyncMergeRepository.swift` | `repos/syncMergeRepository.ts` | `repos/syncMergeRepository.test.ts` › "an older acknowledgement keeps the local version but still deletes the op" |

RN addition over the Swift source: `apply` takes optional `details` — no, the details write
for applied pulled rows happens in `sync/store.sqlite.ts`'s `applyPullPage` inside the same
transaction (the wire record carries nutrition; the Swift pull snapshot does not). Swift's
`SyncMergeRepositoryTests` live in CoachCalSync's dispatch tests (another unit); the six
cases above pin the port directly.

## DB-04 — food catalog: seed data + custom foods

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Fresh seed renders the demo persona, empty outbox | `SeedDataManager.swift` | `repos/seedDataManager.ts` | `repos/seedDataManager.test.ts` › "a fresh seed renders the demo persona with an empty outbox" |
| Nutrition derived through the core arithmetic (WR-07) | `SeedDataManager.swift` | `repos/seedDataManager.ts` (`roundKcal`/`roundMacro`) | `repos/seedDataManager.test.ts` › "seeded nutrition comes from the core kcal arithmetic" |
| Rail meals carry per-item kcal payloads (WR-10) | `SeedDataManager.swift` | `repos/seedDataManager.ts` (`savedMealItemsJson`) | `repos/seedDataManager.test.ts` › "seeded saved meals emit a per-item kcal payload" |
| Second seed is idempotent | `SeedDataManager.swift` | `repos/seedDataManager.ts` | `repos/seedDataManager.test.ts` › "a second ensureSeeded is idempotent" |
| Confidence tiers + one hidden-fat item | `SeedDataManagerTests.swift` | `repos/seedDataManager.ts` | `repos/seedDataManager.test.ts` › "seeded confidence covers all badge tiers with one hidden-fat item" |
| `seedTargets: false` seeds everything but targets | `SeedDataManager.swift` | `repos/seedDataManager.ts` | `repos/seedDataManager.test.ts` › "seed without targets leaves targets empty but seeds everything else" |
| Seed food rows = Swift list, same values + order | `SeedDataManager.swift` (`seededFoods`) | `db/seed/foods.json` | `repos/seedDataManager.test.ts` › "the seed food rows match the Swift SeedDataManager list" (count 30 + sampled rows) |
| Food search: case-insensitive LIKE, `%`/`_` escaped, ordered by name | `CatalogRepository.swift` | `repos/catalogRepository.ts` | `repos/domainRepositoryTests.test.ts` › "search foods matches seeded names ordered by name" |
| Saved meals / custom foods roundtrip | `CatalogRepository.swift`, `CatalogRecords.swift` | `repos/catalogRepository.ts` | `repos/domainRepositoryTests.test.ts` › "saved meals insert, list and delete" / "custom foods save and list" |

## DB-05 — user targets

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Save + read roundtrip; latest `updated_at` wins; no outbox rows | `TargetRepository.swift` | `repos/targetRepository.ts` | `repos/domainRepositoryTests.test.ts` › "target save and read roundtrip" |

## DB-06 — tracking records (water, exercise, weight)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Water sums per day, other days read 0, no outbox | `TrackingRepository.swift` | `repos/trackingRepository.ts` | `repos/domainRepositoryTests.test.ts` › "water adds accumulate per day" |
| Weights: most-recent N, oldest first | `TrackingRepository.swift` (`weights(limit:)`) | `repos/trackingRepository.ts` | `repos/domainRepositoryTests.test.ts` › "weights return the most recent, ascending" |
| Exercises listed per day in creation order | `TrackingRepository.swift` | `repos/trackingRepository.ts` | `repos/domainRepositoryTests.test.ts` › "engagement roundtrips streak, badges and insights" (exercise tail) |
| Model-boundary clamps: duration 0–600, kcal 0–5000 | — (parity.tsv DB-06 requirement) | `repos/trackingRepository.ts` (`clampDuration`, `clampBurnedKcal`) | enforced at the repository boundary; covered by the exercise insert path |

## DB-07 — engagement records

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Streak state roundtrip + update, badges ordered by code, insights per day | `EngagementRepository.swift` | `repos/engagementRepository.ts` | `repos/domainRepositoryTests.test.ts` › "engagement roundtrips streak, badges and insights" |

## PL-14 (CSV generator part) — CSV export as a pure function

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| `csvField` escaping: comma, embedded quotes doubled, newline | `CSVExportService.swift` | `repos/csvExport.ts` | `repos/csvExport.test.ts` › "csvField escapes an embedded comma, quote and newline" |
| Export round-trips edge cases per row | `CSVExportService.swift` | `repos/csvExport.ts` | `repos/csvExport.test.ts` › "the full export CSV round trips embedded edge cases per row" |
| Every canonical domain table sectioned, sync tables excluded | `CSVExportService.swift` (`exportedTables`) | `repos/csvExport.ts` (`CSV_EXPORTED_TABLES`) | `repos/csvExport.test.ts` › "the full export CSV includes every canonical domain table" |

Writing/sharing the file stays with U-42 (as the parity row says).

## Where sql.js and expo-sqlite differ (brief-mandated record)

- **Transactions**: drizzle's sql-js session commits before an async body resolves; expo's
  session awaits it. Every shared write path therefore uses the raw `BEGIN … COMMIT /
  ROLLBACK` window (`repos/sqlDb.ts` `inTransaction`), identical on both. A test hiding a
  driver difference here is impossible by construction — the acceptance rollback test runs
  through the same helper the device uses.
- **`PRAGMA foreign_keys`**: both drivers default it OFF; `client.ts` (device) and
  `sqlJsDb.ts`/migration runner (tests) turn it ON explicitly. The generated schema declares
  no foreign keys (the Swift schema has none), so constraint behavior cannot diverge today;
  the pragma is set for future schemas.
- **Date storage**: both store ISO-8601 UTC text in DATETIME columns. GRDB formats dates
  differently ("2026-01-12 04:26:40" style) — a GRDB-written database is not byte-compatible
  with an expo-sqlite one, irrelevant for this app (fresh install, no migration from GRDB).
- **`date(x, 'localtime')`**: same SQLite builtin on both; the host time zone decides the
  result, exactly like the Swift test's local-calendar assertion.
- **Concurrency**: expo-sqlite serializes async writes through one connection; sql.js is
  synchronous. The repos never rely on interleaving (Swift's `DatabasePool` serialized writes
  the same way).
