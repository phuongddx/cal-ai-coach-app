# CoachCal Native

The native SwiftUI iOS app is generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen). The checked-in source of truth is `project.yml`; `CoachCal.xcodeproj` and `DerivedData/` are generated locally and ignored by Git.

## Requirements

- Xcode 26.6 with the iOS 26.5 simulator runtime
- XcodeGen 2.46+
- Deployment target: iOS 18.0

## Project layout

```text
native/
├── project.yml                  # XcodeGen manifest
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
xcodegen generate
xcodebuild build -project CoachCal.xcodeproj -scheme CoachCal \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5'
xcodebuild test -project CoachCal.xcodeproj -scheme CoachCal \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=26.5' \
  -only-testing:CoachCalUITests/WalkingSmokeUITests
```

Run each package’s macOS-compatible tests with `swift test` from its module directory. `AuthSessionTests` in `CoachCalNetworking` hit a seeded local Supabase (`supabase start`) and are skipped unless `TEST_EMAIL`, `TEST_PASSWORD`, and `SUPABASE_ANON_KEY` are set.

## Xcode Cloud

The PR-triggered workflow and its test action are configured once in App Store Connect. Xcode Cloud invokes the repository hook at `ci_scripts/ci_post_clone.sh`; that hook verifies XcodeGen, regenerates the project from `project.yml`, runs local package tests, and executes the `CoachCal` test scheme against `$CI_DESTINATION` when set, or the first available iPhone simulator otherwise (pinned to iPhone 16 / iOS 26.5 only if none is found).
