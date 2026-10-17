# CoachCal Native

The native SwiftUI iOS app is generated with [Tuist](https://tuist.io). The checked-in source of truth is `Tuist.swift` / `Tuist/Package.swift` / `Project.swift`; `CoachCal.xcodeproj`, `CoachCal.xcworkspace`, and `Derived/` are generated locally and ignored by Git.

## Requirements

- Xcode 26.6 with the iOS 26.5 simulator runtime
- Tuist 4.206+
- Deployment target: iOS 18.0

## Project layout

```text
native/
├── Tuist.swift                  # Tuist project-wide config
├── Tuist/Package.swift          # external + local SPM package declarations
├── Project.swift                # target definitions + scheme
├── App/CoachCal/                # @main app shell and walking smoke screen
├── App/CoachCalTests/           # unit tests + XCUITest smoke sources
└── Modules/                     # local Swift packages
```

The app target is `CoachCal`; `CoachCalTests` is its unit-test target and `CoachCalUITests` its UI-test target. It uses bundle ID `com.nextlabs.coachcal`, Swift 6 language mode, `MainActor` default isolation, and approachable concurrency.

## Module graph

`CoachCalCore` is the shared domain/contract boundary. `CoachCalDesignSystem`, `CoachCalPersistence`, `CoachCalNetworking`, and `CoachCalSync` each depend on Core. The app target imports all five and will own the composition root. Persistence is pinned to GRDB 7.11.1 and Networking to supabase-swift 2.55.2; the resolved package graph is checked in at `native/Package.resolved`.

```text
CoachCal app
├── CoachCalDesignSystem ─┐
├── CoachCalPersistence ──┤
├── CoachCalNetworking ───┼── CoachCalCore
└── CoachCalSync ─────────┘
```

## Regenerate and verify

```sh
cd native
tuist install
tuist generate --no-open
tuist build CoachCal -- -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5'
tuist test CoachCal -- -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5' \
  -only-testing:CoachCalUITests/WalkingSmokeUITests
```

**Note:** raw `xcodebuild build`/`xcodebuild test -scheme CoachCal` do not work for this
project — a confirmed Tuist limitation resolving local-package module
dependencies for the app+widget-extension target graph. Always use `tuist
build`/`tuist test`, not `xcodebuild` directly.

Run each package’s macOS-compatible tests with `swift test` from its module directory. `AuthSessionTests` in `CoachCalNetworking` hit a seeded local Supabase (`supabase start`) and are skipped unless `TEST_EMAIL`, `TEST_PASSWORD`, and `SUPABASE_ANON_KEY` are set.

## Xcode Cloud

The PR-triggered workflow and its test action are configured once in App Store Connect. Xcode Cloud invokes the repository hook at `ci_scripts/ci_post_clone.sh`; that hook verifies Tuist, regenerates the project via `tuist install && tuist generate`, runs local package tests, and executes the `CoachCal` test scheme (via `tuist test`) against `$CI_DESTINATION` when set, or the first available iPhone simulator otherwise (pinned to iPhone 16 / iOS 26.5 only if none is found).
