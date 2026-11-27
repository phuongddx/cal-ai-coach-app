# Spec: CoachCal React Native + Expo spike (RN rewrite decision)

Status: draft <!-- draft | approved | shipped | superseded -->
Date: 2026-11-26
Owner: CoachCal bot (spec, plan, integration, report). Execution: Worker-S1, Worker-S2, Worker-G1, Worker-G2 (see `plan.md`).
Branch: `spike/rn-expo`. Everything lives under `rn-spike/`. This is a throwaway spike, not production code.

## Problem

Phương must choose between rewriting CoachCal's client in React Native (one codebase for iOS
and Android) and keeping the SwiftUI app. Three research reports from 2026-11-26 conclude
"feasible, no hard blocker", yet every load-bearing claim is labelled unverified:

- Liquid Glass in RN is "native" through `expo-router/native-tabs` and `expo-glass-effect` — never rendered.
- `expo-widgets` "writes widgets in TypeScript" — never built.
- `@kingstinct/react-native-healthkit` "is maintained" — never run on the New Architecture.
- "expo-sqlite + a hand-written outbox syncs against an own Hono API" — never written.

The rewrite is estimated at 14–22 engineer-weeks. Committing that budget on unverified claims is
the risk this spike retires. The spike produces four working probes with evidence, three
measurements, a list of problems met, and a go / no-go recommendation.

## Context read

- Zed's summary report `coachcal-react-native-expo-report-2026-11-26.md` (stack, blocker table, open questions).
- Worker-S1's `rn-expo-arch-2026-11.md` (Expo SDK 58, Router, local-first, testing, versions).
- Worker-S1's `coachcal-vps-backend-research.md` (decision: Node + Hono + Postgres on a VPS, no Supabase).
- Repo: `AGENTS.md`, `ARCHITECTURE.md`, `docs/engineering/{conventions,infrastructure,tech-stack}.md`,
  `.agents/templates/{spec,review}.md`.
- Current client, as the visual and behavioural reference:
  - `native/App/Features/Today/TodayView.swift` (+ `WeekStripView.swift`, `TodayModel.swift`).
  - `native/CoachCalWidget/` (small widget "Calories left N", App Group `group.com.nextlabs.coachcal`).
  - `native/Modules/CoachCalCore/Sources/CoachCalCore/{WidgetSnapshot,KcalArithmetic,CanonicalVersion,SyncEnvelope}.swift`.
  - Snapshot renders under `native/App/CoachCalTests/__Snapshots__/` (Today light/dark, widget).
- Ember design system v2 (approved redesign, not yet implemented in SwiftUI):
  `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/coachcal-redesign-v2-7be4/{design-system.md,tokens.css,index.html,screens.js}`.
  Screenshots of the designed Today screen and widgets are in `docs/reference/` in this directory.
- Web client pure logic that ports to TypeScript: `web/core.js` (rounding, LWW, dayKey), `web/store.js` (localStorage outbox).
  `web/` is untracked in git at the time of writing; read it from the main checkout
  `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/web/`, it is absent from worktrees.
- Expo docs read for this spec (2026-11-26): SDK 58 `expo-widgets`, Router `native-tabs`,
  `guides/monorepos`, `develop/unit-testing`, SDK 58 `expo-dev-client`.

Gaps:

- No Android SDK on the spike machine, so nothing can be said about Android from running code.
- No physical device and no signing in the loop; App Groups, HealthKit and Liquid Glass are
  observed on the iOS 26.4 Simulator only.
- Node 24 is the decided backend runtime; the machine has Node 26.8.1 only.

## References

Each source with the decision it informed. "[verified]" means the owner opened the page or ran the
command on 2026-11-26.

- https://docs.expo.dev/versions/latest/sdk/widgets — widget data model [verified]. A widget
  function is marked `'widget'`, has no hooks, async, imports or module-scope values, renders only
  `@expo/ui/swift-ui` components on iOS, needs `containerBackground(_, 'widget')`, and receives all
  data through props pushed by the app (`updateSnapshot`, `updateTimeline`). Informs D2: the app
  pushes a snapshot; no shared database is needed for this widget.
- https://docs.expo.dev/router/advanced/native-tabs — `NativeTabs` / `NativeTabs.Trigger` with
  `Icon sf|md|src` and `Label`, `role="search"`, `minimizeBehavior`, iOS 26 features need Xcode 26+ [verified].
  The page documents no bottom-accessory API, which is why D1 asks the Scan button as an open question.
- https://docs.expo.dev/guides/monorepos — npm workspaces with `"pkg": "*"`, Metro auto-config since SDK 52 [verified].
- https://docs.expo.dev/develop/unit-testing — `jest-expo` needs Jest 30 on SDK 58; Router tests need RNTL 14+ [verified].
- https://docs.expo.dev/versions/latest/sdk/dev-client — plugin options `toolsButton`, `skipOnboarding`, `showMenuAtLaunch` [verified].
- npm registry, 2026-11-26 23:20 ICT [verified]: expo 58.0.26, expo-router 58.0.33, expo-widgets 58.0.30,
  @expo/ui 58.0.30, expo-glass-effect 58.0.6, expo-sqlite 58.0.18, expo-symbols 58.0.5,
  react-native 0.88.1, react 19.3.0, @kingstinct/react-native-healthkit 16.2.0 (peer RN ≥ 0.79,
  react-native-nitro-modules ≥ 0.35), react-native-nitro-modules 0.37.2, @react-native-community/netinfo 12.0.1,
  hono 4.13.22, @hono/node-server 2.1.11, @hono/zod-validator 0.9.1, zod 4.6.7, drizzle-orm 0.45.4,
  jest 30.5.2, jest-expo 58.0.16, @testing-library/react-native 14.1.0 (peer `test-renderer` ^1.0.0),
  typescript 7.0.2 (the SDK 58 template pins ~6.0.3; the spike keeps 6.0.3).
  `expo-widgets@58.0.30` and `@expo/ui@58.0.30` were published during this session; patch releases move
  hourly, so the lockfile is the only version authority.
- `node_modules/@kingstinct/react-native-healthkit/app.plugin.js` [verified]: the package ships an Expo
  config plugin that adds the HealthKit entitlement, background delivery and both usage strings.
- `node_modules/@expo/ui/build/swift-ui/index.d.ts` [verified]: exports `Text`, `VStack`, `HStack`, `ZStack`,
  `Image`, `Gauge`, `ProgressView`, `GlassEffectContainer`, Shapes; `@expo/ui/swift-ui/modifiers` exports
  `containerBackground`, `font` (`size`, `weight`, `design: 'rounded'`), …
- Zed's summary report — stack choices carried into the spike (Expo SDK 58, dev build + CNG, NativeTabs,
  `expo-glass-effect` / `@expo/ui`, `expo-widgets`, `@kingstinct/react-native-healthkit`,
  `expo-sqlite` + Drizzle, Jest + jest-expo + RNTL).
- Ember `design-system.md` / `tokens.css` — palette, type, spacing and component mapping for D1.
- `SyncEnvelope.swift`, `web/core.js#winsLww`, `web/store.js` — naming and the LWW rule reused in D4.

## Goals

Exactly four probes. Each ends in pass, fail or partial with evidence committed under `evidence/`.

1. **Native tab bar with Liquid Glass + an Ember screen in RN**, close to the designed Ember Today
   screen (and to the current SwiftUI one). Decision it informs: can RN carry the approved design,
   and how much of it is real iOS 26 glass.
2. **One home screen widget built with `expo-widgets`** showing today's kcal. Decision: is a
   TypeScript widget real, and what does it cost.
3. **Write a meal (kcal + macros) to HealthKit and read it back.** Decision: does the third-party
   library work on the New Architecture with a dev build, without Swift.
4. **Offline-first sync** against a minimal local Hono API: add and edit meals offline into SQLite and
   an outbox, push when online, pull by cursor, idempotency keys, tombstones, Zod contract shared in
   `packages/api-contract`. Decision: is a hand-written sync layer tractable with the recommended stack.

Plus, for the report: app size, idle memory and cold start (Simulator, stated as such); the list of
problems met; the list of what only Phương can run on a real device; a go / no-go.

Pass means, per item:

| # | Pass when | Evidence |
|---|---|---|
| 1 | App built by `npx expo run:ios` runs on the iOS 26.4 Simulator; the tab bar is the system iOS 26 bar (translucent, floating) with the Ember tabs; the Ember screen renders every block of D1 in light and dark mode with numbers computed by `@coachcal/core`; at least one `expo-glass-effect` surface is visibly glass in a screenshot | screenshots (light, dark, content scrolled under glass), side-by-side with the SwiftUI snapshot, Jest output, findings answered |
| 2 | The widget is in the widget gallery, renders on the home screen in small and medium, shows the kcal pushed by the app, and resets to a new-day entry through a timeline | home-screen screenshots, Metro log of the pushed props, Jest output |
| 3 | After the in-app action, a meal is saved to Health and a read-back returns it with the same kcal and macros | on-screen result / log with the saved UUIDs and the read-back rows, screenshot, Jest output |
| 4 | The scripted scenario in Testing runs green: offline add + edit + delete survive an app kill, push once online, server state matches, outbox empties, a replayed push is a duplicate, an old cursor re-pulls harmlessly | Metro log, curl transcript, server log, screenshots, Jest output for API, contract and engine |

## Non-goals

- Camera / scan / analyze-food, review sheet, food search.
- Sign in (Apple / Google), sessions, IAP, telemetry, notifications, Live Activity, App Intents, watchOS.
- The production backend: no auth provider, no Gemini, no Caddy, no deploy, no Docker Compose for production.
- Android (no SDK on the machine). OTA updates. Migrating real data. Onboarding.
- Pixel-perfect Ember: the goal is "recognisably the designed screen and honest about the differences".
- Any change to `native/`, `web/`, `supabase/`, `scripts/`, `docs/` or root files outside `rn-spike/`.
- Merging into `main`, opening a PR into `main`, pushing the branch.
- Supabase in any form. EAS Build / Update. New accounts of any kind.

## Constraints

- **Branch and tree.** Branch `spike/rn-expo` from `main` at `64ce8a5`, checked out in the worktree
  `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-expo`. The main checkout stays on
  `main` with Phương's uncommitted work untouched. Only `rn-spike/**` is committed on the branch.
- **No Supabase, no EAS, no new accounts, no secrets.** Build locally with `npx expo run:ios`. Never commit `.env`.
- **Stack is fixed to the researched one.** Expo SDK 58, React Native 0.88.1, React 19.3, New Architecture,
  development build + CNG (`ios/` and `android/` are generated, never committed), Expo Router with
  `NativeTabs`, `expo-glass-effect` / `@expo/ui`, `expo-widgets`, `@kingstinct/react-native-healthkit`,
  `expo-sqlite` + Drizzle, Hono + Zod, Jest 30 + `jest-expo` + RNTL 14. Package versions come from
  `package-lock.json`; do not upgrade.
- **Package manager.** npm workspaces. The machine has no pnpm, yarn, nvm or Node 24. Code for the API
  must also run on Node 24: no Node-26-only APIs.
- **Native config has one writer.** `apps/mobile/app.config.ts` and `package-lock.json` change only as
  `plan.md` allows.
- **Simulator.** iOS 26.4, device `iPhone 17 Pro` (UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3`) unless a
  task says otherwise. Xcode 27.1 is the installed toolchain.
- **Identity.** Bundle id `com.nextlabs.coachcal.rnspike`, scheme `ccspike`, App Group
  `group.com.nextlabs.coachcal.rnspike`. Deliberately not the production ids, so a spike build never
  meets the App Store app, its App Group or its Health source.
- **Resources.** About 16 GB free disk at the start. Check `df -h /System/Volumes/Data` before a native
  build and stop if under 6 GB. At most two native builds at once. One Metro per port (8081 main, 8082
  secondary). One simulator per worker.
- **Invariants kept from `AGENTS.md`.** Uniform `{error:{code,details?}}` envelope; 500 only for genuine
  bugs, typed 400 otherwise; strict decoding on both ends (Zod `strictObject`, client rejects unknown keys);
  clients never talk to Postgres directly; a client clamps bad numeric input instead of throwing.
- **No new Markdown outside `rn-spike/docs/`** except the final report, which also lives there.
- **Commits.** Conventional Commits with scope `rn-spike` (`feat(rn-spike): …`, `test(rn-spike): …`,
  `docs(rn-spike): …`, `chore(rn-spike): …`). Commits are GPG-signed by repo config; commit on the task's
  branch only.

## Design

### D0. Monorepo and conventions

```text
rn-spike/
  package.json              npm workspaces: apps/*, packages/*; root scripts test / typecheck / api / mobile
  package-lock.json         single lockfile (npm ci in every worktree)
  tsconfig.base.json        strict; packages extend it
  apps/
    mobile/                 @coachcal/mobile — Expo app (Expo Router, NativeTabs, glass, widget, sync, HealthKit)
      app.config.ts         ALL native config for all four items
      src/app/              routes only: _layout.tsx, index.tsx (Ember), spike.tsx (console), placeholders
      src/features/ember/   EmberView (pure, props-driven), tokens, fixture data
      src/widgets/          CaloriesWidget.tsx ('widget' directive)
      src/data/db/          Drizzle schema, client, migrations
      src/data/sync/        outbox, push, pull, engine
      src/data/health/      HealthKit adapter
      src/data/widget/      snapshot publisher
      src/spike/            console actions, deep-link router, spikeLog
    api/                    @coachcal/api — Hono app, Postgres store, tests
  packages/
    core/                   @coachcal/core — pure TS: kcal rule, dayKey, totals, ring math
    api-contract/           @coachcal/api-contract — Zod wire contracts shared by app and API
  scripts/                  measure.sh, e2e-sync.sh, start-api.sh
  docs/                     spec.md, plan.md, build-recipe.md, reference/, report.md
  evidence/                 committed proof: screenshots, logs, transcripts, measurements
```

- Workspace packages are consumed as TypeScript source (`"main": "src/index.ts"`); Metro and Jest
  transpile them, there is no build step.
- `@coachcal/core` imports nothing from `react-native` or `node`. Feature code imports domain math from
  there, never re-implements rounding.
- Tests live next to the code as `*.test.ts(x)`; `npm test` at the root runs every workspace and is the
  one command the report quotes.

### D1. Native tabs, Liquid Glass, Ember screen (item 1)

**Tabs.** `src/app/_layout.tsx` renders `NativeTabs` from `expo-router/native-tabs` with the Ember tab
set and one debug tab: Ember (`sun.max`, route `index`), Progress (`chart.line.uptrend.xyaxis`), Coach
(`sparkles`), Profile (`person.crop.circle`), Spike (`ladybug`, route `spike`). Only Ember and Spike have
content; the other three are titled placeholders with no behaviour. On iOS 26 the bar is the system
floating glass bar; the screen must not draw its own tab bar or background behind it.

**Ember screen.** `src/features/ember/EmberView.tsx` is pure: it takes `meals`, `targets`, `now`,
`isOffline` and returns the screen. Blocks, top to bottom, following `docs/reference/ember-today-*.png`:

1. Header: weekday + date line, `Today` large title, a round glass icon button (calendar symbol) at the
   trailing edge. When `isOffline`, a yellow "Offline · syncs later" chip.
2. Week strip: seven day cells (weekday letter, day number), 44 pt targets, selected day on an orange tint.
3. Ember hero card: dark surface `#141210` (dark mode `#1C1A18`) with an orange radial glow at 30 %, a
   184 pt ring with a 16 pt stroke (`#FF7A1F` on `#3A342F`) showing kcal left in the centre, and on the
   right `Eaten`, `Goal`, `Burned` (burned is always 0 in the spike).
4. Macro grid 2 × 2: Protein, Carbs, Fat, Fiber, each `consumed / goal g` with a bar. Colors blue, teal,
   purple, green.
5. Streak card: flame symbol, `N-day streak` (N = 0 with fixture data; not a feature).
6. Meals section: header with a `Diary` trailing link, one row per meal (thumbnail placeholder, name,
   time, confidence chip, kcal).
7. A round orange Scan button next to the tab bar, visual only.

Tokens come from Ember `tokens.css` (light and dark) in `src/features/ember/tokens.ts`; no literal hex in
components. Numbers use the rounded system design (`fontFamily: 'ui-rounded'` on iOS) with monospaced
digits. Dynamic Type stays enabled. Symbols render through `expo-symbols`.

**Glass.** `expo-glass-effect`'s `GlassView` wraps at least the header icon button and one larger surface
(the week strip or the macro card). `@expo/ui`'s `GlassEffectContainer` is optional.

**Data.** In this task the screen is driven by fixture meals through `@coachcal/core` (`kcalFromMacros`,
`dayKey`, `sumMacros`, `ringProgress`). Integration (D5) swaps the fixture source for SQLite.

**Open questions the task must answer with evidence** (go into the findings list):

- (a) Is the tab bar the real iOS 26 Liquid Glass, and does it minimize on scroll (`minimizeBehavior`)?
- (b) Does `GlassView` blur and refract what scrolls behind it?
- (c) Is the rounded system design available through `ui-rounded`?
- (d) Do SF Symbols render through `expo-symbols` at every weight used?
- (e) Is there a bottom-accessory API for the Scan button in `NativeTabs`? If not, what is the least-bad
  workaround and what does it cost?
- (f) Did any of this need Swift, a config plugin, or a workaround? Write each one down.

### D2. Home screen widget (item 2)

- `src/widgets/CaloriesWidget.tsx`: `'widget'` directive, `@expo/ui/swift-ui` only, no hooks, no async,
  no imports, nothing from module scope inside the function. Root view carries
  `containerBackground(_, 'widget')`. Families `systemSmall` and `systemMedium`.
- Props: `{ date: 'YYYY-MM-DD', consumedKcal, goalKcal, proteinG, carbsG, fatG, proteinGoalG, carbsGoalG,
  fatGoalG }`. Small shows kcal left on the ember surface with the orange ring; medium adds the three
  macro bars. A props object with `date: ''` renders the placeholder ("Open CoachCal Spike").
- `src/data/widget/WidgetSnapshotPublisher.ts` owns pushing: `publish(snapshot)` calls `updateSnapshot`
  now and `updateTimeline` with two entries — the snapshot now, and a zeroed snapshot at local midnight
  — so the widget resets for a new day without the app running. `reload()` on app foreground.
  `buildTimeline(snapshot, now)` is a pure function and is unit-tested.
- The app calls `publish` whenever today's totals change (fixture data until integration, real totals after).
- Registration stays in `app.config.ts` (`name: 'CaloriesWidget'` must equal the `createWidget` name).

### D3. HealthKit write and read-back (item 3)

- `src/data/health/healthKitMeals.ts` wraps `@kingstinct/react-native-healthkit` behind a small typed
  interface so the console and tests do not import the library directly:
  - `requestMealAuthorization()` — read and write for dietary energy, protein, carbohydrates, fat total
    and the `meal` correlation type.
  - `saveMealToHealth(meal)` — one `HKCorrelation` of type meal holding the four quantity samples, with the
    meal name in metadata and a stable UUID derived from the meal id so a retry cannot double-save.
  - `readMealsFromHealth(dayKey)` — correlations of type meal written by this app in that day, returned as
    plain objects with kcal and macros.
  - `deleteMealFromHealth(meal)` — optional probe for the findings list: does deleting the correlation
    delete its samples?
- Mapping meal → samples → correlation is pure and unit-tested with the library mocked.
- Failures are typed (`HealthMealError`: `notAvailable`, `unauthorized`, `saveFailed`, `queryFailed`) and
  shown on the console; the app never crashes on a HealthKit refusal.

### D4. Offline-first sync (item 4)

**Contract** (`packages/api-contract/src/sync.ts`, Zod 4 `strictObject`, shared by app and API). Names
follow the existing Swift and web contracts so learnings transfer.

```text
Meal            { id: uuid, eatenAt: ISO-8601, name: string ≤ 200, kcal, proteinG, carbsG, fatG, fiberG,
                  updatedAt: integer ms }            // client wall clock at the edit; the LWW clock
MealRecord      = Meal + { deleted: boolean, serverVersion: integer > 0, acceptedOpId: uuid | null }
SyncOperation   { opId: uuid,                       // idempotency key
                  recordId: uuid, kind: 'upsert' | 'tombstone',
                  meal: Meal (required iff upsert), clientTimestamp: integer ms }
PushRequest     { operations: SyncOperation[1..50] }
PushResponse    { accepted: [{ opId, status: 'applied' | 'duplicate', record: MealRecord }] }
PullRequest     { cursor: integer ≥ 0, limit?: 1..500 (default 200) }
PullResponse    { rows: [{ seq: integer > 0, record: MealRecord }], cursor: integer, hasMore: boolean }
```

**API** (`apps/api`, Hono on `http://127.0.0.1:8787`, Node + `@hono/node-server`).

- `POST /v1/sync/push`, `POST /v1/sync/pull`, `GET /health`. Bearer token identifies the user; tokens
  come from a dev-only map (`dev-tokens.json`, checked in, one user). This is not auth.
- Postgres tables: `meals` (one row per record and user), `sync_ops` (`op_id` unique per user, the
  idempotency ledger), `sync_changes` (`seq BIGSERIAL`, the pull log: seq, user, record id, record jsonb).
- Push, per operation, in one transaction: an `op_id` seen before answers `duplicate` with the current
  record and writes nothing. An upsert with `meal.updatedAt` greater than the stored row's overwrites it
  and appends a change; an older upsert is a no-op that answers `applied` with the current record. A
  tombstone sets `deleted` and wins when its `clientTimestamp` is not older than the stored `updatedAt`.
  Every answer returns the server's current record so the client converges.
- Pull returns changes with `seq > cursor` in order, pages by `limit`, and a `hasMore` that is true only
  when more rows exist. Users never see each other's rows.
- Error envelope from `@coachcal/api-contract`: Zod failure → 400 `INVALID_REQUEST` with `details`;
  bad or missing token → 401 `UNAUTHORIZED`; an unexpected exception → 500 `INTERNAL`. Nothing else is a 500.
- Store behind a `query(sql, params)` port. Runtime evidence runs on real PostgreSQL 17 from the Homebrew
  binaries (`/opt/homebrew/opt/postgresql@17/bin`): a throwaway cluster in a temp dir on port 5433,
  never a registered service. Tests may use PGlite (`@electric-sql/pglite`, Postgres compiled to WASM,
  same SQL) or a disposable database.

**Client store** (`src/data/db`, `expo-sqlite` + Drizzle, WAL).

- `meals`: the contract's `Meal` columns plus `serverVersion`, `acceptedOpId`.
- `outbox`: `opId` (primary key), `recordId`, `kind`, `payload` (JSON of the `SyncOperation`), `createdAt`,
  `attempts`, `state` (`pending` | `quarantined`), `lastError`.
- `sync_state`: key / value for `cursor` and `deviceId`.
- A local write is one transaction: write the meal row, insert the outbox operation. A delete removes
  the row at once and queues a tombstone. "Has pending local intent" means an outbox row exists for the
  record id; there is no pending flag on `meals`.
- Migrations are generated with `drizzle-kit` and shipped in the app. If Drizzle blocks the task for
  about 45 minutes, fall back to `expo-sqlite`'s own SQL helpers and record why.

**Engine** (`src/data/sync/engine.ts`), injected with a `SyncStore` port, a `SyncTransport` port, a clock
and an `isOnline()` function, so it is unit-tested without React Native.

- `sync()`: push pending operations in FIFO batches of ≤ 50, then pull pages until `hasMore` is false.
- Push success: per batch, one transaction — remove each acked operation, write the acked record's
  `serverVersion` and `acceptedOpId` onto the local row, and overwrite the row with the server record
  unless another pending operation exists for that record (a newer local edit). A deleted record with no
  pending operation is removed locally.
- Pull: per page, one transaction — skip records with pending local intent, upsert the rest, remove
  records that are deleted, store the new cursor. Applying the same page twice changes nothing.
- Failure: network error or 5xx keeps the operations pending and retries with backoff; a 400 quarantines
  the batch with the error and stops; 401 stops. A quarantined operation is visible on the console and is
  never retried automatically.
- Triggers: app start, app foreground, network regained (NetInfo), 500 ms after a local write, and a
  manual console action. A sync already running coalesces into one follow-up run.
- Dev-only `setForcedOffline(boolean)` makes `isOnline()` false without touching the server, so the
  offline path can be scripted.

### D5. Spike console, deep links, evidence log (verification harness)

- `src/app/spike.tsx` is a plain debug screen, one card per item, each with buttons, a status line and a
  JSON result block, and a Sync card showing online / forced-offline state, outbox count, cursor and the
  last result. Every control has a `testID` of the form `spike:<item>:<control>`.
- Every action is also reachable by deep link `ccspike://spike?action=<name>`, so a shell script can
  drive the app with `xcrun simctl openurl`. Names: `seed`, `add-meal`, `edit-meal`, `delete-meal`,
  `sync`, `force-offline`, `force-online`, `health-request`, `health-save`, `health-read`,
  `health-delete`, `widget-publish`, `reset`.
- One helper, `spikeLog(item, event, data)`, prints `[spike] {json}` with an ISO timestamp. It is the
  machine-readable evidence: Metro's output is redirected to a file and the lines are quoted in
  `evidence/`.
- The first render of the Ember screen writes `first-render.txt` (ISO time) into the app's document
  directory; `scripts/measure.sh` reads it for cold start.

### D6. Measurements

All on the iOS 26.4 Simulator and labelled so. Both the Debug development build and a Release build
(`npx expo run:ios --configuration Release --no-bundler`).

| Metric | How | Said as |
|---|---|---|
| App size | `du -sk` of the built `.app`, and of a zip of it | MB, Simulator slice (arm64 + x86_64), not an App Store thinned size |
| Idle memory | launch, wait 15 s on Ember, then `Physical footprint` from `vmmap -summary` and RSS from `ps` | MB |
| Cold start | 5 runs: terminate, record host time, `xcrun simctl launch`, read `first-render.txt` | ms from the launch call to the first React commit; includes `simctl` overhead; not a frame time |

The SwiftUI app is not measured in this spike (building it needs a Tuist build outside the spike's
scope); the report says so rather than comparing.

## Error handling

- **API:** uniform envelope as in D4. Validation never returns 500. A bug returns 500 `INTERNAL` without a
  stack trace in the body; the stack goes to the server log.
- **Sync client:** errors are a typed `SyncError` (`offline`, `unauthorized`, `invalidRequest`, `server`,
  `transport`). The outbox is never emptied by a failed push. The cursor never advances without the page's
  writes. A quarantined operation needs a human action on the console (`reset`).
- **HealthKit:** typed `HealthMealError`; refusal or unavailability leaves the app usable.
- **Widget:** publishing is best effort; a failed publish is logged and does not affect the app. The widget
  function cannot throw into the app, so its arithmetic clamps (`Math.max(0, …)`).
- **Core:** clamps and flags, never throws, as the Swift engines do.

## Testing

**Unit and component (Jest 30).** One command: `npm test` at `rn-spike/` (every workspace).

- `packages/core`: kcal rule and rounding parity, `dayKey`, totals, ring clamping.
- `packages/api-contract`: every request and response schema; unknown keys rejected; `meal` required for
  an upsert and rejected for a tombstone.
- `apps/api` (`app.request`): upsert then pull; duplicate `opId` writes nothing and answers `duplicate`;
  older upsert does not overwrite; tombstone wins and loses by timestamp; pagination and `hasMore`; users
  isolated; 400 on an unknown key; 401 on a bad token.
- `apps/mobile`: engine against an in-memory `SyncStore` and a fake transport — offline add then push;
  pull applied twice is idempotent; pull skips records with pending intent; cursor and writes roll back
  together; retry and quarantine; edit then delete offline; a newer server record wins on ack; a new
  engine over the same store drains what a previous run left. `buildTimeline`. Meal → HealthKit payload
  mapping with the library mocked. `EmberView` renders the totals it is given. Console deep-link router.
- Tests assert behaviour and are named as sentences. No snapshot tests.

**End-to-end (scripted, `scripts/e2e-sync.sh`).** On the Simulator against the local API and PostgreSQL 17,
driven by deep links, observed through the `[spike]` log, `curl`, and screenshots:

1. Online: seed meals A and C, sync. Server has A and C.
2. Offline (server stopped): add B, edit A, delete C. Force-stop the app, relaunch, still offline: B
   present, A edited, C gone, outbox = 3.
3. Start the server, foreground the app: 3 operations pushed, outbox = 0, cursor advanced.
4. `curl` the pull with the old cursor: A (edited), B, C (deleted). Replay step 3's push body with `curl`:
   three `duplicate` answers, no new change rows.
5. Second device: a `curl` push edits B; the app pulls and shows the edit.

**Items 1–3 on the Simulator.** Item 1: screenshots in both appearances, with content scrolled behind the
glass surfaces. Item 2: add the widget from the gallery to the home screen in both families (long-press
automation with `axe` or the computer tools), publish from the app, screenshot; kill the app and confirm
the widget keeps its last value. Item 3: request, save, read back, screenshot the on-screen result;
optionally open Health.

**Done for the spike** is the `Done when` list in `plan.md`: every item pass, fail or partial with
evidence, `npm test` green, all worker threads closed, the report complete with a go / no-go.
