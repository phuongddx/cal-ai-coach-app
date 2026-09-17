# CoachCal Mobile Tech Stack — Whole-Plan Analysis

**Source artifacts:** `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/research/STACK.md`, `.planning/phases/01-*/` plans/summaries, `package.json` (installed ground truth)
**Analyzed:** 2026-09-13 · **Scope:** advisory, no code changes

---

## 1. Verdict (one paragraph)

CoachCal is an **Expo SDK 57 / React Native 0.86 (New Architecture) TypeScript app**, iOS-first, built with **Expo CNG + EAS** (no bare RN, no Expo Go), styled with **NativeWind 4 / Tailwind 3**, navigated by **expo-router**, persisted **local-first** in **expo-sqlite + Drizzle ORM** with a hand-rolled outbox sync to **Supabase (Postgres + RLS + Edge Functions)**, AI via **two-tier Gemini VLM with DB-grounded deterministic arithmetic** (VLM never outputs kcal), billing via **RevenueCat**, health via **HealthKit / Health Connect**, observability via **Sentry + PostHog**. Every "latest-vs-preview" trap in this stack was caught at research time and pinned to the stable line.

## 2. Core Mobile Layer (installed, Phase 1 proven)

| Technology | Version (installed) | Role | Why chosen |
|---|---|---|---|
| Expo (CNG + EAS) | `expo ~57.0.22` (hard floor ≥57.0.17) | App framework, config plugins, builds/OTA | Camera/billing/health/widgets all config-plugin supported; floor fixes Hermes V1 memory regression (Reanimated/Worklets) |
| React Native | `0.86.3` | Runtime | New-Arch-only line; SDK 57 pairs it |
| React | `19.2.3` | UI runtime | Paired by Expo |
| expo-router | `~57.0.21` | File-based nav, typed routes, deep links | Official; avoids hand-rolled react-navigation config |
| expo-dev-client | `~57.0.19` | Dev builds | Expo Go can't run camera/health/widgets/RC |
| TypeScript | `~6.0.3` | Language | Strict contracts (`src/contracts` zod, no-kcal VLM schema) |
| Node | 22 LTS | Toolchain | SDK 57 published under Node 22 |

## 3. State, Styling, Data (installed)

| Concern | Choice | Notes |
|---|---|---|
| Client state | **Zustand 5.0.15** | Lightweight stores |
| Server state | **TanStack Query 5.102.8** | Caching/retries for API calls |
| Contracts | **zod 4.6.2** | Scan/sync/entitlement schemas; malformed VLM output = schema error, never 500 |
| Styling | **NativeWind 4.2.6 + Tailwind 3.4.19** | v5 is preview-only — do not ship; Tailwind 4 incompatible with NW4. Design tokens from `coachcal-app-ui-v3` (lime `#B4F04A`, ED-Safe tokens seeded Phase 1) |
| Local DB | **expo-sqlite ~57.0.3 + Drizzle ORM 0.45.2 + drizzle-kit** | Bundled migrations, typed repo, atomic repo+outbox writes |
| Sync | **Hand-rolled outbox, LWW deterministic merge, ack-set integrity, idempotency ledger** | Phase 1 proven: offline queue→push, two-install convergence, RLS cross-user denial on-device |
| Connectivity | `@react-native-community/netinfo 11.4.1` | Reconnect triggers |

## 4. Backend & AI (Supabase + two-tier VLM)

| Layer | Choice | Rationale |
|---|---|---|
| BaaS | **Supabase** (`@supabase/supabase-js 2.116.0`): Postgres + RLS + push/pull RPCs + `food_cache` + pgTAP tests | RLS matches single-user privacy; Deno Edge Functions keep AI keys server-side only |
| VLM Tier-1 | **Gemini 3.8-flash** ($0.75/1M in → 2026-12-31 promo, then $1.50) | Cheapest capable multimodal; `responseSchema` structured output |
| Escalation | **gemini-3.1-pro-preview** + OpenAI GPT-5.x hedge | Target ≥85% Tier-1 resolution; model names still [INFERENCE] |
| Invariant | **VLM outputs label+grams+confidence only — never kcal.** kcal = `round(per100g × grams/100)` deterministic DB arithmetic | −63% MAE vs hallucinated nutrition; auditable |
| Grounding | USDA FDC → Open Food Facts → FatSecret cascade (server-side) | Exact packaged nutrition; typed not-found, never a guess |

## 5. Native Capabilities & Integrations

| Capability | Choice | Phase | Status |
|---|---|---|---|
| Camera/barcode | `expo-camera ~57.0.5` (`CameraView` + `barcodeScannerSettings`; `barcodeScannerEnabled` in app.config before first build) | 1/3 | Installed; frozen CNG surface in built binary |
| iOS Health | **`@kingstinct/react-native-healthkit` 15.1.0** | 1→4 | **Swapped from `react-native-health@1.19`** (stale ~23 mo; fails RN 0.86 compile — proven live on sim) |
| Android Health | `react-native-health-connect 4.1.3` | 4 | Planned |
| Push/reminders | `expo-notifications ~57` | 4 | Planned |
| Widget/Live Activity | `@expo/ui` (swift-ui, `widget` directive) | 4 | Planned |
| Billing | **RevenueCat `react-native-purchases 10.9.1`** — CI grep fails build if any other payment SDK enters tree | 5 | Planned (docs 404 at research time — re-verify at planning) |
| Charts | `victory-native 42.0.1` + `@shopify/react-native-skia` | 3 | Planned |
| Crash/perf | **`@sentry/react-native 8.26.0`** (`@sentry/expo` is dead/404) | 1+ | Installed |
| Analytics | `posthog-react-native 4.71.0` | 1+ | Installed |

## 6. QA / Tooling

- **jest-expo + Jest 29.7** (+ `.sql` transform for migration tests), `tsc --noEmit` typecheck
- **pgTAP** for RLS/authorization proofs (Phase 1 proven)
- **Maestro** E2E (Phase 4: scan→edit→airplane→reconnect→Postgres)
- **expo-doctor** after every dependency change; `npx expo install` for all Expo-managed modules (never hand-pin)
- EAS free tier = 15 iOS + 15 Android builds/mo (budget Starter $19/mo at beta scale)

## 7. Stack Decision Log (from PROJECT.md Key Decisions)

| Decision | Rationale |
|---|---|
| Expo CNG over bare RN | All needed native surfaces are config-plugin supported; EAS covers build/OTA |
| Supabase over Firebase | Postgres+RLS+pgvector+Deno match the AI pipeline; predictable pricing |
| VLM-first, DB-grounded | −63% MAE; auditable arithmetic; honesty brand |
| RevenueCat over raw StoreKit | Entitlements + remote paywalls + A/B without releases |
| Local-first SQLite + outbox (LWW) | Single-user diary is LWW-friendly; no sync service pre-PMF (PowerSync later) |
| Hand-rolled sync now, PowerSync later | Deferred until proven necessary |

## 8. Known Traps Already Baked Into the Plan

1. **NativeWind v5 / Tailwind 4** — preview-only / incompatible; plan pins 4.2.6 + 3.4.19.
2. **Expo floor ≥57.0.17** — Hermes V1 memory regression below it.
3. **react-native-health** — stale + RN 0.86 compile failure; replaced by @kingstinct (Nitro).
4. **@sentry/expo** — package dead; use @sentry/react-native.
5. **Gemini promo pricing ends 2026-12-31** — January COGS must be recomputed at post-promo rates.
6. **`barcodeScannerEnabled`** — must be set in app.config before first native build (defaults true; exists to disable).
7. **OpenAI escalation model names** — still [INFERENCE]; verify before Phase 4 VLM flip.

## 9. Unresolved Questions

- None blocking stack choice. Carry-forwards already tracked in STATE.md: RevenueCat doc re-verification (Phase 5 planning), OpenAI model-name verification (Phase 4), post-promo Gemini COGS math (Launch).
