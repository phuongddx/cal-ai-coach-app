# Tech Stack

## iOS app

- Swift 6 / SwiftUI; deployment floor iOS 18 (Xcode 26.6 SDK).
- Tuist-generated project (`native/Project.swift`); Tuist 4.206+ installed via
  brew, unpinned in CI. Edit manifests, never generated
  `CoachCal.xcodeproj`/`Derived/`.
- WidgetKit extension + Live Activity; HealthKit; App Group
  `group.com.nextlabs.coachcal`.

## Local SPM packages (`native/Modules/`, all `.staticFramework`)

| Package | Depends on |
| --- | --- |
| `CoachCalCore` | — (zero deps; macOS-testable) |
| `CoachCalDesignSystem` | Core (iOS-only) |
| `CoachCalPersistence` | Core, GRDB exact `7.11.1` |
| `CoachCalSync` | Core, Persistence, GRDB exact `7.11.1` |
| `CoachCalNetworking` | Core, supabase-swift exact `2.55.2` |

App-level pins (`native/Tuist/Package.swift` / `Package.resolved`):
ViewInspector exact `0.10.3`; swift-snapshot-testing `from: 1.19.4` (resolved
`1.19.5`); sentry-cocoa exact `9.28.0`; posthog-ios exact `3.75.2`.

## Backend

- Deno major 2 (Supabase edge runtime). Canonical lockfile is repo-root
  `deno.lock`; `supabase/functions/deno.json` sets `lock:false` — do not create
  a second lock.
- Key deps (root `deno.lock`): `@supabase/supabase-js` `2.116.0`, `zod`
  `4.6.5`, `@std/assert` `1.0.19`.
- Postgres major 17 via Supabase CLI; clients use supabase-swift /
  supabase-js, never direct table access.
- `scripts/*.mjs` run on system Node — no `package.json`, no pinned Node
  toolchain.
