# Implementation plan: CoachCal on React Native + Expo

Spec: `spec.md` in this directory. Rules for every unit: `standing-orders.md`. Parity rows:
`parity.tsv`. Owner: CoachCal bot. Date 2026-11-27. The plan is updated at every drain: a unit that
is not in this file yet is not scoped.

## Exit condition

Checked at the end, box by box, with evidence.

- [ ] Every row of `parity.tsv` is `done`, `partial` or `not-done` with a reason, or `n/a` with
      evidence. `npm run parity:check` is green on `main`.
- [ ] The RN app builds and runs on the iOS 26.4 Simulator from a build of `main`.
- [ ] `npm test` and `npm run typecheck` pass at the repo root on `main`; RN CI is green.
- [ ] Every place the old app called Supabase has a Hono endpoint (`spec.md` section 6) and the app
      calls none of Supabase (the parity gate checks `apps/` and `packages/`).
- [ ] `native/`, the Tuist manifests, the Swift CI and the Xcode Cloud hook of the old app are gone
      from `main`; tag `archive/swiftui-final` points at the last commit that still has them.
- [ ] The four spike issues are fixed and tested: the Scan button no longer covers a meal's kcal
      (TD-01), HealthKit delete removes each child sample (PL-13), ids are UUID v4 on Hermes (I11),
      Drizzle migrations are bundled for Metro by a script (PL-03).
- [ ] `apps/mobile/src/design/tokens.ts` holds every token of `docs/design/ember/tokens.css` for
      light and dark, and its test compares the two files.
- [ ] Every screen has a Simulator screenshot next to its Ember frame, and the report lists each
      deviation from the design with its reason and the backend follow-ups.
- [ ] `docs/rn-migration/report.md` exists in Vietnamese with the six sections Zed asked for.
- [ ] Worker threads are closed, worktrees and DerivedData are removed.

## Shape of the work

```text
U-00 promote monorepo, contracts, parity gate, CI, docs (owner)            done in the first PR
  │
  ├─ wave 1 (parallel, independent)
  │    U-10 core domain port                    Worker-G1   JS only
  │    U-11 backend scan pipeline               Worker-S1   JS + PostgreSQL 17
  │    U-13 native foundation + first build     Worker-S2   native slot, simulator slot
  │    U-22 design system, tokens, ED-safe      Worker-G2   JS only
  │
  ├─ wave 2 (after every wave 1 PR is merged)
  │    U-12 mobile persistence                  Worker-G1   needs U-10
  │    U-14 evidence harness + first flows      Worker-G2   simulator slot, needs U-13
  │    U-20 mobile networking and auth client   Worker-S2   needs U-13
  │    U-21 backend auth, account, webhook,
  │         sync RPCs, deploy kit               Worker-S1   needs U-11
  │
  ├─ wave 3  U-23 sync engine and triggers · U-30 scan flow · U-31 onboarding · U-32 diary
  ├─ wave 4  U-33 today · U-40 progress and coach · U-41 profile and settings ·
  │          U-42 HealthKit, notifications, CSV · U-43 widget and Live Activity (native slot)
  ├─ wave 5  U-50 telemetry (native slot) · U-51 composition root, debug seams, shell ·
  │          U-52 and U-53 simulator evidence sweeps (simulator slot)
  ├─ wave 6  U-60 parity audit (a worker that built none of it) · U-61 CI completion
  └─ wave 7  U-70 cleanup of the SwiftUI app and tooling, tag, final docs
```

Waves 3 to 7 are scoped at the drain before they start. One unit per worker at a time. A worker on
the GLM model (G1, G2) gets units with an exact recipe; a unit that needs judgment goes to S1 or S2.
When a GLM unit fails on a provider error, the owner re-dispatches it to S1 or S2 with the same brief
and the partial result.

## Topology: who may write what

Shared files have one writer per wave. "Only" means nobody else edits it in that wave.

| File or tree | Wave 1 | Wave 2 | From wave 3 |
|---|---|---|---|
| `package.json`, `package-lock.json`, `apps/*/package.json` | U-13 only | nobody (frozen) | the owner, through a dependency unit |
| `apps/mobile/app.config.ts`, `apps/mobile/plugins/**` | U-13 only | U-13 follow-ups only | the unit that holds the native slot |
| `apps/mobile/src/app/**` | U-13 (skeleton) | U-14 adds nothing; U-20 owns `sign-in.tsx` | each feature owns its route file; `_layout.tsx` files belong to U-51 |
| `apps/mobile/src/design/**` | U-22, then U-71 and U-71b in phase 4 | U-22 follow-ups | frozen; U-30 adds a `testID` prop to the two buttons |
| `apps/mobile/src/data/db/**`, `src/data/repos/**` | nobody | U-12 only | frozen, except U-23: `sqlDb.ts`, `syncMergeRepository.ts` and the demo owner constant of `seedDataManager.ts` |
| `apps/mobile/src/data/sync/**` | nobody | U-12: `store.sqlite.ts`, `repository.ts` only | U-23 |
| `apps/mobile/src/data/api/**`, `src/data/auth/**` | nobody | U-20 only | frozen, except U-23: `syncClient.ts` and `syncTransport.test.ts` |
| `apps/mobile/src/features/**` | U-22 may fix import paths only | nobody | one feature tree per unit: U-30 `scan`, U-31 `onboarding`, U-32 `diary` |
| `apps/mobile/src/data/environment.ts`, `src/debug/launchArgs.ts` | nobody | nobody | the owner until U-51 |
| `packages/core/**` | U-10 only | bug fixes through the owner | bug fixes through the owner |
| `packages/api-contract/**` | nobody (relocated in U-00) | U-21 may add `auth.ts`; `index.ts` gets one export line | the owner |
| `apps/api/**` | U-11 only | U-21 only (U-11 is merged) | frozen; a server change is a fix unit |
| `scripts/rn/e2e-sync.sh`, `scripts/rn/e2e-sync-app.sh` | the spike | nobody | U-23 |
| `docs/rn-migration/parity.tsv` | the owner sets status and evidence after each drain | same | same |

## Levers (tools every unit uses; do not edit them, report a defect instead)

| Lever | What it does | Written by |
|---|---|---|
| `scripts/rn/parity-check.mjs` (`npm run parity:check`) | parity gate: inventory coverage, evidence exists, golden drift, no Supabase in `apps/` and `packages/`; `npm run parity:write` regenerates `parity.md` | U-00 |
| `scripts/rn/clone-node-modules.sh <from> <to>` | gives a worktree `node_modules` as an APFS clone of another worktree's (39 s, no extra disk); refuses when the two lockfiles differ | U-00 |
| `scripts/rn/start-api.sh [start\|stop]` | throwaway PostgreSQL 17 on 5433 and the API on 8787; the env file it writes is named after the checkout, so only that checkout's Jest suites find the cluster | spike, extended by U-11 and U-21, isolated by the owner |
| `scripts/rn/gen-migrations.mjs` | regenerates `apps/mobile/src/data/db/migrations.ts` from Drizzle Kit's SQL so Metro can bundle the migrations; a test fails when the generated file is stale | U-12 |
| `scripts/rn/native-slot.sh prepare\|release` | prepares the native worktree for a build (disk check, prebuild) and releases it (removes Pods and DerivedData) | U-13 |
| `scripts/rn/check-artifact-compliance.mjs <path.to.app>` | entitlements, usage strings, privacy manifest and URL scheme of a built `.app` | U-13 |
| `scripts/rn/evidence/lib.sh` and `flows/*.sh` | boot, launch with `--cc*` arguments, tap, type, screenshot into `docs/rn-migration/evidence/<id>/`, transcript | U-14 |

## Seams (written by the owner after wave 2; feature units consume them, nobody edits them)

| Seam | What it gives a feature |
|---|---|
| `getDataEnvironment()` in `apps/mobile/src/data/environment.ts` | the app's one database handle and the repositories over it (the sync runtime opens the handle) |
| `notifyLocalMutation()` in `apps/mobile/src/data/sync/runtime.ts` | the UI re-reads and a sync is scheduled after a write, as `notifyLocalMutation()` does in the Swift app |
| `getDebugFlags()` and `setDebugFlags()` in `apps/mobile/src/debug/launchArgs.ts` | the nine `--cc*` flags and the parser the native reader will use (U-51) |

## Places

See `standing-orders.md`. Coordinator state that survives a restart: `ledger.tsv` (one last row per
unit), `trail.tsv` (decision log) and `briefs/U-*.md`, all on branch `rn/orchestrate`.

## Merge recipe (the owner, after every drain)

1. Read the pull request diff on the pushed head, run `npm test`, `npm run typecheck` and
   `npm run parity:check` on that head in the coordinator worktree, open every screenshot.
2. Set status and evidence in `parity.tsv` on the `rn/orchestrate` branch together with the ledger
   row (workers never edit `parity.tsv`). These rows land on `main` through the owner's next
   pull request, which is a docs-only PR that merges as soon as `npm run parity:check` passes.
3. The branch is synced with `main` (`git merge origin/main`, done by the worker if `main` moved)
   and RN CI is green or the same checks pass locally on the pushed head.
4. `gh pr merge <n> --merge --delete-branch`. The Swift CI result is recorded, not waited for.
5. Append a row to `ledger.tsv` and a row to `trail.tsv`, push `rn/orchestrate`.
6. Close the worker's thread; `git worktree remove` the unit worktree.

## Units of wave 1

### U-10 Core domain port (Worker-G1)

```text
GOAL        packages/core holds every pure engine of CoachCalCore with the Swift tests ported, so
            neither the app nor the API ever needs the Swift versions.
SCOPE       writable: packages/core/**, apps/mobile/src/data/widget/snapshotFromMeals.ts and its test,
            apps/mobile/src/widgets/CaloriesWidget.tsx (type and field renames only, when the snapshot shape changes),
            docs/rn-migration/findings/U-10.md, docs/rn-migration/parity-detail/core.md
            forbidden: everything else
CONTEXT     Swift sources (read in full): native/Modules/CoachCalCore/Sources/CoachCalCore/
            {KcalArithmetic, TargetsEngine, StreakEngine, DayKey, WidgetSnapshot, CanonicalVersion,
            SyncEnvelope, ProofRecord, NotificationScheduler}.swift
            Swift tests: native/Modules/CoachCalCore/Tests/CoachCalCoreTests/*.swift (9 files)
            Existing TS: packages/core/src/index.ts (spike: kcalFromMacros, clamp, dayKey, sumMacros,
            ringProgress) and arithmetic.ts (server rule, keep as is)
SHAPE       one file per Swift source in packages/core/src, same names in camelCase, exported from
            index.ts. SyncEnvelope: port the validators that need no zod (acknowledgement set equals
            the request, cursor rules, CanonicalVersion compare) as pure functions over structural
            types; the zod shapes stay in packages/api-contract and are not duplicated.
            NotificationScheduler: the pure rule part only (which of meal.lunch, meal.dinner, eod.recap
            is pending for a day and a set of logged slots); the notification center calls are not core.
ACCEPTANCE  every public type and function of the 9 Swift sources has a TS counterpart or a line in
            the findings file that explains a merge or a rename; every Swift test case in the 9 test
            files has a Jest case with the same behavior sentence and passes; DayKey cases run under
            TZ=Asia/Ho_Chi_Minh, TZ=America/Los_Angeles and TZ=Pacific/Kiritimati; a test proves
            kcalFromMacros agrees with the server rule on the Swift vectors; packages/core imports
            nothing but its own files (show the grep in the report); snapshotFromMeals.ts is
            reconciled field by field with WidgetSnapshot.swift and the differences are listed
VERIFY      npm test --workspace @coachcal/core; npm run typecheck; npm run parity:check
TIMEBOX     3 hours
```

Method: for each Swift test file, write the Jest file first with the same cases, see it fail, then
port the source until it passes.

### U-11 Backend scan pipeline (Worker-S1)

```text
GOAL        apps/api serves POST /v1/scan, POST /v1/barcode/resolve and POST /v1/foods/search with
            the behavior of the three Deno functions, on the ported SQL, with the Deno tests ported.
SCOPE       writable: apps/api/** (src, migrations/, scripts/rn/start-api.sh, apps/api/.env.example,
            scripts/rn/smoke-scan.sh), docs/rn-migration/findings/U-11.md,
            docs/rn-migration/parity-detail/backend-scan.md
            forbidden: packages/**, apps/mobile/**, supabase/**, native/**, package.json files,
            .github/**, docs/rn-migration/parity.tsv
CONTEXT     Deno sources (read in full): supabase/functions/analyze-food/index.ts,
            barcode-resolve/index.ts, food-search/index.ts, _shared/{http,quota,entitlement,routing,
            hiddenFat}.ts, _shared/grounding/*.ts, _shared/vlm/*.ts, _shared/db.ts
            Deno tests: supabase/functions/tests/{arithmetic,cascade,gemini-provider,hiddenFat,modes,
            scan-gates,barcode-resolve,food-search,analyze-food.e2e}.test.ts and tests/fixtures/
            SQL: supabase/migrations/*.sql (3 files; tables and the 5 SECURITY DEFINER functions)
            Already ported: contracts in packages/api-contract/src/contracts, arithmetic in
            packages/core/src/arithmetic.ts (apps/api depends on @coachcal/core)
SHAPE       apps/api/src: http.ts (json, errorJson, zodIssues with dotted paths), db.ts (postgres
            client; withUser(userId, fn) runs a transaction that sets app.user_id; ported functions
            read current_setting('app.user_id', true)::uuid instead of auth.uid()), migrate.ts (applies
            apps/api/migrations/*.sql in order inside a transaction, table schema_migrations),
            quota.ts, entitlement.ts, routing.ts, hiddenFat.ts, grounding/{cascade,fdc,off,fatsecret,
            normalize}.ts, vlm/{provider,gemini,fixture}.ts, lookup/{barcode,search}.ts,
            scan/{pipeline,route}.ts. fetch is injectable like the Deno fdcFetch seam. Routes are
            mounted in app.ts behind one requireUser middleware: in this unit it accepts the dev
            tokens only when AUTH_DEV_TOKENS=1 (default off); U-21 replaces its inside with session
            verification and nothing else changes.
            Roles: coachcal_api (EXECUTE on the five functions, no table privileges) and
            coachcal_owner (runs migrations). Tests create both in a real PostgreSQL 17.
ACCEPTANCE  each Deno test file listed has a Jest twin file with one case per Deno.test, same
            sentence; the gate order tests pass; with VLM_PROVIDER=fixture and the cache seeded as
            the legacy e2e test seeds it, POST /v1/scan returns the numbers of
            packages/api-contract/golden/scan-response-200.golden.json; run as coachcal_api, a direct
            SELECT on scans, scan_items, scan_usage or food_cache fails and persist_scan and
            claim_scan_credit work for the caller's own user and reject another user's rows;
            every error body parses with ErrorEnvelopeSchema; GET /health answers ok;
            bash scripts/rn/start-api.sh && bash scripts/rn/smoke-scan.sh && bash scripts/rn/start-api.sh stop
            ends with every step ok and both ports free; apps/api/.env.example lists every variable
            with a one-line meaning and no value
VERIFY      npm test --workspace @coachcal/api with TEST_OWNER_URL and TEST_API_URL set by start-api.sh;
            npm run typecheck; npm run parity:check
TIMEBOX     6 hours
```

### U-13 Native foundation and first build (Worker-S2)

```text
GOAL        apps/mobile builds once with every native capability the program needs, starts on the
            Simulator under the production identity, and its dependency manifest is frozen.
SCOPE       dependency writer for wave 1. Writable: package.json, package-lock.json,
            apps/mobile/package.json, apps/api/package.json, apps/mobile/app.config.ts,
            apps/mobile/plugins/**, apps/mobile/assets/**, apps/mobile/jest.config.js,
            apps/mobile/jest.setup.ts, apps/mobile/src/__mocks__/**, apps/mobile/src/app/** (skeleton
            only, see SHAPE), apps/mobile/src/testing/** (empty index for now),
            scripts/rn/native-slot.sh, scripts/rn/check-artifact-compliance.mjs,
            docs/rn-migration/build-recipe.md, docs/rn-migration/findings/U-13.md,
            docs/rn-migration/evidence/U-13/**, docs/rn-migration/evidence/PL-15/**,
            docs/rn-migration/evidence/PL-17/**
            forbidden: apps/mobile/src/data/**, apps/mobile/src/features/** (except import paths that
            break when a route file is renamed), apps/mobile/src/design/**, packages/**, apps/api/src/**
SLOTS       native slot and simulator slot: this is the only unit in wave 1 that builds or uses them.
            Work in the native worktree .worktrees/rn-native (the owner prepared it).
CONTEXT     Native config of the old app: native/App/CoachCal/Info.plist, SupportingFiles/
            CoachCal.entitlements, SupportingFiles/PrivacyInfo.xcprivacy, native/CoachCalWidget/
            Info.plist and .entitlements, native/Project.swift; the shell in native/App/CoachCal/
            MainShell.swift and RootView.swift. Spike recipe and pitfalls: docs/rn-migration/spike/
            build-recipe.md. Machine facts: docs/rn-migration/spec.md section 11.
SHAPE       npm script `migrate` in apps/api: "tsx src/migrate.ts" (U-11 writes the file).
            Dependencies to add with `npx expo install` in apps/mobile: @tanstack/react-query, zustand,
            expo-camera, expo-image-picker, expo-image-manipulator, expo-apple-authentication,
            expo-web-browser, expo-secure-store, expo-notifications, expo-background-task,
            expo-file-system, expo-sharing. For apps/api: jose. Nothing else; a missing package is a
            finding, not an install.
            app.config.ts: deploymentTarget 18.0 (already set), plugins and infoPlist for camera
            usage string (same sentence as the old Info.plist), Sign in with Apple, notifications,
            image picker, widgets, and a local plugin that adds to the entitlements
            com.apple.developer.healthkit, com.apple.developer.healthkit.background-delivery,
            com.apple.developer.applesignin [Default] and com.apple.security.application-groups
            [group.com.nextlabs.coachcal]; NSSupportsLiveActivities true; URL scheme coachcal;
            app icon from native/App/CoachCal/Assets.xcassets/AppIcon.appiconset/AppIcon1024.png.
            Route skeleton (placeholder screens that render the route name; feature units replace
            their file's default export later):
              src/app/_layout.tsx                      Stack over the tabs group and the other routes
              src/app/(tabs)/_layout.tsx              NativeTabs index, progress, coach, profile with the
                                                       SF symbols of MainShell.swift (sun.max,
                                                       chart.line.uptrend.xyaxis, bell, gearshape) and
                                                       the Scan button, testID shell.fab
              src/app/(tabs)/index.tsx                Today: the spike's index.tsx (Ember) moved here
              src/app/(tabs)/progress.tsx, coach.tsx, profile.tsx (already placeholders)
              src/app/sign-in.tsx                     AU-01
              src/app/onboarding/index.tsx            OB-01
              src/app/scan/index.tsx                  SC-01
              src/app/diary.tsx                       DY-01, presented as a sheet
              src/app/settings.tsx                    PR-02
              src/app/debug.tsx                       the spike console (spike.tsx renamed), no longer
                                                       a tab; deep links become coachcal://debug
            Jest: jest.setup.ts with a manual mock for every native module that jest-expo does not
            mock itself; one smoke test per added package that imports it.
ACCEPTANCE  npm ci in a fresh clone of your branch succeeds from the committed lockfile; `npx expo-doctor`
            has no error; `npx expo prebuild --platform ios` and `CI=1 npx expo run:ios --no-bundler
            --device 85024D2F-71DE-43C0-8E11-CE58F4578FC3` end with Build Succeeded (log tail committed
            to docs/rn-migration/evidence/U-13/build-log-tail.txt); the app launches on the
            Simulator with the bundle from Metro, shows the Today placeholder with the four tabs and
            the Scan button, and the screenshot is docs/rn-migration/evidence/PL-17/first-launch.png;
            scripts/rn/check-artifact-compliance.mjs passes on the built .app and its output is
            committed under docs/rn-migration/evidence/PL-15/; the built Debug .app is copied to
            apps/mobile/build-output/CoachCal-dev.app (git-ignored) for later evidence units;
            `npm test`, `npm run typecheck`, `npm run parity:check` are green; the deep link
            coachcal://debug and coachcal://diary resolve to their routes (unit tests)
VERIFY      the commands above; df -h /System/Volumes/Data before the build
TIMEBOX     5 hours (the build alone is about 25 minutes)
```

If a package cannot be built on this toolchain, do not work around it with another package: leave
it out of the manifest, keep the config entry out, and report the package, the error and the doc
page that explains the limit.

### U-22 Design system (Worker-G2)

```text
GOAL        apps/mobile/src/design has the tokens and components of CoachCalDesignSystem and the
            single ED-safe API, and the SwiftUI snapshot references are copied into the docs.
SCOPE       writable: apps/mobile/src/design/** (new), the one import line in
            apps/mobile/src/features/ember/EmberView.tsx that points at the moved tokens,
            docs/rn-migration/reference/swiftui-snapshots/** (copies, native/ is not touched),
            docs/rn-migration/findings/U-22.md, docs/rn-migration/parity-detail/design.md
            forbidden: everything else, including apps/mobile/src/app/** and package files
CONTEXT     Swift (read in full): native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/
            Tokens.swift, EdSafe.swift, Components/{Buttons,Cards,Content,Controls,Progress,Shell,
            WeeklyStats}.swift; tests: native/Modules/CoachCalDesignSystem/Tests (iOS only, read for
            behavior) and native/App/CoachCalTests/ComponentContractTests.swift, EdSafeSweepSnapshotTests.swift.
            Snapshots: native/App/CoachCalTests/__Snapshots__/** (71 PNG). Existing TS:
            apps/mobile/src/features/ember/tokens.ts and format.ts (spike).
SHAPE       src/design/tokens.ts (every token of Tokens.swift as a const object for light and dark,
            useTokens() hook that follows useColorScheme; the spike's features/ember/tokens.ts is not
            touched, U-33 removes it), src/design/edSafe.ts (edSafeMode(), edSafeHidden(), and the
            hooks useEdSafeMode() and useEdSafeHidden() over useSyncExternalStore; module state, no
            dependency, not persisted yet), and
            src/design/components/<Name>.tsx, one per CC component, same name without the CC prefix,
            same props and variants, drawn with react-native, react-native-svg, expo-symbols and
            expo-glass-effect only. Accessibility identifiers stay identical to the Swift ones
            (list every one you find in parity-detail/design.md).
ACCEPTANCE  a test table holds every value read from Tokens.swift and tokens.ts matches it; each
            component has an RNTL test per variant and per ED-safe branch; grep proves no component
            outside src/design contains the word kcal or a calorie string (format.ts is exempt and
            moves to src/design/format.ts); the 71 snapshots are copied (count them in the report);
            npm test, npm run typecheck and npm run parity:check are green
VERIFY      npm test --workspace @coachcal/mobile; npm run typecheck; npm run parity:check
TIMEBOX     6 hours
```

## State after wave 1 (2026-11-27)

Landed on `main`: PR 4 (U-10, merge `fcaee1b`), PR 5 (U-11, `a2ec624`), PR 6 (U-13, `b10ed1a`),
PR 7 (U-22, `404aa1a`). The owner re-ran the four merged together on one branch: 470 tests with
PostgreSQL 17 up, typecheck clean, parity gate 0 problems, smoke 4 of 4; each PR was synced with
`main` and merged only when its tree equaled the tested one.

Follow-ups the drain found, each with its owner:

| Finding | Owner |
|---|---|
| The ported SQL keeps the legacy column `supabase_user_id`; one test harness builds the name in pieces so the parity gate does not see it. Rename to `user_id`, use it plainly | U-21, first commit |
| The generated Info.plist has the generic `expo-image-picker` photo-library string; the old app had none (the picker needs no permission). Set `photoPermissionPermission: false` | the next unit that holds the native slot |
| The icon is RGBA; the App Store icon must have no alpha | U-61 |
| Component tests carry a preamble that maps `react` onto one copy; the nested copy is gone since U-13, so the preamble is dead | U-61 |
| `npm run typecheck` regenerates the Expo Router typed routes first (`scripts/rn/gen-typed-routes.mjs`): without it a worktree that never ran Metro type-checks against stale routes and CI checked none | done in the drain PR |

## Units of wave 2

Scoped here; each gets a `briefs/U-*.md` with the full CONTEXT at dispatch.

| Unit | Worker | Parity rows | Goal | Needs |
|---|---|---|---|---|
| U-12 mobile persistence | G1 | PL-03, DB-01 to DB-07 | Drizzle schema with every table of the 3 GRDB migrations, migrations bundled by `scripts/rn/gen-migrations.mjs`, repositories with the Swift behavior (atomic mirror plus outbox write, outbox batch and dead letter, LWW merge that skips pending local intent, catalog and seed rows, targets, tracking, engagement), CSV generator as a pure function; every Persistence test file ported | U-10, U-13 |
| U-14 evidence harness | G2 | QA-03 (tool) | `scripts/rn/evidence/lib.sh` (boot, launch with `--cc*` arguments, tap by accessibility identifier or coordinates, type, screenshot, transcript) and the first flows against the merged `main`: first launch, tabs, open debug console; screenshots land under `docs/rn-migration/evidence/<id>/`; holds the simulator slot | U-13; simulator slot |
| U-20 mobile networking and auth client | S2 | NW-01 to NW-04, AU-01 | Typed fetch clients for scan, sync and account over `packages/api-contract`; fixture client over the golden files; `ScanAPIError` from the envelope; session store in `expo-secure-store` with refresh on 401; Sign in with Apple with the SHA256 nonce; Google through `expo-web-browser`; email and OTP; sign-in screen | U-13 (deps), U-22 (components) |
| U-21 backend auth, account, webhook, sync, deploy | S1 | BE-04 to BE-07, BE-12 | `/v1/auth/*` with jose and scrypt, refresh rotation, `DELETE /v1/account` with Apple token revoke, `POST /webhooks/revenuecat`, sync routes on the ported RPCs with the exact ack-set semantics, Dockerfile, compose with PostgreSQL 17 and Caddy, env template, backup script, `docs/rn-migration/deploy-vps.md` with every step Phương runs and every secret he must create | U-11 |

## State after wave 2 (2026-11-27)

Landed on `main`: PR 14 (U-21, `021bc0f`), PR 12 (U-12, `1848844`), PR 11 (U-20, `8223f60`),
PR 13 (U-14, `f1c3583`). The owner merged the four on one integration branch and ran everything on
that tree: 775 tests with PostgreSQL 17 up (api 249, mobile 392, contract 47, core 87), typecheck
clean, parity gate 0 problems, smoke 10 of 10. Each PR was merged only when its synced tree equaled
the tested tree. Three independent reviews read the diffs before the merge (auth security, persistence
against Swift, sync semantics across the three units).

Follow-ups the drain and the reviews found, each with its owner:

| Finding | Owner |
|---|---|
| A push acknowledgement stamps only the server version and drops the record the server returns. The server does not number a losing operation, so a device whose push lost keeps its own text under the winner's version and the next pull skips it: a permanent divergence. The acknowledgement must apply the record like a pulled row unless a newer local op is pending | U-23 |
| `inTransaction` on the one database handle does not serialize overlapping callers; a second `BEGIN` fails and its rollback kills the first caller's transaction, which then autocommits statement by statement. No call site overlaps today | U-23 |
| `newUuid()` falls back to `Math.random` in a production build: Hermes has no `globalThis.crypto`. The ids are UUID v4 shaped (I11 holds) but the Apple nonce is derived from them, so the bytes must come from `expo-crypto` `getRandomValues` | U-23 |
| The RN engine quarantines only on a 400 and retries transport and server errors forever; the Swift engine quarantines an op after 5 attempts. `validatePullResponse` is ported but not called | U-23 |
| `scripts/rn/e2e-sync.sh` pins the spike's per-record counter; the ported SQL numbers operations from one global sequence (the legacy behavior). `scripts/rn/e2e-sync-app.sh` still reads the spike tables | U-23 |
| Mirror rows and the seed carry a demo owner id. The session user must reach the store and the engine; sign-out and account deletion must reset the local store as the Swift app does | U-23 (owner id), U-51 (reset, route guard, `load()` at launch) |
| If Apple's revoke fails during account deletion the error is only logged and the token is gone, so it can never be retried (the legacy function never revoked). Keep the encrypted token in a tombstone row until Apple confirms | backend hardening unit before the App Store release |
| The e-mail OTP throttle answers 429 with the code `VALIDATION_ERROR`; the contract documents 400, 401 and 503. A dedicated code in `packages/api-contract` would be cleaner | the owner, with the next contract change |
| The design system buttons have no `testID`; U-20 wrapped them in views to tap them in tests | U-30 adds the prop |
| The generator of the bundled migrations committed a second copy of the schema (Drizzle Kit output under `src/data/db/migrations/`); nothing imported it | done in the drain PR |
| `clone-node-modules.sh` exited 1 on success (the last workspace has no nested `node_modules`) | done in the drain PR |
| Three units ran the root `npm test` against a cluster another worktree had migrated, because the SQL suites read one shared env file. The env file is now named after the checkout and the API is a slot (standing-orders rule 17) | done in the drain PR |
| U-21 ran `docker builder prune -af`, which also deleted the build cache of other projects on the machine | standing-orders rule 18 |
| Reading process arguments needs a native module and a native build. Until U-51 lands it, flags are set in Jest and by a `__DEV__` query parameter on the route | U-51 |
| The clamps of 0 to 600 minutes and 0 to 5000 kcal sit in the repository (Swift clamped in the sheet); the diary sheet ports them too | U-32 |

## Units of wave 3

Scoped here; each has a `briefs/U-*.md` with the full CONTEXT. No unit builds natively: the machine
has about 1 GB free and a build needs 5 GB.

| Unit | Worker | Parity rows | Goal | Holds |
|---|---|---|---|---|
| U-23 sync engine, session wiring and triggers | S1 | PL-04, NW-02, DB-02, DB-03, CO-07 | The engine of `CoachCalSync` (500 ms debounce, batches of 50, generation tokens, quarantine at 5), the acknowledgement applies the server record, serialized transactions, random ids from `expo-crypto`, the session user in the store and the runtime, triggers from AppState, NetInfo and `expo-background-task`, the e2e scripts and an integration suite against the real API | API slot |
| U-30 scan flow | S2 | SC-01 to SC-07, PL-12 (calls) | Reducer with the Swift tests, screens over the design system, `expo-camera` capture seam with the fixture feed on the Simulator, save in one `recordUpserts` then `notifyLocalMutation`, a Live Activity port with a no-op implementation, screenshots of the flow and the first evidence that the store works through `expo-sqlite` | Simulator slot |
| U-31 onboarding | G1 | OB-01 to OB-10 | Nine steps with the locked copy, the plan through `TargetsEngine`, the just-in-time HealthKit request behind an injected function | nothing |
| U-32 diary | G2 | DY-01 to DY-07 | Day sheet, add food, local food search, custom food, manual log, exercise log, water card | nothing |

## State after wave 3 (2026-11-27)

Landed on `main`: PR 17 (U-23, `380d833`), PR 18 (U-32, `fdfde23`), PR 19 (U-31, `c57db8b`),
PR 16 (U-30, `bfb8408`, after a rework: a Flip camera button without an action and a hint that
promised OCR). The owner merged the four on one integration branch and ran everything on that tree:
1,018 tests with PostgreSQL 17 up (api 252, mobile 632, contract 47, core 87), typecheck clean,
parity gate 0 problems, the curl sync script 15 of 15 steps, both smokes 5 of 5. Three independent
reviews read the diffs before the merge.

**The machine lost every Simulator.** Between 13:19 and 13:32 a cleanup outside this program (it
needed administrator rights) removed all Simulator runtimes and devices, while the disk was full.
U-30 could not take its screenshots. The owner reinstalled the iOS 26.4 runtime (8.46 GB) and
recreated `iPhone 17 Pro`; the built development app launches on it. No script pins a device id any
more: `scripts/rn/sim-udid.sh` finds the device by name.

Follow-ups the drain and the reviews found, each with its owner:

| Finding | Owner |
|---|---|
| Scan flow: the Flip camera button had no action; the label-mode hint promised OCR; quota routing was looser than Swift | done in the rework of PR 16 |
| Two suites timed out at the 5 s Jest default under a load of 12 with unchanged code | done: the mobile Jest timeout is 15 s |
| `EdSafeCollapse` lived in `features/scan` while two units of wave 4 need it | done: it moved into `src/design` before wave 4 |
| Onboarding (OB-09): in ED-safe mode the kcal hero and the weekly range of the plan reveal still show; no design component owns that branch. `EdSafeCollapse` exists in `features/scan` and belongs in `src/design` | U-41 |
| Onboarding asks HealthKit for write and read on five types; Swift asks to read steps only, and only when not decided | U-42 |
| Two caption rows of onboarding that Swift hides from VoiceOver are readable here | the accessibility pass of U-52 |
| `features/diary/writeQueue.ts` repeats what the serialized transaction helper does since U-23 | the next unit that touches the diary |
| A due operation whose mirror row is missing is sent as an empty upsert instead of being reported undecodable; an applied tombstone leaves the detail row behind | the next sync unit |
| `features/ember/**` and `src/spike/**` are still imported by placeholder routes and the debug console | the cleanup unit after wave 4 |
| The findings of U-32 state that a Swift assertion contradicts its own seed; the Swift test simply has no seed | U-60 (wording) |
| The two smoke scripts read the old env file name after PR 15, and PR 15 was verified without them | done in this drain PR |

## Units of wave 4

JS only for three units; one unit holds the Simulator slot. Briefs: `briefs/U-33.md`, `U-40.md`,
`U-41.md`, `U-51.md`.

| Unit | Worker | Parity rows | Goal | Holds |
|---|---|---|---|---|
| U-33 Today and the Simulator evidence | S2 | TD-01; evidence of SC-02 to SC-07 and DB-01 | The Today screen on the design tokens in `features/today`; the Scan button never covers a meal's kcal; the week strip contrast; then on the recreated Simulator: the screenshots U-30 could not take and a re-run of the five flows of U-14 | Simulator slot |
| U-40 Progress and Coach | G2 | PG-01 to PG-04, CH-01 | Charts with react-native-svg and an accessibility description, the weight log, weekly energy hidden in ED-safe mode, achievements, the weekly review | nothing |
| U-41 Profile and Settings | G1 | PR-01 to PR-03, OB-09 | Settings copy, the inert subscription card, the ED-safe toggle and its persistence, the account deletion entry, the target edit sheet; closes OB-09 with `EdSafeCollapse` from `src/design` | nothing |
| U-51 Composition root, root gate, debug console | S1 | PL-01, PL-02, PL-05 | The React environment over `getDataEnvironment()`; the root gate (sign-in, onboarding, shell); session load at launch; the local reset on sign-out and account deletion; flags settable from the debug console | nothing |

Topology of wave 4 (one writer per file):

| File or tree | Writer |
|---|---|
| `apps/mobile/src/app/_layout.tsx`, `debug.tsx` | U-51 |
| `apps/mobile/src/app/(tabs)/index.tsx`, `(tabs)/_layout.tsx` | U-33 |
| `apps/mobile/src/app/(tabs)/progress.tsx`, `coach.tsx` | U-40 |
| `apps/mobile/src/app/(tabs)/profile.tsx`, `settings.tsx` | U-41 |
| `apps/mobile/src/features/today/**`, `src/data/binding.ts` (exports unchanged) | U-33 |
| `apps/mobile/src/features/progress/**`, `coach/**` | U-40 |
| `apps/mobile/src/features/profile/**`, `features/onboarding/PlanRevealScreen.tsx` and its test | U-41 |
| `apps/mobile/src/design/**` | nobody: frozen (`EdSafeCollapse` is in it since the drain) |
| `apps/mobile/src/platform/**` (root gate, account reset, telemetry seam, the React environment), `src/data/environment.ts`, `src/data/sync/runtime.ts` (their exports keep name and signature), `src/debug/**` | U-51 |
| `apps/mobile/src/spike/**` | U-51, only what the console needs |
| `apps/mobile/src/features/ember/**` | nobody: deleted after wave 4 |
| `src/__tests__/routes.test.tsx` | nobody: no unit adds or removes a route file in wave 4 |
| `scripts/rn/evidence/**` | U-33 |

## Phase 4: the Ember design (decided 2026-11-27)

Phương asked, through Zed, that the RN app follow the Ember design of Designer instead of copying
the SwiftUI app. Spec decisions D12 to D14, `docs/design/ember/README.md` and the `ember` column of
`parity.tsv` hold the rule. What stays: behavior, test sentences, accessibility identifiers, the
kcal parity test of the review (464 becomes 508 after three taps on `+`), invariant I7.

New behavior the design adds, and where each one goes:

| Behavior | Decision |
|---|---|
| Describe mode of the scan | exists (SC-05); restyled in U-72 |
| Review that blocks Save while an item needs review | exists (the unresolved item gates the save); restyled in U-72 |
| Onboarding in nine steps | exists; restyled in U-73 |
| Analyzing with the real progress of the server | the scan API answers in one request, so it reports no stages; until the backend does, the screen shows only what the client observes and runs no timer (U-72). Server stages are a backend follow-up |
| Action buttons in Coach | built in U-75 when they need no new endpoint; anything that needs one goes to the backend follow-up list |
| Billing: Quota sheet, Plans, Cancel | the quota sheet reads the limit and the reset day from the server (U-77). No product and no StoreKit configuration exists, so the paywall reads the store at run time and shows no sample price; products, the purchase SDK (a native dependency) and a StoreKit configuration are follow-ups |
| Haptics (save, meal segment, minus and plus) | needs `expo-haptics`, a native dependency: follow-up with the next native unit |
| ED-Safe leaks the design closes (food search rows, manual log, exercise and custom food kcal fields, widgets, Live Activity) | U-74 and U-78 |

Units, in order; U-71 first because every other unit reads its tokens:

| Unit | Rows | Goal | Needs |
|---|---|---|---|
| U-71 Ember design system (Worker-S1) | PL-06, PL-07 | `apps/mobile/src/design/tokens.ts` holds every token of `tokens.css` for light and dark, one to one, under names that keep today's keys working; the design components follow the component mapping and the color rules of `design-system.md`; the token test compares with `tokens.css`; a `SideBySide` evidence helper renders an RN frame and its Ember frame | nothing |
| U-71b Ember components, second batch (Worker-S1) | PL-07 | the icon set of the canvas, `GlassIconButton`, `SheetHeader`, `Segment`, `EdSafeNote`, `FillField`, `GramsRuler` and the icon tile of `OptionCard`, built once in `src/design` for every restyle unit | U-71 |
| U-72 Scan on Ember | SC-01 to SC-07 | the six frames of the scan loop and Describe mode | U-71, U-71b; stage A2 also needs the picker of U-74 on `main` |
| U-73 Onboarding on Ember | OB-01 to OB-10 | the nine steps | U-71 |
| U-74 Diary sheets on Ember | DY-01 to DY-07 | Diary day, add food, food search, manual log, exercise, custom food, water; the ED-Safe leak fixes | U-71 |
| U-75 Progress and Coach on Ember | PG-01 to PG-04, CH-01 | both tabs, the chart tokens, the Coach actions | U-71 |
| U-76 Today on Ember | TD-01 | the three Today frames, the tab bar icons of the design (Coach `sparkles`, Profile `person.crop.circle`) | U-33 merged, U-71 |
| U-77 Profile, Settings and Billing on Ember | PR-01 to PR-03 | Profile, Settings, the quota sheet, the paywall, the cancel flow | U-71 |
| U-78 Widgets and Live Activity on Ember (native slot) | PL-11, PL-12 | small, medium and Lock Screen widgets, the ED-Safe variants, the Live Activity in both places | U-71, the native slot |
| U-79 The native launch-argument reader (Worker-S2; native slot and Simulator slot) | PL-05 | a local Expo module reads the process arguments once at launch; the nine `--cc*` arguments work on a device as they did in the SwiftUI app; the harness passes them to `simctl launch` | nothing |
| U-80 App icon "Ember ring" (native slot) | PL-17 | starts when Designer delivers the complete icon: the flattened 1024 icon without alpha as the store icon, the Icon Composer document for the four appearances where `ios.icon` takes a `.icon` directory (the config type of SDK 58 says so; the prebuild result is what proves it), the compliance check on the built app, and every step that needs Icon Composer by hand written down for Phương | the complete icon set, the native slot |
| U-71c Ember rounds 2 and 3 in the app (Worker-S1) | PL-06, PL-07 | tokens by the chain `tokens.css`, `tokens.json`, `emberTokens.generated.ts`; High Contrast; four component gaps | U-71b |
| U-77b Sign-in on Ember | AU-01 | the seven sign-in frames: the native buttons of Apple and Google, the error under the field | U-71c |
| U-81 A fresh install shows onboarding (Worker-S2; Simulator slot) | PL-01, PL-05 | the root gate: reproduced, the cause proven by a log, fixed where the launch goes wrong, a test that fails without the fix, the seeding workaround of the harness removed | PR 38 |
| U-61c The catalog of every frame | QA-04 | `docs/design/ember/FRAMES.md` covers the 107 frames and maps the new screens to their parity rows | U-71c |

Topology of phase 4: U-71 owned `apps/mobile/src/design/**`, and U-71b owns it until it merges. A
restyle unit owns its feature tree and its route files, and changes a design component only through
a finding to the owner. `apps/mobile/src/app/(tabs)/_layout.tsx` belongs to U-76.

How the restyle units run (decided on 2026-11-27 in the evening). The machine has one Simulator and
U-79 held it, so a restyle unit has three stages in one thread and one pull request, and it merges
at the end of the third:

- Stage A, JS only: the code and its Jest tests, as far as the design components on the branch
  allow. A control that does not exist yet stays as today's control, restyled with tokens, and is
  listed in the findings under "Needs a design component". The unit never builds it inside the
  feature.
- Stage A2: once U-71b is on `main`, the unit merges `main` and swaps the shared components in.
- Stage B, with the Simulator slot: the evidence rows of its frames written with
  `scripts/rn/evidence/side-by-side.mjs`, the fixes they need, and `run-all.sh` at `0 failed`.

Copy follows the frame where the frame shows that screen, except the onboarding copy, which OB-01
locks. A test never changes its sentence; it may change the strings and the visual values it
expects.

Decisions the owner took for the behaviors the frames add. Each brief holds the ones of its unit.

| The frame needs | Decision |
|---|---|
| Analyzing ticks only stages the server reports | the dwell timer goes and the screen shows only what the client observes (U-72); server stages are a backend follow-up |
| The free-scan counter of the viewfinder and the "Free scans" row of the plan reveal | not shown until the server sends the limit before a scan; a pre-scan entitlement read is a backend follow-up |
| Serving chips on the items of the review | the scan contract carries no servings and the VLM vocabulary is strict: contract and backend follow-up |
| Onboarding "Prefer not to say" | follow-up: a new path through `TargetsEngine`, whose behavior tests are locked |
| Metric and Imperial units in onboarding | follow-up: unit conversion across the app |
| A meal-reminders toggle | follow-up: no stored preference exists, and `refreshNotifications()` has no caller yet (PL-10) |
| The percent readout of onboarding step 8 | removed with the fake progress; the identifier is recorded as removed |
| One Food / Exercise / Custom food segment in the diary | follow-up: it moves three sheets and their `*.close` identifiers |
| Editing a food in the diary | built in stage A2 of U-74 (row DY-08), derived from the Review frame until the frame of Designer arrives |
| The frames Designer is still drawing: the edit sheet, the CSV export error state, the dark variants of onboarding and billing, the high-contrast tokens, a `tokens.json`, the complete icon | Phương approved Ember on 2026-11-27: every one of those screens is built now from the tokens and the patterns of the nearest frame (D15). When a frame arrives, the owner copies it into `docs/design/ember/`, sends it into the thread of its unit, and the unit corrects the screen |
| The app icon | it becomes "Ember ring" when Designer delivers the complete set (U-80); a step that needs Icon Composer by hand is written down for Phương |
| The Export tap shares a file | U-77 binds the tap to `exportCsvAndShare`; today it shares the text, as before U-42 |
| `SecondaryButton` without an action in Settings | `action` becomes required in U-77; the billing buttons stay inert until products exist |
| The label of the ring | U-76 decides between "remaining" and the frame's "kcal left" |
| "Report a problem" on the review | A report unlocks Save, as the correction of the SwiftUI app did. Nothing leaves the device, so the sent state says the report is saved on this device and the photo toggle goes; an endpoint with storage is a follow-up |
| The billing buttons of Settings | visibly disabled with a note while no product exists |
| The Export tap | opens the share with the file; a dismissed share is not an error |
| The paywall | a shell with three states that never shows a price; it ends in the failed state until a store is connected |
| The cancel flow | its primary opens the subscriptions page of the App Store |
| The goal floor of the target sheet | the floor the engine returns, one flat minimum; the height-based minimum of the frame is an engine follow-up |
| Chips, the back button and the typed fields of onboarding | chips at 44 pt in U-71c; no back button; no clamp while typing, and the ranges of the old wheels when the field loses focus (height 120 to 220 cm, weight 35 to 200 kg, goal 40 to 150 kg) |
| Delete and edit in the diary | the action sheet of the system, an undo toast for five seconds (`diary.toast.undo`), the label "Edited" that persists, and a saved toast with its undo |
| "Set a reminder" in Coach | not drawn until a reminders preference exists and something calls `refreshNotifications()` |

Evidence of phase 4: for every frame, a Simulator screenshot of the RN screen next to the Ember
frame (light, dark and ED-Safe where the design has them), and a list of deviations with reasons.
Each restyle unit writes its rows with `node scripts/rn/evidence/side-by-side.mjs` into
`docs/rn-migration/evidence/ember/<unit>.md` (the tool refuses a missing frame or a screenshot over
700 KB); the final report gathers those pages.

## State after the fourth drain (2026-11-27, evening)

Merged, each after an independent review and the full gates with PostgreSQL 17 on an integration
tree: PR 27 (U-33 Today, `e34ebda`), PR 30 (U-61b frame catalog, `d25536d`), PR 31 (U-71 Ember
design system, `a0f210f`), PR 32 (U-42 HealthKit, notifications, CSV, `2458805`). Parity table: 89
rows, 18 done, 57 partial, 13 todo, 1 n/a.

Phương approved Ember on 2026-11-27 in the evening, through Zed, and asked that the parts the
design was missing be drawn and built at once (D15). The owner PR of that decision added U-80 and
the row DY-08.

Running: U-79 (Worker-S2, native and Simulator slots), U-71b (Worker-S1), stage A of U-73
(Worker-G1) and of U-74 (Worker-G2). Queued in the order the workers free up: U-72 after U-71b,
U-77 after U-73, U-75 after U-74, U-76 and U-78 after U-79, then the A2 and B stages.

Still open from the fourth wave: `refreshNotifications()` has no caller; the Export tap shares text;
the harness flows 06 and 07 of U-33 wait on `rn/u-33-harness` (cherry-pick `006ca49`, the branch
carries a reverted commit in its history); `features/ember` and `src/spike` go in U-24.

## The closing plan (set on 2026-11-27 at night)

Zed set the goal for the whole migration: every screen on Ember with the new frames, tokens from
`tokens.json`, a Simulator screenshot next to its frame for every screen, CI green, and the Swift
cleanup merged after the tag `archive/swiftui-final`. The order below reaches the exit condition
with one Simulator and one native slot. Each restyle unit merges at the end of its stage B.

State at 21:00: merged through PR 35 (and PR 34, the second batch of components); `main` is
`812e926`. Open: PR 36 (U-73), PR 37 (U-74), PR 38 (U-79, under review), PR 39 (U-72). Running:
U-71c (Worker-S1), U-75 stage A (Worker-G1), U-77 stage A (Worker-G2).

| Step | Unit | Who | Needs |
|---|---|---|---|
| 1 | U-79, the launch arguments on a device (PR 38) | Worker-S2 | merged after review and gates |
| 2 | U-81, a fresh install shows onboarding | Worker-S2 | the Simulator slot |
| 3 | U-71c, the design of rounds 2 and 3 in the app | Worker-S1 | merged after review and gates |
| 4 | Stage A2 of U-73, U-75, U-77 and U-74 | each unit's worker | U-71c on `main` |
| 5 | Stage B of U-74, then U-73, U-75, U-77 | each unit's worker | the Simulator slot, one at a time, in that order |
| 6 | Stage A2 and B of U-72 | Worker-S1 | U-74 on `main` for the picker, then the Simulator slot |
| 7 | U-76 Today on Ember, with the four-digit ring number and the macro row checked on the Simulator | Worker-S2 | U-74 on `main` (it mounts the water card), the Simulator slot |
| 8 | U-77b Sign-in on Ember | the first free worker | U-71c, the Simulator slot |
| 9 | U-61c, the catalog of the 107 frames | the first free worker | U-71c |
| 10 | U-78 Widgets and Live Activity, U-80 the app icon, U-50 telemetry | Worker-S2 | the native slot, one build for all three |
| 11 | U-24, the spike files go, with the caller of `refreshNotifications()` and the reminders preference | the first free worker | nothing native |
| 12 | U-61, the API integration tests on PostgreSQL 17 in RN CI | the first free worker | nothing |
| 13 | U-70, the cleanup: tag `archive/swiftui-final` at the last commit that holds `native/`, then one pull request | Worker-S2 | every screen merged and evidenced |
| 14 | `docs/rn-migration/report.md` in Vietnamese, the six sections | the owner | step 13 |

Follow-ups that stay outside the exit condition: server stages for Analyzing, a pre-scan
entitlement read, servings in the scan contract, a report endpoint with storage, store products
with a purchase SDK, the height-based goal floor (an engine change), unit conversion, "Prefer not to
say", the Food / Exercise / Custom food segment, haptics.

## Waves 5 to 7 (outline; scoped at the drain before each)

| Unit | Rows | Notes |
|---|---|---|
| U-23 sync engine and triggers | PL-04, NW-02, DB-03 | see "Units of wave 3" above |
| U-30 scan flow | SC-01 to SC-07, PL-12 (start, update, end) | see "Units of wave 3" above |
| U-31 onboarding | OB-01 to OB-10 | see "Units of wave 3" above |
| U-32 diary | DY-01 to DY-07 | see "Units of wave 3" above |
| U-33 Today and the Simulator evidence | TD-01 | see "Units of wave 4" above |
| U-40 progress and coach | PG-01 to PG-04, CH-01 | see "Units of wave 4" above |
| U-41 profile and settings | PR-01 to PR-03 | see "Units of wave 4" above |
| U-42 HealthKit, notifications, CSV | PL-10, PL-13, PL-14 | steps read, confirmed burned-energy write, background delivery, three local notifications, CSV share |
| U-43 widget and Live Activity | PL-11, PL-12 | native slot; small widget with midnight rollover and ED-safe variant; Live Activity UI |
| U-50 telemetry | PL-09 | native slot; allow-list seam first, Sentry and PostHog adapters after |
| U-51 composition root, shell, debug console | PL-01, PL-02, PL-05 | see "Units of wave 4" above; the native reader of the launch arguments waits for the native slot |
| U-52, U-53 evidence sweeps | every screen row | superseded on 2026-11-27: stage B of each restyle unit captures every screen next to its Ember frame (the SwiftUI snapshots are no longer the reference); what a sweep finds beyond those frames becomes its own fix unit |
| U-60 parity audit | QA-01, QA-04 | a worker that built none of the feature reads every Swift source against the detail files and lists what is missing |
| U-61 CI completion | QA-02, QA-03 | API integration tests on a PostgreSQL 17 service in RN CI; evidence flows runnable from CI artifacts |
| U-70 cleanup | CL-01 | tag first, then one PR |

## U-70 cleanup (fixed now because it is the irreversible step)

1. On `main`, with every earlier PR merged: `git tag -a archive/swiftui-final -m "Last commit with the SwiftUI app"` and push the tag.
2. Copy nothing out of `native/` except what earlier units already copied (snapshots, icon, fixture
   image). The tag keeps the rest.
3. Delete `native/`, `.github/workflows/ci.yml` (Swift job), `.github/workflows/release-ipa.yml`,
   `ci_scripts/ci_post_clone.sh`, `native/scripts/*` (replaced by `scripts/rn/check-artifact-compliance.mjs`).
4. Rewrite `AGENTS.md`, `ARCHITECTURE.md`, `docs/engineering/conventions.md`,
   `docs/engineering/infrastructure.md`, `docs/engineering/tech-stack.md` for the RN app and the
   Hono API; keep the invariants worded as in `spec.md` section 3. Add a root `README.md`.
5. `supabase/`, `deno.lock` and the Deno scripts under `scripts/` stay; `README.md` says they are
   redundant once the VPS backend runs.
6. RN CI becomes the only CI: remove the `paths-ignore` lines that skip `native/**`.
7. Write `docs/rn-migration/report.md` (Vietnamese) with the six sections Zed asked for.

## Resuming after a restart

Check out `rn/orchestrate`, read `ledger.tsv` (last row per unit is its state) and `trail.tsv`.
A `running` unit lost its worker: its brief is in `briefs/`, its branch may hold commits; re-dispatch
with the brief and the partial result. A `pass` whose PR head moved is void.
