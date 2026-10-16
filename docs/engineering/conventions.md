# Engineering Conventions

Derived from current source. Cite-grade references in parentheses.

## Swift / iOS

- Swift 6 with `SWIFT_DEFAULT_ACTOR_ISOLATION=MainActor` and
  `SWIFT_APPROACHABLE_CONCURRENCY=YES` project-wide (`native/Project.swift`).
  `SyncEngine` is the one `public actor`; background work uses explicit `Task`
  handles with generation/cancellation guards.
- `@Observable` everywhere — never `ObservableObject`. Features are
  `FeatureModel`/`FeatureView` pairs; models are `@MainActor @Observable final
  class` (e.g. `native/App/Features/Scan/ScanModel.swift`).
- `AppEnvironment.swift` is the single composition root: constructor injection
  of protocols + closures (`CoachCalAPI`, `SyncTransport`,
  `CameraCaptureService`, `now: @Sendable () -> Date`). No service locator.
- Typed nested error enums per boundary (`ScanAPIError`, `SyncTransportError`,
  `AuthSessionError`…), all `Equatable, Sendable`. Best-effort paths use `try?`
  with a justifying comment; persistence writes are transactional.
- Strict wire decoding on both ends: zod `strictObject` server-side; Swift
  decoders reject unknown keys (`SyncEnvelope.swift`,
  `FixtureModels.swift`).
- Pure-core rule: `CoachCalCore` engines are zero-import enum namespaces;
  unsafe inputs clamp with flags instead of throwing (`TargetsEngine.swift`,
  `KcalArithmetic.swift`).
- DesignSystem uses `CC`-prefixed tokens/components; `edSafeHidden()` is the
  only sanctioned feature-side ED-Safe API (`EdSafe.swift`, `Tokens.swift`).
- Telemetry privacy: feature code never calls Sentry/PostHog directly —
  `AppEnvironment` owns an allow-list with payload scrubbing.

## Backend (Deno)

- Uniform `{error:{code,details?}}` envelope from `_shared/http.ts`; 500 only
  for genuine bugs; malformed input → typed 400; malformed VLM output → 422.
- The VLM never outputs kcal: enforced by `_shared/contracts/vlm.ts`,
  `_shared/vlm/gemini.ts`, and `_shared/arithmetic.ts`.
- Clients get zero table privileges; all access via SECURITY DEFINER RPCs
  (`sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`,
  `apply_webhook_event`) in `supabase/migrations/`.

## Tests

- Naming: XCTest `testXxx()` / Swift Testing `@Suite struct` + `@Test func` /
  `Deno.test('behavior sentence')`.
- Fresh GRDB database per test; UI tests drive fixtures via DEBUG `--cc*`
  launch args (`--ccFreshStart`, `--ccEDSafe`, `--ccScanScenario`,
  `--ccFixedClock`, …).
- Golden fixtures are shared server↔client and mirrored verbatim
  (`supabase/functions/tests/golden/` → app bundle).
- Deno suites run sequentially; `--parallel` is forbidden
  (`supabase/functions/deno.json`).

## Git

- Conventional Commits, imperative lowercase subjects; observed types: `feat`,
  `fix`, `test`, `chore`, `docs`, `ci`, `build`, `refactor`; scope is area or
  phase/task id (e.g. `fix(native): …`).
- Commits and tags are GPG-signed (`commit.gpgsign=true`, `tag.gpgsign=true`).
- Topic branches are merged by explicit merge commit (e.g. `tuist-migration-ci`).
- PR conventions: Not configured — not discoverable from local git metadata.
