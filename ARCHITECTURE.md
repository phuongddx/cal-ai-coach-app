# Architecture

CoachCal is a local-first AI calorie coach: a SwiftUI iOS app + widget backed by
Supabase (Postgres 17, Deno edge functions). Meal photos are analyzed server-side
(VLM never emits kcal; arithmetic is grounded and deterministic), diary data is
owned by a local GRDB store with an outbox/LWW sync path for `diary_entries`
only, and clients hold no direct table privileges.

This file is a thin map. Behavior, commands, and conventions live in the
authorities linked below — it intentionally does not restate them.

## Layout model

| Path | Model | Authority |
| --- | --- | --- |
| `native/` | Tuist-generated iOS app + widget + tests | `native/Project.swift`, `native/Tuist/Package.swift` |
| `native/Modules/` | 5 local SPM packages (Core, DesignSystem, Persistence, Networking, Sync) | each module's `Package.swift` |
| `native/App/` | App target, composition root (`AppEnvironment.swift`), features, resources | `native/Project.swift` |
| `native/CoachCalWidget/` | WidgetKit extension + Live Activity | `native/Project.swift` |
| `supabase/functions/` | Edge functions (`analyze-food`, `barcode-resolve`, `food-search`, `delete-account`, `rc-webhook`) + `_shared/` | `supabase/functions/deno.json` |
| `supabase/migrations/` | DDL + inline RLS/RPCs | `supabase/config.toml` |
| `scripts/` | Deno/Node verification + proof-capture harnesses | script headers |
| `docs/engineering/` | Stable engineering knowledge (conventions, infra, stack) | files in this directory |
| `docs/features/` | Feature specs (starter; currently empty) | `.agents/templates/spec.md` |
| `plans/` | Dated execution reports and proof records | `plans/reports/` |
| `.agents/` | Agent starter structure: skills, policies, hooks, templates | `.agents/templates/` |
| `.planning/` | Live planning state (gitignored) | — |

## Deeper reading

- Engineering ground truth: `docs/engineering/conventions.md`,
  `docs/engineering/infrastructure.md`, `docs/engineering/tech-stack.md`.
- Historical design/execution: `docs/superpowers/`, `plans/reports/`.
- Root contributor guide: `AGENTS.md` (pre-existing; not managed here).
