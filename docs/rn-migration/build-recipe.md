# Build recipe: what works on this machine (2026-11-27)

Living file. The unit that holds the native slot keeps it current; workers add pitfalls to their own
`findings/U-*.md` and the owner moves what is reusable here. The spike's recipe with its 16 pitfalls
is frozen in `spike/build-recipe.md`; everything there still applies except the paths.

## Machine

| Fact | Value |
|---|---|
| Chip / RAM | Apple M3 Pro, 18 GB, 11 cores |
| Xcode | 27.1 (27A9275) |
| Simulator runtimes | iOS 18.4, 26.4, 27.0, 27.1 |
| Simulator for this program | `iPhone 17 Pro`, iOS 26.4, UDID `A902237E-29DE-4A6F-9E93-23199FC2107F` (recreated 2026-11-27; scripts find it by name through `scripts/rn/sim-udid.sh`) |
| Node / npm | 26.8.1 / 11.19.0 (CI uses Node 24) |
| CocoaPods | 1.17.0 at `/opt/homebrew/bin/pod` |
| PostgreSQL | 17 binaries under `/opt/homebrew/opt/postgresql@17/bin`; no server running until `scripts/rn/start-api.sh` |
| UI automation | `axe` 2.1.1; no Maestro, no idb |
| Disk | check `df -h /System/Volumes/Data` (not `df -h /`, which shows the sealed system volume). One native build costs about 5.3 GB (Pods 1.4 GB, DerivedData 3.9 GB) |
| Other projects on this machine | Stress Coach, SOS Mac and Pulse AI build here too; their DerivedData and Simulators are not ours |

## Worktrees

| Worktree | Branch | Role |
|---|---|---|
| `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app` | `main` | Phương's checkout with uncommitted work. Never touch |
| `.worktrees/rn-expo` | detached at `origin/main` or an owner branch | coordinator; holds the `node_modules` that worker worktrees clone |
| `.worktrees/rn-native` | detached at `origin/main` | the only worktree that builds natively; keeps `apps/mobile/ios`, Pods and `apps/mobile/build-output/CoachCal-dev.app` |
| `.worktrees/rn-u-<nn>` | `rn/u-<nn>-<slug>` | one per unit, created and removed by the owner |

A worker worktree starts with `bash scripts/rn/clone-node-modules.sh <coordinator worktree> <worker worktree>`
instead of `npm ci`.

## Commands

Run from the repo root unless stated.

| Step | Command | Measured |
|---|---|---|
| Tests | `npm test` | 140 tests in 4 workspaces, about 70 s on a loaded machine |
| Types | `npm run typecheck` | |
| Parity gate | `npm run parity:check` (`npm run parity:write` regenerates the table) | under 1 s |
| Local API with PostgreSQL 17 | `bash scripts/rn/start-api.sh`, stop with `bash scripts/rn/start-api.sh stop` | ports 5433 and 8787 |
| Native project | `bash scripts/rn/native-slot.sh prepare` (clean-tree and 6 GB disk check, then `expo prebuild`) | 138 s with `pod install`; in the native worktree only |
| Build, install, launch | `cd apps/mobile && CI=1 npx expo run:ios --no-bundler --device A902237E-29DE-4A6F-9E93-23199FC2107F` | measured 1002 s (16.7 min) from a cold DerivedData, including install and launch, on 2026-11-27 (U-13); `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first |
| Metro | `cd apps/mobile && npx expo start --dev-client --port 8081` | not with `CI=1` |
| Point the dev client at Metro | `xcrun simctl openurl A902237E-29DE-4A6F-9E93-23199FC2107F "exp+coachcal://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` | the slug is `coachcal` since the promotion commit |
| Screenshot | `xcrun simctl io <udid> screenshot <file.png>` | |

## Pitfalls met in this program

1. `df -h /` shows 7.5 GB free while the data volume has 14 GB. The sealed system volume has its own
   number. Always read `/System/Volumes/Data`.
2. Jest with `--testPathPatterns` on one workspace is the fast way to re-run a subset; the full
   mobile suite takes about 50 seconds when other projects are building.

3. Disk: the first native build needs about 5.3 GB (measured: `ios/Pods` 1.5 GB, DerivedData 3.8 GB, the
   copied Debug app 199 MB). With 10 GB free before the build the volume ended at 3.8 GB. Run
   `bash scripts/rn/native-slot.sh release` when the build is done (it removes only `ios/Pods` and
   `DerivedData/CoachCal-*`); free disk went from 3.8 GB back to 8 GB.
4. `npx expo install` exits 1 when `app.config.ts` is a dynamic config: it installs the packages but
   cannot write the plugin list. Add the config plugins to `app.config.ts` by hand.
5. A simulator build is ad-hoc signed with an empty entitlement set, so
   `codesign -d --entitlements :- CoachCal.app` prints an empty `<dict>`. The real entitlements sit in the
   `__TEXT,__entitlements` section of the executable (`otool -X -s __TEXT __entitlements`, 4-byte words
   printed little-endian). `scripts/rn/check-artifact-compliance.mjs` reads both places.
6. `expo-doctor` fails the "duplicate dependencies" check when `apps/mobile` pins `react@19.3.0` and a
   hoisted package with `peer react: "*"` pulls `react@19.3.1` to the root. The root `package.json` has
   `overrides` for `react` and `react-dom` at 19.3.0. Keep them equal to the version in `apps/mobile`.
7. `expo-router/testing-library` `renderRouter` with an in-memory route object: keys must have no leading
   `./` and no file extension (`'(tabs)/index'`, not `'./(tabs)/index.tsx'`), else it throws
   "Cannot read properties of undefined (reading 'ErrorBoundary')". A `coachcal://` `initialUrl` resolves to
   `/` even with `linking.prefixes`; convert with `extractExpoPathFromURL` first (as the native app does).
8. jest-expo auto-mocks every native module with `jest.fn()` that returns `undefined`. A module the code
   awaits (secure store, camera permissions) needs a manual mock in `src/__mocks__/`.
9. `expo-doctor` also checks the `expo` package against the SDK patch line (`~58.1.0` for SDK 58 on
   2026-11-27, not `~58.0.26`).

## State on 2026-11-27

Verified in the promotion PR: `npm test` (140 tests), `npm run typecheck` and `npm run parity:check`
at the repo root after the move. Verified in U-13: the native build with the production identity
(`Build Succeeded`, 0 errors, 2 warnings), launch under Metro (Today, four tabs, Scan button),
`npx expo-doctor` 20/20, `npm ci` in a fresh clone (1164 packages, 24 s).
