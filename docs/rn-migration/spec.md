# Spec: CoachCal on React Native + Expo, replacing the SwiftUI app

Date 2026-11-27. Owner: CoachCal bot. Program requested by Phương through Zed: finish the migration
to React Native + Expo, then remove everything that belongs to the SwiftUI app. Android is skipped
for now. The plan is not waiting for approval; this spec and `plan.md` are the contract.

Labels used below: **[verified]** read from the repo or run on this machine during this program;
**[spike]** run on the iOS 26.4 Simulator by the spike (report in `spike/report.md`); **[Zed]** taken
from the RN + Expo report Zed verified against official docs on 2026-11-26 and not re-run here;
**[unverified]** a decision this program has to prove.

## 1. Goal and non-goals

**Goal.** One React Native app with the production identity `com.nextlabs.coachcal` that does
everything the SwiftUI app in `native/` does, on iOS, backed by a Hono API on PostgreSQL 17 instead
of Supabase. Every feature of the old app has a row in `parity.tsv`; each row ends `done`, `partial`
or `not-done` with a reason, and every `done` row has evidence from the iOS 26.4 Simulator.

**Non-goals.**

- Android: not built, not verified. The config keeps the Android block so the door stays open.
- App Store or TestFlight: nothing is submitted, the bundle id and the App Store Connect record do
  not change, no signing asset is touched.
- New design: screens copy the SwiftUI app (Ember). No screen is redesigned.
- New product features: nothing that the old app does not have is added. The Settings subscription
  card is ported with its inert buttons, as it is today.
- The web client in `web/` (uncommitted work on `main`) still calls the Supabase functions. It is
  not part of this program.
- Deploying the API. The deploy kit is written, Phương deploys.

## 2. Fixed decisions

| # | Decision | Why |
|---|---|---|
| D1 | Expo SDK 58 (expo ~58.0.26, React Native 0.88.1, React 19.3.0, Hermes V1, New Architecture), development build with Continuous Native Generation; `ios/` and `android/` are never committed | Chosen by Phương after the spike; `expo-dev-client` is needed for HealthKit, widgets, the camera and Sign in with Apple [Zed] |
| D2 | Expo Router with `NativeTabs` from `expo-router/native-tabs`; `src/app` holds routes only | The tab bar and Liquid Glass are native on iOS 26 [spike] |
| D3 | `expo-sqlite` + Drizzle for the local store; an outbox the program writes itself; TanStack Query v5 only for server-only data; Zustand for small UI state | The diary is local-first; the sync layer has no ready-made tooling [Zed] |
| D4 | npm workspaces monorepo at the repo root: `apps/mobile`, `apps/api`, `packages/core`, `packages/api-contract` | The app, the API and the web share TypeScript; the spike already used this shape [verified] |
| D5 | Backend: Node 24 LTS + Hono + PostgreSQL 17, behind Caddy on a VPS, Docker Compose | `coachcal-vps-backend-research.md`: four endpoints, one webhook, no realtime, no storage |
| D6 | Deployment target stays iOS 18.0. iOS 26 looks (glass, floating tab bar) come from libraries that check availability; on iOS 18 the surfaces are plain | Same floor as the SwiftUI app [verified: `Project.swift`] |
| D7 | The app takes the production identity now: name CoachCal, bundle `com.nextlabs.coachcal`, scheme `coachcal`, App Group `group.com.nextlabs.coachcal` | It replaces the old app; "do not change the bundle id" means keep this one [verified: `app.config.ts` in the promotion commit] |
| D8 | Evidence comes from one Simulator: `iPhone 17 Pro`, iOS 26.4, found by name through `scripts/rn/sim-udid.sh` (the machine lost every Simulator on 2026-11-27, outside this program, and the device was recreated), driven with `axe` 2.1.1 and `xcrun simctl` | Only iOS 26 runtime with a device set up for this project; Maestro is not installed [verified] |
| D9 | Google sign-in keeps the browser flow (Google's consent page in `expo-web-browser`, back through `coachcal://auth/google`), not a native Google SDK | The old app used `ASWebAuthenticationSession` through Supabase [verified: `AuthSessionStore.swift`]; no third-party native library to keep up with RN releases |
| D10 | Dev tokens for the API exist only when `AUTH_DEV_TOKENS=1`; the production image never sets it | `apps/api/dev-tokens.json` is public in this repository [verified] |
| D11 | `supabase/` is not deleted and not developed further. Its contracts and golden fixtures now live in `packages/`; the parity gate fails if the two golden copies diverge | Not Swift; it goes when the VPS backend runs |

## 3. Invariants (carried over from `AGENTS.md`, restated for this stack)

| # | Invariant | How it is enforced here |
|---|---|---|
| I1 | The VLM never outputs kcal | Contract: `packages/api-contract/src/contracts/vlm.ts` rejects a kcal key (`golden.test.ts`). Provider: the Gemini response schema and prompt in `apps/api/src/vlm/` carry no kcal field. Arithmetic: kcal is computed only by `packages/core/src/arithmetic.ts` from grounded per-100g times VLM grams |
| I2 | The API process holds zero table privileges | The API connects as a role with no privilege on any table. It can only execute the SECURITY DEFINER functions it needs: `sync_push`, `sync_pull`, `persist_scan`, `claim_scan_credit`, the helper functions U-11 added, and the auth functions of U-21. The webhook goes through `webhook_apply`, not through `apply_webhook_event`. An integration test run as that role proves a direct `SELECT` on a table fails |
| I3 | `500 INTERNAL` only for genuine bugs; malformed input is a typed `400 VALIDATION_ERROR`, malformed VLM output a typed `422 VLM_SCHEMA_ERROR`; every body uses the uniform envelope | One `ErrorEnvelopeSchema` with the legacy `ERROR_CODES`, shared by API and app (`packages/api-contract/src/contracts/errors.ts`) |
| I4 | Only `diary_entries` syncs (mirror rows and tombstones); every other table is local-only | The sync wire contract has one record type (`packages/api-contract/src/sync.ts`) |
| I5 | The gate order in the scan pipeline is fixed: preflight, JSON parse, schema (400), auth (401), quota (402 `FREE_LIMIT_REACHED`), kind routing (barcode never reaches a VLM), grounding cascade, arithmetic, self-parse, `persist_scan`, 200 | Ported test by test from `scan-gates.test.ts` and `analyze-food.e2e.test.ts` |
| I6 | The displayed kcal is always recomputed from the current grams on the client; the response kcal is never the display source after an edit | The scan reducer owns grams; a test edits grams and asserts the recomputed figure; parity with the server rule is a test in `packages/core` |
| I7 | ED-safe has one API; components own the policy branch, feature code has none | `apps/mobile/src/design/edSafe.ts` is the only file that exports ED-safe functions: `edSafeMode()` and `edSafeHidden()` for plain code, `useEdSafeMode()` and `useEdSafeHidden()` for components (through `useSyncExternalStore`); the ED-safe sweep screenshots of the old app are the reference |
| I8 | Photo, health and kcal text never leave the device through telemetry | The telemetry seam is an allow-list with payload scrubbing, as in `AppEnvironment.swift`; no feature imports Sentry or PostHog |
| I9 | Privacy manifest and usage strings stay in the app bundle | `app.config.ts` plugins; `scripts/rn/check-artifact-compliance.mjs` reads the built `.app` |
| I10 | Strict wire decoding on both ends | Server: zod `strictObject`. Client: every response is parsed with the same schema from `packages/api-contract`; unknown keys fail |
| I11 | Every id that reaches the server is a valid UUID v4 on Hermes | `apps/mobile/src/data/sync/uuid.ts` is the only id source; the parity gate fails on `crypto.randomUUID` under `apps/mobile` (from U-12 on) |
| I12 | Deleting a HealthKit meal deletes each child sample | The delete routine iterates the samples [spike: `health-actions-log.txt`]; a test covers it |
| I13 | `packages/core` is pure | No `react-native` and no `node:` import; Jest runs it in Node, Metro bundles it in Hermes |

Compliance rules do not change: no in-app purchase bypass (3.1.1), no manipulative flows (5.6).

## 4. Layout

```text
/                     npm workspaces root (package.json, package-lock.json, tsconfig.base.json)
apps/mobile/          Expo app: src/app (routes), src/features/<feature>, src/data (db, sync, api,
                      auth, health, widget), src/design (tokens, components, edSafe), src/platform
                      (telemetry, notifications), src/debug (launch args, console), src/testing
                      (fixtures, fixture API), src/widgets
apps/api/             Hono API: src/<domain>, migrations/*.sql, deploy/, dev-tokens.json
packages/core/        pure domain: arithmetic, kcal, targets, streak, day key, widget snapshot,
                      canonical version, proof record, notification scheduling rules
packages/api-contract/  zod contracts (scan, lookup, VLM, errors, webhook, sync) and golden/
modules/              Expo Modules written in Swift or Kotlin, when a capability needs one
targets/              Swift app extensions that Expo plugins cannot express, when needed
docs/rn-migration/    this program: spec, plan, parity, inventory, findings, evidence
scripts/rn/           parity gate, API and sync scripts, build and evidence scripts
native/, supabase/    legacy, frozen until CL-01 (native) and until the VPS backend runs (supabase)
```

Inside `apps/mobile/src`:

- `features/<feature>/` owns its screens, its model or reducer, its hooks and its tests. A feature
  never imports another feature's internals; it navigates by typed route and reads shared data
  through `src/data` and `src/design`.
- `src/app/` holds route files only. Tests never live there (Expo Router makes every file a route).
- `data/db` holds the Drizzle schema, the bundled migrations and the client. `data/sync` holds the
  outbox engine. `data/api` holds typed clients. `data/auth` holds the session.

## 5. Data flow

**Scan.** Capture (camera or fixture seam) → `POST /v1/scan` with `ScanRequest` (`scanId` is a
fresh UUID v4) → response parsed with `ScanResponseSchema` → the scan reducer holds items and grams
→ every edit recomputes the displayed kcal through `@coachcal/core` → save writes mirror rows,
details and one pending op per entry in one SQLite transaction → `notifyLocalMutation` fans out to
sync, notifications and the widget.

**Sync.** Local mutation → pending op in the outbox → the engine debounces 500 ms, drains up to 50
ops FIFO → `POST /v1/sync/push` → the ack set must equal the request → `POST /v1/sync/pull` with the
cursor → last-writer-wins merge that skips rows with a pending local intent → cursor advance. An op
quarantines after 5 attempts. Triggers: app foreground, network back, background task.

**Auth.** Sign-in method → `/v1/auth/*` → the API verifies the credential (Apple identity token and
Google ID token through their JWKS, scrypt password hash, OTP code from the mail sender), issues an
access token (short-lived JWT signed by the API) and a refresh token (random, stored hashed,
rotated on every refresh). The app keeps both in `expo-secure-store` and attaches the access token
as a bearer. `DELETE /v1/account` removes the user's rows and sessions and revokes the Apple token
when the account was created with Apple.

## 6. API surface

| Method and path | Replaces | Caller and auth |
|---|---|---|
| `POST /v1/scan` | `analyze-food` | app, bearer session |
| `POST /v1/barcode/resolve` | `barcode-resolve` | app, bearer session |
| `POST /v1/foods/search` | `food-search` | app, bearer session |
| `POST /v1/sync/push`, `POST /v1/sync/pull` | RPCs `sync_push`, `sync_pull` | app, bearer session |
| `DELETE /v1/account` | `delete-account` | app, bearer session |
| `POST /webhooks/revenuecat` | `rc-webhook` | RevenueCat, HMAC over the raw body |
| `POST /v1/auth/apple` | GoTrue `signInWithIdToken` (Apple) | app: Apple identity token, raw nonce, authorization code when present |
| `GET /v1/auth/google/start`, `GET /v1/auth/google/callback` | GoTrue `signInWithOAuth` (Google) | browser session; the callback redirects to `coachcal://auth/google?code=<one-time code>` |
| `POST /v1/auth/google/exchange` | (replaces the implicit tokens in the redirect URL) | app: the one-time code, once |
| `POST /v1/auth/email` | GoTrue `signIn(email, password)` | app |
| `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify` | GoTrue `signInWithOTP`, `verifyOTP` | app |
| `POST /v1/auth/refresh`, `POST /v1/auth/signout` | GoTrue session | refresh token / session |
| `GET /health` | none | uptime check, no auth |

The wire bodies of scan, lookup, webhook and sync do not change: they are the relocated contracts.
Unknown routes answer `404 {error:{code:"VALIDATION_ERROR",details:["route"]}}` so the envelope stays
uniform.

The request and response bodies of sign-in and session are `packages/api-contract/src/auth.ts`
(the owner wrote it before the two units that implement it started). Access tokens are short-lived
(15 minutes) and treated as opaque; refresh tokens (30 days) are random, stored hashed and rotated
on every refresh. Email with password only signs an existing user in; an account is created through
Apple, Google or the e-mail code.

## 7. Native surface

| Capability | SwiftUI app | RN approach | Swift in the new app? |
|---|---|---|---|
| Tabs and Liquid Glass | SwiftUI tab bar on iOS 26 | `NativeTabs`, `expo-glass-effect` | none [spike] |
| Home screen widget, small | WidgetKit extension | `expo-widgets` | none [spike] |
| Live Activity | ActivityKit, UI in the widget extension | `expo-widgets` Live Activity; if SDK 58 cannot express it, a Swift target under `targets/` | maybe [unverified] |
| HealthKit | HealthKit | `@kingstinct/react-native-healthkit` 16.2.0 | none [spike] |
| Camera, barcode | AVFoundation, `DataScannerViewController`, `DetectBarcodesRequest` | `expo-camera` capture and code scanning | none [unverified on this SDK] |
| Photo library | PhotosUI | `expo-image-picker`, `expo-image-manipulator` | none |
| Sign in with Apple | AuthenticationServices | `expo-apple-authentication` | none |
| Google | `ASWebAuthenticationSession` | `expo-web-browser`, `expo-linking` | none |
| Notifications | UserNotifications | `expo-notifications` | none |
| Background and network | BGTaskScheduler, NWPathMonitor | `expo-background-task`, `@react-native-community/netinfo` | none [unverified] |
| Telemetry | Sentry, PostHog, MetricKit | `@sentry/react-native`, PostHog RN, in a later native unit | none |
| CSV share | ShareLink | `expo-sharing`, `expo-file-system` | none |
| App Intents, watchOS, OCR | not in the old app | nothing | none |

Charts (line, area, points and bars in Progress) are drawn with `react-native-svg`, which is
already installed.

## 8. Debug and test seams

- Launch arguments keep their names: `--ccFreshStart`, `--ccDisableAnimations`, `--ccEDSafe`,
  `--ccFixedClock`, `--ccFixtureCapture`, `--ccForceOffline`, `--ccRequireSignIn`,
  `--ccScanScenario`, `--ccSeedNoTargets`. They are read once at startup in `src/debug/launchArgs.ts`.
- The API seam stays: a fixture client over `packages/api-contract/golden` and a live client behind
  one `CoachCalApi` interface. `--ccScanScenario` picks the fixture response.
- The capture seam stays: fixture capture on the Simulator, the camera on a device.
- The clock is injected, as in the Swift app.
- `apps/api` exposes its routes as a Hono instance so tests call `app.request(...)`.

## 9. Evidence standard (Phase 4)

A parity row is `done` only when all of this is true:

1. It runs on the iOS 26.4 Simulator from a build of `main` (dev build loading the bundle from
   Metro, or a release build).
2. A screenshot, an axe transcript or a Jest file is committed under `docs/rn-migration/evidence/<id>/`
   or next to the code, and `parity.tsv` names it.
3. Its Jest tests pass in CI.
4. A worker other than the one that built it, or the owner, re-ran the check on the pushed head.

Rows that cannot reach that bar say why and what would get them there: `partial` (runs with a named
gap) or `not-done` (reason and proposal). Rows for things the old app never had are `n/a` with the
evidence from `inventory.md`.

Known limits of Simulator evidence: no camera (the viewfinder is shown with the fixture feed), the
HealthKit permission sheet and background delivery behave differently from a device, Liquid Glass
rendering differs from a device, no Sign in with Apple sheet (it needs a signed-in Apple account).
These go on the list of things Phương runs on a device.

## 10. Dependencies

Chosen for the first native build (U-13 adds them once; later units do not touch the lockfile):

| Package | For |
|---|---|
| `@tanstack/react-query`, `zustand` | server data, small UI state |
| `expo-camera`, `expo-image-picker`, `expo-image-manipulator` | capture, library fallback, resize before upload |
| `expo-apple-authentication`, `expo-web-browser` | sign-in |
| `expo-secure-store` | session tokens |
| `expo-notifications`, `expo-background-task` | reminders, sync trigger |
| `expo-file-system`, `expo-sharing` | CSV export |
| `jose` (API) | JWT and JWKS |

Telemetry SDKs (`@sentry/react-native`, PostHog) join in a later native unit, after the core app is
proven, so a problem with them cannot block everything else.

## 11. Risks and open calls

| Risk or call | Default applied | Who decides otherwise |
|---|---|---|
| Disk: 15 GB free on the data volume on 2026-11-27 [verified: `df -h /System/Volumes/Data`]; one native build costs about 5.3 GB [spike]; three other projects build on the same machine | One native build slot for the whole program; worker worktrees clone `node_modules` with an APFS clone instead of installing; other projects' DerivedData and Simulators are not touched (the `iPhone Duo` Simulator alone holds 11 GB) | Phương may erase Simulators he no longer uses |
| Only one Simulator and one native build at a time | Feature units are JS-only and verify with Jest and `tsc`; screenshots come from serial evidence units | nobody; it is the machine |
| Third-party native libraries on RN 0.88 with Xcode 27.1 | Only `@kingstinct/react-native-healthkit` and the Nitro modules it needs; first-party Expo packages otherwise | U-13 proves the build |
| `expo-camera` code scanning and `expo-background-task` on SDK 58 | Used as documented; U-13 and U-42 read the docs in `node_modules` before relying on them | the unit that finds a blocker reports it |
| Live Activity support in `expo-widgets` | Try `expo-widgets` first, fall back to a Swift target | U-43 |
| Google OAuth and Apple token revoke need credentials only Phương has (Google Web client, Apple key and Services ID, mail sender) | The API reads them from env; missing values give a typed `503` with a clear code; the deploy doc lists every value | Phương |
| `AGENTS.md`, `ARCHITECTURE.md`, `docs/engineering/tech-stack.md` have uncommitted edits in Phương's checkout | CL-01 rewrites them on `main` through a PR; Phương's local `git pull` will need his edits committed first | Zed may hold CL-01's doc part |
| CI for the Swift app keeps running on every PR until CL-01 | RN CI runs on Ubuntu and is the gate for this program; Swift CI results are reported, not waited for | nobody |

## 12. Docs read for this spec

Read in the repository during this program: `AGENTS.md`, `ARCHITECTURE.md`, the spike's `spec.md`,
`plan.md`, `report.md`, `build-recipe.md`, `findings/T1` to `T4` and `T6`; `native/` sources listed in
`inventory.md`; `supabase/functions/_shared/contracts/*`, `arithmetic.ts`, `http.ts`, `db.ts`;
`supabase/functions/deno.json`; Zed's two reports (`coachcal-vps-backend-research.md`,
`coachcal-react-native-expo-report-2026-11-26.md`).

Official docs, through the reports above and the spike (not re-opened for this spec):

- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/versions/latest/sdk/widgets/
- https://docs.expo.dev/router/advanced/native-tabs/
- https://docs.expo.dev/versions/latest/sdk/glass-effect/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/guides/local-first/
- https://docs.expo.dev/guides/monorepos
- https://docs.expo.dev/versions/latest/sdk/apple-authentication/
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://docs.expo.dev/versions/latest/sdk/background-task/
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/versions/latest/sdk/camera/
- https://orm.drizzle.team/docs/connect-expo-sqlite
- https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
- https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-v2
- https://www.revenuecat.com/docs/integrations/webhooks
- https://hono.dev/docs
- https://nodejs.org/en/about/previous-releases
- https://www.postgresql.org/support/versioning/

Every unit that relies on a library API re-reads that library's docs and typings in `node_modules`
and records what it read in its findings file.
