# Implementation plan: CoachCal React Native + Expo spike

Spec: `spec.md` in this directory. Owner: CoachCal bot. Date: 2026-11-26.

## Exit condition

Checked box by box at the end; a box is ticked only with evidence committed under `evidence/`.

- [ ] Spec and plan committed in `rn-spike/docs/` on branch `spike/rn-expo`.
- [ ] `npm test` green at `rn-spike/` (core, api-contract, api, mobile).
- [ ] The app built by `npx expo run:ios` runs on the iOS 26.4 Simulator (`iPhone 17 Pro`).
- [ ] Item 1 (tabs + glass + Ember): pass / fail / partial, with evidence.
- [ ] Item 2 (widget): pass / fail / partial, with evidence.
- [ ] Item 3 (HealthKit): pass / fail / partial, with evidence.
- [ ] Item 4 (offline sync): pass / fail / partial, with evidence.
- [ ] Measurements recorded (size, idle memory, cold start; Simulator, labelled).
- [ ] `docs/report.md` complete: 4-item table, measurements, problems, device-only list, go / no-go.
- [ ] Worker threads closed; child worktrees removed.

## Shape of the work

```text
T0 base (owner)
 └─┬─ T1 app shell + Ember      (Worker-S1, main worktree)      ─┐
   ├─ T2 widget                 (Worker-S2, worktree rn-spike-widget)  │
   ├─ T3 sync: API + contract + db + engine (Worker-G1, worktree rn-spike-sync)   │ parallel
   └─ T4 HealthKit + measure.sh (Worker-G2, worktree rn-spike-health) ─┘
        │
        └─ T5 merge into spike/rn-expo (owner)
             └─ T6 integration + Simulator runs + evidence (Worker-S1, main worktree)
                  └─ T7 measurements + evidence check (owner)
                       └─ T8 report, close threads, cleanup (owner)
```

T1–T4 never edit the same file; the table below is the contract. T5 is a plain merge. T6 is the
only task that touches every folder. Native builds run only in the main worktree (T0, T1, T6, T7):
one built worktree holds about 6 GB and the disk started with 16 GB free.

## Places

| What | Value |
|---|---|
| Main checkout (do not touch) | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app` (on `main`, holds Phương's uncommitted work) |
| Spike worktree, branch `spike/rn-expo` | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-expo` |
| Spike project root | `<spike worktree>/rn-spike` |
| T2 worktree, branch `spike/rn-expo-widget` | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-spike-widget` |
| T3 worktree, branch `spike/rn-expo-sync` | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-spike-sync` |
| T4 worktree, branch `spike/rn-expo-health` | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-spike-health` |
| Simulator (all native runs) | `iPhone 17 Pro`, iOS 26.4, UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3` |
| Metro | port 8081, main worktree only |
| API | `http://127.0.0.1:8787` |
| PostgreSQL 17 (throwaway) | port 5433, binaries `/opt/homebrew/opt/postgresql@17/bin` |
| Log directory | `/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs/` |
| Bundle id / scheme | `com.nextlabs.coachcal.rnspike` / `ccspike` |

## File ownership in T1–T4

"only" means the only writer; "—" means do not edit.

| Path (under `rn-spike/`) | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| `package-lock.json` | only (`npm install` allowed) | — (`npm ci`) | — (`npm ci`) | — (`npm ci`) |
| `apps/mobile/app.config.ts` | yes, except the two marked plugin blocks | the `expo-widgets` plugin block only | — | — |
| `apps/mobile/src/app/**` | only | — | — | — |
| `apps/mobile/src/features/ember/**` | only | — | — | — |
| `apps/mobile/src/spike/**` (except `types.ts`) | only | — | — | — |
| `apps/mobile/src/spike/types.ts` | — (frozen; import only) | — (frozen; import only) | — (frozen; import only) | — (frozen; import only) |
| `apps/mobile/src/widgets/**`, `apps/mobile/src/data/widget/**` | — | only | — | — |
| `apps/mobile/src/data/db/**`, `src/data/sync/**`, `src/data/api/**` | — | — | only | — |
| `apps/mobile/src/data/health/**` | — | — | — | only |
| `packages/core/**` | only | — | — | — |
| `packages/api-contract/**`, `apps/api/**` | — | — | only | — |
| `scripts/e2e-sync.sh`, `scripts/start-api.sh`, `apps/api/dev-tokens.json` | — | — | only | — |
| `scripts/measure.sh` | — | — | — | only |
| `docs/findings/T<n>-*.md` | own file | own file | own file | own file |
| `evidence/item<n>/` | `item1/` | — (T6 captures item 2) | `item4/` | `item3/`, `measurements/` |

T2, T3 and T4 cannot edit `src/spike/**` in their stage. `src/spike/types.ts` is frozen and holds the
shared `SpikeAction` shape: they type their exported action definitions with it
(`import type { SpikeAction } from '../spike/types'`) from their own `spikeActions.ts`, and list the
registration lines in their findings file; T6 registers them.

## Rules for every task

1. Work only inside your own worktree. Never run git commands that change the main checkout
   (`checkout`, `stash`, `reset`, `clean`), never edit files outside `rn-spike/`.
2. Commit on your task branch with Conventional Commits, scope `rn-spike`. No push, no merge, no PR.
3. `npm ci` at `rn-spike/` once at the start. `npm install` only where the table allows.
4. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before anything that runs CocoaPods or `expo run:ios`.
5. A command that can run over a minute writes to a log file in the log directory and gets a
   generous timeout. Never rerun a timed-out command unchanged; read its log first.
6. Native builds (`expo run:ios`, `pod install`, `prebuild`) only where your task says so, and only in
   the main worktree. Before one, run `df -h /System/Volumes/Data`; under 6 GB free, stop and report.
7. No Supabase, no EAS, no new accounts, no secrets, no changes outside the spike.
8. Do not add a dependency unless the spec names it. If one is unavoidable, say why in your report.
9. When stuck, read the official docs for the package in `node_modules/<pkg>` (README, types) before
   guessing. If still blocked after a real attempt, stop and report exactly what blocks you.
10. Finish with a report (see "Report format"). Evidence beats description: quote commands and output.

Driving the Simulator (installed and checked by the owner):

- Deep link: `xcrun simctl openurl <udid> "ccspike://spike?action=<name>"`.
- Screenshot: `xcrun simctl io <udid> screenshot <file.png>`.
- UI automation with `axe` 2.1.1: `axe describe-ui --udid <udid>`, `axe tap --label <text> --udid <udid>`,
  `axe touch -x <x> -y <y> --down --up --delay 1.2 --udid <udid>` (long press), `axe drag`, `axe swipe`,
  `axe batch` to run steps in order.
- Stop and relaunch the app: `xcrun simctl terminate <udid> com.nextlabs.coachcal.rnspike`, then
  `xcrun simctl launch <udid> com.nextlabs.coachcal.rnspike`.
- A background job may die when the command that started it ends. Start Metro inside the same script
  that drives the app, wait for `curl -s localhost:<port>/status` to answer `packager-status:running`,
  do the steps, then stop Metro at the end of that script.

Test facts the owner verified on this skeleton:

- RNTL 14 builds on `test-renderer` and its `render` is async: `await render(<X />)`, then `screen.getBy…`.
- Node packages test with `ts-jest`; TypeScript 6.0.3 needs `moduleResolution: 'node10'` plus
  `ignoreDeprecations: '6.0'` in each `jest.config.js` (already set).
- Do not put test files in `src/app/`: Expo Router treats every file there as a route. Tests live in
  `src/__tests__/` or next to the code outside `src/app/`.

## Report format (every task)

```text
Status: done | partial | blocked
Branch and commits: <branch>, <sha> <subject> per commit
Deliverables: one line each, done / partial / not done
Commands run: the ones that matter, with the key output lines (test summary, build result)
Evidence: paths under rn-spike/evidence/
Findings: answers to the task's questions, pitfalls, docs that were wrong, anything native you had to write
Not verified: what you could not run or observe, and why
Open questions: only those that need the owner's decision
```

---

## T0 — Base (owner)

Goal: a committing base that proves the toolchain before four workers build on it.

- Branch and worktree, `rn-spike/` skeleton: npm workspaces, `@coachcal/core`, `@coachcal/api-contract`,
  `@coachcal/api` (Hono `/health`), `@coachcal/mobile` from `create-expo-app` (default template, SDK 58).
- Every dependency for all four items installed and locked; all native config in `app.config.ts`
  (`expo-widgets` with `CaloriesWidget`, the HealthKit plugin, `expo-dev-client`, updates disabled).
- Skeleton `CaloriesWidget.tsx`, two-tab `NativeTabs` shell, one Jest test per workspace.
- Toolchain proof: `npx expo run:ios` builds and launches the skeleton on `iPhone 17 Pro` (iOS 26.4).
- `docs/spec.md`, this plan, `docs/build-recipe.md`, `docs/reference/*`.

Exit: build log shows the launch; `npm test` green; committed.

## T1 — App shell, NativeTabs, glass, Ember screen (Worker-S1)

- Worktree: main spike worktree. Branch: `spike/rn-expo`. Depends on: T0.
- Scope: `docs/spec.md` D1 and the T1 parts of D5.

Brief:

> Goal: build the React Native app shell and the Ember "Today" screen for the CoachCal RN spike, and
> prove how much of the iOS 26 design RN delivers without native code. This is spike item 1 of
> `rn-spike/docs/spec.md` (read `spec.md` D0, D1, D5 first; it is the contract).
>
> Context: `rn-spike/` is a throwaway Expo SDK 58 monorepo on branch `spike/rn-expo`, already scaffolded
> and building (see `docs/build-recipe.md`). The design to match is Ember v2:
> `docs/reference/ember-today-1-hero-macros.png`, `docs/reference/ember-today-2-meals-tabbar.png` and
> the token tables in `design-system.md` and `tokens.css` under
> `~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/coachcal-redesign-v2-7be4/`
> (the `index.html` there renders every screen). The current SwiftUI screen it replaces is
> `docs/reference/swiftui-today-light.png` / `-dark.png`, source
> `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/native/App/Features/Today/TodayView.swift` (read only).
>
> Output:
> 1. `src/app/_layout.tsx`: `NativeTabs` with five triggers — Ember (`sun.max`, `index`), Progress, Coach,
>    Profile, Spike (`ladybug`, `spike`) — using the SF Symbols from the Ember design system. Progress,
>    Coach and Profile are titled placeholders with no behaviour.
> 2. `src/features/ember/EmberView.tsx`: pure, props-driven (`meals`, `targets`, `now`, `isOffline`), every
>    block of spec D1 in light and dark mode from tokens in `src/features/ember/tokens.ts`; numbers come
>    from `@coachcal/core` (add `dayKey`, `sumMacros`, `ringProgress`, `clamp` there, with tests), never
>    hard-coded in JSX. Fixture meals and targets live in `src/features/ember/fixture.ts` and use the same
>    field names as the contract `Meal` in spec D4 (plus `fiberG`).
> 3. Glass: `expo-glass-effect` `GlassView` on the header icon button and on one larger surface. Scan
>    button: round orange glass button next to the tab bar, visual only.
> 4. `src/spike/` (`types.ts` is frozen; build next to it): a `spikeLog(item, event, data)` helper that prints `[spike] {json}` with an ISO
>    timestamp; an action registry `registerSpikeAction({ name, item, title, run })`; a deep-link router
>    so `ccspike://spike?action=<name>` runs a registered action; and `src/app/spike.tsx`, a debug console
>    with one card per item, buttons with `testID="spike:<item>:<control>"`, a status line and a JSON
>    result block per card. In this task only the item-1 card and a fixture-backed `seed` action work; the
>    cards for items 2–4 render "not wired yet". The first Ember render writes `first-render.txt` (ISO
>    time) to the app document directory.
> 5. Jest with `jest-expo/ios` + RNTL 14 (`test-renderer`; `render` is async there, so `await render(…)`):
>    `EmberView` renders the totals it is given; core math; the deep-link router. No test file goes in
>    `src/app/`.
> 6. Evidence under `evidence/item1/`: light and dark screenshots of Ember on `iPhone 17 Pro` (iOS 26.4),
>    one with content scrolled behind the glass surfaces and the tab bar, and a side-by-side image
>    `side-by-side-swiftui-vs-rn.png` (SwiftUI snapshot next to your screenshot).
> 7. `docs/findings/T1-app-shell.md`: answers to spec D1 questions (a)–(f), each with what you observed;
>    every workaround, config plugin or native file you needed; every place the docs were wrong.
>
> Build and run: `npx expo run:ios` (see `docs/build-recipe.md`; export `LANG`/`LC_ALL` as UTF-8 first).
> Metro on port 8081; redirect its output to a log file.
>
> Done when: the app built by `npx expo run:ios` shows the NativeTabs bar and the Ember screen in light
> and dark mode with every D1 block; a GlassView surface is visibly glass in a committed screenshot;
> `npm test` passes at `rn-spike/`; `npx tsc --noEmit` passes in `apps/mobile`; evidence and
> `docs/findings/T1-app-shell.md` are committed on `spike/rn-expo`; your report is in the plan's format.
>
> Limits: edit only the paths the plan's ownership table gives T1. Do not touch `src/widgets/**`,
> `src/data/**` or `packages/api-contract/**`. No new feature beyond spec D1 and D5. No Supabase, EAS,
> accounts or secrets. No push, merge or PR. If NativeTabs cannot do something the design needs, record
> the cheapest workaround and move on; do not write Swift.

## T2 — Widget (Worker-S2)

- Worktree: `.worktrees/rn-spike-widget`. Branch `spike/rn-expo-widget`. Depends on: T0.

Brief:

> Goal: prove that a real iOS home screen widget can be written in TypeScript with `expo-widgets` for the
> CoachCal RN spike. This is spike item 2 of `rn-spike/docs/spec.md` (read D0, D2, D5).
>
> Context: `rn-spike/` is a throwaway Expo SDK 58 monorepo. Your worktree is on branch
> `spike/rn-expo-widget`, cut from `spike/rn-expo`. `apps/mobile/app.config.ts` already registers a widget
> named `CaloriesWidget` (families small and medium) through the `expo-widgets` plugin, and
> `apps/mobile/src/widgets/CaloriesWidget.tsx` holds a compiling skeleton. The design is
> `docs/reference/ember-widgets.png` (small: ember surface, orange ring, "816 kcal left"; medium: plus three
> macro bars). The SwiftUI widget it replaces is `docs/reference/swiftui-widget-normal-light.png`. The
> official rules are in `node_modules/expo-widgets/README.md` and
> https://docs.expo.dev/versions/latest/sdk/widgets (the widget function has no hooks, async, imports or
> module-scope values; data arrives only through props pushed by the app).
>
> Output:
> 1. `src/widgets/CaloriesWidget.tsx`: small and medium layouts per spec D2 and the design, ember tokens
>    declared inside the widget function (module-scope constants are not available there), root view with
>    `containerBackground(_, 'widget')`, `environment.widgetFamily` for the two layouts, a placeholder when
>    `props.date === ''`.
> 2. `src/data/widget/WidgetSnapshotPublisher.ts`: `buildTimeline(snapshot, now)` (pure: the snapshot now,
>    a zeroed snapshot at local midnight) and `publish(snapshot)` (`updateTimeline`, then `reload()` on app
>    foreground through a listener the app can start). Pure functions unit-tested; the widget file itself
>    stays too thin to need a test.
> 3. `src/data/widget/spikeActions.ts`: export `widgetSpikeAction`, typed with the frozen
>    `SpikeAction` from `src/spike/types.ts` (`{ name: 'widget-publish', item: 'widget', title: 'Publish snapshot', run }`),
>    which pushes a fixture snapshot. You cannot edit `src/spike/**`; the integration task registers it.
>    Write the exact registration line in your findings file.
> 4. No native build in this task: the disk has no room for a second built worktree (about 6 GB each),
>    so the widget first runs on a simulator in T6. Instead, check your widget file against every
>    `'widget'` rule line by line, and write `docs/findings/T2-widget.md` as the integration task's
>    checklist: how to place the widget on the home screen with `axe` (long press, "+", gallery, add),
>    what to look for in each family, and the ways a first run can fail (missing `containerBackground`,
>    a component or modifier `@expo/ui/swift-ui` does not support, a name that differs from the config,
>    a value read from module scope) with the fix for each. Add to it: which `@expo/ui/swift-ui`
>    components and modifiers you used and which were missing; what the gallery shows before the first
>    launch (`initialLayout`); how to prove the midnight timeline entry on a device; and every place
>    the docs were wrong.
>
> Done when: `npm test` and `npx tsc --noEmit` pass in your worktree; the widget, the publisher and the
> `buildTimeline` tests are complete; `docs/findings/T2-widget.md` holds the checklist; everything is
> committed on `spike/rn-expo-widget` with your report in the plan's format, which says plainly that
> the widget has not run on a simulator yet.
>
> Limits: no `expo run:ios`, no `pod install`, no `prebuild` — the main worktree is the only place that
> builds. Edit only the paths the ownership table gives T2 (in `app.config.ts` only the `expo-widgets`
> plugin block; `npm ci`, no `npm install`). No new feature. No Supabase, EAS, accounts, secrets, push,
> merge or PR.

## T3 — Sync: contract, API, local store, engine (Worker-G1)

- Worktree: `.worktrees/rn-spike-sync`. Branch `spike/rn-expo-sync`. Depends on: T0.

Brief:

> Goal: write the offline-first sync of the CoachCal RN spike — the Zod contract, a minimal Hono API on
> PostgreSQL, the SQLite outbox store, and the sync engine — with Jest tests for each. This is spike item
> 4 of `rn-spike/docs/spec.md`. Read D4 line by line: it is the contract between your parts, and the
> integration task wires them into the app later.
>
> Context: `rn-spike/` is a throwaway Expo SDK 58 monorepo. Your worktree is on branch
> `spike/rn-expo-sync`. Existing pieces: `packages/api-contract/src/index.ts` (error envelope schema),
> `apps/api/src/app.ts` (Hono app with `/health`); `expo-sqlite`, `drizzle-orm`,
> `@react-native-community/netinfo`, `hono`, `@hono/node-server`, `@hono/zod-validator`, `zod` are installed
> and locked. References you may read (not edit): `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/web/core.js`
> (`winsLww`) and `web/store.js` (the localStorage outbox), and
> `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/native/Modules/CoachCalCore/Sources/CoachCalCore/SyncEnvelope.swift`
> (the current wire contracts; the spec keeps their names).
>
> Output, in this order; the tests of a step pass before the next step starts:
> 1. `packages/api-contract/src/sync.ts`: the schemas of spec D4 as Zod 4 `strictObject`; export the
>    inferred types from `src/index.ts`. Tests: every schema; unknown key rejected; `meal` required for
>    `upsert` and rejected for `tombstone`; limits (1..50 operations, name ≤ 200, numbers ≥ 0).
> 2. `apps/api/src/`: `sync.ts` (routes `POST /v1/sync/push` and `POST /v1/sync/pull`), `store.ts` (the
>    `query(sql, params)` port), `store.postgres.ts` (postgres.js), `schema.sql` (tables `meals`,
>    `sync_ops`, `sync_changes` with `seq BIGSERIAL`), `auth.ts` (bearer token → user id from
>    `apps/api/dev-tokens.json`, checked in, with `"spike-dev-token"` and `"spike-dev-token-2"` as the two
>    tokens), and the error handling of spec D4. Tests with `app.request` on every case under "apps/api"
>    in spec Testing, using `@electric-sql/pglite` as a Postgres that starts in memory inside Jest. The
>    only dependency change you may make: add `postgres` (dependency) and `@electric-sql/pglite`
>    (devDependency) to `apps/api/package.json`, run `npm install` once from `rn-spike/` in your worktree,
>    and commit the lockfile change.
> 3. `apps/mobile/src/data/db/`: Drizzle schema for `meals`, `outbox`, `sync_state`; a client that opens
>    `coachcal.db` with WAL; migrations generated by `npx drizzle-kit@0.31.11 generate` from an
>    `apps/mobile/drizzle.config.ts` (do not edit `apps/mobile/package.json`) and applied at open.
>    `apps/mobile/src/data/api/syncClient.ts`: a fetch-based `SyncTransport` that parses with the contract
>    schemas (unknown key → typed error) and reads base URL and token from `expo-constants` extra
>    (`apiBaseUrl`, default `http://127.0.0.1:8787`; `apiToken`, default `spike-dev-token`).
> 4. `apps/mobile/src/data/sync/`: `types.ts` (the `SyncStore` and `SyncTransport` ports),
>    `repository.ts` (local write = one transaction: meal row + outbox operation; delete = remove row +
>    tombstone; `hasPendingIntent(recordId)` = an outbox row exists), `engine.ts` per spec D4 (push FIFO
>    ≤ 50, pull pages, pending-intent skip, one transaction per batch and per page, backoff, quarantine
>    on 400, stop on 401, coalescing, `setForcedOffline`), `triggers.ts` (app start, foreground, NetInfo,
>    500 ms after a local write). Export `createSyncEngine(deps)` and a `getSyncRuntime()` that wires the
>    real store, transport and triggers; the integration task calls them.
> 5. Engine tests against an in-memory `SyncStore` and a fake transport — every case under "apps/mobile"
>    in spec Testing that names the engine.
> 6. `apps/mobile/src/data/sync/spikeActions.ts`: export action definitions typed with the frozen
>    `SpikeAction` from `src/spike/types.ts` (`item: 'sync'`) for `seed`, `add-meal`, `edit-meal`,
>    `delete-meal`, `sync`, `force-offline`, `force-online`, `reset`. They call the real repository and
>    engine, so on a device `add-meal` writes SQLite and the outbox: `seed` inserts fixture meals A and C
>    through the repository, `edit-meal` changes A's kcal, `delete-meal` deletes C, `sync` runs one manual
>    sync and reports pushed and pulled counts, `force-offline` / `force-online` toggle
>    `setForcedOffline`, `reset` empties the local tables and the cursor. Log through the action's
>    `ctx.log`. You cannot edit `src/spike/**`; write the registration lines in your findings file.
> 7. `scripts/start-api.sh`: start a throwaway PostgreSQL 17 cluster (`initdb` into a temp dir, `pg_ctl`
>    on port 5433, binaries `/opt/homebrew/opt/postgresql@17/bin`), apply `schema.sql`, start the API on
>    8787, and print how to stop both. `scripts/e2e-sync.sh`: the steps of spec Testing "End-to-end" that
>    need no app (`curl` only): push A and C, replay the push (duplicates), pull with cursor 0 and with an
>    old cursor, user 2 sees nothing. Keep the app-driven steps as commented placeholders for the
>    integration task.
> 8. Evidence under `evidence/item4/`: Jest output and the `curl` transcript of `e2e-sync.sh` against
>    real PostgreSQL 17. `docs/findings/T3-sync.md`: what Drizzle and PGlite made easy or hard, docs that
>    were wrong, the registration lines, and everything left for the device run.
>
> Done when: `npm test` passes at `rn-spike/` and `npx tsc --noEmit` passes in `apps/api`,
> `packages/api-contract` and `apps/mobile`; `scripts/start-api.sh` brings up PostgreSQL 17 and the API,
>    and `scripts/e2e-sync.sh` runs green with its transcript saved; the server and the cluster are
>    stopped afterwards; everything is committed on `spike/rn-expo-sync` with your report in the plan's
>    format.
>
> Limits: this task needs no native build — do not run `expo run:ios`, `pod install` or `prebuild`; you
> will not see the engine run on a simulator, the integration task does that. Edit only the paths the
> ownership table gives T3. If Drizzle blocks you for about 45 minutes, fall back to `expo-sqlite`'s SQL
> helpers and say why. No real auth. No Supabase, EAS, accounts, secrets, push, merge or PR. Node is
> 26.8.1 here; write for Node 24 too.

## T4 — HealthKit and measurement script (Worker-G2)

- Worktree: `.worktrees/rn-spike-health`. Branch `spike/rn-expo-health`. Depends on: T0.

Brief:

> Goal: write the HealthKit write / read-back adapter for the CoachCal RN spike with tests, and the script
> that measures app size, idle memory and cold start. This is spike item 3 of `rn-spike/docs/spec.md`
> (read D3, D5, D6).
>
> Context: `rn-spike/` is a throwaway Expo SDK 58 monorepo. Your worktree is on branch
> `spike/rn-expo-health`. `@kingstinct/react-native-healthkit` 16.2.0 and `react-native-nitro-modules`
> 0.37.2 are installed and locked, and `apps/mobile/app.config.ts` already applies the library's config
> plugin (HealthKit entitlement and usage strings). The library's API is in its
> `node_modules/@kingstinct/react-native-healthkit/README.md`, `src/` types and `lib/` typings — read them
> before writing code; do not guess function names. The contract `Meal` will have the fields of spec D4
> (`id`, `eatenAt`, `name`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`, `updatedAt`); declare that shape
> locally in your folder, do not import from `packages/api-contract`.
>
> Output:
> 1. `apps/mobile/src/data/health/healthKitMeals.ts` per spec D3: `requestMealAuthorization()`,
>    `saveMealToHealth(meal)`, `readMealsFromHealth(dayKey)`, `deleteMealFromHealth(meal)`, and the typed
>    `HealthMealError`. One meal is one correlation of type meal with four quantity samples (dietary energy
>    in kcal, protein, carbohydrates, fat total in grams), the meal name in metadata, and a stable UUID
>    derived from the meal id so a retry cannot save twice.
> 2. `mealToHealthKit.ts`: the pure mapping (meal → samples → correlation payload) and the pure read-back
>    reduction (correlations → meals with kcal and macros), unit-tested with the library mocked by a manual
>    mock (`__mocks__/@kingstinct/react-native-healthkit.ts`). Tests: one meal maps to four samples with the
>    right identifiers and units; a meal of 624 kcal reads back as 624; an unauthorized query becomes
>    `HealthMealError('unauthorized')` and never throws out of the adapter; an unavailable HealthKit store
>    (iPad-like) becomes `notAvailable`.
> 3. `apps/mobile/src/data/health/spikeActions.ts`: export action definitions typed with the frozen
>    `SpikeAction` from `src/spike/types.ts` (`item: 'health'`) for `health-request`,
>    `health-save`, `health-read`, `health-delete` — where `health-save` writes a fixture meal
>    (`Chicken rice bowl`, 624 kcal, 38 g protein, 70 g carbs, 18 g fat, eaten today at 12:40) and
>    `health-read` returns the read-back for today. You cannot edit `src/spike/**`; write the
>    registration lines in your findings file.
> 4. `scripts/measure.sh` (argument `debug` or `release`), per spec D6. The built app is at
>    `~/Library/Developer/Xcode/DerivedData/CoachCalSpike-*/Build/Products/<Debug|Release>-iphonesimulator/CoachCalSpike.app`
>    (take the newest); report `du -sk` of the `.app` and of a zip of it. Then launch it on the simulator, wait 15 s,
>    read `Physical footprint` from `vmmap -summary` and RSS from `ps`; then 5 cold starts (terminate,
>    record host time in ms, `xcrun simctl launch`, poll for `first-render.txt` in the app container from
>    `xcrun simctl get_app_container <udid> com.nextlabs.coachcal.rnspike data`, report each and the
>    median). Print a table and write `evidence/measurements/<debug|release>.txt`. The simulator UDID is
>    `85024D2F-71DE-43C0-8E11-CE58F4578FC3`. You cannot run it end to end yet (the app has no marker file
>    until integration); make it correct by reading, dry-run what you can (`bash -n`, the size branch on
>    the existing Debug build if one exists), and say what is unverified.
> 5. `docs/findings/T4-healthkit.md`: the exact library calls you used with the file and line of their
>    declaration; anything the README gets wrong; what must be observed on a simulator (authorization
>    sheet, Health app, whether deleting a correlation deletes its samples).
>
> Done when: `npm test` passes at `rn-spike/` and `npx tsc --noEmit` passes in `apps/mobile`;
> `scripts/measure.sh` passes `bash -n` and its size branch runs; everything is committed on
> `spike/rn-expo-health` with your report in the plan's format.
>
> Limits: this task needs no native build — do not run `expo run:ios` or `pod install`; you will not see
> HealthKit run on a simulator, the integration task does that. Edit only the paths the ownership table
> gives T4; `npm ci` only. No new dependencies. No Supabase, EAS, accounts, secrets, push, merge or PR.

## T5 — Merge (owner)

For each of `spike/rn-expo-sync`, `spike/rn-expo-health`, `spike/rn-expo-widget`, after T1 is on
`spike/rn-expo`: `git merge --no-ff <branch>` in the spike worktree. `package-lock.json` conflicts are
settled by taking the T1 side and running `npm install` once. Then `npm install`, `npm test`,
`npx tsc --noEmit` in every workspace, `npx expo run:ios`. Any breakage goes back to the owning worker
with `rework`.

## T6 — Integration and Simulator runs (Worker-S1)

- Worktree: main spike worktree. Branch `spike/rn-expo`. Depends on: T5.

Brief:

> Goal: make the four spike items run together in one app on the iOS 26.4 Simulator and capture the
> evidence the spike report needs. `rn-spike/docs/spec.md` D5 and Testing are the contract; read the
> four `docs/findings/T*.md` first — each lists the registration lines and the open device questions
> for its part.
>
> Output:
> 1. Register the exported spike actions of T2, T3 and T4 in `src/spike/` so every deep-link name of spec
>    D5 works, and fill the item 2–4 cards of the console.
> 2. Bind data: Ember and the widget publisher read today's meals from the SQLite repository (T3), so
>    `seed`, `add-meal`, `edit-meal`, `delete-meal` change what Ember shows and what the widget receives.
>    Start the sync engine's triggers at app start.
> 3. Run, on `iPhone 17 Pro` (iOS 26.4), with the Metro log going to a file:
>    - `scripts/start-api.sh`, then `scripts/e2e-sync.sh` end to end including the app-driven steps
>      (stop the server for the offline step; force-stop and relaunch the app with `xcrun simctl`).
>    - Item 2: follow `docs/findings/T2-widget.md`: place the widget on the home screen in both families,
>       change today's meals in the app, confirm the widget follows; kill the app and confirm the widget
>       keeps its last value. If it fails at first run, fix it and record what it was.
>    - Item 3: `health-request`, `health-save`, `health-read`, `health-delete` on the simulator; note
>       whether the authorization sheet appeared, what Health shows, and whether deleting the correlation
>       removed its samples.
>    - Item 1: refresh the screenshots if the bound data changed the look.
> 4. Evidence under `evidence/item2/`, `evidence/item3/`, `evidence/item4/`: screenshots, `[spike]` log
>    excerpts, `curl` transcripts. `docs/findings/T6-integration.md`: the result per item as pass, fail
>    or partial with the reason; every integration bug you fixed; anything that only a real device or
>    Phương's account can show.
>
> Done when: all five end-to-end steps of spec Testing ran and their evidence is committed; each of the
> four items has a pass, fail or partial line with evidence in `docs/findings/T6-integration.md`;
> `npm test` and `tsc --noEmit` pass; the API and the PostgreSQL cluster are stopped; everything is
> committed on `spike/rn-expo`.
>
> Limits: you may now edit any file under `rn-spike/`. Keep fixes small and tested. No new feature. No
> Supabase, EAS, accounts, secrets, push, merge or PR.

## T7 — Measurements and evidence check (owner)

1. Debug build: `scripts/measure.sh debug`. Release build: `npx expo run:ios --configuration Release
   --no-bundler`, then `scripts/measure.sh release`.
2. Re-run the checks behind every pass line myself (`Prove It Works`): open each screenshot, re-read each
   log excerpt against the claim, run `npm test` and `e2e-sync.sh` once more.
3. Record each number with what limits it and what could have distorted it.

## T8 — Report, threads, cleanup (owner)

1. `docs/report.md` in Vietnamese: 4-item table with evidence, measurements (Simulator), problems met,
   device-only list for Phương, go / no-go with reasons, links to docs read.
2. Close each worker thread after its result is checked. Remove the three child worktrees and their
   merged branches. Keep `.worktrees/rn-expo` so Phương can open the app; say how much disk it holds.
