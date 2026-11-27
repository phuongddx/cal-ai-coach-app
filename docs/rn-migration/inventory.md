# Inventory of the SwiftUI app and the Supabase backend (frozen 2026-11-27)

Source of truth for this page: `swift-inventory.tsv` in this directory (one row per file under
`native/`) and the commands at the end. The file is the fact; the prose explains it. Counts come from
`main` at `64ce8a5`, which is the tree `spike/rn-expo` was cut from.

## 1. Size

| Kind under `native/` | Files | Lines | Where they go |
|---|---|---|---|
| Sources | 114 | 15,268 | parity rows in `parity.tsv` |
| Tests | 65 | 9,123 | ported to Jest (QA-01) or to axe flows (QA-03) |
| Snapshot references | 71 | n/a | copied to `docs/rn-migration/reference/swiftui-snapshots/` by U-22 |
| Resources | 19 | 191 | golden fixtures (relocated), icons, privacy manifest |
| Tuist and script tooling | 12 | n/a | deleted in CL-01 |

Sources by area: shell and composition root 832, Today 657, Scan 2,142, Diary 1,842, Progress
744, Coach 282, Profile 796, Onboarding 1,437, Auth 167, Health 152, Live Activity 15, widget 165,
Core module 1,158, DesignSystem 1,758, Networking 684, Persistence 1,966, Sync 471.

## 2. Targets and extensions

| Target | Bundle id | Notes |
|---|---|---|
| CoachCal app | `com.nextlabs.coachcal` | deployment target iOS 18.0, Swift 6, MainActor default isolation |
| CoachCalWidget extension | `com.nextlabs.coachcal.CoachCalWidget` | home screen widget (small family only) and the Live Activity UI |
| CoachCalTests, CoachCalUITests | | unit, snapshot, proof and UI tests |

There is no watch target, no App Intents, no Share or Action extension, no string catalog. The
app is English only.

## 3. What the app does, by area

Parity rows are in `parity.tsv`; this list names the entry points.

- **Shell**: `RootView` picks onboarding, sign-in or the main shell. `MainShell` is the tabbed
  shell and presents the diary as a sheet for `coachcal://diary`. `AppEnvironment` (629 lines) is the
  composition root: api seam, sync binding, telemetry allow-list, account reset, `openScan`.
- **Auth** (`AU-01`): three sign-in entry points: email, Sign in with Apple (SHA256 nonce from
  `AppleNonceProvider`), Google through the browser, plus email OTP (`AuthSessionStore`).
- **Onboarding** (`OB-01` to `OB-10`): value hero, privacy and Health (just-in-time HealthKit
  permission), goal, activity and diet, body metrics, goal weight and pace, generating plan, plan
  reveal, projection. Copy is locked verbatim (`OnboardingModel`, `OnboardingContractTests`).
- **Today** (`TD-01`): kcal ring and remaining number, macro bars, week strip, meal list, entry
  points to scan and diary.
- **Scan** (`SC-01` to `SC-07`): viewfinder with photo, label and barcode modes, analyzing, review
  with editable grams and recomputed kcal, describe-meal text scan, correction capture, saved with
  Undo. Barcode uses VisionKit `DataScannerViewController` on device and `AVCaptureMetadataOutput`
  or the photo picker as fallbacks. The simulator has no camera: a fixture seam renders a synthetic
  feed and the fixture image.
- **Diary** (`DY-01` to `DY-07`): day view, add food, food search (seeded and custom foods),
  custom food, manual log, exercise log, water card and log.
- **Progress** (`PG-01` to `PG-04`): weight trend (SwiftUI Charts with an accessibility chart
  descriptor), weight log, weekly energy, achievements.
- **Coach** (`CH-01`): weekly review card and insights, all local rules, no network call.
- **Profile** (`PR-01` to `PR-03`): profile with the plan line, settings detail (locked copy, account
  deletion entry), goals and targets edit.
- **Platform**: local database with 3 GRDB migrations, sync engine (500 ms debounce, batches of 50,
  generation tokens, quarantine at 5 attempts, triggers on foreground, network change and BGTask),
  small home screen widget with midnight rollover, Live Activity around one scan save, HealthKit
  (steps read, burned-energy write only from a user-confirmed value, background delivery), local
  notifications `meal.lunch`, `meal.dinner`, `eod.recap`, CSV export through ShareLink, Sentry and
  PostHog behind an allow-list with MetricKit, ED-safe mode, design system of 7 component files.

## 4. What the old app does not have

Each line is a parity row marked `n/a` (`PL-16`); nothing is ported for them.

| Not present | Evidence |
|---|---|
| App Intents or Shortcuts | no `AppIntents` import anywhere under `native/` |
| watchOS app | no watch target in `Project.swift` |
| Text OCR | no `VNRecognizeTextRequest`; Vision is used only for `DetectBarcodesRequest` |
| In-app purchase code | no `StoreKit` or `RevenueCat` import. Settings shows a display-only subscription card ("Free", with inert "Change plan" and "Cancel subscription" buttons and a footnote); the client reads the entitlement state from the 402 error envelope |
| Localization | no `.xcstrings` or `.strings` file; one `LocalizedStringKey` in `Cards.swift` |

## 5. Backend call sites

The app talks to Supabase in exactly four files, all in `Modules/CoachCalNetworking`.

| Swift | Call | Hono replacement |
|---|---|---|
| `LiveApiClient.analyzeFood` | `functions.invoke("analyze-food")` with `ScanRequest`; error envelope mapped to `ScanAPIError`; tier inferred from a 5 s duration threshold | `POST /v1/scan` |
| `SupabaseSyncTransport.push` | `rpc("sync_push", p_ops)` then validates the ack set against the request | `POST /v1/sync/push` |
| `SupabaseSyncTransport.pull` | `rpc("sync_pull", p_cursor)` | `POST /v1/sync/pull` |
| `AccountDeletionTransport.deleteAccount` | `functions.invoke("delete-account")` | `DELETE /v1/account` |
| `AuthSessionStore` | GoTrue: `signIn(email,password)`, `signInWithIdToken(apple, idToken, nonce)`, `signInWithOAuth(google, redirectTo)`, `signInWithOTP(email)`, `verifyOTP(email, token)`, session restore, `signOut`; Keychain service `com.nextlabs.coachcal.auth` | `/v1/auth/*` |

No Storage bucket and no Realtime channel are used. `food-search` and `barcode-resolve` exist as
functions but the SwiftUI app never calls them (food search is local).

`SupabaseConfiguration` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Info.plist, injected at
build time from `COACHCAL_*` xcconfig variables. The RN app reads one `EXPO_PUBLIC_API_URL` instead;
no key ships with the app.

## 6. Backend (Deno edge functions)

| Path under `supabase/functions/` | Lines | Role |
|---|---|---|
| `analyze-food/index.ts` | 228 | scan pipeline with the fixed gate order |
| `barcode-resolve/index.ts` | 49 | barcode lookup |
| `food-search/index.ts` | 49 | food search |
| `delete-account/index.ts` | 49 | deletes the auth user |
| `rc-webhook/index.ts` | 67 | RevenueCat webhook, HMAC verified |
| `_shared/contracts/` (6 files) | 303 | zod strict contracts; relocated to `packages/api-contract/src/contracts` |
| `_shared/arithmetic.ts` | 31 | canonical kcal rule; relocated to `packages/core/src/arithmetic.ts` |
| `_shared/grounding/` (5 files) | 466 | cascade, FDC, Open Food Facts, FatSecret, normalize |
| `_shared/vlm/` (3 files) | 352 | Gemini provider, fixture provider, kcal-free vocabulary use |
| `_shared/` others (7 files) | 262 | http envelope, db client, quota, entitlement, routing, hidden fat, webhook HMAC |

Tests: 13 Deno files, 3,342 lines, against a local Supabase stack. Golden fixtures: 10 files, now
also in `packages/api-contract/golden`.

Database: 3 migrations. Tables `diary_entries`, `entitlements`, `eval_cases`, `food_cache`,
`scan_items`, `scan_usage`, `scans`, `sync_operations`, `webhook_events`. SECURITY DEFINER functions
`sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`, `apply_webhook_event`.

## 7. Permissions, entitlements, privacy

| Item | Value |
|---|---|
| `NSCameraUsageDescription` | camera for meal photos |
| `NSHealthShareUsageDescription` | step count from Apple Health |
| `NSHealthUpdateUsageDescription` | burned-energy summaries only on explicit confirm |
| `NSSupportsLiveActivities` | true |
| `CFBundleURLSchemes` | `coachcal` |
| `ITSAppUsesNonExemptEncryption` | false |
| Entitlements | HealthKit, HealthKit background delivery, Sign in with Apple, App Group `group.com.nextlabs.coachcal` (app and widget) |
| Privacy manifest | collects email (linked), health (not linked), photos (linked) for app functionality; no tracking; file timestamp (C617.1) and UserDefaults (CA92.1) reasons |

## 8. Test seams

| Seam | Values |
|---|---|
| API client | `FixtureApiClient` (golden fixtures) and `LiveApiClient` behind `CoachCalAPI` |
| Capture | `FixtureCaptureService` and `CameraService` behind `ScanCaptureSeam` |
| Launch arguments | `--ccFreshStart`, `--ccDisableAnimations`, `--ccEDSafe`, `--ccFixedClock`, `--ccFixtureCapture`, `--ccForceOffline`, `--ccRequireSignIn`, `--ccScanScenario`, `--ccSeedNoTargets` |
| Clock | `now: @Sendable () -> Date` injected |
| Proofs | `ProofRecord` and a proof harness for live checks (online, offline reconnect, replay idempotency, cross-user denial, same-owner convergence, two installs) |

## 9. Tooling that exists only for the old app

All deleted in CL-01 unless a line says otherwise.

| Path | Fate |
|---|---|
| `native/Project.swift`, `native/Tuist.swift`, `native/Tuist/`, `native/Modules/*/Package.swift` | deleted |
| `native/scripts/check-artifact-compliance.sh`, `native/scripts/scan-ipa-secrets.sh` | replaced by `scripts/rn/check-artifact-compliance.mjs` (PL-15) |
| `.github/workflows/ci.yml` | Swift job removed; `rn-ci.yml` is the CI contract |
| `.github/workflows/release-ipa.yml` | deleted; the RN release pipeline is a follow-up owned by Phương |
| `ci_scripts/ci_post_clone.sh` | deleted; an Xcode Cloud hook for the RN app is a follow-up |
| `deno.lock`, `scripts/*.ts`, `scripts/*.mjs` under the repo root, `supabase/` | kept: not Swift. Redundant once the VPS backend runs |

`AGENTS.md`, `ARCHITECTURE.md` and `docs/engineering/*.md` describe the old app and are rewritten
in CL-01. Three of them (`AGENTS.md`, `ARCHITECTURE.md`, `docs/engineering/tech-stack.md`) have
uncommitted edits in Phương's checkout on `main`.

## 10. Commands behind the counts

```sh
find native -type f -not -path 'native/Derived/*' -not -path '*.xcassets/*' -not -path '*/.*' | wc -l   # 281
find native -name '*.swift' -not -path '*/Tests/*' -not -path 'App/CoachCalTests/*' -not -path 'App/CoachCalUITests/*' -print0 | xargs -0 wc -l | tail -1   # 15672
grep -rhoE '^import [A-Za-z]+' native/App native/Modules/*/Sources native/CoachCalWidget --include='*.swift' | sort | uniq -c | sort -rn
grep -rnoE '"(analyze-food|food-search|barcode-resolve|delete-account|rc-webhook|sync_push|sync_pull|persist_scan|claim_scan_credit)"' native --include='*.swift'
node scripts/rn/parity-check.mjs   # every inventoried file maps to a parity row
```
