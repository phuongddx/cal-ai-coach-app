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
| `apps/mobile/src/design/**` | U-22 only | U-22 follow-ups | component changes need the feature unit to say so in its report |
| `apps/mobile/src/data/db/**`, `src/data/repos/**` | nobody | U-12 only | the unit named in the brief |
| `apps/mobile/src/data/sync/**` | nobody | U-12: `store.sqlite.ts`, `repository.ts` only | U-23 |
| `apps/mobile/src/data/api/**`, `src/data/auth/**` | nobody | U-20 only | U-20 follow-ups |
| `apps/mobile/src/features/**` | U-22 may fix import paths only | nobody | one feature tree per unit |
| `packages/core/**` | U-10 only | bug fixes through the owner | bug fixes through the owner |
| `packages/api-contract/**` | nobody (relocated in U-00) | U-21 may add `auth.ts`; `index.ts` gets one export line | the owner |
| `apps/api/**` | U-11 only | U-21 only (U-11 is merged) | the unit named in the brief |
| `docs/rn-migration/parity.tsv` | the owner sets status and evidence after each drain | same | same |

## Levers (tools every unit uses; do not edit them, report a defect instead)

| Lever | What it does | Written by |
|---|---|---|
| `scripts/rn/parity-check.mjs` (`npm run parity:check`) | parity gate: inventory coverage, evidence exists, golden drift, no Supabase in `apps/` and `packages/`; `npm run parity:write` regenerates `parity.md` | U-00 |
| `scripts/rn/clone-node-modules.sh <from> <to>` | gives a worktree `node_modules` as an APFS clone of another worktree's (39 s, no extra disk); refuses when the two lockfiles differ | U-00 |
| `scripts/rn/start-api.sh [start\|stop]` | throwaway PostgreSQL 17 on 5433 and the API on 8787 | spike, extended by U-11 and U-21 |
| `scripts/rn/gen-migrations.mjs` | regenerates `apps/mobile/src/data/db/migrations.ts` from Drizzle Kit's SQL so Metro can bundle the migrations; a test fails when the generated file is stale | U-12 |
| `scripts/rn/native-slot.sh prepare\|release` | prepares the native worktree for a build (disk check, prebuild) and releases it (removes Pods and DerivedData) | U-13 |
| `scripts/rn/check-artifact-compliance.mjs <path.to.app>` | entitlements, usage strings, privacy manifest and URL scheme of a built `.app` | U-13 |
| `scripts/rn/evidence/lib.sh` and `flows/*.sh` | boot, launch with `--cc*` arguments, tap, type, screenshot into `docs/rn-migration/evidence/<id>/`, transcript | U-14 |

## Places

See `standing-orders.md`. Coordinator state that survives a restart: `ledger.tsv` (one last row per
unit), `trail.md` (decision log) and `briefs/U-*.md`, all on branch `rn/orchestrate`.

## Merge recipe (the owner, after every drain)

1. Read the pull request diff on the pushed head, run `npm test`, `npm run typecheck` and
   `npm run parity:check` on that head in the coordinator worktree, open every screenshot.
2. Set status and evidence in `parity.tsv` on the `rn/orchestrate` branch together with the ledger
   row (workers never edit `parity.tsv`). These rows land on `main` through the owner's next
   pull request, which is a docs-only PR that merges as soon as `npm run parity:check` passes.
3. The branch is synced with `main` (`git merge origin/main`, done by the worker if `main` moved)
   and RN CI is green or the same checks pass locally on the pushed head.
4. `gh pr merge <n> --merge --delete-branch`. The Swift CI result is recorded, not waited for.
5. Append a row to `ledger.tsv` and a line to `trail.md`, push `rn/orchestrate`.
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
              src/app/_layout.tsx                      root (keep the spike's deep-link and data binding)
              src/app/sign-in.tsx                     AU-01
              src/app/onboarding/index.tsx            OB-01
              src/app/(tabs)/_layout.tsx              NativeTabs today, progress, coach, profile with the
                                                       SF symbols of MainShell.swift (sun.max,
                                                       chart.line.uptrend.xyaxis, bell, gearshape) and
                                                       the Scan button, testID shell.fab
              src/app/(tabs)/today.tsx                the spike's index.tsx (Ember) moved here
              src/app/(tabs)/progress.tsx, coach.tsx, profile.tsx (already placeholders)
              src/app/scan/index.tsx                  SC-01
              src/app/diary.tsx                       DY-01, presented as a sheet
              src/app/settings.tsx                    PR-02
              src/app/debug.tsx                       the spike console (spike.tsx renamed), no longer
                                                       a tab
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

## Units of wave 2

Scoped here; each gets a `briefs/U-*.md` with the full CONTEXT at dispatch.

| Unit | Worker | Parity rows | Goal | Needs |
|---|---|---|---|---|
| U-12 mobile persistence | G1 | PL-03, DB-01 to DB-07 | Drizzle schema with every table of the 3 GRDB migrations, migrations bundled by `scripts/rn/gen-migrations.mjs`, repositories with the Swift behavior (atomic mirror plus outbox write, outbox batch and dead letter, LWW merge that skips pending local intent, catalog and seed rows, targets, tracking, engagement), CSV generator as a pure function; every Persistence test file ported | U-10, U-13 |
| U-14 evidence harness | G2 | QA-03 (tool) | `scripts/rn/evidence/lib.sh` (boot, launch with `--cc*` arguments, tap by accessibility identifier or coordinates, type, screenshot, transcript) and the first flows against the merged `main`: first launch, tabs, open debug console; screenshots land under `docs/rn-migration/evidence/<id>/`; holds the simulator slot | U-13; simulator slot |
| U-20 mobile networking and auth client | S2 | NW-01 to NW-04, AU-01 | Typed fetch clients for scan, sync and account over `packages/api-contract`; fixture client over the golden files; `ScanAPIError` from the envelope; session store in `expo-secure-store` with refresh on 401; Sign in with Apple with the SHA256 nonce; Google through `expo-web-browser`; email and OTP; sign-in screen | U-13 (deps), U-22 (components) |
| U-21 backend auth, account, webhook, sync, deploy | S1 | BE-04 to BE-07, BE-12 | `/v1/auth/*` with jose and scrypt, refresh rotation, `DELETE /v1/account` with Apple token revoke, `POST /webhooks/revenuecat`, sync routes on the ported RPCs with the exact ack-set semantics, Dockerfile, compose with PostgreSQL 17 and Caddy, env template, backup script, `docs/rn-migration/deploy-vps.md` with every step Phương runs and every secret he must create | U-11 |

## Waves 3 to 7 (outline; scoped at the drain before each)

| Unit | Rows | Notes |
|---|---|---|
| U-23 sync engine and triggers | PL-04 | 500 ms debounce, batches of 50, generation tokens, quarantine at 5, foreground, network and background triggers; port the Sync module tests and the proof scenarios |
| U-30 scan flow | SC-01 to SC-07, PL-12 (start, update, end) | reducer first with `ScanKcalParityTests` and `ScanSnapshotTests` behaviors, then the screens over U-22 components; fixture capture on the Simulator |
| U-31 onboarding | OB-01 to OB-10 | locked copy, step model, plan through TargetsEngine, just-in-time HealthKit request |
| U-32 diary | DY-01 to DY-07 | day sheet, add food, search, custom food, manual log, exercise, water |
| U-33 today | TD-01 | Ember screen completed; the Scan button moves so no meal's kcal is covered; week strip contrast |
| U-40 progress and coach | PG-01 to PG-04, CH-01 | charts with react-native-svg and an accessibility description; weekly review |
| U-41 profile and settings | PR-01 to PR-03 | settings copy, inert subscription card, account deletion entry, target edit |
| U-42 HealthKit, notifications, CSV | PL-10, PL-13, PL-14 | steps read, confirmed burned-energy write, background delivery, three local notifications, CSV share |
| U-43 widget and Live Activity | PL-11, PL-12 | native slot; small widget with midnight rollover and ED-safe variant; Live Activity UI |
| U-50 telemetry | PL-09 | native slot; allow-list seam first, Sentry and PostHog adapters after |
| U-51 composition root, shell, debug seams | PL-01, PL-02, PL-05 | environment context, root gate (sign-in, onboarding, shell), launch arguments, debug console |
| U-52, U-53 evidence sweeps | every screen row | simulator slot, one at a time; light, dark and ED-safe screenshots per screen next to the SwiftUI snapshots; fix units for what they find |
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

Check out `rn/orchestrate`, read `ledger.tsv` (last row per unit is its state) and `trail.md`.
A `running` unit lost its worker: its brief is in `briefs/`, its branch may hold commits; re-dispatch
with the brief and the partial result. A `pass` whose PR head moved is void.
