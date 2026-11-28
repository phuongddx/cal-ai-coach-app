# Repository Guidelines

## Project Overview

CoachCal — an AI calorie coach. React Native + Expo iOS app (`apps/mobile`) + Hono API on PostgreSQL 17 (`apps/api`), in one npm workspaces monorepo. Photograph a meal, get calories/macros in seconds, then correct the estimate. Competes with Cal AI; differentiates on honesty: transparent billing with in-app cancel, visible AI confidence on every scan, ED-safe guardrails. Core value: a trustworthy, editable kcal/macro estimate from any meal photo in under 5 seconds. Data is local-first; AI keys are server-side only.

The SwiftUI app and the Supabase backend came first. The SwiftUI app was removed in the cleanup unit U-70 (`native/`, its two workflows, `ci_scripts/`); the git tag `archive/swiftui-final` keeps the last commit that held it. `supabase/`, `deno.lock` and the Deno scripts under `scripts/` are still in the tree and are not developed further: they go once the hosted Hono backend runs.

## Architecture & Data Flow

Monorepo (`package.json` workspaces `apps/*` and `packages/*`): `apps/mobile/` (Expo app), `apps/api/` (Hono API), `packages/core/` and `packages/api-contract/` (shared TypeScript), `scripts/rn/` (gates and build/evidence scripts), `supabase/` + `scripts/*.ts` (legacy backend and its Deno harnesses), `docs/`.

### Module graph

```text
@coachcal/mobile  (Expo app)         @coachcal/api  (Hono + PostgreSQL 17)
├── @coachcal/api-contract ──┐       ├── @coachcal/api-contract ──┐
└── @coachcal/core ──────────┴─ (no react-native, no node: imports)
```

- **`@coachcal/core`** (`packages/core/src`) — pure domain, imports nothing but its own files, runs in Node (Jest) and Hermes (Metro): `arithmetic` (kcal/macro rule), `kcal`, `targets` (Mifflin-St Jeor, clamps instead of throwing), `streak`, `dayKey`, `widgetSnapshot`, `canonicalVersion` (the LWW comparator), `syncEnvelope`, `notificationSchedule`, `proofRecord`.
- **`@coachcal/api-contract`** (`packages/api-contract/src`) — zod `strictObject` wire contracts shared by app and API: `contracts/` (scan, lookup, food, VLM vocabulary, errors, webhook), `sync.ts`, `auth.ts`, and, next to `src/`, `golden/` (ten golden JSON fixtures; `src/golden.test.ts` lists all ten and parses nine, `webhook-response-200.golden.json` is only listed).
- **`@coachcal/api`** (`apps/api`) — Hono app built without a listener in `src/app.ts` (`createApp(deps)`), served by `src/index.ts`. Domains: `auth/` (Apple and Google providers, e-mail code, sessions, rate limit, dev tokens), `scan/` (route + pipeline), `grounding/` (cache-first cascade: FDC, Open Food Facts, FatSecret), `lookup/` (barcode, food search), `vlm/` (provider seam, Gemini, fixture), `webhook/` (RevenueCat, HMAC), `sync.ts`, `quota.ts`, `entitlement.ts`. `migrations/*.sql` are applied by `src/migrate.ts`; `deploy/` + `Dockerfile` are the VPS kit.
- **`@coachcal/mobile`** (`apps/mobile`) — Expo Router app. `src/app/` holds route files only (every file there is a route; no tests live there). `src/design/` tokens, components and the ED-safe API. `src/features/<feature>/` per feature (`today`, `diary`, `scan`, `progress`, `coach`, `profile`, `billing`, `onboarding`, `auth`, plus `ember`, the first design canvas): a model/reducer, its views, its tests. `src/data/` `db` (Drizzle schema, bundled migrations), `repos` (repositories), `sync` (outbox engine), `api` (typed clients), `auth` (session), `health` (HealthKit), `widget`. `src/platform/` composition root, telemetry seam, notifications, CSV export, root gate. `src/debug/` launch flags (`launchArgs.ts`) and their tests; the debug console is the route `src/app/debug.tsx`. `src/spike/` the spike registry and deep-link actions that `src/app/_layout.tsx` imports. `src/testing/` fixtures and the fixture scan API. `src/widgets/` the calories widget. `modules/coachcal-launch-arguments/` is the local Expo module (Swift) that hands launch arguments to JS. `plugins/with-coachcal-entitlements.js` is the config plugin. `ios/` and `android/` are never committed (Continuous Native Generation).

### Composition root

- `apps/mobile/src/platform/appEnvironment.tsx` defines `AppEnvironment` (data handle, session store, `createApi`, injected clock, debug flags, telemetry, `openScan`, `resetLocalData`) and its React provider; `src/platform/rootRuntime.ts` is the real wiring (database, session, sync runtime, data binding), `getRootController()` is called from three places: `src/app/_layout.tsx`, `src/app/onboarding/index.tsx` (completing onboarding) and `src/platform/appEnvironmentDeps.ts` (account reset); `launchSequence.ts` and `rootController.ts` hold the pure rules Jest proves.
- `apps/mobile/src/data/environment.ts` `getDataEnvironment()` is the database handle plus the repositories and the clock. Feature models take repositories, API client, clock and flags through their constructor; the route file gets the real ones from `getDataEnvironment()` and `getDebugFlags()`. Feature code never opens the database and never reads process arguments.
- `apps/mobile/src/debug/launchArgs.ts` is the only reader of debug and fixture flags (`getDebugFlags()`, `setDebugFlags()`).

### Photo-scan data flow

1. The viewfinder (`features/scan/CaptureViewfinderView`) takes a capture from the camera, or from the fixture seam under `--ccFixtureCapture` → `ScanCapture`.
2. `features/scan/scanModel.ts` → the API client in `src/data/api/scanClient.ts` (live, or `src/testing/fixtureScanApi.ts` under a scenario) → `POST /v1/scan` with a `ScanRequest` (`scanId` is a fresh UUID v4).
3. Server gate order is **fixed**: preflight → JSON parse → `ScanRequestSchema` (400) → auth (401) → entitlement/quota `claim_scan_credit` (402 `FREE_LIMIT_REACHED`) → kind routing (barcode → cascade directly, never a VLM; photo/label/text → VLM tier1, escalate to tier2 on low confidence, `apps/api/src/routing.ts`) → grounding cascade (cache-first) → arithmetic → response self-parse (500 only for genuine inconsistencies) → `persist_scan` → 200. The route chain is `validateJson` then `requireUser` in `apps/api/src/scan/route.ts`; the rest is `scan/pipeline.ts`.
4. Client review: the displayed kcal is **always recomputed** with `@coachcal/core` from the current grams — the response kcal is never the display source after edits.
5. Save: `DiaryEntryRepository` writes mirror rows, details and one pending op per entry in **one SQLite transaction**, then `notifyLocalMutation()` (`src/data/sync/runtime.ts`) fans out to sync, notifications and the widget.
6. Sync: `src/data/sync/engine.ts` debounces 500 ms, drains the outbox (≤50, FIFO) → `POST /v1/sync/push` → exact-ack-set validation → ack merge → `POST /v1/sync/pull` with the cursor → last-writer-wins merge (skips rows with a pending local intent) → cursor advance. An op quarantines after 5 attempts (a 400 on push quarantines the batch at once; 401 stops without counting). Triggers wired today (`triggers.ts`): app start, foreground, network regained, the local write (`notifyLocalMutation()`) and the debug console. The background-task seam (`triggerSeams.ts`, `BGTaskTrigger`) exists but is unused: the app has no background task yet, so nothing syncs in the background.

### Hard invariants

Worded as in `docs/rn-migration/spec.md` section 3.

- **The VLM never outputs kcal.** Contract: `packages/api-contract/src/contracts/vlm.ts` rejects a kcal key (`golden.test.ts`). Provider: the Gemini response schema and prompt in `apps/api/src/vlm/` carry no kcal field. Arithmetic: kcal is computed only by `packages/core/src/arithmetic.ts` from grounded per-100g times VLM grams.
- **The API process holds zero table privileges.** It connects as a role with no privilege on any table and can only execute the SECURITY DEFINER functions it needs (`sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`, the helper and auth functions in `apps/api/migrations/`). The webhook goes through `webhook_apply`, not `apply_webhook_event`. `apps/api/src/privileges.test.ts` and `auth/authPrivileges.test.ts` run as that role.
- **`500 INTERNAL` only for genuine bugs**; malformed input is a typed `400 VALIDATION_ERROR`, malformed VLM output a typed `422 VLM_SCHEMA_ERROR`; every body uses the uniform envelope `{error:{code,details?}}` (`packages/api-contract/src/contracts/errors.ts`, `apps/api/src/http.ts`).
- **Only `diary_entries` syncs** (mirror rows and tombstones); every other table is local-only. The sync wire contract has one record type (`packages/api-contract/src/sync.ts`).
- **The gate order in the scan pipeline is fixed**: preflight, JSON parse, schema (400), auth (401), quota (402 `FREE_LIMIT_REACHED`), kind routing (barcode never reaches a VLM), grounding cascade, arithmetic, self-parse, `persist_scan`, 200.
- **The displayed kcal is always recomputed from the current grams on the client**; the response kcal is never the display source after an edit.
- ED-safe has one API (`apps/mobile/src/design/edSafe.ts`); components own the policy branch, feature code has none. Photo, health and kcal text never leave the device through telemetry. Every id that reaches the server is a valid UUID v4 on Hermes (`src/data/sync/uuid.ts` is the only id source). `packages/core` is pure.

## Key Directories

| Path | Purpose |
|---|---|
| `apps/mobile/` | Expo app (SDK 58, React Native 0.88, Hermes, New Architecture). `app.config.ts` is the native config; run through a development build (`expo-dev-client`) |
| `apps/mobile/src/` | `app` routes, `design`, `features`, `data`, `platform`, `debug`, `spike`, `testing`, `widgets` (see the module graph) |
| `apps/mobile/modules/` | Local Expo modules in Swift; today `coachcal-launch-arguments` |
| `apps/api/` | Hono API; `migrations/` SQL, `deploy/` Docker Compose + Caddy + backup, `dev-tokens.json` (dev only), `.env.example` (names only) |
| `packages/core/`, `packages/api-contract/` | Shared pure domain; wire contracts and `golden/` fixtures |
| `scripts/rn/` | Gates and tools of the React Native stack: parity gate, token generator, typed routes, API start/stop, smoke scripts, native-module check, artifact compliance, `evidence/` flows |
| `docs/rn-migration/` | The migration record: spec, plan, parity table, findings, evidence, build recipe, VPS deploy steps |
| `docs/design/ember/` | The Ember design: `tokens.css` (token source), `tokens.json`, `design-system.md`, the frame canvas and `frames/` |
| `docs/engineering/` | Stable engineering knowledge: conventions, infrastructure, tech stack |
| `supabase/` | Legacy backend (Deno edge functions, migrations); not developed further, goes when the hosted Hono backend runs |
| `scripts/*.ts`, `scripts/*.mjs`, `scripts/proof-capture/` | Deno/Node harnesses of the Supabase stack (golden eval, e2e sync check, smoke, fixture export) |
| `plans/`, `docs/superpowers/` | Historical specs and dated execution reports (live planning state is gitignored `.planning/`) |

## Development Commands

Node 24+ (`engines` in `package.json`). Run everything at the repo root.

```sh
# Install and the three gates (the same three CI runs, see below)
npm ci
npm run typecheck          # first runs scripts/rn/gen-typed-routes.mjs, then tsc in every workspace
npm test                   # Jest in apps/mobile, apps/api, packages/*; SQL suites print [sql-skip] without a database
npm run parity:check       # the parity gate (docs/rn-migration/parity.tsv)
bash scripts/rn/gate.sh    # all three, one gate on the machine at a time; prints the last lines of each

# Generated files and docs checks
node scripts/rn/gen-tokens.mjs --check     # emberTokens.generated.ts matches docs/design/ember/tokens.json
node scripts/rn/check-frames-doc.mjs       # FRAMES.md cites every frame of the manifest
npm run parity:write                       # also regenerates docs/rn-migration/parity.md

# API with a throwaway PostgreSQL 17 on port 5433 (API on 8787)
bash scripts/rn/start-api.sh               # initdb, roles, migrations, API; stop it afterwards:
bash scripts/rn/start-api.sh stop

# Simulator, native build and evidence (macOS, Xcode)
bash scripts/rn/check-native-modules.sh [<path to the .app>]   # which native module the code needs and the build lacks
. scripts/rn/sim-udid.sh && sim_udid                           # the evidence Simulator by name (the file only defines `sim_udid`: source it)
bash scripts/rn/evidence/run-all.sh                            # every evidence flow in one Metro + Simulator session
node scripts/rn/check-artifact-compliance.mjs <path to CoachCal.app>   # entitlements, Info.plist, privacy manifest, secrets

# Day-to-day
npm run mobile             # Metro for the development client (expo start --dev-client)
npm run api                # API with file watching (tsx watch)
npm run test:mobile        # or: npm run test:api
```

Edit `apps/mobile/app.config.ts` and the config plugins, never a generated `ios/`. Never edit `apps/mobile/src/design/emberTokens.generated.ts`, `apps/mobile/src/data/db/migrations.ts` or `apps/mobile/.expo/types/router.d.ts` by hand; regenerate them.

Legacy Supabase stack (not developed further; needs the local Supabase stack, Deno 2):

```sh
cd supabase/functions && deno task test      # → deno test --allow-all tests/ ; NEVER add --parallel
supabase functions serve --env-file supabase/functions/.env
supabase status -o env > envfile && deno run --env-file=envfile --allow-all scripts/run-golden-eval.ts
deno run --allow-all scripts/verify-e2e-sync.ts
node --test scripts/measure-phase1-sync.test.mjs
```

Not part of the gate and not run by `npm test`: `start-api.sh` (needs the API slot), `sim-udid.sh`, `evidence/run-all.sh` and `npm run mobile` (Simulator or Metro), `npm run api` (long-running), `parity:write` (rewrites a document) and the legacy Supabase block (needs the local Supabase stack and Deno). `docs/rn-migration/findings/U-70.md` records which commands were run for this document and which were not.

## Code Conventions & Common Patterns

- **TypeScript strict**: `apps/api`, `packages/core` and `packages/api-contract` extend `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`); `apps/mobile` extends `expo/tsconfig.base` and sets only `strict`. React 19, React Compiler-safe code: read external stores through `useSyncExternalStore` with a stable snapshot (see `design/edSafe.ts`).
- **State**: each feature has a model or reducer that is plain TypeScript (`scanModel.ts`, `diaryDayModel.ts`, `onboardingModel.ts`, …) with a hook for the view; views stay thin. Module-level stores are read with `useSyncExternalStore` (`design/edSafe.ts`, `features/ember/emberStore.ts`). `zustand` and `@tanstack/react-query` are dependencies of `apps/mobile` (decision D3 of the spec) but no app code imports them yet (only `src/__tests__/nativeModulesSmoke.test.ts` does).
- **DI**: constructor injection of ports and closures (API client, repositories, `SyncStore`, `SyncTransport`, `now: () => Date`); `AppEnvironment` / `getDataEnvironment()` is the composition root — no service locator. Test seams are flag-based: the fixture scan API (`src/testing/fixtureScanApi.ts`), the fixture capture, `--cc*` launch arguments read once by `loadLaunchArguments()` (`--ccFreshStart`, `--ccEDSafe`, `--ccDisableAnimations`, `--ccFixtureCapture`, `--ccForceOffline`, `--ccRequireSignIn`, `--ccSeedNoTargets`, `--ccFixedClock <ISO instant>`, `--ccScanScenario <name>`).
- **After a write** through a repository, call `notifyLocalMutation()`. **Ids**: `src/data/sync/uuid.ts` is the only id source; never `crypto.randomUUID` under `apps/mobile` (a convention of the spec, invariant I11: no gate checks it today; nothing under `apps/mobile` uses it, while `apps/api` does, in production code at `scan/pipeline.ts` for every persisted scan item).
- **Error handling**: typed discriminated unions or error classes per boundary (scan API errors, sync transport errors, auth session errors, config errors), never a bare string. Best-effort paths swallow with a comment that says why. Persistence failures roll back and keep UI state consistent.
- **Strict wire decoding both ends**: zod `strictObject` server-side; the client parses every response with the same schema from `@coachcal/api-contract` (unknown keys fail); sync validates the exact ack set and the cursor.
- **Pure-core rule**: `packages/core` imports no `react-native`, no `node:` module, no other package; inputs clamp with flags instead of throwing.
- **ED-safe**: `design/edSafe.ts` is the only file that exports ED-safe functions (`edSafeMode()`, `edSafeHidden()`, `setEdSafeMode()`, `useEdSafeMode()`, `useEdSafeHidden()`). The rule: feature code under `src/features/**` hides a calorie framing with `EdSafeCollapse` from `src/design`, never by calling `edSafeMode(`/`edSafeHidden(`/`useEdSafeHidden(` itself; reading `useEdSafeMode()` to show a switch state (Settings, the onboarding privacy step) is fine. No test checks the rule. The diary has three recorded stays of `useEdSafeMode()`: the caption of the custom food sheet, the field fold of the search, and litres or glasses of the water card.
- **Design tokens**: the chain is `docs/design/ember/tokens.css` → `tokens.json` → `apps/mobile/src/design/emberTokens.generated.ts` (`node scripts/rn/gen-tokens.mjs`) → `src/design/tokens.ts` → the keys the app reads. Feature code uses tokens and `src/design` components only, never a literal color. What the chain does not hold is registered in `tokensWithoutSource.ts`.
- **Telemetry privacy**: feature code never imports Sentry or PostHog; it calls `track(name, payload)` on the seam in `src/platform/telemetry/`, which only passes allow-listed event names with a scrubbed payload (photo/health/kcal/food/meal text never leaves the device).
- **Naming**: `FeatureModel`-style `<feature>Model.ts` + `<Feature>View.tsx`; repositories are `*Repository`; ports and fakes sit beside the code (`fakeServer.ts`, `inMemorySyncStore.ts`, `src/testing/`).
- **Git**: Conventional Commits `type(scope): imperative lowercase summary`; this repository's migration units use scope `rn` (types seen: feat, fix, test, chore, docs, ci, build, refactor). Topic branches are merged by merge commit. Do not add AI authors, `Co-Authored-By` trailers or "Generated with" footers to commits or pull requests.
- **No lint/format tooling configured** (no ESLint, Prettier, `.editorconfig`, pre-commit); match surrounding style.

## Important Files

| File | Role |
|---|---|
| `package.json` | Workspaces, the `test`, `typecheck`, `parity:check` scripts |
| `apps/mobile/app.config.ts` | Native config: identity `com.nextlabs.coachcal`, scheme `coachcal`, privacy manifest, plugins, entitlements |
| `apps/mobile/src/platform/appEnvironment.tsx`, `rootRuntime.ts` | Composition root — start here for wiring questions |
| `apps/mobile/src/data/environment.ts` | Database handle + repositories + clock |
| `apps/mobile/src/debug/launchArgs.ts` | Debug and fixture flags |
| `apps/mobile/src/features/scan/scanModel.ts` | Scan state machine, kcal-recompute invariant, single-transaction save |
| `apps/mobile/src/data/sync/engine.ts` | Outbox drain engine (debounce/batch/quarantine/generation tokens) |
| `apps/mobile/src/data/repos/diaryEntryRepository.ts` | Atomic mirror + outbox write pattern |
| `apps/mobile/src/data/sync/uuid.ts` | The only id source |
| `apps/mobile/src/design/edSafe.ts`, `tokens.ts` | The ED-safe API; the token keys |
| `packages/core/src/arithmetic.ts` | Canonical kcal/macro math |
| `packages/core/src/canonicalVersion.ts`, `syncEnvelope.ts` | LWW comparator and wire validation |
| `packages/api-contract/src/contracts/`, `sync.ts`, `auth.ts` | Wire contracts (server and client share them) |
| `apps/api/src/app.ts` | The Hono app, error envelope, route registration |
| `apps/api/src/scan/route.ts`, `pipeline.ts` | Scan pipeline with the fixed gate order |
| `apps/api/src/grounding/cascade.ts` | Cache-first grounding cascade |
| `apps/api/src/sync.ts` | `/v1/sync/push` and `/v1/sync/pull` over the SECURITY DEFINER functions |
| `apps/api/migrations/*.sql` | DDL and the SECURITY DEFINER functions |
| `apps/api/deploy/`, `apps/api/Dockerfile` | VPS kit: Compose, Caddy, role init, backup |
| `scripts/rn/gate.sh`, `parity-check.mjs` | The gate; the parity checks |
| `docs/rn-migration/parity.tsv` | One row per feature of the old app: unit, status, evidence |
| `.github/workflows/rn-ci.yml` | The CI contract |
| `apps/api/.env.example`, `apps/mobile/.env.example` | Environment names (no values) of the API and the app; the root `.env.example` belongs to the legacy Supabase functions |

## Runtime/Tooling Preferences

- **Node 24+** (`engines`; CI uses Node 24), npm workspaces, one root `package-lock.json`. TypeScript ~6.0, Jest 30 with `jest-expo` (app) and `ts-jest` (packages), `@testing-library/react-native` for views, `sql.js` for in-process SQL (`@electric-sql/pglite` is installed in `apps/api` but nothing imports it).
- **Expo SDK 58** (`expo ~58.1`, React Native 0.88.1, React 19.3.0), development build with Continuous Native Generation; `expo-dev-client` is required (HealthKit, widgets, camera, Sign in with Apple). iOS deployment target 18.0; Android is not built.
- **Xcode** is needed only for `expo prebuild`/`expo run:ios`, the Simulator and artifact checks. Evidence Simulator: `iPhone 17 Pro`, iOS 26.4, found by name (`scripts/rn/sim-udid.sh`), never by a written UDID.
- **API**: Node + Hono + `postgres` + `jose`; PostgreSQL 17; deployment is Docker Compose + Caddy (`apps/api/deploy/`).
- **Deno major 2** only for the legacy Supabase stack. Canonical lockfile is repo-root `deno.lock`; `supabase/functions/deno.json` sets `lock:false` — don't create a second lock.
- Build-time env: `EXPO_PUBLIC_API_URL` (Metro inlines `EXPO_PUBLIC_*`). API env names are in `apps/api/.env.example`. Never commit a key, a token, a `.env` file or signing material.

## Testing & QA

| Tier | Location | Frameworks | Runs via |
|---|---|---|---|
| Pure domain + contracts | `packages/core/src`, `packages/api-contract/src` | Jest (`ts-jest`), golden fixtures | `npm test` |
| App unit + view | `apps/mobile/src/**` (`*.test.ts(x)`, `__tests__/`) | Jest `jest-expo/ios` preset, RNTL, `sql.js`; native modules mocked in `src/__mocks__/` | `npm run test:mobile` |
| API | `apps/api/src/**/*.test.ts` | Jest; SQL suites against the real SECURITY DEFINER functions on PostgreSQL 17 | `npm run test:api`; SQL suites need `scripts/rn/start-api.sh` (or `TEST_OWNER_URL`/`TEST_API_URL`), else they print `[sql-skip]` and skip |
| Parity gate | `docs/rn-migration/parity.tsv` | `scripts/rn/parity-check.mjs` | `npm run parity:check` |
| Evidence harness | `scripts/rn/evidence/` | shell + `axe` + `xcrun simctl` on one Simulator | `bash scripts/rn/evidence/run-all.sh`; results under `docs/rn-migration/evidence/`. It rewrites screenshots of every row it covers: restore the ones outside your unit with `git checkout -- <path>` |
| Legacy edge functions | `supabase/functions/tests/` | Deno test + real supabase-js vs the local stack | `deno task test` (sequential) |

- The parity gate checks: `parity.tsv` is well formed (unique ids, known status, a unit for every row, evidence that exists for `done`/`partial`, a reason in `notes` for `partial`, `not-done` and `n/a`); every file of `swift-inventory.tsv` maps to an existing row; `packages/api-contract/golden` and `supabase/functions/tests/golden` hold the same bytes while both exist; no Supabase client, URL or env name in `apps/` and `packages/`.
- Test naming: one Jest case per behavior, the case title is the behavior sentence; files that port a Swift test say "Jest twin of …" in their header. Fresh in-memory SQLite per test. Jest times out at 15 s per test in `apps/mobile`.
- Golden fixtures are shared server↔client: `packages/api-contract/golden/` is read by both suites; the Supabase copy is `supabase/functions/tests/golden/`.
- There is no Maestro flow in the repository (no `.maestro/`, no `rn-ios.yml`); UI evidence comes from the evidence harness.
- CI (`.github/workflows/rn-ci.yml`, workflow "RN CI") has one job, `test` ("Typecheck, Jest and parity gate", Ubuntu 24.04, Node 24): `npm ci`, `npm run typecheck`, `npm test`, `npm run parity:check`. It proves the TypeScript compiles in every workspace, the Jest suites pass without a database (SQL suites skip), and the parity table and its checks hold. It runs on pull requests and pushes to `main` except those that only touch `supabase/**` or `deno.lock`; it does not build the app, run a Simulator or the Deno tests.

## Compliance

No IAP bypass (Apple 3.1.1); trial terms shown adjacent to price (3.1.2(c)); no manipulative flows (5.6). Privacy manifest, usage strings (camera, HealthKit share and update) and the entitlements (HealthKit, background delivery, Sign in with Apple, App Group `group.com.nextlabs.coachcal`) come from `apps/mobile/app.config.ts` and the config plugin and must stay in the app bundle — enforced by `node scripts/rn/check-artifact-compliance.mjs <path to CoachCal.app>` against a built app (needs macOS).

## Docs

`docs/rn-migration/` is where the migration lives (`README.md` there is the index: `spec.md`, `plan.md`, `parity.tsv`, `findings/`, `evidence/`, `build-recipe.md`, `deploy-vps.md`). Plans live in `plans/`, docs in `docs/`; do not create markdown outside those two (and the root `README.md`, `AGENTS.md`, `ARCHITECTURE.md`) unless asked. Release/TestFlight runbooks of the Swift era live in `plans/reports/`; the hosted-backend deploy steps are `docs/rn-migration/deploy-vps.md` (not yet run on a real server).
