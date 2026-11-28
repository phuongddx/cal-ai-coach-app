# CoachCal

CoachCal is an AI calorie coach for iOS: photograph a meal, get calories and macros in seconds, then
correct the estimate. It is built on honesty: transparent billing with in-app cancel, a visible AI
confidence on every scan, and ED-safe guardrails.

## What is in this repository

| Path | What it is |
|---|---|
| `apps/mobile/` | The iOS app: React Native + Expo (SDK 58), Expo Router, local SQLite, the Ember design |
| `apps/api/` | The backend: Hono on Node 24 and PostgreSQL 17 (auth, scan, lookup, sync, account, webhook), SQL migrations, a Docker Compose deploy kit |
| `packages/core/` | Pure TypeScript domain shared by the app and the API (kcal arithmetic, targets, streaks, sync rules) |
| `packages/api-contract/` | Zod wire contracts and golden fixtures shared by the app and the API |
| `scripts/rn/` | Gates and tools: parity gate, token generator, API start/stop, smoke scripts, evidence harness |
| `docs/` | `rn-migration/` (the migration record), `design/ember/` (the design), `engineering/` (conventions, infrastructure, stack) |
| `supabase/`, `scripts/*.ts` | The previous Supabase backend and its Deno harnesses (see the last section) |

`AGENTS.md` is the guide for contributors and agents; `ARCHITECTURE.md` is the one-page map.

## Install

Node 24 or newer, then at the repository root:

```sh
npm ci
```

## Run

```sh
npm run mobile                      # Metro for the development client (expo start --dev-client)
npm run api                         # the API with file watching; needs the environment of apps/api/.env.example
bash scripts/rn/start-api.sh        # alternative: a throwaway PostgreSQL 17 (5433) + the API (8787) for local work
bash scripts/rn/start-api.sh stop   # stop both and delete the throwaway cluster
```

The app talks to `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`). It needs a development build
(HealthKit, camera, Sign in with Apple, widgets do not run in Expo Go); Xcode is required for that
and for the Simulator. What builds on a Mac, and the pitfalls, are in `docs/rn-migration/build-recipe.md`.

## Test

```sh
npm run typecheck                   # typed routes, then tsc in every workspace
npm test                            # Jest in every workspace; SQL suites skip without a database
npm run parity:check                # the parity gate over docs/rn-migration/parity.tsv
bash scripts/rn/gate.sh             # the three above, one gate on the machine at a time
```

The API SQL suites run against the PostgreSQL that `scripts/rn/start-api.sh` starts. CI
(`.github/workflows/rn-ci.yml`) runs `npm ci`, typecheck, test and the parity gate on Ubuntu.

## Build

The app is built as a development client with Expo Continuous Native Generation (`ios/` is generated,
never committed): `npm run prebuild:ios --workspace @coachcal/mobile`, then `npm run ios --workspace
@coachcal/mobile`, following `docs/rn-migration/build-recipe.md`. `node scripts/rn/check-artifact-compliance.mjs
<CoachCal.app>` checks entitlements, usage strings and the privacy manifest of the result. The API
image is built from the repository root with `docker build -f apps/api/Dockerfile -t coachcal-api .`.
No App Store or TestFlight submission is set up from this app yet.

## The migration record

The SwiftUI app and the Supabase backend were replaced by this stack in November 2026. The record is
in `docs/rn-migration/`: `spec.md` (decisions and invariants), `plan.md`, `parity.tsv` (one row per
feature of the old app, with status and evidence), `findings/` and `evidence/`. The git tag
`archive/swiftui-final` holds the last commit that contained the SwiftUI app.

## `supabase/` and the Deno scripts

`supabase/` (edge functions, migrations, Deno tests), `deno.lock` and the Deno harnesses under
`scripts/` (`run-golden-eval.ts`, `verify-e2e-sync.ts`, `smoke-scan-pipeline.ts`,
`export-contract-fixtures.ts`, `proof-capture/`) belong to the previous backend. The app no longer calls
it, and they are redundant once the hosted Hono backend runs; they are kept until then and are not
developed further. The deploy steps for the Hono backend are in `docs/rn-migration/deploy-vps.md`; they have not been run
on a real server.
