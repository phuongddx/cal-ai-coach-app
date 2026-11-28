# Engineering Conventions

Derived from current source. Cite-grade references in parentheses.

## TypeScript / React Native

- TypeScript strict in every workspace (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`,
  `isolatedModules`). React 19 on Hermes with the New Architecture; code must stay React Compiler-safe:
  external stores are read with `useSyncExternalStore` and a stable snapshot
  (`apps/mobile/src/design/edSafe.ts`).
- Features are model + view pairs under `apps/mobile/src/features/<feature>/`: a plain-TypeScript
  model or reducer (`scanModel.ts`, `diaryDayModel.ts`, `onboardingModel.ts`) and thin views. A
  feature never imports another feature's internals; it navigates by typed route and reads shared
  data through `src/data` and `src/design`. `src/app/` holds route files only; tests never live there.
- `apps/mobile/src/platform/appEnvironment.tsx` + `rootRuntime.ts` and
  `apps/mobile/src/data/environment.ts` are the composition root: constructor injection of ports and
  closures (API client, repositories, `SyncStore`, `SyncTransport`, `now: () => Date`). No service
  locator. Feature code never opens the database and never reads process arguments.
- Typed error values per boundary (scan API errors, sync transport errors, auth session errors,
  `ConfigError` in the API). Best-effort paths swallow with a comment that says why; persistence
  writes are transactional.
- Strict wire decoding on both ends: zod `strictObject` server-side; the client parses every response
  with the same schema from `@coachcal/api-contract`; sync validates the exact ack set and the cursor
  (`apps/mobile/src/data/sync/engine.ts`, `packages/core/src/syncEnvelope.ts`).
- Pure-core rule: `packages/core` imports no `react-native`, no `node:` module and nothing outside
  itself; unsafe inputs clamp with flags instead of throwing (`targets.ts`, `kcal.ts`).
- Ids: `apps/mobile/src/data/sync/uuid.ts` is the only id source on the client; every id that reaches
  the server is a UUID v4. After a repository write call `notifyLocalMutation()`.
- ED-safe: `apps/mobile/src/design/edSafe.ts` is the only file that exports ED-safe functions;
  components own the policy branch. Feature code hides a calorie framing with `EdSafeCollapse` and
  does not call `edSafeMode(`, `edSafeHidden(` or `useEdSafeHidden(` to decide what to show.
- Design tokens: `docs/design/ember/tokens.css` → `tokens.json` → `emberTokens.generated.ts`
  (`node scripts/rn/gen-tokens.mjs`) → `tokens.ts`. Feature code uses tokens and design components,
  never a literal color. Generated files (`emberTokens.generated.ts`, `data/db/migrations.ts`,
  `.expo/types/router.d.ts`) are regenerated, not edited.
- Telemetry privacy: feature code never imports Sentry or PostHog; `src/platform/telemetry/` is an
  allow-list seam with payload scrubbing.

## Backend (Hono)

- Uniform `{error:{code,details?}}` envelope from `apps/api/src/http.ts`; the codes are the shared
  `ERROR_CODES` of `packages/api-contract/src/contracts/errors.ts`. 500 only for genuine bugs
  (`app.onError` in `apps/api/src/app.ts` logs the stack, never returns it); malformed input → typed
  400; malformed VLM output → 422.
- The scan route chain is JSON parse → schema → auth → handler (`apps/api/src/scan/route.ts`), then
  the fixed gate order in `scan/pipeline.ts`.
- The VLM never outputs kcal: enforced by `packages/api-contract/src/contracts/vlm.ts`, the Gemini
  schema and prompt in `apps/api/src/vlm/`, and `packages/core/src/arithmetic.ts`.
- The API role holds zero table privileges; all access goes through SECURITY DEFINER functions
  (`sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`, `webhook_apply`, the auth functions)
  in `apps/api/migrations/`. Dev tokens work only while `AUTH_DEV_TOKENS=1`; production never sets it.
- Dependencies are injected into `createApp(deps)` (database, session service, providers, mail sender,
  webhook secret) so tests drive it with `app.request(...)`.

## Tests

- Jest everywhere (`jest-expo/ios` in the app, `ts-jest` in packages and the API). One case per
  behavior; the case title is the behavior sentence. A file that ports a Swift test says
  "Jest twin of …" in its header.
- Fresh in-memory SQLite (`sql.js`) per app test; native modules are mocked in
  `apps/mobile/src/__mocks__/`. API SQL suites need a PostgreSQL 17 from
  `scripts/rn/start-api.sh`, else they print `[sql-skip]` and skip.
- Debug and fixture flags (`--ccFreshStart`, `--ccEDSafe`, `--ccFixtureCapture`, `--ccForceOffline`,
  `--ccFixedClock`, `--ccScanScenario`, …) are read once from `apps/mobile/src/debug/launchArgs.ts`.
- Golden fixtures are shared server↔client (`packages/api-contract/golden/`; the legacy copy in
  `supabase/functions/tests/golden/` must stay byte-identical, the parity gate checks it).
- Legacy Deno suites run sequentially; `--parallel` is forbidden (`supabase/functions/deno.json`).

## Git

- Conventional Commits, imperative lowercase subjects; types in use: `feat`, `fix`, `test`, `chore`,
  `docs`, `ci`, `build`, `refactor`; the migration units use scope `rn` (`feat(rn): …`).
- Topic branches are merged by explicit merge commit. No AI agent is named as author or co-author in
  commits or pull requests (no `Co-Authored-By`, no "Generated with" footer).
- Tags: `archive/swiftui-final` marks the last commit that held the SwiftUI app.
- PR conventions beyond that: not configured — not discoverable from local git metadata.
