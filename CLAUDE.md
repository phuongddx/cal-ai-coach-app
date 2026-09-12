<!-- GSD:project-start source:PROJECT.md -->

## Project

**CoachCal — AI Calorie Coach**

CoachCal is an iOS-first (React Native/Expo) AI calorie-tracking app that competes with Cal AI: snap a photo of a meal, get calories and macros in seconds, then easily correct the estimate. It differentiates on honesty — transparent pricing with in-app cancel, visible AI confidence on every scan, and health-safe guardrails — attacking Cal AI's two documented failure clusters (billing traps, silent AI inaccuracy).

**Core Value:** A user can photograph any meal and get a trustworthy, editable calorie/macro estimate in under 5 seconds — and trust the app's billing and safety claims.

### Constraints

- **Tech stack**: Expo SDK 57 (≥57.0.17), RN 0.86.3, New Architecture (mandatory), expo-router v57 — latest stable verified Sept 2026; no bare-RN
- **Backend**: Supabase (Postgres RLS + Edge Functions) — AI keys server-side only, never on device
- **AI budget**: Two-tier VLM routing; target ≥85% Tier-1 resolution; ~$200/mo AI COGS at 100K scans
- **Platform compliance**: No IAP bypass (Apple 3.1.1); trial terms display adjacent to price (3.1.2(c)); no manipulative flows (5.6); HealthKit privacy manifest required
- **Data**: Local-first SQLite; VLM never outputs kcal — deterministic DB arithmetic only
- **Camera**: `barcodeScannerEnabled` must be set in app.config before first native build

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Session Claim Audit (verification of SESSION-RESEARCH.md "Stack (verified Sept 2026)")

| Session claim | Verdict | Evidence (2026-09-12) |
|---|---|---|
| Expo SDK 57, ≥57.0.17 | ✅ CONFIRMED + rationale found | `expo@57.0.22` is npm `latest`; SDK 57 changelog: 57.0.17 bumps to RN 0.86.3 fixing Hermes V1 memory regression with Reanimated/Worklets (expo/expo#46519) and dev startup regression (#48298). **57.0.17 is a hard floor**; current is 57.0.22 |
| RN 0.86.3, React 19.2 | ✅ CONFIRMED | expo 57.0.22 devDeps: `react-native 0.86.3`, `react 19.2.3` |
| New Architecture mandatory | ✅ CONFIRMED | RN 0.86 line is New-Arch-only; SDK 57 changelog references New Architecture rollout as complete |
| expo-router v57 | ✅ CONFIRMED | `expo-router@57.0.21` (latest) |
| **NativeWind v5** | ❌ **CORRECTED → v4.2.6** | npm `latest` = **4.2.6**; v5 exists only as `5.0.0-preview.4` (preview dist-tag). nativewind.dev banner: "Pre-release v5 of Nativewind is now available!" |
| Zustand 5 + TanStack Query 5 | ✅ CONFIRMED | `zustand@5.0.15`, `@tanstack/react-query@5.102.8` |
| RHF + zod 4 | ✅ CONFIRMED | `react-hook-form@7.88.0` (v7 line is current), `zod@4.6.2` |
| expo-sqlite + Drizzle 0.45 | ✅ CONFIRMED | `expo-sqlite@57.0.3`, `drizzle-orm@0.45.2`; `drizzle-orm/expo-sqlite` export (driver/session/migrator) verified in 0.45.2 package exports; peerOptional `expo-sqlite >=14` satisfied |
| Supabase | ✅ CONFIRMED | `@supabase/supabase-js@2.116.0` (latest; first-class `react-native` export condition, Expo integration tests in repo); current Expo tutorial prescribes the AsyncStorage + SecureStore pattern below |
| RevenueCat 10.9.1 | ✅ CONFIRMED exact | `react-native-purchases@10.9.1` (latest); RevenueCat-maintained, peer RN ≥0.73; RC's own repo tests with Maestro + Expo example |
| expo-camera 57.0.4 "CodeScanner" | ⚠️ VERSION ✅ / API NAMED WRONG | `expo-camera@57.0.4` ✓, but SDK 57 docs expose **`CameraView` + `onBarcodeScanned` + `barcodeScannerSettings.barcodeTypes`** — no `CodeScanner` API in v57 docs. Also `barcodeScannerEnabled` **defaults to `true`** (it exists to *disable* scanning/app size); on Android it only matters when building from source |
| react-native-health 1.19 | ✅ version / ⚠️ STALE | `1.19.0` is latest but **last published Oct 2024** (~23 months). Works via Expo config plugin; iOS 26 compat unverified. Fallback now pinned: `@kingstinct/react-native-healthkit@15.1.0` (Sept 2026, Nitro-based, very active) |
| health-connect 4.1.3 | ✅ CONFIRMED exact | `react-native-health-connect@4.1.3` (latest), actively shipped, devDeps on RN 0.86.2, Expo config plugin |
| EAS free tier ~30 builds/mo | ✅ CONFIRMED | expo.dev/pricing: Free = 15 Android + 15 iOS builds/mo, low-priority queue, 45-min timeout |
| AI: Gemini 3.x Flash ~$0.0017/scan; Gemini 3.1 Pro escalation | ✅ CONFIRMED | Gemini pricing (2026-09): current Flash = `gemini-3.8-flash` (3.7/3.6/3.5 still listed); Flash input **$0.75/1M tokens through 2026-12-31, then $1.50**; output $3.75→$7.50. Pro escalation model exists as `gemini-3.1-pro-preview` ("3rd generation Pro") |
| Sentry (package unspecified) | ⚠️ PRESCRIBED | `@sentry/expo` is **dead** (registry 404). Use `@sentry/react-native@8.26.0` — includes Expo support (EAS build hooks, `expo-expo-upload-sourcemaps`, expo peer ≥49) |
| PostHog | ✅ CONFIRMED | `posthog-react-native@4.71.0` (latest), ships `posthog-react-native/expo` config export |

## Recommended Stack

### Core Technologies

| Technology | Version (2026-09-12) | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Expo (CNG + EAS) | `expo@~57.0.22` (**floor 57.0.17**) | App framework, config plugins, build/OTA infra | Camera/billing/health/widgets all config-plugin supported; SDK 57 = RN 0.86.3; `<57.0.17` carries a Hermes V1 memory regression with Reanimated | HIGH |
| React Native | `0.86.3` (bundled) | Runtime | New-Arch-only line; non-breaking release; edge-to-edge fixes on Android | HIGH |
| React | `19.2.3` (bundled) | UI runtime | Paired with RN 0.86.3 by Expo | HIGH |
| expo-router | `~57.0.21` | File-based navigation, deep links, typed routes | Official Expo answer; peer-locked to SDK 57; avoids maintaining react-navigation config by hand | HIGH |
| **NativeWind** | **`4.2.6`** + `tailwindcss@3.4.19` (v3-lts) | Styling | **v5 is preview-only (`5.0.0-preview.4`)** — do not ship on it. NW4 is the stable line; peer-requires Tailwind >3.3 (v3-lts = 3.4.19); `tailwindcss@4.x` is NOT compatible with NW4 | HIGH |
| expo-sqlite | `~57.0.3` | Local-first SQLite storage | Source of truth on device (offline-first, PLT-02); supports lazy loading, live queries | HIGH |
| drizzle-orm | `0.45.2` (+ `drizzle-kit` dev dep) | Type-safe SQL query builder + migrations | `drizzle-orm/expo-sqlite` driver/session/migrator verified in 0.45.2; SQL-close, zero runtime bloat; Drizzle is the 2026 default for RN SQLite | HIGH (drizzle-kit version unverified — take latest at install) |
| @supabase/supabase-js | `2.116.0` | Auth, Postgres (RLS), Storage, Edge Function calls | Postgres + RLS + pgvector + Deno edge functions for the AI pipeline; keys server-side only; `react-native` export condition + Expo CI tests in repo | HIGH |
| @react-native-async-storage/async-storage | latest 2.x | KV storage / session ciphertext | Required by Supabase client `auth.storage`; pair with SecureStore below | MEDIUM (version not pinned this session) |
| expo-secure-store | `~57` (SDK-managed) | Keychain storage | Holds the AES-256 key in Supabase `LargeSecureStore` pattern (official tutorial pattern, verified) | HIGH |
| react-native-purchases (RevenueCat) | `10.9.1` | IAP/subscription entitlements, remote paywalls, A/B | Exact-match to session decision; entitlement sync across devices; Apple 3.1.2(c)-safe paywall config without app releases | HIGH (version) / MEDIUM (docs unreachable from this environment — plugin props from package + session knowledge) |
| expo-camera | `~57.0.4` | Meal photo capture + barcode scan | `CameraView` + `onBarcodeScanned` + `barcodeScannerSettings`; set `barcodeScannerEnabled: true` explicitly in app.json (default true — explicit guards against future default changes) | HIGH |
| Zustand | `5.0.15` | Client UI state (scan flow, diary drafts) | Minimal, RN-native exports, no provider boilerplate | HIGH |
| @tanstack/react-query | `5.102.8` | Server-state (Supabase queries, scan status) | Dedupe/cache/retry for edge-function calls; Zustand for UI state, Query for async — standard 2026 split | HIGH |
| react-hook-form + zod | `7.88.0` + `4.6.2` (+ `@hookform/resolvers`) | Onboarding quiz, edit-grams forms, scan-result schema validation | RHF perf on 20-question quiz; zod 4 for VLM response + food-DB normalization schemas shared client/server | HIGH (resolvers version unverified) |
| react-native-health | `1.19.0` | iOS HealthKit (steps, weight, workouts) | Expo config plugin included; broadest HK API coverage. **Last publish Oct 2024 — smoke-test on iOS 26/RN 0.86 in Phase 1, before building on it** | MEDIUM (staleness) |
| react-native-health-connect | `4.1.3` | Android Health Connect | Active (Aug 2026 publish), Expo config plugin, RN 0.86 dev-tested | HIGH |
| expo-widgets | `~57.0.19` | iOS home widget + Live Activity (ENG-04) | Official; widgets AND Live Activities from TS via `@expo/ui/swift-ui`; config plugin; iOS-only, dev-build only | HIGH |
| expo-notifications | `~57.0.18` | Meal reminders, end-of-day recap (ENG-03) | Actively shipped in SDK 57 | HIGH |
| victory-native | `42.0.1` + `@shopify/react-native-skia >=2.6 <3` | Weight/exercise trend charts (TRK-04/05) | victory-native-xl line: Skia-rendered, reanimated-driven — the 2026 standard for RN charts | HIGH |
| @sentry/react-native | `8.26.0` | Crash + perf monitoring | Supersedes `@sentry/expo` (dead); EAS build hooks + sourcemap upload built in | HIGH |
| posthog-react-native | `4.71.0` | Product analytics, funnels (trial→paid) | First-class Expo config export; autocapture + session replay available | HIGH |
| Google Gemini API | `gemini-3.8-flash` (Tier-1) | VLM food recognition (label + grams, never kcal) | Cheapest capable multimodal tier: **$0.75/1M input / $3.75/1M output through 2026-12-31** (then $1.50/$7.50) ≈ session's ~$0.0017/scan; escalation `gemini-3.1-pro-preview` verified current; structured output via `responseSchema` | HIGH (pricing verified) |
| OpenAI API (escalation/hedge) | GPT-5.x `json_schema` strict | Tier-2 VLM escalation + Claude Sonnet hedge | Session AIStackResearch decision; **[INFERENCE] model names/prices not verified this session** | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aes-js + react-native-get-random-values | latest | AES-256 session encryption for Supabase `LargeSecureStore` (key in SecureStore, ciphertext in AsyncStorage) | Always — official Supabase RN auth-storage pattern (verified) |
| dayjs | ^1 | Date math (streaks, weekly averages, diary days) | Lighter than date-fns for RN; [INFERENCE] version not verified |
| @expo/ui (swift-ui) | ~57 | Widget/Live Activity layout primitives | Only inside `'widget'`-directive components |
| expo-local-authentication | ~57 | Optional app-lock (ED-safe mode lock) | Phase 2+, if user demand |
| papaparse or hand-rolled | — | TRU-03 one-tap CSV export | Hand-roll from SQLite cursor; avoid heavy dep |
| USDA FDC + Open Food Facts + FatSecret APIs | server-side | Food-DB grounding (kcal = DB × grams, never VLM) | Called from Supabase Edge Functions only; keys never on device [session decision, MEDIUM] |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| EAS Build/Submit/Update | Cloud builds, store submission, OTA | Free tier: 15 Android + 15 iOS builds/mo, low-priority queue, 45-min timeout, 1K update MAUs. iOS build $2 (medium worker). Budget for Starter $19/mo at beta scale (high-priority queue + $45 credit). Verified 2026-09-12 |
| Maestro | E2E flows (scan→edit→log, paywall) | Also runnable as EAS CI/CD jobs ($0.05/test + minutes, Starter+); RevenueCat itself tests RN with Maestro |
| expo-dev-client | Development builds | Required — Expo Go can't run camera-native/health/widgets/RC; Expo Go for SDK 57 not even on the App Store yet |
| jest-expo + @testing-library/react-native 13.x | Unit/component tests | Preset ships with SDK 57 |
| expo-doctor | Dependency sanity | `npx expo-doctor@latest` after every dependency change |
| TypeScript ~5.9 | Language | RN 0.86-era default in the ecosystem |

## Installation

# Scaffold (TypeScript template, then pin SDK 57 floor)

# Expo-managed modules (versions auto-pinned by SDK)

# Styling (stable pairing — NOT v5/tailwind v4)

# Data + state

# Backend + auth

# Forms + validation

# Monetization + health + charts

# Observability

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase | Firebase | Only if team has deep FTS/firestore expertise — but no SQL/RLS/pgvector, and the AI pipeline is Postgres-shaped. Decision already logged in PROJECT.md |
| NativeWind 4.2.6 | Tamagui; StyleSheet+Restyle; NativeWind 5 preview | Tamagui if a full cross-platform component kit is wanted (heavier); NW5 preview once it hits stable — re-evaluate at each phase boundary, migration is modest |
| Drizzle + expo-sqlite | WatermelonDB, Realm, TypeORM | Watermelon/Realm only with huge offline datasets and complex relations; TypeORM is effectively unmaintained; single-user diary LWW fits Drizzle |
| RevenueCat | Raw StoreKit2/Play Billing; Superwall | Raw billing only if 0 third-party fees is existential (you rebuild entitlements, receipts, paywall A/B); Superwall is paywall-specific — RevenueCat Paywalls covers TRU-01 with remote config |
| expo-router | react-navigation (direct) | Never alongside expo-router; direct react-navigation only for non-Expo legacy codebases |
| react-native-health 1.19 | @kingstinct/react-native-healthkit 15.1.0 | **Swap immediately if the iOS 26 smoke test fails** — actively maintained (Nitro modules, RN ≥0.79, Expo plugin). Costs an extra dep: react-native-nitro-modules ≥0.35 |
| Hand-rolled outbox LWW sync | PowerSync / ElectricSQL | When multi-device conflict complexity outgrows LWW or teams/sharing lands (post-PMF, per PROJECT decision) |
| victory-native 42 | react-native-gifted-charts, Recharts (web) | Gifted-charts is RN-Views-based (janks on long series); our charts are few and Skia-rendered |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NativeWind v5 (`5.0.0-preview.4`) | Preview dist-tag only; API churn risk against a January launch window | nativewind@4.2.6 |
| tailwindcss v4.x with NativeWind 4 | NW4 targets Tailwind v3 (peer `>3.3.0`, devDeps 3.4.4); v4 engine is the NW5 line | tailwindcss@3.4.19 (v3-lts) |
| @sentry/expo | Package gone — registry 404; superseded | @sentry/react-native@8.26.0 |
| Unscoped `react-native-healthkit` | Dead 0.0.1 from 2015 | @kingstinct/react-native-healthkit (only as fallback) |
| `CodeScanner` API naming | Not in SDK 57 camera docs | `CameraView` + `onBarcodeScanned` + `barcodeScannerSettings` |
| Expo Go as the dev environment | Camera native modules, HealthKit, expo-widgets, RevenueCat all need a dev build; Expo itself now recommends dev builds for production apps; SDK 57 Go awaiting App Store approval | expo-dev-client development builds |
| expo < 57.0.17 | Hermes V1 memory regression with Reanimated/Worklets (expo/expo#46519) + dev-startup regression (#48298) | expo ~57.0.22 |
| AsyncStorage alone for auth session | Tokens at rest unencrypted | Supabase LargeSecureStore (SecureStore AES key + encrypted AsyncStorage) |
| react-navigation alongside expo-router | Two competing nav systems, double native screen stacks | expo-router only |
| Prisma / TypeORM / WatermelonDB on device | Prisma: no RN SQLite runtime story; TypeORM unmaintained; Watermelon overkill for single-user diary | expo-sqlite + Drizzle |
| PowerSync/ElectricSQL at MVP | Sync-service cost/complexity before PMF | Hand-rolled outbox LWW (PROJECT decision), revisit post-PMF |
| Raw StoreKit/Play Billing | You rebuild entitlements, receipt validation, paywall A/B — Cal AI's billing failures are the moat, don't hand-roll the risky part | RevenueCat |
| Nutritionix | $499/mo entry — banned in PROJECT.md Out of Scope | USDA FDC + OFF + FatSecret |
| `barcodeScannerEnabled: false` | Removes barcode scan support (LOG-02); on Android also only effective with `buildFromSource` | Keep explicit `true` in app.json plugin config |
| Legacy victory-native (<37) / svg-based chart libs | Old architecture rendering, perf cliffs on scroll | victory-native@42 + Skia |

## Stack Patterns by Variant

- Re-evaluate upgrade (Tailwind v4 engine, oklch/P3 color support)
- Until then: NW4 + tailwind 3.4.19; keep the design tokens (lime #B4F04A, macro palette) in `tailwind.config.js` so migration is config-level
- Swap to @kingstinct/react-native-healthkit@15.1.0 + react-native-nitro-modules
- Isolate all HealthKit calls behind one `healthAdapter.ts` from day one — this is the only module in the stack with a live deprecation risk
- react-native-health-connect@4.1.3 for Health Connect (INT-02); RN 0.86 edge-to-edge is the default and fixed-up
- expo-widgets is iOS-only — Android widget is a later-phase native/Compose decision, keep ENG-04 scoped to iOS at MVP
- Set `NSSupportsLiveActivitiesFrequentUpdates` via plugin `enablePushNotifications`; budget update cadence (calories-remaining changes ~per log, not per minute)
- Gemini Batch API is 50% off (verified) for non-latency reprocessing; context caching ($0.075/1M promo) for the shared few-shot prompt prefix; keep ≥85% Tier-1 resolution target

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|----------------|-------|
| expo@57.0.22 | RN 0.86.3, React 19.2.3 | Bundled by SDK; verified from expo package metadata |
| expo-router@57.0.21 | expo 57 line; screens ^4.26; safe-area ≥5.4; gesture-handler; reanimated 4.5.1 | Peer deps from package; `npx expo install --fix` resolves all |
| nativewind@4.2.6 | tailwindcss >3.3 (use 3.4.19) | **NOT tailwind v4**; NOT RN-web-only — RNW optional peer |
| drizzle-orm@0.45.2 | expo-sqlite ≥14 (SDK 57 = 57.0.3 ✓) | `drizzle-orm/expo-sqlite` driver verified in exports |
| victory-native@42.0.1 | skia ≥2.6 <3; reanimated ≥3.19.1; gesture-handler ≥2 | Peer deps from package |
| react-native-purchases@10.9.1 | RN ≥0.73 (0.86 ✓) | peerDeps from package |
| react-native-health@1.19.0 | RN ≥0.67; @expo/config-plugins ^7 | Stale — verify on RN 0.86/iOS 26 in Phase 1 |
| @kingstinct/react-native-healthkit@15.1.0 | RN ≥0.79; React ≥19; nitro ≥0.35 | Fallback option |
| react-native-health-connect@4.1.3 | Expo plugin optional peer ≥6 | Active; dev-tested against RN 0.86.2 |
| zod@4.6.2 + react-hook-form@7.88.0 | @hookform/resolvers (zod-v4 resolver) | Resolver version not verified — check at install |
| @supabase/supabase-js@2.116.0 | Node ≥22 for tooling; RN via react-native export | engines: node>=22; Hermes compat tested in repo |
| @sentry/react-native@8.26.0 | expo ≥49 (optional peer); RN ≥0.65 | Dev-tested against RN 0.87.1 — ahead of us, good |

## Quality Gates

- [x] Every recommended version verified against npm registry `/latest` JSON or official docs on 2026-09-12 (expo, expo-router, nativewind + dist-tags, tailwind dist-tags, drizzle-orm, zustand, @tanstack/react-query, zod, react-hook-form, @supabase/supabase-js, react-native-purchases, react-native-health, react-native-health-connect, @kingstinct/react-native-healthkit, expo-camera, expo-sqlite, expo-widgets, expo-notifications, victory-native, posthog-react-native, @sentry/react-native, @sentry/expo-404)
- [x] Session stack cross-checked claim-by-claim (audit table above): 2 corrections (NativeWind v5→4.2.6; CodeScanner→CameraView props), 1 hard-floor rationale found (expo ≥57.0.17 = Hermes V1 fixes), 1 package-death found (@sentry/expo), 1 staleness quantified (react-native-health, Oct 2024)
- [x] Official docs fetched & cited: expo-camera SDK 57, expo-widgets SDK 57, SDK 57 changelog, EAS pricing, Supabase Expo tutorial, NativeWind site, Gemini API pricing
- [x] Confidence level assigned per row; unverified items marked [INFERENCE] (drizzle-kit, @hookform/resolvers, dayjs, OpenAI GPT-5.x model names/prices, async-storage minor)
- [x] Anti-recommendations include concrete reason + replacement
- [x] Digests cached in GSD research-store (keys from research-plan) for future sessions

## Sources

- registry.npmjs.org `<pkg>/latest` and `/-/package/<pkg>/dist-tags` JSON — all versions above — HIGH (registry is authoritative for current versions)
- https://expo.dev/changelog/sdk-57 (June 30 2026 + Aug 27 2026 update) — SDK 57 scope, RN 0.86.3 in 57.0.17, Hermes V1 regressions, reanimated 4.5/worklets 0.10/gesture-handler 2.32, Expo Go status — HIGH
- https://docs.expo.dev/versions/latest/sdk/camera.md (ref v57.0.0) — CameraView barcode API, `barcodeScannerEnabled` default-true — HIGH
- https://docs.expo.dev/versions/latest/sdk/widgets.md (ref v57.0.0) — widgets + Live Activities, `'widget'` directive limits, config plugin — HIGH
- https://expo.dev/pricing (md) — EAS plan limits/build rates, Maestro CI jobs — HIGH
- https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native (md) — client setup, LargeSecureStore pattern — HIGH
- https://www.nativewind.dev — "Pre-release v5 now available" banner — HIGH
- https://ai.google.dev/gemini-api/docs/pricing — gemini-3.8-flash $0.75/$3.75 promo thru 2026, gemini-3.1-pro-preview exists, Batch 50%, caching — HIGH
- .planning/research/SESSION-RESEARCH.md + agent://AIStackResearch — AI routing (GPT-5.6-terra escalation, ~$0.0017/scan, food-DB fallback ladder) — MEDIUM (carried forward, model names not independently verified)
- RevenueCat docs (revenuecat.com/docs/getting-started/...) — 404 from this environment; integration details from package metadata + session — MEDIUM

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
