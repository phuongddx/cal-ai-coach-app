# Build recipe: what works on this machine (2026-11-26)

Living file. The owner (CoachCal bot) maintains it; workers add pitfalls to their own
`docs/findings/T*.md` and the owner merges what is reusable here.

## Machine

| Fact | Value |
|---|---|
| Chip / RAM | Apple M3 Pro, 18 GB |
| Xcode | 27.1 (27A9275) |
| Simulator runtimes | iOS 18.4, 26.4, 27.0, 27.1 |
| Spike simulator | `iPhone 17 Pro`, iOS 26.4, UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3` |
| Node / npm | 26.8.1 / 11.19.0 (no Node 24, no pnpm, yarn, nvm, fnm) |
| CocoaPods | 1.17.0 (Homebrew, Ruby 4.0.6) at `/opt/homebrew/bin/pod` |
| Android SDK | none — Android is not built in this spike |
| PostgreSQL | 15, 16, 17 binaries from Homebrew under `/opt/homebrew/opt/postgresql@<n>/bin`; no server running |
| UI automation | `axe` 2.1.1, `xcbeautify` 3.2.1; no Maestro, no idb |
| Disk at start | about 16 GB free on the data volume; one built worktree costs about 6.3 GB |
| Disk after the spike | about 11 GB free. The app's DerivedData (7.8 GB after a Debug and a Release build) and `apps/mobile/ios/Pods` (1.4 GB) were deleted to give the disk back. The two built `.app` bundles are kept in `apps/mobile/build-output/` (git-ignored) for `xcrun simctl install` |

## Versions

Everything comes from `rn-spike/package-lock.json`. Never upgrade; never pin by hand. On
2026-11-26 `expo-widgets` and `@expo/ui` 58.0.30 were published in the middle of the setup and
`babel-preset-expo` 58.0.27 stopped resolving against 58.0.29. `npx expo install --fix` in
`apps/mobile` aligns first-party packages with the installed `expo` version; run it only in the
main worktree, then `npm install` and commit the lockfile.

Resolved at the base commit: expo 58.0.26, expo-router 58.0.33, expo-widgets 58.0.30, @expo/ui 58.0.30,
expo-glass-effect 58.0.6, expo-sqlite 58.0.18, expo-symbols 58.0.5, expo-dev-client 58.0.22,
react-native 0.88.1, react 19.3.0, react-native-nitro-modules 0.37.2,
@kingstinct/react-native-healthkit 16.2.0, drizzle-orm 0.45.4, hono 4.13.22, zod 4.6.7,
jest 30.5.2, jest-expo 58.0.16, @testing-library/react-native 14.1.0, typescript 6.0.3.

## Commands

Run from `rn-spike/` unless stated. Always first:

```sh
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods crashes without a UTF-8 locale
```

| Step | Command | Measured |
|---|---|---|
| Install | `npm ci` (`npm install` only in the main worktree) | 37 s, 1138 packages, 1.0 GB |
| Native project | `cd apps/mobile && npx expo prebuild --platform ios` | 3 s; `ios/` is generated and git-ignored |
| Build + install + launch | `cd apps/mobile && CI=1 npx expo run:ios --no-bundler --device 85024D2F-71DE-43C0-8E11-CE58F4578FC3` | first run 23 min (pod install with cold caches: 129 pods, then xcodebuild); Pods 1.4 GB, DerivedData 3.9 GB |
| Metro (main worktree) | `cd apps/mobile && npx expo start --dev-client --port 8081` | first bundle 13 s, 1305 modules |
| Point the dev client at Metro | `xcrun simctl openurl 85024D2F-71DE-43C0-8E11-CE58F4578FC3 "exp+coachcal-rn-spike://?__expo_url=http%3A%2F%2Flocalhost%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1"` | loads the bundle in about 15 s |
| Deep link into the console | `xcrun simctl openurl <udid> "ccspike://spike?action=<name>"` | |
| Screenshot | `xcrun simctl io <udid> screenshot <file>.png` | |
| Tests | `npm test` | 4 workspaces, about 4 s total |
| Types | `npm run typecheck` | |
| Release build (measurements), official way | `cd apps/mobile && CI=1 npx expo run:ios --configuration Release --no-bundler --device <udid>` | not run here (builds both architectures) |
| Release build, one architecture | `cd apps/mobile/ios && xcodebuild -workspace CoachCalSpike.xcworkspace -scheme CoachCalSpike -configuration Release -destination "id=<udid>" ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO build`, then `xcrun simctl install <udid> ~/Library/Developer/Xcode/DerivedData/CoachCalSpike-*/Build/Products/Release-iphonesimulator/CoachCalSpike.app` | 9 min; `.app` 74.4 MB; adds about 4 GB of DerivedData |
| Measurements | `scripts/measure.sh debug` (Metro must run on 8081) and `scripts/measure.sh release` | 5 cold starts each; results in `evidence/measurements/` |

`CI=1` makes Expo CLI non-interactive and it also turns off Metro's watch mode ("reloads are
disabled"), so pass `CI=1` to `expo run:ios` but not to `expo start`.

## Pitfalls met

1. **Locale.** `pod install` fails with `Unicode Normalization not appropriate for ASCII-8BIT`
   when `LANG` is not UTF-8. Non-interactive shells on this machine start without it.
2. **Versions move hourly.** Pin nothing by hand; `npm ci` everywhere except the main worktree.
3. **npm 11 install scripts.** `npm install` reports that `esbuild`, `@parcel/watcher` and
   `fsevents` have install scripts not covered by `allowScripts` and skips them. Nothing broke
   so far; if a package needs its script, approve it in the root `package.json` (`allowScripts`).
4. **RNTL 14 is async.** `render` returns a promise: `await render(<X />)` before `screen.getBy…`.
   It depends on `test-renderer`, not on the deprecated `react-test-renderer`.
5. **ts-jest with TypeScript 6.** `moduleResolution: 'node10'` is deprecated; each Node package's
   `jest.config.js` passes `ignoreDeprecations: '6.0'`.
6. **Tests never go in `src/app/`.** Expo Router treats every file there as a route. Use
   `src/__tests__/` or a folder outside `src/app/`.
7. **Only the main worktree builds natively.** A second built worktree needs another 6 GB and the
   disk has none to spare. Child worktrees run `npm ci`, Jest and `tsc` only.
8. **Background jobs can die with the command.** Start Metro and drive the app inside one script,
   or start Metro with a persistent background job and stop it by port (`lsof -ti :8081 | xargs kill`).
9. **Shared caches.** `~/Library/Caches/ReactNative` (457 MB) and `~/Library/Caches/CocoaPods`
   (1.1 GB) were filled by the first build and are reused by later builds.

10. **A new native build after the cleanup is a full build.** `npx expo run:ios` runs `pod install`
    first (about 3 min from the CocoaPods cache) and then compiles everything (about 23 min for Debug,
    about 6 GB of disk). Check the free space first.
11. **Deep-link confirmation.** `xcrun simctl openurl <udid> "ccspike://spike?action=…"` showed an
    "Open in CoachCal Spike?" dialog in T1 and none in T6. Automation taps **Open** when the dialog is
    there.
12. **Metro with `CI=1` never reloads.** After a JS change, restart Metro, terminate the app and
    launch it again, or it keeps the old bundle.
13. **React Compiler caches zero-argument calls.** A component that reads a module-level store through
    a plain function call renders once and never updates. Read it through `useSyncExternalStore` with a
    stable snapshot. Jest does not catch this.
14. **Hermes has no `crypto.randomUUID`** in this setup; `apps/mobile/src/spike/uuid.ts` builds v4 ids.
15. **`axe tap --label` misses the glass tab bar and the Health sheet**; use coordinates there
    (402 × 874 pt, screenshots are about 2.29 times larger).
16. **`scripts/measure.sh` printed a stray `unavailable` line** after the real footprint in its first
    two runs (pipefail plus an early `exit` in awk). Fixed; the two evidence files carry a note.

## Proof of the base commit

- `evidence/t0-base/skeleton-first-run-iphone17pro-ios26.4.png`: the skeleton running on the
  iOS 26.4 Simulator, NativeTabs bar with two tabs, the kcal number computed by `@coachcal/core`.
- Build log ended with `› Build Succeeded`, `› Installing on iPhone 17 Pro`, `exit=0`.
- `npm test`: 4 suites, 6 tests passed. `npm run typecheck`: clean in all four workspaces.
