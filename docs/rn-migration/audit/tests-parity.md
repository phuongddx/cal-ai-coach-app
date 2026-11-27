# Test parity audit (U-60a)

One row per Swift test file of the old app: does the RN tree have its tests, how many cases each
side has, which sentences are missing or reworded, which unit wrote the twin, and who owns each
gap. Counted mechanically on `main` @ `00baa0d`; the method, the commands and their output are in
`docs/rn-migration/findings/U-60a.md`. "verbatim" = every case of the file has a Jest twin with
the same sentence (camelCase read as words); "reworded" = twinned, different wording; "missing" =
no twin found for the case by the mechanical pass, verified by hand.

Headline: of the 40 unit-test files (46 minus the 6 snapshot files of the second table), **35 have
a complete twin, 1 is partial, 4 have no twin**. Of their 205 Swift cases, 185 have Jest twins
(99 verbatim, 86 reworded), 20 are missing (Settings 10, HealthKit 8, design smoke 1, MetricKit 1),
and 1 live proof is uncovered (`AuthSessionTests.liveSignInThenSyncEngineBindsAndDispatches`).

## 1. Module test files (native/Modules/*/Tests/) — 29 files

| Swift file | Cases | Jest twin | Jest cases | Missing / reworded | Unit | Gap owner |
|---|---|---|---|---|---|---|
| CoachCalCore/CoachCalCoreTests/CoachCalCoreTests.swift | 1 | `packages/core/src/index.test.ts` | 11 | verbatim 1/1 (+10 spike extras) | U-10 | — |
| CoachCalCore/CoachCalCoreTests/KcalArithmeticTests.swift | 5 | `packages/core/src/kcal.test.ts` | 6 | verbatim 5/5 (+1 extra golden-parity case) | U-10 | — |
| CoachCalCore/CoachCalCoreTests/LWWComparatorTests.swift | 4 | `packages/core/src/canonicalVersion.test.ts` | 4 | verbatim 4/4 | U-10 | — |
| CoachCalCore/CoachCalCoreTests/NotificationSchedulerTests.swift | 7 | `packages/core/src/notificationSchedule.test.ts` | 7 | verbatim 7/7 | U-10 | — |
| CoachCalCore/CoachCalCoreTests/ProofSerializerTests.swift | 4 | `packages/core/src/proofRecord.test.ts` | 4 | verbatim 4/4 | U-10 | — |
| CoachCalCore/CoachCalCoreTests/StreakEngineTests.swift | 11 | `packages/core/src/streak.test.ts` | 11 | verbatim 11/11 | U-10 | — |
| CoachCalCore/CoachCalCoreTests/StrictCodableTests.swift | 4 | `packages/core/src/syncEnvelope.test.ts` | 7 | verbatim 4/4 (+3 extras) | U-10 | — |
| CoachCalCore/CoachCalCoreTests/TargetsEngineTests.swift | 17 | `packages/core/src/targets.test.ts` | 17 | verbatim 12, reworded 5, missing 0 | U-10 | — |
| CoachCalCore/CoachCalCoreTests/WidgetSnapshotTests.swift | 4 | `packages/core/src/widgetSnapshot.test.ts` | 6 | verbatim 4/4 (+2 extras) | U-10 | — |
| CoachCalDesignSystem/CoachCalDesignSystemTests/CoachCalDesignSystemTests.swift | 1 | none | — | **missing 1**: `moduleNameIsExposed` (no module-name smoke under `src/design`) | U-22 | owner (design frozen since wave 4; one-line export + case) |
| CoachCalNetworking/CoachCalNetworkingTests/AuthSessionTests.swift | 3 | `apps/mobile/src/data/auth/sessionStore.test.ts` | 13 | reworded 2/3 (mocked-storage covers), **missing 1**: `liveSignInThenSyncEngineBindsAndDispatches` (needs a live API; `parity-detail/networking-auth.md` documents it) | U-20 | owner (`scripts/rn/smoke-auth.sh` covers the flow; no Jest twin) |
| CoachCalNetworking/CoachCalNetworkingTests/CoachCalNetworkingTests.swift | 1 | `apps/mobile/src/data/api/networkingModule.test.ts` | 1 | verbatim 1/1 | U-20 | — |
| CoachCalNetworking/CoachCalNetworkingTests/FixtureScenarioTests.swift | 8 | `apps/mobile/src/testing/fixtureScanApi.test.ts` | 10 | verbatim 2, reworded 6, missing 0 (+2 extras) | U-20 | — |
| CoachCalNetworking/CoachCalNetworkingTests/GoldenFixtureTests.swift | 3 | `apps/mobile/src/data/api/goldenFixtures.test.ts` | 4 | verbatim 3/3 (+1 extra) | U-20 | — |
| CoachCalNetworking/CoachCalNetworkingTests/LiveApiClientTests.swift | 5 | `apps/mobile/src/data/api/scanClient.test.ts` | 13 | verbatim 1, reworded 4, missing 0 (+8 extras) | U-20 | — |
| CoachCalNetworking/CoachCalNetworkingTests/SupabaseSyncTransportTests.swift | 3 | `apps/mobile/src/data/api/syncTransport.test.ts` | 11 | verbatim 3/3 (+8 extras) | U-20 | — |
| CoachCalPersistence/CoachCalPersistenceTests/CSVExportServiceTests.swift | 3 | `apps/mobile/src/data/repos/csvExport.test.ts` | 3 | reworded 3/3 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/CoachCalPersistenceTests.swift | 1 | `apps/mobile/src/data/repos/coachCalPersistence.test.ts` | 1 | verbatim 1/1 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/DiaryEntryRepositoryTests.swift | 5 | `apps/mobile/src/data/repos/diaryEntryRepository.test.ts` | 6 | verbatim 1, reworded 4, missing 0 (+1 extra) | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/DomainMigrationTests.swift | 6 | `apps/mobile/src/data/db/domainMigrationTests.test.ts` | 6 | verbatim 3, reworded 3, missing 0 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/DomainRepositoryTests.swift | 8 | `apps/mobile/src/data/repos/domainRepositoryTests.test.ts` | 8 | verbatim 4, reworded 4, missing 0 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/MigrationTests.swift | 3 | `apps/mobile/src/data/db/migrationTests.test.ts` | 3 | verbatim 1, reworded 2, missing 0 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/OutboxRepositoryTests.swift | 4 | `apps/mobile/src/data/repos/outboxRepository.test.ts` | 4 | reworded 4/4, missing 0 | U-12 | — |
| CoachCalPersistence/CoachCalPersistenceTests/SeedDataManagerTests.swift | 6 | `apps/mobile/src/data/repos/seedDataManager.test.ts` | 7 | verbatim 2, reworded 4, missing 0 (+1 extra) | U-12 | — |
| CoachCalSync/CoachCalSyncTests/AckIntegrityTests.swift | 3 | `apps/mobile/src/data/sync/ackIntegrity.test.ts` | 3 | verbatim 3/3 | U-23 | — |
| CoachCalSync/CoachCalSyncTests/CoachCalSyncTests.swift | 1 | `apps/mobile/src/data/sync/coachCalSync.test.ts` | 1 | verbatim 1/1 | U-23 | — |
| CoachCalSync/CoachCalSyncTests/LifecycleBarrierTests.swift | 2 | `apps/mobile/src/data/sync/lifecycleBarrier.test.ts` | 2 | verbatim 1, reworded 1, missing 0 | U-23 | — |
| CoachCalSync/CoachCalSyncTests/SyncEngineDispatchTests.swift | 7 | `apps/mobile/src/data/sync/syncEngineDispatch.test.ts` | 7 | verbatim 7/7 | U-23 | — |
| CoachCalSync/CoachCalSyncTests/TriggerTests.swift | 1 | `apps/mobile/src/data/sync/triggerSeams.test.ts` | 4 | verbatim 1/1 (+3 extras) | U-23 | — |

All paths under `native/Modules/`. A file is twinned by exactly one Jest file except the design
contract (row 12 of the app table), which is twinned in aggregate.

## 2. App test files (native/App/CoachCalTests/) — 17 files

| Swift file | Cases | Jest twin | Jest cases | Missing / reworded | Unit | Gap owner |
|---|---|---|---|---|---|---|
| AppLaunchMigrationTests.swift | 1 | `apps/mobile/src/data/db/appLaunchMigrationTests.test.ts` | 1 | reworded 1/1 | U-12 | — |
| ChartDescriptorTests.swift | 4 | `apps/mobile/src/features/progress/__tests__/ChartDescriptor.test.tsx` | 4 | reworded 4/4, missing 0 | U-40 | — |
| ComponentContractTests.swift | 12 | aggregate: `apps/mobile/src/design/components/*.test.tsx` (30 files, 95 cases) | 95 | all 12 behaviors twinned (ConfidenceBadge ×2, Stepper ×2, OptionCard ×1, WarningChip ×2, Toast ×2, CalorieRing ×2, ChartCard ×1), reworded, missing 0 — **no single-file twin, so nothing fails CI if a new component ports without its contract case** | U-22 | owner (add a case to the component test that ports the contract) |
| DiaryWaterExerciseTests.swift | 13 | `apps/mobile/src/features/diary/__tests__/DiaryWaterExercise.test.ts` | 13 | reworded 13/13, missing 0. One fixture difference: the Swift boundary test never seeds (`ensureSeeded` absent from it), the RN twin runs on the seeded harness and asserts today's 4 items (3 boundary + seeded dinner). The grouping behavior under test is identical; the wording in `findings/U-32.md` §3 needs the owner's correction | U-32 | owner (wording only) |
| EdSafeSweepSnapshotTests.swift | 9 | snapshot suite — second table | — | — | U-14 wrote the harness | U-52/U-53 |
| HealthKitServiceTests.swift | 8 | none | — | **missing 8**: permission-once, no re-request when authorized, denied returns false, background delivery only when authorized, step aggregation ×2, confirmed-energy write, burn-add-back default | U-42 (PL-13 names the same gaps) | U-42 |
| MetricKitIsolationTests.swift | 1 | none | — | **missing 1**: `objCDispatchOffMainDeliversBothPayloadTypesWithoutIsolationTrap` | U-50 (PL-09) | U-50 |
| OnboardingContractTests.swift | 8 | `apps/mobile/src/features/onboarding/onboardingModel.test.tsx` | 13 | reworded 8/8, missing 0 (+5 extras) | U-31 | — |
| OnboardingSnapshotTests.swift | 1 | snapshot suite — second table | — | — | U-31 | U-52/U-53 (ED-safe reveal variant also U-41) |
| ProgressSnapshotTests.swift | 4 | snapshot suite — second table | — | — | U-40 | U-52/U-53 |
| ScanCapturePermissionTests.swift | 3 | `apps/mobile/src/features/scan/scanCapturePermission.test.tsx` | 5 | verbatim 3/3 (+2 extras) | U-30 | — |
| ScanKcalParityTests.swift | 8 | `apps/mobile/src/features/scan/scanKcalParity.test.ts` | 9 | verbatim 8/8 (Swift names kept as the Jest sentences) (+1 extra) | U-30 | — |
| ScanSnapshotTests.swift | 1 | snapshot suite — second table | — | — | U-30 | U-52/U-53 |
| SettingsTests.swift | 10 | none | — | **missing 10**: ED-safe toggle persist/announce, burn-add-back toggle, delete-account copy, local reset, subscription card, CSV share sheet, target edit reclamp, profile inventory, Apple Health footnote | U-41 (PR-01..PR-03, in flight) | U-41 |
| StreakBadgeInsightTests.swift | 6 | `apps/mobile/src/features/progress/__tests__/StreakBadgeInsight.test.ts` | 6 | reworded 6/6, missing 0 | U-40 | — |
| TodayDiarySnapshotTests.swift | 4 | snapshot suite — second table | — | — | U-32/U-33 | U-52/U-53 |
| WidgetSnapshotSnapshotTests.swift | 5 | snapshot suite — second table | — | — | U-10/U-43 | U-43 |

## 3. Snapshot suites and UI tests (evidence, not Jest twins)

`rule 9` twins are code; the machine-sensitive snapshot baselines (71 PNGs under
`native/App/CoachCalTests/__Snapshots__/`) and the XCUITest flows are replaced by Simulator
evidence under `docs/rn-migration/evidence/<id>/`. Present evidence folders today: DY-01, PL-01,
PL-05, PL-15, PL-17, TD-01, U-13, spike, transcripts.

### Snapshot suites

| Swift suite | Cases | What it pinned | Replacing evidence | Owner |
|---|---|---|---|---|
| EdSafeSweepSnapshotTests | 9 matrices | every screen in light/dark/ED-safe (today, diary, add-food, food-search, review, progress, coach, profile, settings) | none: screens covered so far are TD-01/DY-01/PL-01 (light/dark only); the ED-safe sweep is exactly what is missing | U-52/U-53 |
| OnboardingSnapshotTests | 1 | plan reveal light/dark/ED-safe | none (OB-09 ED-safe collapse lands with U-41) | U-52/U-53 |
| ProgressSnapshotTests | 4 | coach, achievements, weight trend, progress-ED-safe-hides-weekly-energy | none | U-52/U-53 |
| ScanSnapshotTests | 1 | scan flow matrices | none (U-33 held the slot for the flow screens; SC evidence pending) | U-52/U-53 |
| TodayDiarySnapshotTests | 4 | today, diary day, add-food, food-search-empty | partial: `evidence/TD-01/03-today-seeded-{light,dark}.png`, `evidence/DY-01/04-diary-sheet.png`; add-food and food-search missing | U-52/U-53 |
| WidgetSnapshotSnapshotTests | 5 | widget small/medium light/dark/ED-safe + no-raw-kcal check | partial: `evidence/spike/item2/home-small-medium-v2-fixed-crop.png` (spike widget, not the production one) | U-43 |

### UI tests (native/App/CoachCalUITests/, 11 files)

| UI test | What it drove | Replacing evidence or twin | Owner |
|---|---|---|---|
| AccessibilityAuditTests | VoiceOver audit of the shell | none | U-52 (accessibility pass) |
| E2ESyncConvergenceTests | two-device sync convergence | `apps/mobile/src/data/sync/e2e.integration.test.ts` + `scripts/rn/e2e-sync.sh` + `evidence/transcripts/run-all.txt` (partial: not yet run from CI) | U-61 |
| EdSafeTests | ED-safe flows end to end | none | U-52/U-53 |
| FoodSearchTests | search, recents, custom food | none on the Simulator (RNTL twins exist: `FoodSearchView.test.tsx`, `DiaryWaterExercise.test.ts`) | U-52/U-53 |
| MainShellSmokeTests | first launch, tabs | `evidence/PL-01/01-first-launch-*.png`, `02-tab-*.png` (partial) | U-52/U-53 |
| NavigationSmokeTests | tab navigation | `evidence/PL-01/02-tab-*.png` (partial) | U-52/U-53 |
| OfflineStateTests | offline banner and recovery | none | U-52/U-53 |
| OnboardingFlowTests | the nine steps on device | none (RNTL twins exist under `features/onboarding/`) | U-52/U-53 |
| ScanFlowTests | capture → review → saved | none (RNTL twins exist under `features/scan/`) | U-52/U-53 |
| SignInFlowTests | sign-in flows | none (Apple sheet needs a signed-in Apple account; known Simulator limit) | U-52/U-53 |
| TodayScreenTests | today screen over seeded data | `evidence/TD-01/03-today-seeded-*.png` (partial) | U-52/U-53 |

## 4. Jest files that twin no Swift test file

Group (a) — the 22 API Jest files twin the Deno tests of `supabase/functions/tests/` (the Swift
app never tested the server; they are listed to keep the count complete): `apps/api/src/app.test.ts`,
`arithmetic.test.ts`, `config.test.ts`, `contracts.test.ts`, `hiddenFat.test.ts`, `modes.test.ts`,
`privileges.test.ts`, `testing/sqlHarness.env.test.ts`, `auth/{accessToken,authPrivileges,crypto,deleteAccount,rateLimit,session,signIn}.test.ts`,
`grounding/cascade.test.ts`, `lookup/{barcode,search}.test.ts`, `scan/{analyze-food.e2e,gates}.test.ts`,
`vlm/gemini-provider.test.ts`, `webhook/webhook.test.ts`; plus `packages/api-contract/src/{auth,golden,index,sync}.test.ts`
and `packages/core/src/arithmetic.test.ts` (server-rule parity vectors).

Group (b) — no Swift unit-test file, but the behavior has a Swift counterpart elsewhere (snapshot
suite, UI test, or the aggregate design contract): all 30 `apps/mobile/src/design/components/*.test.tsx`
+ `design/__tests__/{edSafe,tokens,useTokens}.test.ts*` (ComponentContractTests is the aggregate
Swift counterpart for the components; EdSafe.swift/Tokens.swift have no Swift test file of their own);
`features/scan/{scanModelTransitions,scanScreens,scanCapture}.test.tsx?` (ScanSnapshotTests + ScanFlowTests);
the 8 diary screen tests (DiaryWaterExerciseTests + TodayDiarySnapshotTests + FoodSearchTests);
the 10 onboarding screen tests (OnboardingContractTests + OnboardingSnapshotTests + OnboardingFlowTests);
the 5 progress screen tests and `features/coach/__tests__/CoachView.test.tsx` (ProgressSnapshotTests
+ CoachSnapshotTests matrix); `features/auth/SignInScreen.test.tsx` (SignInFlowTests);
`data/api/{http,accountClient,goldenFixtures}.test.ts`-adjacent client surfaces, `data/auth/{appleNonce,appleSignIn,authApi,authServices,sessionRefresh}.test.ts`
(AuthSessionTests covers the behavior with mocks); `data/sync/{e2e.integration,store.sqlite,engine,engineChange,repository,runtime.session}.test.ts`
(E2ESyncConvergenceTests, SyncEngine internals), `data/repos/syncMergeRepository.test.ts`
(DB-03; Swift tests the merge inside `SyncEngineDispatchTests`), `data/db/generatedMigrations.test.ts`
(bundle guard, Swift enforced at compile time), `data/widget/{WidgetSnapshotPublisher,snapshotFromMeals}.test.ts`
(WidgetSnapshotSnapshotTests / U-43).

Group (c) — nothing on the Swift side at all (spike and new-infra guards): `apps/mobile/src/__tests__/{EmberView,nativeModulesSmoke,routes,spikeDeepLink}.test.tsx?`,
`data/environment.test.ts`, `debug/launchArgs.test.ts`, `data/repos/sqlDb.test.ts`, `data/sync/uuid.test.ts`,
`design/components/EdSafeCollapse.test.tsx` (RN-side composition the old app did not have).

## 5. What the numbers say

- 46 Swift test files: 29 module + 17 app, exactly as the plan rows QA-01 claims; no other
  `*Tests*.swift` exists under `native/` outside `CoachCalUITests/`.
- 229 Swift cases counted mechanically (parameterized `@Test(arguments:)` count as one — see
  findings; 5 files use them: SeedDataManagerTests, DomainMigrationTests, MigrationTests,
  CSVExportServiceTests, StreakBadgeInsightTests).
- Twin status of the 40 unit-test files: **35 complete, 1 partial (AuthSessionTests 2/3),
  4 none (SettingsTests 10, HealthKitServiceTests 8, CoachCalDesignSystemTests 1,
  MetricKitIsolationTests 1)**. The 6 snapshot files need evidence, not twins (section 3).
- 205 unit-test cases: 185 twinned (99 verbatim, 86 reworded), 20 missing, 1 live proof uncovered.
- Jest side: 151 test files, 1,004 cases (`it(`/`test(` occurrences). The Jest files of groups (b)
  and (c) in section 4 are extra coverage the old app carried as snapshots or UI tests — QA-03's
  sweep, not QA-01's gap.
