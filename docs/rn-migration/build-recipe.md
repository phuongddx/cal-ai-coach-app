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
| Simulator for this program | `iPhone 17 Pro`, iOS 26.4, UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3` |
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
| Native project | `cd apps/mobile && npx expo prebuild --platform ios` | in the native worktree only |
| Build, install, launch | `cd apps/mobile && CI=1 npx expo run:ios --no-bundler --device 85024D2F-71DE-43C0-8E11-CE58F4578FC3` | first build about 25 minutes; `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first |
| Metro | `cd apps/mobile && npx expo start --dev-client --port 8081` | not with `CI=1` |
| Point the dev client at Metro | `xcrun simctl openurl 85024D2F-71DE-43C0-8E11-CE58F4578FC3 "exp+coachcal://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` | the slug is `coachcal` since the promotion commit |
| Screenshot | `xcrun simctl io <udid> screenshot <file.png>` | |

## Pitfalls met in this program

1. `df -h /` shows 7.5 GB free while the data volume has 14 GB. The sealed system volume has its own
   number. Always read `/System/Volumes/Data`.
2. Jest with `--testPathPatterns` on one workspace is the fast way to re-run a subset; the full
   mobile suite takes about 50 seconds when other projects are building.

## State on 2026-11-27

Verified in the promotion PR: `npm test` (140 tests), `npm run typecheck` and `npm run parity:check`
at the repo root after the move. Not yet verified after the move: the native build (the identity
changed to the production one, so the spike's build cannot be reused). U-13 builds first.
