# Repository Guidelines

## Project Overview

CoachCal — an AI calorie coach. Native SwiftUI iOS app + Supabase backend (Postgres 17 with RLS, Deno edge functions). Photograph a meal, get calories/macros in seconds, then correct the estimate. Competes with Cal AI; differentiates on honesty: transparent billing with in-app cancel, visible AI confidence on every scan, ED-safe guardrails. Core value: a trustworthy, editable kcal/macro estimate from any meal photo in under 5 seconds. Data is local-first; AI keys are server-side only.

## Architecture & Data Flow

Monorepo: `native/` (Tuist-generated iOS app), `supabase/` (backend), `scripts/` (Deno/Node verification harnesses).

### Module graph (Swift)

```text
CoachCal app  (+ CoachCalWidget extension)
├── CoachCalDesignSystem ─┐
├── CoachCalPersistence ──┤
├── CoachCalNetworking ───┼── CoachCalCore
└── CoachCalSync ─────────┘
```

- **CoachCalCore** — pure domain, zero dependencies, macOS `swift test`-able: `KcalArithmetic` (client kcal rule), `TargetsEngine` (Mifflin-St Jeor, clamps-not-throws), `StreakEngine`, `DayKey`, `WidgetSnapshot(+Store)`, `CanonicalVersion` (the LWW comparator), `SyncEnvelope` (strict-decodable wire contracts), `SyncTransport` protocol.
- **CoachCalDesignSystem** — `CC`-prefixed tokens, components, and the single sanctioned ED-Safe API (`edSafeMode` / `edSafeHidden()`).
- **CoachCalPersistence** — GRDB store: `Migrations` (3 migrations), `DiaryEntryRepository` (atomic mirror+outbox writes), `OutboxRepository` (batch ≤50, retry, quarantine), `SyncMergeRepository` (LWW merge), feature repositories.
- **CoachCalNetworking** — `CoachCalAPI` protocol seam, `LiveApiClient` / `FixtureApiClient` (golden fixtures), `SupabaseSyncTransport` (`sync_push`/`sync_pull` RPCs), `AuthSessionStore`, `AccountDeletionTransport`.
- **CoachCalSync** — `SyncEngine` `public actor` (500ms debounce, batch 50, generation tokens, quarantine at 5 attempts) + foreground/NWPath/BGTask triggers.
- **App target** — `AppEnvironment.swift` is the composition root (DI wiring, `api` seam, telemetry allow-list, account reset); features live in `native/App/Features/<Flow>/` as `FeatureModel`/`FeatureView` pairs.

### Photo-scan data flow

1. `CaptureViewfinderView` → `ScanCaptureSeam` (`CameraService` on device, `FixtureCaptureService` under `--ccFixtureCapture`) → `ScanCapture{image, request}`.
2. `ScanModel.analyze` → `AppEnvironment.api` (`LiveApiClient` when signed in, else `FixtureApiClient`) → `functions.invoke("analyze-food")`.
3. Server gate order is **fixed**: preflight → JSON parse → `ScanRequestSchema` (400) → auth (401) → entitlement/quota `claim_scan_credit` (402 `FREE_LIMIT_REACHED`) → kind routing (barcode → cascade directly, never a VLM; photo/label/text → VLM tier1, escalate to tier2 when `scanConfidence <0.7` or item `<0.5`) → grounding cascade (cache-first: food_cache TTLs 30d/7d, negative 24h; FDC-only search tier) → arithmetic → response self-parse (500 only for genuine inconsistencies) → `persist_scan` RPC → 200.
4. Client review: displayed kcal is **always recomputed** via `KcalArithmetic` from current grams — the response kcal is never the display source after edits.
5. Save: `DiaryEntryRepository.recordUpserts` commits mirror rows + details + one `PendingOp` each in **one GRDB transaction** → `notifyLocalMutation()` fans out to sync + notifications + widget.
6. Sync: `SyncEngine.dispatch()` drains outbox (≤50, FIFO) → `sync_push` → exact-ack-set validation → ack merge → `sync_pull(cursor)` → LWW merge (skips rows with pending local intent) → cursor advance.

### Hard invariants (backend)

- **The VLM never outputs kcal.** Enforced in 3 layers: `z.strictObject` vocabulary in `_shared/contracts/vlm.ts`; kcal-free responseSchema + prompt in `_shared/vlm/gemini.ts`; kcal computed only by `_shared/arithmetic.ts` from grounded per-100g × VLM grams. Server value is canonical; clients recompute only for edited grams (parity: `Math.round` half-up ↔ `KcalArithmetic`).
- Clients hold **zero server table privileges** — all access via SECURITY DEFINER RPCs (`sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`, `apply_webhook_event`); cross-user ops rejected.
- `500 INTERNAL` reserved for genuine bugs; malformed VLM output → typed 422; malformed requests → typed 400. Uniform `{error:{code,details?}}` envelope from `_shared/http.ts`.
- Only `diary_entries` syncs (mirror + tombstones); domain tables (details, foods, targets, logs…) are local-only.

## Key Directories

| Path | Purpose |
|---|---|
| `native/Modules/` | 5 local SPM packages (see graph above); each has `Sources/` + `Tests/` |
| `native/App/CoachCal/` | App target: composition root, resources, entitlements, privacy manifest |
| `native/App/Features/` | Feature folders: Scan, Diary, Today, Progress, Coach, Profile, Onboarding, Auth, Health, LiveActivity |
| `native/App/CoachCalTests/` | App unit/snapshot tests + `Proofs/` (live-Supabase) + `__Snapshots__/` |
| `native/App/CoachCalUITests/` | XCUITests with `--cc*` launch-arg fixtures |
| `native/CoachCalWidget/` | WidgetKit extension (calories widget + live activity) |
| `supabase/functions/` | 5 edge functions + `_shared/` (contracts, arithmetic, grounding, vlm, quota, http) + `tests/` |
| `supabase/migrations/` | DDL + inline RLS (no separate policies dir) |
| `scripts/` | Deno/Node verification harnesses; `scripts/proof-capture/` seeds test accounts/fixtures |
| `docs/`, `plans/` | Historical specs + dated execution reports (live planning state is gitignored `.planning/`) |

## Development Commands

```sh
# iOS app — Tuist only; raw `xcodebuild build/test -scheme CoachCal` does NOT work
# (confirmed Tuist limitation resolving the app+widget+local-package graph)
cd native
tuist install
tuist generate --no-open
tuist build CoachCal -- -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5'
tuist test  CoachCal -- -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5'

# Module tests — macOS host, all modules except CoachCalDesignSystem (iOS-only)
cd native/Modules/<Name> && swift test

# Edge functions — local Supabase stack required; NEVER add --parallel
cd supabase/functions && deno task test   # → deno test --allow-all tests/

# Local function serving / hosted secrets
supabase functions serve --env-file supabase/functions/.env
supabase secrets set NAME=value

# Root harness scripts (canonical pattern)
supabase status -o env > envfile && deno run --env-file=envfile --allow-all scripts/run-golden-eval.ts
deno run --allow-all scripts/verify-e2e-sync.ts
```

Edit Tuist manifests (`native/Tuist.swift`, `native/Tuist/Package.swift`, `native/Project.swift`), never the generated `CoachCal.xcodeproj`/`.xcworkspace`/`Derived/` (git-ignored).

## Code Conventions & Common Patterns

- **Swift 6, `SWIFT_DEFAULT_ACTOR_ISOLATION=MainActor`, approachable concurrency** (project-wide in `Project.swift` — must stay or widget/test targets silently regress). `@Observable` everywhere, never ObservableObject; views read via `@Environment(AppEnvironment.self)` + `@Bindable`. `SyncEngine` is the one `public actor`; background work via explicit `Task` handles with generation/cancellation guards.
- **DI**: constructor injection of protocols + closures (`CoachCalAPI`, `SyncTransport`, `CameraCaptureService`); `now: @Sendable () -> Date` clock injection; `AppEnvironment` is the single composition root — no service locator. Test seams are env/launch-arg based: `FixtureApiClient`/`LiveApiClient`, `FixtureCaptureService`/`CameraService`, `overrideVlmProvider`, DEBUG `--cc*` args (`--ccFreshStart`, `--ccEDSafe`, `--ccScanScenario`, `--ccFixedClock`).
- **Error handling**: typed nested enums per boundary (`ScanAPIError`, `SyncTransportError`, `AuthSessionError`, …), all `Equatable, Sendable`. Best-effort paths use `try?` with a justifying comment; persistence failures roll back and keep UI state consistent.
- **Strict wire decoding both ends**: zod `strictObject` server-side; `SyncEnvelopeDecoder.rejectUnknownKeys` + ack-set/cursor validation client-side.
- **Pure-core rule**: Core engines are zero-import enum namespaces; inputs clamp with flags instead of throwing; must stay macOS `swift test`-able.
- **Naming**: `CC` prefix in DesignSystem; `FeatureModel`/`FeatureView` per feature; `*Repository`; `Fixture*`/`Live*` seam pairs.
- **Telemetry privacy**: feature code never calls Sentry/PostHog directly — `AppEnvironment` owns an allow-list with payload scrubbing (photo/health/kcal text never leaves the device).
- **Before writing Swift**: check Axiom skills (`axiom-swiftui`, `axiom-concurrency`, `axiom-data`) and Apple SDK docs. Gate iOS-26-only APIs with `#available(iOS 26.0, *)` and keep an iOS 18 fallback — deployment target is the floor, not the SDK version.
- **Git**: Conventional Commits `type(scope): imperative lowercase summary` (types in use: feat, fix, test, chore, docs, ci, build, refactor); scope is phase/task id or area. Review-fix branches `gsd-reviewfix/<phase>-<id>`. Commits are GPG-signed (repo-local config).
- **No lint/format tooling configured** (no SwiftLint/swift-format/pre-commit); match surrounding style.

## Important Files

| File | Role |
|---|---|
| `native/Project.swift` | Tuist manifest: 4 targets, Swift 6 + MainActor default isolation, manual signing, Info.plist entries |
| `native/Tuist/Package.swift` | External deps + local packages as `.staticFramework` |
| `native/App/CoachCal/AppEnvironment.swift` | Composition root — start here for wiring questions |
| `native/App/Features/Scan/ScanModel.swift` | Scan state machine, kcal-recompute invariant, single-transaction save |
| `native/Modules/CoachCalSync/Sources/CoachCalSync/SyncEngine.swift` | Outbox drain actor (debounce/batch/quarantine) |
| `native/Modules/CoachCalPersistence/.../DiaryEntryRepository.swift` | Atomic mirror+outbox transaction pattern |
| `native/Modules/CoachCalCore/.../SyncEnvelope.swift` | Wire contracts + LWW comparator |
| `supabase/functions/analyze-food/index.ts` | Scan pipeline with the fixed gate order |
| `supabase/functions/_shared/arithmetic.ts` | Canonical kcal/macro math (server authority) |
| `supabase/functions/_shared/grounding/cascade.ts` | Cache-first grounding cascade |
| `supabase/migrations/20260912000000_foundation_sync.sql` | sync_push/sync_pull RPCs + owner RLS |
| `supabase/config.toml` | Local stack config; `[functions.rc-webhook] verify_jwt=false` |
| `.github/workflows/ci.yml` | The CI contract (skip lists documented inline) |
| `ci_scripts/ci_post_clone.sh` | Xcode Cloud release hook |
| `.env.example` | Edge-function env surface + run modes |

## Runtime/Tooling Preferences

- **Xcode 26.6** (iOS 26.5 simulator runtime), simulator pin `iPhone 16,OS=26.5`. **Tuist 4.206+** (installed via brew; unpinned in CI).
- **Deno major 2**. Canonical lockfile is repo-root `deno.lock`; `supabase/functions/deno.json` sets `lock:false` — don't create a second lock.
- Local **Postgres major 17** via Supabase CLI. No Node toolchain pinned (no package.json; `scripts/*.mjs` run on system Node).
- Manual signing: team `K2TYLYAWMK`, App Store profiles; App Group `group.com.nextlabs.coachcal` is the widget↔app channel.
- Build-time env injection into Info.plist: `SUPABASE_URL`/`SUPABASE_ANON_KEY` (default local stack), `SENTRY_DSN`, `POSTHOG_API_KEY` via `COACHCAL_*` xcconfig vars.
- Test credentials (`TEST_EMAIL`, `TEST_PASSWORD`, `SUPABASE_ANON_KEY`) reach tests via the scheme's Test-action env vars; `AuthSessionTests` skip unless set.

## Testing & QA

Three tiers:

| Tier | Location | Frameworks | Runs via |
|---|---|---|---|
| Module unit | `native/Modules/*/Tests/` | Swift Testing | `swift test` (macOS host; DesignSystem excluded — iOS-only) |
| App unit + snapshot + UI | `native/App/CoachCalTests/`, `CoachCalUITests/` | XCTest + Swift Testing, ViewInspector 0.10.3, swift-snapshot-testing 1.19.4, XCUITest | `tuist test CoachCal` (simulator only) |
| Edge functions | `supabase/functions/tests/` | Deno test + zod + real supabase-js vs local stack | `deno task test` (sequential) |

- CI (GitHub Actions `macos-26`) runs the module loop + `tuist test CoachCal --no-selective-testing ... CODE_SIGNING_ALLOWED=NO` with inline `-skip-testing:` lists: live-Supabase proof suites (credential-gated), snapshot suites (machine-sensitive baselines), AccessibilityAuditTests. **No Deno steps in CI** — supabase tests are local-only.
- Golden fixtures are shared server↔client: `supabase/functions/tests/golden/` mirrors verbatim into the app bundle for `FixtureApiClient`. Regenerate with `scripts/export-contract-fixtures.ts`; capture live RPC responses with `scripts/proof-capture/capture-golden-fixtures.mjs`.
- Conventions: XCTest `testXxx()` / Swift Testing `@Suite struct` + `@Test func` / `Deno.test('behavior sentence')`; fresh GRDB DB per test; UI tests drive fixtures via `--cc*` launch args; Deno suites stub fetch seams (`fdcFetch.impl = …`) and restore `Deno.env`.
- Pinned deps: GRDB **7.11.1** (exact), supabase-swift **2.55.2** (exact), Sentry **9.28.0**, PostHog **3.75.2**, ViewInspector **0.10.3** (exact), swift-snapshot-testing **1.19.4**.

## Compliance

No IAP bypass (Apple 3.1.1); trial terms shown adjacent to price (3.1.2(c)); no manipulative flows (5.6). Privacy manifest (`PrivacyInfo.xcprivacy`) and HealthKit/camera usage strings must remain in the app bundle — enforced by `native/scripts/check-artifact-compliance.sh` against the built IPA.

## Docs

`AGENTS.md` is the only agent-facing project doc. Plans live in `plans/`, docs in `docs/`; do not create markdown outside those two unless asked. Release/TestFlight runbooks live in `plans/reports/`; no hosted-Supabase deploy runbook exists yet.
