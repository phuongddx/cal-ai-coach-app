# Architecture

CoachCal is a local-first AI calorie coach: a React Native + Expo iOS app (`apps/mobile`) backed by a
Hono API on PostgreSQL 17 (`apps/api`). Meal photos are analyzed server-side (the VLM never emits
kcal; arithmetic is grounded and deterministic), diary data is owned by a local SQLite store with an
outbox/last-writer-wins sync path for `diary_entries` only, and the API process holds no direct table
privileges.

This file is a thin map. Behavior, commands, and conventions live in the authorities linked below — it
intentionally does not restate them.

## The system

```text
iOS app (apps/mobile)  ── HTTPS, bearer session ──►  Hono API (apps/api)  ──►  PostgreSQL 17
  local SQLite (Drizzle)                               auth, scan, lookup,       SECURITY DEFINER functions;
  outbox + sync engine                                 sync, account, webhook     the API role has no table privilege
  design system (Ember tokens)                            │
  HealthKit, camera, widget                               └── VLM (Gemini), FDC / Open Food Facts / FatSecret
                                                              RevenueCat webhook in, Apple/Google sign-in
```

- **App.** Expo Router app with a development build (no Expo Go). Screens follow the Ember design.
  Writes go to SQLite first; `notifyLocalMutation()` fans out to sync, notifications and the widget.
- **API.** Node 24 + Hono. Routes: `POST /v1/scan`, `/v1/barcode/resolve`, `/v1/foods/search`,
  `/v1/sync/push`, `/v1/sync/pull`, `DELETE /v1/account`, `/v1/auth/*` (Apple, Google, e-mail code,
  refresh, sign-out), `POST /webhooks/revenuecat`, `GET /health`. Shared TypeScript lives in
  `packages/core` (pure domain) and `packages/api-contract` (zod wire contracts).
- **PostgreSQL 17.** Schema and functions in `apps/api/migrations/*.sql`. The API connects as
  `coachcal_api`, which can only execute the SQL functions; the owner role runs migrations.
- **Supabase functions that remain.** `supabase/` (edge functions `analyze-food`, `barcode-resolve`,
  `food-search`, `delete-account`, `rc-webhook`, their Deno tests and migrations) is still in the tree,
  not developed further. The app no longer calls it (the parity gate fails on a Supabase reference in
  `apps/` and `packages/`). It goes when the hosted Hono backend runs; the deploy steps are
  `docs/rn-migration/deploy-vps.md`, not yet run on a real server.

## Layout model

| Path | Model | Authority |
| --- | --- | --- |
| `apps/mobile/` | Expo app: `src/app` routes, `src/design`, `src/features`, `src/data`, `src/platform`, `src/debug`, `src/spike`, `modules/` | `apps/mobile/app.config.ts`, `package.json` |
| `apps/api/` | Hono API, SQL migrations, VPS deploy kit | `apps/api/package.json`, `src/app.ts` |
| `packages/core/` | Pure domain (no `react-native`, no `node:` imports) | `packages/core/src/index.ts` |
| `packages/api-contract/` | Zod wire contracts + `golden/` fixtures | `packages/api-contract/src/index.ts` |
| `scripts/rn/` | Gates and tools: parity, tokens, typed routes, API start/stop, evidence, compliance | script headers |
| `supabase/` | Legacy edge functions + migrations (Deno 2, Postgres 17) | `supabase/functions/deno.json`, `supabase/config.toml` |
| `scripts/*.ts`, `scripts/*.mjs`, `scripts/proof-capture/` | Deno/Node harnesses of the Supabase stack | script headers |
| `docs/rn-migration/` | The migration record: spec, plan, parity table, findings, evidence | `README.md` there |
| `docs/design/ember/` | The Ember design: tokens, frames, design system | `README.md` there |
| `docs/engineering/` | Stable engineering knowledge (conventions, infra, stack) | files in this directory |
| `docs/features/` | Feature specs (starter; currently empty) | `.agents/templates/spec.md` |
| `docs/superpowers/` | Historical plans and specs | — |
| `plans/` | Dated execution reports and proof records | `plans/reports/` |
| `.agents/` | Agent starter structure: skills, policies, hooks, templates | `.agents/templates/` |
| `.planning/` | Live planning state (gitignored) | — |

The SwiftUI app was removed in unit U-70; the tag `archive/swiftui-final` holds the last commit with it.

## Deeper reading

- Engineering ground truth: `docs/engineering/conventions.md`,
  `docs/engineering/infrastructure.md`, `docs/engineering/tech-stack.md`.
- The decisions and invariants of the stack: `docs/rn-migration/spec.md`; the plan and the parity
  table: `docs/rn-migration/plan.md`, `docs/rn-migration/parity.tsv`.
- Historical design/execution: `docs/superpowers/`, `plans/reports/`.
- Contributor guide for agents and people: `AGENTS.md`; setup and commands: `README.md`.
