# RN migration: React Native + Expo replaces the SwiftUI app

Program requested by Phương on 2026-11-27 (through Zed): migrate CoachCal to React Native + Expo,
then remove everything that belongs to the SwiftUI app. Android is skipped for now.

| File | What it is | Who writes it |
|---|---|---|
| `spec.md` | decisions, invariants, layout, data flow, API surface, native surface, evidence standard, risks | the owner |
| `plan.md` | waves, units with their briefs, who may write what, merge recipe | the owner |
| `parity.tsv` | one row per feature of the old app: unit, status, evidence, gaps. The gate `npm run parity:check` reads it | the owner |
| `parity.md` | the same table rendered (`npm run parity:write`) | generated |
| `inventory.md` | what the SwiftUI app and the Supabase backend contain, with counts and call sites | the owner, frozen |
| `swift-inventory.tsv` | every file under `native/` mapped to a parity row | the owner, frozen |
| `standing-orders.md` | rules included in every worker brief, the report format | the owner |
| `build-recipe.md` | what builds and runs on this machine, with pitfalls | the unit that holds the native slot |
| `findings/U-*.md` | each unit's pitfalls and what it read | the unit |
| `parity-detail/<area>.md` | behavior-level parity for one area: every behavior found in the Swift source, its RN file, its test or screenshot | the unit |
| `reference/` | design references and the SwiftUI snapshot screenshots | the owner, U-22 |
| `evidence/<id>/` | screenshots, transcripts and logs per parity row or unit | the unit that produced them |
| `spike/` | the spike's spec, plan, report, recipe and findings, frozen. Paths in there refer to the former `rn-spike/` directory, which the promotion commit moved to the repo root | frozen |
| `evidence/spike/` | the spike's evidence, frozen | frozen |
| `deploy-vps.md` | the steps Phương runs to deploy the API (written in U-21) | U-21 |
| `report.md` | the final report in Vietnamese | the owner |

Status today: see `parity.md` for the rows and `plan.md` for the waves.
