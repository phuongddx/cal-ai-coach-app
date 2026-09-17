# Expo/RN → Native SwiftUI Pivot — Research & Plan-Update Report

**Date:** 2026-09-13 · **Mode:** 5 parallel research agents (owner-authorized) + main-thread integration
**Decision:** Abandon the Expo/React Native client. Rebuild **native SwiftUI, deployment target iOS 18.0**, iOS-only (Android deferred). Supabase backend, sync protocol, RLS, and RPCs retained unchanged.

---

## 1. Verified Toolchain (local machine, same day)

| Item | Value |
|---|---|
| Xcode | 26.6 (17F113) — Apple requires iOS 26 SDK for ASC uploads since 2026-04-28 |
| Swift | 6.3.3 compiler, Swift 6 language mode, `SWIFT_DEFAULT_ACTOR_ISOLATION=MainActor` |
| Deployment target | iOS 18.0; iOS-26-only APIs (custom Liquid Glass, WebView/WebPage, `RecognizeDocumentsRequest`, Foundation Models) gated `#available(iOS 26,*)` |
| ⚠️ Simulator runtimes | iOS 26.5 only — **iOS 18 runtime must be downloaded** for floor testing |
| Xcode 27 | RC only — stay on 26.x for release |

## 2. New Mobile Stack (verified versions)

| Layer | Choice |
|---|---|
| UI | SwiftUI + NavigationStack (per-tab), `@Observable`/`@Bindable`, Liquid Glass adopted passively via SDK |
| Modules | SPM: `CoachCalCore` (Sendable domain + deterministic kcal math), `DesignSystem`, `Persistence`, `Networking`, `Sync`, feature modules |
| Local store | **GRDB 7.11.1** (verified) — NOT SwiftData (object-graph ORM fights mirror+outbox sync + explicit LWW SQL); "Apple SQLiteData" unverifiable in the 26.5 SDK |
| Backend client | **supabase-swift v2.55.2** (verified; v3 unreleased) — Keychain sessions, typed `sync_push`/`sync_pull` Codable envelopes with golden fixtures |
| Sync engine | `actor SyncEngine` porting the proven TS design verbatim: 50-op batches, exact ack-set equality, durable pull cursor, LWW `(serverVersion, acceptedOpId)`, retry 1 s→30 s ×2, foreground + `NWPathMonitor` + BGTask triggers |
| Auth | Email OTP primary, Sign in with Apple (nonce), Google via `ASWebAuthenticationSession` |
| Camera/barcode | AVFoundation `AVCapturePhotoOutput` + `PhotosPicker`; VisionKit `DataScannerViewController`, Vision `VNDetectBarcodesRequest`; Vision `RecognizeTextRequest` for label OCR (server Gemini still parses) |
| Health | HealthKit first-class (descriptor/anchored/background-delivery) — replaces the whole RN health-lib risk class; never write unconfirmed AI energy |
| Monetization | **StoreKit 2 default** (`SubscriptionStoreView` at floor); RevenueCat optional wrapper — final call at Phase 5 research (purchases-ios current major unverified locally) |
| Widgets | WidgetKit + App Group **snapshot** (live shared SQLite explicitly avoided); ActivityKit only for bounded events |
| Notifications | Local `UNUserNotificationCenter` triggers; APNs only if server-generated recaps are needed |
| Charts | Swift Charts; CSV via `ShareLink` |
| Observability | Sentry cocoa (SPI 9.13.0) + PostHog iOS (SPI 3.15.2) + MetricKit — **pins unverified, re-check at integration** |
| Testing | Swift Testing (logic) + XCUITest (UI/a11y smoke); Maestro dropped with Android |
| CI/CD | Xcode Cloud → TestFlight → App Store phased release (replaces EAS; no OTA rollback — server flags only for safe changes) |

## 3. What Survives vs Rewrite

- **Survive unchanged:** `supabase/` (migration `20260912000000_foundation_sync.sql`, RLS — 2 tables/3 policies, `sync_push(jsonb)`/`sync_pull(bigint)`, pgTAP suite). No Edge Functions exist yet (Phase 2 creates them).
- **Spec-only (semantics port, code doesn't):** `src/contracts/sync.ts` invariants, outbox/LWW/ack design, proof-harness design. Note: Drizzle never generated the Supabase SQL — server schema is hand-authored and stays canonical.
- **Superseded:** all `app/`, `src/` TS/RN code, Drizzle local schema + Jest suites (behavior portable, code not), Expo/EAS/Metro config surface, RN native surface.
- **Still mandatory from old 01-08:** `ProofAuto.ts` still contains embedded proof credentials → **rotate exposed proof accounts on the local Supabase stack before any distributed build** (blocking for the 1.1-06 TestFlight gate).
- **Evidence flag:** the claimed two-device LWW convergence proof has **no in-repo artifacts** — re-proof required in Swift regardless (1.1-05).

## 4. Restructured Roadmap (written to `.planning/ROADMAP.md`)

| Phase | Name | Status |
|---|---|---|
| 1 | Foundation & Offline-First Data Layer (RN) | **SUPERSEDED** — backend artifacts canonical; client abandoned; 01-08/09/10 obligations carried into 1.1 |
| 1.1 (INSERTED) | **SwiftUI Foundation & Sync Port** | Ready to plan — 6 seeds: Xcode/SPM skeleton → GRDB mirror+outbox → supabase-swift client → SyncEngine actor → Swift Testing + convergence proofs → first TestFlight build |
| 2 | Scan Pipeline (API Layer) | Mostly unchanged (server-side; fixture VLM, quota, rc-webhook, golden set) |
| 3 | Core Loop & Full UI (SwiftUI) | 25-screen design-system port, ED-Safe as global EnvironmentKey, a11y at floor |
| 4 | Integrations & Real Services | Real auth + two-device test, VLM flip, HealthKit, notifications, widget, CSV, XCUITest |
| 5 | Monetization & Trust Hardening | StoreKit 2 (+ optional RC), server-enforced free tier, device matrix |
| 6 | Launch Readiness | Reviewer runbook, privacy label, capacity, phased-release rehearsal |

## 5. Doc Changes Made

| File | Change |
|---|---|
| `.planning/research/STACK-SWIFTUI.md` | **NEW** — full pivot stack decision record |
| `.planning/research/STACK.md` | Superseded banner (server sections still valid reference) |
| `.planning/PROJECT.md` | What-This-Is → iOS-native; Constraints tech-stack/data/camera rewritten; Key Decisions: pivot + GRDB + StoreKit-2-default rows added, Expo row struck |
| `.planning/REQUIREMENTS.md` | TRK-03 → HealthKit only; INT-02 removed → Out of Scope (Android post-MVP); traceability updated |
| `.planning/ROADMAP.md` | Fully restructured (Phase 1 superseded, 1.1 inserted, 2–6 updated) |
| `.planning/STATE.md` | Position → Phase 1.1 ready-to-plan; pivot decision logged; evidence caveat noted |
| `.planning/HANDOFF.json` | Replaced — old 01-08-execution handoff obsolete; new handoff points to `/gsd-plan-phase 1.1` |
| `AGENTS.md` | Expo-docs directive → SwiftUI/Axiom directive |

## 6. Unresolved Questions

1. Do old RN proof artifacts (two-device convergence evidence) exist outside the repo? (Re-proof happens regardless.)
2. RevenueCat vs pure StoreKit 2 — resolved at Phase 5 plan-time research (server-side entitlement/quota stays either way).
3. Should the SwiftUI client keep the same JSON proof contract accepted by `scripts/measure-phase1-sync.mjs`? (Recommended: yes — validator survives host-side.)
4. Fresh-install only (no RN SQLite data migration) — assumed YES; no end users exist pre-launch.
5. iOS 18 simulator runtime needs downloading before floor testing — proceed?
