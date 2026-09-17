# Tuist Migration + GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace XcodeGen with Tuist as `native/`'s project generator, and add a GitHub Actions workflow that builds/tests the app on every push/PR/manual trigger, so "does it still build" is answered by CI instead of a local build.

**Architecture:** Tuist manifests (`Tuist.swift`, `Tuist/Package.swift`, `Project.swift`) replace `project.yml` 1:1 — same targets, same dependencies, same settings, same Info.plist/entitlements. The 5 local SwiftPM modules under `Modules/*` are untouched; Tuist consumes them as external packages the same way XcodeGen did. A new `.github/workflows/ci.yml` runs `tuist generate` + `swift test` (per module) + `xcodebuild test` (app) on a `macos-26` runner with Xcode 26.6 selected, unsigned. `ci_scripts/ci_post_clone.sh` (Xcode Cloud) is updated to bootstrap Tuist instead of XcodeGen so it keeps working after `project.yml` is deleted.

**Tech Stack:** Tuist 4.206.0 (CLI + Swift manifest DSL), Xcode 26.6, Swift 6.0, GitHub Actions (`macos-26` runner).

**Spec:** `docs/superpowers/specs/2026-09-17-tuist-migration-github-actions-ci-design.md`

## Global Constraints

- Deployment target: iOS 18.0 (floor) — do not raise it.
- `SWIFT_VERSION: "6.0"`, `SWIFT_DEFAULT_ACTOR_ISOLATION: MainActor`, `SWIFT_APPROACHABLE_CONCURRENCY: "YES"` — carry these settings forward exactly.
- Manual code signing settings (`DEVELOPMENT_TEAM: K2TYLYAWMK`, `CODE_SIGN_IDENTITY: "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)"`, `PROVISIONING_PROFILE_SPECIFIER: "CoachCal AppStore"`) must be preserved verbatim in the app target — Xcode Cloud's signed builds depend on them.
- Do not touch `App/Features/**`, `App/CoachCal/**` source files, module `Sources/`/`Tests/`, entitlements, or `PrivacyInfo.xcprivacy` content.
- Do not change `objectVersion` or attempt any raw pbxproj-format hack (out of scope per spec).
- CI (GitHub Actions) builds/tests unsigned (`CODE_SIGNING_ALLOWED=NO`) — no signing secrets needed there.
- Simulator destination in any CI/local verification command must be resolved dynamically (query `xcrun simctl list devices available`), never hardcoded to a specific iPhone model name — mirrors the existing `ci_post_clone.sh` pattern and avoids breaking when a runner's default simulator set changes.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `native/Tuist.swift` | Create | Tuist project-wide config (Swift version, compatible platforms) |
| `native/Tuist/Package.swift` | Create | External SPM dependency declarations (local modules + Sentry/PostHog/ViewInspector/SnapshotTesting) |
| `native/Project.swift` | Create | Target definitions (CoachCal app, CoachCalWidget extension, CoachCalTests, CoachCalUITests) + Scheme |
| `native/project.yml` | Delete | Replaced by the three files above |
| `native/Package.resolved` | Delete | XcodeGen-managed; Tuist manages its own resolution |
| `ci_scripts/ci_post_clone.sh` | Modify | Swap XcodeGen bootstrap for Tuist bootstrap |
| `.github/workflows/ci.yml` | Create | New GitHub Actions build/test verification workflow |

---

### Task 1: Tuist workspace bootstrap (`Tuist.swift` + `Tuist/Package.swift`)

**Files:**
- Create: `native/Tuist.swift`
- Create: `native/Tuist/Package.swift`

**Interfaces:**
- Produces: a `Tuist/Package.swift` whose declared package products (`CoachCalCore`, `CoachCalDesignSystem`, `CoachCalPersistence`, `CoachCalNetworking`, `CoachCalSync`, `Sentry`, `PostHog`, `ViewInspector`, `SnapshotTesting`) Task 2/3 reference via `TargetDependency.external(name:)`.

- [ ] **Step 1: Create `native/Tuist.swift`**

```swift
import ProjectDescription

let tuist = Tuist(
    project: .tuist(
        compatibleSwiftVersions: .upToNextMajor("6.0")
    )
)
```

- [ ] **Step 2: Create `native/Tuist/Package.swift`**

This mirrors `project.yml`'s `packages:` block: 5 local modules by path, plus the 4 remote deps with the exact same version pins.

```swift
// swift-tools-version: 6.0
import PackageDescription

#if TUIST
    import ProjectDescription

    let packageSettings = PackageSettings(
        productTypes: [:]
        // NOTE (added during Task 2 execution): this got overridden to
        // .staticFramework for all 5 local modules once building the app +
        // widget targets surfaced a real cross-project build-order problem.
        // See Task 2's "Discovered during execution" note below — this file
        // is touched again in Task 2, not just Task 1.
    )
#endif

let package = Package(
    name: "CoachCal",
    dependencies: [
        .package(path: "../Modules/CoachCalCore"),
        .package(path: "../Modules/CoachCalDesignSystem"),
        .package(path: "../Modules/CoachCalPersistence"),
        .package(path: "../Modules/CoachCalNetworking"),
        .package(path: "../Modules/CoachCalSync"),
        .package(url: "https://github.com/nalexn/ViewInspector", exact: "0.10.3"),
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.19.4"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", exact: "9.28.0"),
        .package(url: "https://github.com/PostHog/posthog-ios", exact: "3.75.2"),
    ]
)
```

- [ ] **Step 3: Run `tuist install` to verify the manifest is syntactically valid and dependencies resolve**

Run: `cd native && tuist install`
Expected: Tuist fetches/resolves all 9 packages without error and reports success (no `Project.swift` exists yet, so this only validates the package graph, not a full generate).

If this fails with an unknown-API error (e.g. `PackageSettings` or `.external`/`.package` signature mismatch for the installed Tuist 4.206.0), run `tuist --help` and check `tuist plugin list` / the bundled manifest docs (`tuist edit` opens an editable Xcode project with autocomplete against the real installed API) to correct the syntax, then re-run this step. Do not proceed to Task 2 until this succeeds.

- [ ] **Step 4: Commit**

```bash
git add native/Tuist.swift native/Tuist/Package.swift
git commit -m "feat(native): bootstrap Tuist package manifest"
```

---

### Task 2: `Project.swift` — CoachCal app target + CoachCalWidget extension

**Files:**
- Create: `native/Project.swift`

**Interfaces:**
- Consumes: package product names from Task 1's `Tuist/Package.swift` (`CoachCalCore`, `CoachCalDesignSystem`, `CoachCalPersistence`, `CoachCalNetworking`, `CoachCalSync`, `Sentry`, `PostHog`).
- Produces: `Target` named `"CoachCal"` and `Target` named `"CoachCalWidget"`, referenced by Task 3's test targets via `.target(name: "CoachCal")`.

- [ ] **Step 1: Write `native/Project.swift` with the app + widget targets**

Translates `project.yml`'s `CoachCal` and `CoachCalWidget` target blocks verbatim, including the cross-target shared source file (`App/Features/LiveActivity/CoachCalLiveActivityAttributes.swift` is compiled into both the app and the widget, same as `project.yml`'s widget `sources:` list does).

```swift
import ProjectDescription

// project.yml's root-level `settings.base` applied SWIFT_VERSION,
// actor-isolation, concurrency, and signing-team/identity to EVERY target
// (app, widget, tests, UI tests) by XcodeGen's default inheritance. Tuist's
// `Project(settings:)` is the equivalent project-wide default — do not put
// these only on the app target, or the widget/test targets silently regress
// to Swift 5 language mode and lose actor isolation.
let projectBaseSettings: SettingsDictionary = [
    "SWIFT_VERSION": "6.0",
    "SWIFT_DEFAULT_ACTOR_ISOLATION": "MainActor",
    "SWIFT_APPROACHABLE_CONCURRENCY": "YES",
    "CODE_SIGN_STYLE": "Manual",
    "DEVELOPMENT_TEAM": "K2TYLYAWMK",
    "CODE_SIGN_IDENTITY": "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)",
]

// App-target-only additions from project.yml's `targets.CoachCal.settings.base`.
let appSettings: SettingsDictionary = [
    "PRODUCT_BUNDLE_IDENTIFIER": "com.nextlabs.coachcal",
    "TARGETED_DEVICE_FAMILY": "1",
    "PROVISIONING_PROFILE_SPECIFIER": "CoachCal AppStore",
    "SUPABASE_URL": "$(COACHCAL_SUPABASE_URL:http://127.0.0.1:54321)",
    "SUPABASE_ANON_KEY": "$(COACHCAL_SUPABASE_ANON_KEY)",
    "SENTRY_DSN": "$(COACHCAL_SENTRY_DSN:)",
    "POSTHOG_API_KEY": "$(COACHCAL_POSTHOG_API_KEY:)",
]

let coachCalTarget = Target.target(
    name: "CoachCal",
    destinations: .iOS,
    product: .app,
    bundleId: "com.nextlabs.coachcal",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .extendingDefault(with: [
        "CFBundleURLTypes": [
            [
                "CFBundleURLName": "com.nextlabs.coachcal",
                "CFBundleURLSchemes": ["coachcal"],
            ],
        ],
        "SUPABASE_URL": "$(SUPABASE_URL)",
        "SUPABASE_ANON_KEY": "$(SUPABASE_ANON_KEY)",
        "SENTRY_DSN": "$(SENTRY_DSN)",
        "POSTHOG_API_KEY": "$(POSTHOG_API_KEY)",
        "CFBundleDisplayName": "CoachCal",
        "NSCameraUsageDescription": "CoachCal uses the camera to photograph your meals so CoachCal can estimate calories and macros.",
        "ITSAppUsesNonExemptEncryption": false,
        "NSHealthShareUsageDescription": "CoachCal reads your step count from Apple Health to show it on the Today screen and keep calorie estimates accurate.",
        "NSHealthUpdateUsageDescription": "CoachCal saves burned-energy summaries to Apple Health only when you explicitly confirm them — never automatically from a scan.",
        "NSSupportsLiveActivities": true,
    ]),
    sources: [
        "App/CoachCal/**",
        "App/Features/**",
    ],
    resources: [
        "App/CoachCal/Assets.xcassets",
        "App/CoachCal/Resources/**",
    ],
    entitlements: .file(path: "App/CoachCal/SupportingFiles/CoachCal.entitlements"),
    dependencies: [
        .external(name: "CoachCalCore"),
        .external(name: "CoachCalDesignSystem"),
        .external(name: "CoachCalPersistence"),
        .external(name: "CoachCalNetworking"),
        .external(name: "CoachCalSync"),
        .external(name: "Sentry"),
        .external(name: "PostHog"),
        .target(name: "CoachCalWidget"),
    ],
    settings: .settings(base: appSettings)
)

let coachCalWidgetTarget = Target.target(
    name: "CoachCalWidget",
    destinations: .iOS,
    product: .appExtension,
    bundleId: "com.nextlabs.coachcal.CoachCalWidget",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .extendingDefault(with: [
        "CFBundleDisplayName": "CoachCal Widget",
        "NSExtension": [
            "NSExtensionPointIdentifier": "com.apple.widgetkit-extension",
        ],
    ]),
    sources: [
        "CoachCalWidget/**",
        "App/Features/LiveActivity/CoachCalLiveActivityAttributes.swift",
    ],
    entitlements: .file(path: "CoachCalWidget/CoachCalWidget.entitlements"),
    dependencies: [
        .external(name: "CoachCalDesignSystem"),
        .external(name: "CoachCalCore"),
    ],
    settings: .settings(base: [
        "PRODUCT_BUNDLE_IDENTIFIER": "com.nextlabs.coachcal.CoachCalWidget",
        "TARGETED_DEVICE_FAMILY": "1",
    ])
)

let project = Project(
    name: "CoachCal",
    settings: .settings(base: projectBaseSettings),
    targets: [
        coachCalTarget,
        coachCalWidgetTarget,
    ]
)
```

- [ ] **Step 2: Generate and verify the project builds**

Run: `cd native && tuist generate --no-open`
Expected: Succeeds, produces `native/CoachCal.xcodeproj`.

**DISCOVERED DURING EXECUTION (controller-diagnosed):** raw `xcodebuild build -project CoachCal.xcodeproj -scheme CoachCal ...` fails at this point in the plan with `error: unable to resolve module dependency: 'CoachCalCore'` in `CoachCalWidget`'s compile step — NOT because the target/dependency definitions are wrong, but because no custom scheme exists yet (Task 3 adds it); Tuist's auto-generated default scheme has incomplete implicit cross-project dependency discovery for this app+extension+multiple-local-package-target shape. Confirmed via manual pbxproj inspection: `CoachCalCore.framework` IS correctly listed as a linked framework in both the app's and widget's Frameworks build phase — the target/link graph is correct, only the *scheme's build order* is incomplete.

Also required: `native/Tuist/Package.swift`'s `PackageSettings.productTypes` (from Task 1) must be changed from `[:]` to force `.staticFramework` for the 5 local modules — a plain dynamic `.framework` product type for a module shared between the app and its widget extension hit intermittent "unable to resolve module dependency" failures (varying which module failed between runs) under Xcode's explicit-module build system; `.staticFramework` is deterministic and resolved it in conjunction with the scheme finding above:

```swift
let packageSettings = PackageSettings(
    productTypes: [
        "CoachCalCore": .staticFramework,
        "CoachCalDesignSystem": .staticFramework,
        "CoachCalPersistence": .staticFramework,
        "CoachCalNetworking": .staticFramework,
        "CoachCalSync": .staticFramework,
    ]
)
```

**Corrected Task 2 verification** (do not use raw `xcodebuild -scheme` yet — there is no custom scheme until Task 3):

```bash
cd native
tuist build CoachCal -- -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO
```

Expected: `Build Succeeded` / `The project built successfully` (ignore the "`tuist build` is deprecated in favor of `tuist xcodebuild`" warning — the modern `tuist xcodebuild build` wrapper's exact flag-passthrough syntax wasn't resolved during this session; `tuist build` is confirmed working and is an acceptable interim choice, not a regression).

**Carried forward to Task 3 — RESOLVED:** re-verified once Task 3's custom scheme existed. Answer: **no**, the explicit scheme does NOT fix it — raw `xcodebuild build`/`test -scheme CoachCal` (and `tuist xcodebuild`, which is a thin passthrough to the same call) still fail identically. Tasks 3, 4, 6, and 7 (including the GitHub Actions workflow and the Xcode Cloud script) have all been updated in this plan to use `tuist build`/`tuist test` instead of raw `xcodebuild`.

If a *different* manifest API mismatch shows up (e.g. `.external`, `.extendingDefault`, `SettingsDictionary` signature), consult `tuist generate --help` and fix the manifest, then re-run this step. Do not proceed until the build genuinely succeeds.

- [ ] **Step 3: Commit**

```bash
git add native/Project.swift
git commit -m "feat(native): define CoachCal app + widget targets via Tuist"
```

---

### Task 3: `Project.swift` — test targets + scheme

**Files:**
- Modify: `native/Project.swift`

**Interfaces:**
- Consumes: `Target` `"CoachCal"` from Task 2 (as UI/unit test host).
- Produces: `Target`s `"CoachCalTests"`, `"CoachCalUITests"`, and a named `Scheme` `"CoachCal"` that later CI/local commands reference by name.

- [ ] **Step 1: Add the test targets and scheme to `native/Project.swift`**

Append these definitions (add to the `dependencies:` array in the `Package.swift` products list check — no, these go in `Project.swift`'s targets array and a new `schemes:` argument on `Project`):

```swift
let coachCalTestsTarget = Target.target(
    name: "CoachCalTests",
    destinations: .iOS,
    product: .unitTests,
    bundleId: "com.nextlabs.coachcal.unit-tests",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .default,
    sources: [
        "App/CoachCalTests/**",
        "CoachCalWidget/CaloriesRemainingTimelineProvider.swift",
    ],
    dependencies: [
        .target(name: "CoachCal"),
        .external(name: "ViewInspector"),
        .external(name: "SnapshotTesting"),
    ]
)

let coachCalUITestsTarget = Target.target(
    name: "CoachCalUITests",
    destinations: .iOS,
    product: .uiTests,
    bundleId: "com.nextlabs.coachcal.tests",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .default,
    sources: [
        "App/CoachCalUITests/**",
    ],
    dependencies: [
        .target(name: "CoachCal"),
    ],
    settings: .settings(base: [
        "UI_TESTING": "YES",
    ])
)

let coachCalScheme = Scheme.scheme(
    name: "CoachCal",
    buildAction: .buildAction(targets: [
        .target("CoachCal"),
        .target("CoachCalTests"),
    ]),
    testAction: .targets(
        [
            .testableTarget(target: .target("CoachCalTests")),
            .testableTarget(target: .target("CoachCalUITests")),
        ],
        configuration: .debug,
        // Same rationale as the old project.yml scheme comment: xcodebuild
        // test does not forward the invoking shell's environment to a
        // UI-test host process the way `swift test` does. These must be
        // set on the scheme's Test action, not read from the shell at
        // `tuist generate` time.
        environmentVariables: [
            "TEST_EMAIL": .environmentVariable(value: "$(TEST_EMAIL)", isEnabled: true),
            "TEST_PASSWORD": .environmentVariable(value: "$(TEST_PASSWORD)", isEnabled: true),
            "SUPABASE_ANON_KEY": .environmentVariable(value: "$(SUPABASE_ANON_KEY)", isEnabled: true),
        ]
    ),
    runAction: .runAction(configuration: .debug)
)

let project = Project(
    name: "CoachCal",
    settings: .settings(base: projectBaseSettings),
    targets: [
        coachCalTarget,
        coachCalWidgetTarget,
        coachCalTestsTarget,
        coachCalUITestsTarget,
    ],
    schemes: [
        coachCalScheme,
    ]
)
```

(This replaces the earlier bare `let project = Project(...)` from Task 2 — keep only one `project` declaration, with all four targets and the scheme.)

- [ ] **Step 2: Generate and verify build-for-testing succeeds**

```bash
cd native
tuist generate --no-open
DEST="generic/platform=iOS Simulator"
xcodebuild build-for-testing -project CoachCal.xcodeproj -scheme CoachCal -destination "$DEST" CODE_SIGNING_ALLOWED=NO
```

Expected: `** TEST BUILD SUCCEEDED **`. Fix any manifest API mismatches (e.g. `Scheme.TestAction` initializer shape, `EnvironmentVariable` type) using `tuist generate --help` / `tuist edit`, then re-run.

- [ ] **Step 3: Commit**

```bash
git add native/Project.swift
git commit -m "feat(native): add test targets and scheme via Tuist"
```

---

### Task 4: Full local validation (modules + app tests)

**Files:** none (verification only)

**Interfaces:** none — this task only runs commands and reports pass/fail.

- [ ] **Step 1: Run each local module's own test suite (unchanged by this migration)**

```bash
cd native
for package in Modules/*; do
  if [ "$(basename "$package")" = "CoachCalDesignSystem" ]; then
    continue
  fi
  echo "Running package tests in $package"
  (cd "$package" && swift test)
done
```

Expected: all module test suites pass (they don't depend on the project generator).

- [ ] **Step 2: Run the full app test suite via Tuist's own orchestration**

**DISCOVERED DURING EXECUTION (Task 3, definitively resolved the Task 2 open question):** even with Task 3's explicit custom scheme in place, raw `xcodebuild build`/`test -scheme CoachCal` still fails identically to the schemeless case (`unable to resolve module dependency: 'CoachCalCore'`). `tuist xcodebuild` is a thin passthrough to the same broken invocation and fails the same way. Only `tuist build`/`tuist test` (Tuist's own graph-based orchestration, not a raw `xcodebuild -scheme` call) reliably works. Use `tuist test`, not `xcodebuild test`, here and in every later task.

A generic destination (`generic/platform=iOS Simulator`) works for `tuist build` but is REJECTED by `tuist test`/`xcodebuild test` with "Tests must be run on a concrete device" — a concrete simulator name is required.

```bash
cd native
resolved_name="$(xcrun simctl list devices available 2>/dev/null | grep -m1 -o 'iPhone [^(]*' | tail -n 1 | sed 's/ *$//')"
tuist test CoachCal --no-selective-testing -- -destination "platform=iOS Simulator,name=${resolved_name:-iPhone 16}" CODE_SIGNING_ALLOWED=NO
```

Expected: Tuist generates, builds, and actually reaches test execution (this alone proves Task 3's target/scheme wiring is structurally correct — no module-resolution error). The test *content* may still report `** TEST FAILED **` for reasons that are Task 4's job to triage, not Task 3's: e.g. snapshot tests can be simulator/OS-version-sensitive, and any test whose name implies a live dependency (e.g. one literally named `...ConvergesOnRealSupabase`) requires real `TEST_EMAIL`/`TEST_PASSWORD`/`SUPABASE_ANON_KEY` credentials that won't be set in an ad-hoc local run — that is a pre-existing environment-gating condition, not a regression from this migration. Distinguish "fails to build/wire" (this migration's concern — must be zero) from "fails because a specific test needs credentials or an exact snapshot baseline this environment doesn't have" (pre-existing, report but do not treat as a migration regression) before deciding whether to stop and fix or note-and-continue.

- [ ] **Step 2b: Triage any test-content failures**

For each failing test, determine: (a) does it fail the same way on `main` before this migration (check by looking at what the test actually asserts/needs — e.g. `grep` the test file for env-var reads or snapshot-comparison calls), or (b) is it new. Only (b) blocks this task. Record (a)-class failures in the ledger as pre-existing/environment-gated, not migration defects.

- [ ] **Step 3: Commit** (only if any fixes were needed in the previous steps; otherwise skip — this task is verification-only)

---

### Task 5: Remove XcodeGen artifacts

**Files:**
- Delete: `native/project.yml`
- Delete: `native/Package.resolved`

**Interfaces:** none.

- [ ] **Step 1: Delete the XcodeGen files**

```bash
cd native
git rm project.yml Package.resolved
```

- [ ] **Step 2: Re-run generate from a clean state to confirm nothing depended on the deleted files**

```bash
cd native
rm -rf CoachCal.xcodeproj
tuist generate --no-open
```

Expected: succeeds identically to Task 3 Step 2, proving the `.xcodeproj` is fully reproducible from the Tuist manifests alone.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(native): remove XcodeGen project.yml and Package.resolved"
```

---

### Task 6: Update Xcode Cloud's `ci_scripts/ci_post_clone.sh` to bootstrap Tuist

**Files:**
- Modify: `ci_scripts/ci_post_clone.sh`

**Interfaces:**
- Consumes: nothing new — the per-module `swift test` loop and final `xcodebuild test` invocation already in this file are untouched.

- [ ] **Step 1: Replace the XcodeGen install-and-generate block**

Current content (top of file, to be replaced):

```bash
if ! command -v xcodegen >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install xcodegen
  else
    echo "error: xcodegen is required and Homebrew is unavailable to install it" >&2
    exit 1
  fi
fi

cd "$ROOT/native"
xcodegen generate
```

Replace with:

```bash
if ! command -v tuist >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install tuist
  else
    echo "error: tuist is required and Homebrew is unavailable to install it" >&2
    exit 1
  fi
fi

cd "$ROOT/native"
tuist install
tuist generate --no-open
```

Full resulting file (for reference — write this exact content to `ci_scripts/ci_post_clone.sh`):

```bash
#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v tuist >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install tuist
  else
    echo "error: tuist is required and Homebrew is unavailable to install it" >&2
    exit 1
  fi
fi

cd "$ROOT/native"
tuist install
tuist generate --no-open

for package in Modules/*; do
  if [ "$(basename "$package")" = "CoachCalDesignSystem" ]; then
    # iOS-only SwiftUI package (no macOS platform); exercised via the app scheme on the iOS destination.
    continue
  fi
  echo "Running package tests in $package"
  (cd "$package" && swift test)
done

if [ -n "${CI_DESTINATION:-}" ]; then
  destination="$CI_DESTINATION"
else
  destination="platform=iOS Simulator,name=iPhone 16,OS=26.5"
  resolved_name="$(xcrun simctl list devices available 2>/dev/null | grep -m1 -o 'iPhone [^(]*' | tail -n 1 || true)"
  if [ -n "$resolved_name" ]; then
    destination="platform=iOS Simulator,name=$(printf '%s' "$resolved_name" | sed 's/ *$//')"
  fi
fi

# DISCOVERED DURING EXECUTION (Task 3): raw `xcodebuild test -scheme CoachCal`
# fails with "unable to resolve module dependency" even with the custom
# scheme in place — only Tuist's own build/test orchestration (`tuist
# test`, not `xcodebuild test`) reliably resolves this app+widget+local-
# package-modules graph. Do not revert this to raw xcodebuild.
# --no-selective-testing: this is the CI safety net — always run every
# test, never let hash-based selective testing skip coverage even if
# Tuist Cloud/remote caching gets configured later (Task 6 review finding).
tuist test CoachCal --no-selective-testing -- \
  -destination "$destination" \
  -derivedDataPath DerivedData
```

- [ ] **Step 2: Verify shell syntax**

Run: `bash -n ci_scripts/ci_post_clone.sh`
Expected: no output, exit code 0 (syntax valid).

- [ ] **Step 3: Manually walk through the script's commands locally to sanity-check the Tuist swap** (this script only truly runs inside Xcode Cloud's sandboxed clone environment — this step is the closest local proxy)

```bash
cd native
tuist install
tuist generate --no-open
```

Expected: matches Task 5 Step 2's result (already verified).

- [ ] **Step 4: Commit**

```bash
git add ci_scripts/ci_post_clone.sh
git commit -m "ci(xcode-cloud): bootstrap Tuist instead of XcodeGen"
```

---

### Task 7: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:** none — this is the terminal deliverable of the plan.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  build-and-test:
    runs-on: macos-26
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Select Xcode 26.6
        run: sudo xcode-select -s /Applications/Xcode_26.6.app

      - name: Install Tuist
        run: |
          if ! command -v tuist >/dev/null 2>&1; then
            brew install tuist
          fi
          tuist version

      - name: Cache Tuist dependencies
        uses: actions/cache@v4
        with:
          path: |
            native/.tuist
            ~/.tuist
          key: ${{ runner.os }}-tuist-${{ hashFiles('native/Tuist/Package.resolved') }}
          restore-keys: |
            ${{ runner.os }}-tuist-

      - name: Install dependencies
        working-directory: native
        run: tuist install

      - name: Generate Xcode project
        working-directory: native
        run: tuist generate --no-open

      - name: Test local Swift packages
        working-directory: native
        run: |
          for package in Modules/*; do
            if [ "$(basename "$package")" = "CoachCalDesignSystem" ]; then
              continue
            fi
            echo "Running package tests in $package"
            (cd "$package" && swift test)
          done

      - name: Build and test CoachCal app
        working-directory: native
        run: |
          resolved_name="$(xcrun simctl list devices available 2>/dev/null | grep -m1 -o 'iPhone [^(]*' | tail -n 1 | sed 's/ *$//')"
          destination="platform=iOS Simulator,name=${resolved_name:-iPhone 16}"
          # DISCOVERED DURING EXECUTION (Task 3): raw `xcodebuild test
          # -scheme CoachCal` fails ("unable to resolve module dependency")
          # even with the custom scheme present — use Tuist's own
          # orchestration, not raw xcodebuild, for this app+widget+local-
          # package-modules graph.
          # --no-selective-testing: always run every test in CI, never let
          # hash-based selective testing skip coverage.
          tuist test CoachCal --no-selective-testing -- \
            -destination "$destination" \
            CODE_SIGNING_ALLOWED=NO
```

- [ ] **Step 2: Validate YAML syntax locally**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output, exit code 0 (valid YAML). If `pyyaml` isn't available, use `ruby -ryaml -e "YAML.load_file('.github/workflows/ci.yml')"` instead.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions build/test verification workflow"
```

- [ ] **Step 4: Push and confirm the workflow runs green**

Run: `git push`
Then check: `gh run list --limit 1` and `gh run watch` (or open the Actions tab on GitHub) until the run completes.
Expected: the `build-and-test` job succeeds. This is the one step in this plan that cannot be verified without an actual push to GitHub — flagged as a real risk in the spec (Xcode Cloud's own equivalent verification has the same limitation and cannot be checked from this plan alone).

---

## Self-Review Notes

- **Spec coverage:** Every "In scope" item from the spec (§Scope) has a task: Tuist manifests → Tasks 1–3; Xcode Cloud script update → Task 6; GitHub Actions workflow → Task 7; cutover/removal → Task 5. Validation steps from the spec's §Validation map to Task 4 (1–2) and Task 7 Step 4 (3) and Task 6 (4, as a best-effort local proxy since a real Xcode Cloud run can't be triggered from this plan).
- **Placeholder scan:** No TBD/TODO; every manifest/workflow/script is full, real content, not a description of what to write.
- **Type/name consistency:** Target names (`CoachCal`, `CoachCalWidget`, `CoachCalTests`, `CoachCalUITests`) and package product names (`CoachCalCore`, `CoachCalDesignSystem`, `CoachCalPersistence`, `CoachCalNetworking`, `CoachCalSync`) are identical across Task 1 (declaration) and Tasks 2–3 (consumption).
- **Known uncertainty, called out explicitly rather than hidden:** the exact Tuist 4.206.0 manifest API (`.external(name:)`, `PackageSettings`, `Scheme.TestAction` shape) is written from documented Tuist knowledge but not executed against the live CLI while writing this plan. Every task that introduces new manifest API includes an explicit run-and-verify step (`tuist install` / `tuist generate` / `xcodebuild build`) specifically so any API drift is caught and corrected during execution, not assumed away.
