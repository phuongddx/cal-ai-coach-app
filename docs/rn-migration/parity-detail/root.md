# Root parity detail (U-51)

Per-row record of the composition root, root gate, telemetry seam and debug console. Source of truth:
`native/App/CoachCal/RootView.swift`, `AppEnvironment.swift`, `PersistenceBootstrap.swift`,
`MainShell.swift`, `CoachCalApp.swift`, `native/App/Features/Health/HealthKitService.swift` (the
`burnAddBackEnabled` key). Test evidence: `apps/mobile/src/platform/**/*.test.*` and
`apps/mobile/src/debug/*.test.*`, run by `npm test`.

## Files

| Swift source | RN file | Notes |
|---|---|---|
| RootView.swift (gate rule) | `platform/rootGate.ts` | Pure `decideRootGate(state)` → `wait` / `sign-in` / `onboarding` / `shell` |
| RootView.swift + AppEnvironment `onboardingPending` | `platform/rootController.ts`, `platform/useRootGate.ts` | External store over the session, the flags and local writes; the gate re-decides without a route-file edit |
| AppEnvironment.swift launch, PersistenceBootstrap.swift | `platform/launchSequence.ts` | Pure, injected: session → stored flag → target → data binding, once |
| (real wiring of the above) | `platform/rootRuntime.ts` | The only file that imports the real runtime; `getRootController()` singleton |
| AppEnvironment.swift `performLocalAccountReset` (~300–340) | `platform/accountReset.ts`, `platform/accountResetDeps.ts`, `platform/storedFlags.ts` | Pure order + real wiring + the two stored keys |
| AppEnvironment.swift (the `AppEnvironment` object) | `platform/appEnvironment.tsx`, `platform/appEnvironmentDeps.ts` | One React context: data, session, api factory, clock, flags, telemetry, `openScan`, `resetLocalData` |
| AppEnvironment.swift Sentry/PostHog setup (~483–600) | `platform/telemetry/telemetry.ts`, `index.ts` | No SDK imported; default sink is a no-op |
| AppEnvironment.swift `DebugLaunchArguments.parse` (50–110) | `debug/launchArgs.ts` | `flagsFromArguments`, same names |
| RootView.swift `Group` / MainShell.swift | `app/_layout.tsx` | `Stack.Protected` groups from the gate; `(tabs)` is the shell |
| (debug build only) | `app/debug.tsx` | Flags card |

## Per parity row

| Row | Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|---|
| PL-01 | Not ready → wait | RootView.swift | rootGate.ts | `rootGate.test.ts` "waits while the launch sequence has not finished" |
| PL-01 | Sign-in required and no session → sign-in | RootView.swift | rootGate.ts | `rootGate.test.ts` "asks for sign-in…", "does not ask for sign-in when it is not required…"; `rootController.test.ts` "shows sign-in when sign-in is required…" |
| PL-01 | A target exists or onboarding is pending → shell | RootView.swift | rootGate.ts | `rootGate.test.ts` "shows the shell when a target exists", "…when onboarding is pending…"; `rootController.test.ts` "shows the shell at once when onboarding is pending" |
| PL-01 | Otherwise → onboarding; the shell once a target is saved | RootView.swift | rootGate.ts, rootController.ts | `rootGate.test.ts` "shows onboarding when there is no target…"; `rootController.test.ts` "shows onboarding when there is no target, then the shell once a local write saved one" |
| PL-01 | The gate waits for the session and the target before it decides | RootView.swift (`isReady`) | rootController.ts | `rootController.test.ts` "waits for the session and the target before it decides" |
| PL-01 | Signing in re-reads the target for that user | AppEnvironment.swift (onboarding saved under `currentUserId`) | rootController.ts, launchSequence.ts `targetOwners` | `rootController.test.ts` "moves from sign-in to the shell when the session arrives…"; `launchSequence.test.ts` "reads the target for the demo persona, and also for the session user…" |
| PL-01 | Stale target reads never overwrite a newer answer | (RN-only: async reads) | rootController.ts | `rootController.test.ts` "does not let an older target read overwrite a newer answer" |
| PL-01 | Account reset sends the user back to onboarding | AppEnvironment.swift reset + RootView.swift | rootController.ts `handleReset` | `rootController.test.ts` "goes to onboarding after an account reset…" |
| PL-01 | Stack groups follow the gate (sign-in, onboarding, shell; scan, diary, settings in the shell group; debug always) | RootView.swift, MainShell.swift | app/_layout.tsx | `rootController.test.ts` (route decisions); `src/__tests__/routes.test.tsx` (route list unchanged). The `Stack.Protected` render itself is not Jest-run: see findings |
| PL-02 | Launch order: session load, stored flag read, target read, data binding | AppEnvironment.swift launch | launchSequence.ts | `launchSequence.test.ts` "loads the session, reads the stored flag, reads the target, then starts the data binding" |
| PL-02 | Sync triggers start once (data binding is the only starter) | AppEnvironment.swift | launchSequence.ts, rootController.ts | `launchSequence.test.ts` "starts the data binding … exactly once"; `rootController.test.ts` "runs the launch sequence once however often start is called…"; `rootRuntime.test.ts` "…then starts the sync triggers once" |
| PL-02 | Launch survives a failing keychain, flag read or target read | AppEnvironment.swift (`try?` paths) | launchSequence.ts | `launchSequence.test.ts` "keeps launching when the keychain, the flag or the target read fails" |
| PL-02 | `--ccFreshStart` wipes local data first | AppEnvironment.swift (removes the database files) | launchSequence.ts, rootRuntime.ts `wipeLocalData` | `launchSequence.test.ts` "wipes the local data first under --ccFreshStart…" |
| PL-02 | `--ccSeedNoTargets` sets onboarding pending | AppEnvironment.swift (~411) | launchSequence.ts | `launchSequence.test.ts` "marks onboarding pending only for --ccSeedNoTargets…" |
| PL-02 | Real wiring over SQLite and the keychain: stored ED-safe, target, session before the gate | AppEnvironment.swift | rootRuntime.ts | `rootRuntime.test.ts` (first two cases) |
| PL-02 | `--ccForceOffline` puts the sync engine offline, at launch and on flip | AppEnvironment.swift | rootRuntime.ts `applyForcedOffline` | `rootRuntime.test.ts` "puts the sync engine offline for --ccForceOffline…" |
| PL-02 | Account reset order: server, session, stored flags, ED-safe off, local rows, widget, gate | AppEnvironment.swift `performLocalAccountReset` | accountReset.ts | `accountReset.test.ts` "calls the server, forgets the session, clears the flags…" |
| PL-02 | Local sign-out skips the server call | AppEnvironment.swift | accountReset.ts | `accountReset.test.ts` "skips the server call for a plain local sign-out" |
| PL-02 | A failing server cascade or keychain never blocks the local wipe | AppEnvironment.swift | accountReset.ts | `accountReset.test.ts` "forgets this device even when the server cascade and the keychain fail" |
| PL-02 | No reset announced when a local step fails | AppEnvironment.swift | accountReset.ts | `accountReset.test.ts` "does not announce a reset when a local step fails" |
| PL-02 | Reset removes local rows, stored flags and the session (real SQLite + keychain) | AppEnvironment.swift | accountReset.ts, accountResetDeps.ts | `accountReset.test.ts` "removes the local rows, the stored flags and the session" |
| PL-02 | Every user table is wiped, never SQLite's own | AppEnvironment.swift (database removal) | accountReset.ts `listUserTables` | `accountReset.test.ts` "lists every table except SQLite's own" |
| PL-02 | Stored keys `edSafeMode` / `burnAddBackEnabled` round trip as `'1'` / `'0'` | AppEnvironment.swift, HealthKitService.swift | storedFlags.ts | `accountReset.test.ts` "round-trips as "1" and "0" under the Swift key" |
| PL-02 | One React environment for every screen; a clear error outside the provider | AppEnvironment.swift (`@Environment`) | appEnvironment.tsx | `appEnvironment.test.tsx` (both cases) |
| PL-02 | Telemetry: allow-listed event passes, any other is dropped | AppEnvironment.swift allow-list | telemetry/telemetry.ts | `telemetry.test.ts` "passes an event that is on the allow-list…", "drops an event that is not on the allow-list…" |
| PL-02 | Nothing leaves the device by default | AppEnvironment.swift | telemetry/telemetry.ts | `telemetry.test.ts` "sends nothing anywhere by default" |
| PL-02 | Scrub drops photo, health, calorie keys and text; case-insensitive | AppEnvironment.swift `disallowedPayloadFragments` | telemetry/telemetry.ts | `telemetry.test.ts` "drops photo, health and calorie keys and text…", "recognises the disallowed fragments without regard to case", "drops values a sink cannot carry" |
| PL-05 | Seven launch arguments parsed as `DebugLaunchArguments.parse` does (switches by exact name; scan scenario `=` or next arg; fixed clock next-arg ISO 8601) | AppEnvironment.swift 50–110 | debug/launchArgs.ts | `launchArgs.test.ts` (all cases) |
| PL-05 | `--ccScanScenario` and `--ccFixtureCapture` unchanged (Swift: CameraCaptureService.swift) | CameraCaptureService.swift | debug/launchArgs.ts | `launchArgs.test.ts` "reads a scan scenario written with an equals sign or as the next argument" |
| PL-05 | Fixed clock feeds the data environment clock | AppEnvironment.swift (`now`) | data/environment.ts | `launchArgs.test.ts` fixed-clock cases; `rootRuntime.test.ts` "feeds the data environment clock from --ccFixedClock" |
| PL-05 | Flags card: one switch per flag, plus ED-safe | debug build | app/debug.tsx | `debugConsoleFlags.test.tsx` "shows one switch per flag…", "presses a switch and the flag changes", "presses the ED-safe switch and the live mode changes", "shows a flag changed from outside the console" |
| PL-05 | Reading real process arguments | `ProcessInfo.arguments` | not ported | Needs a native module: native slot (U-50) |
| PL-08 (launch half) | Stored ED-safe plus `--ccEDSafe` set the live mode at launch | AppEnvironment.swift, EdSafe.swift | launchSequence.ts, storedFlags.ts | `launchSequence.test.ts` "applies the stored ED-safe mode, and the --ccEDSafe flag forces it on"; `rootRuntime.test.ts` "reads the stored ED-safe flag…" |
| PL-08 (launch half) | Reset turns ED-safe off and removes the stored key | AppEnvironment.swift | accountReset.ts | `accountReset.test.ts` first and "removes the local rows…" cases |
| PL-08 (launch half) | Console ED-safe switch changes the live mode | debug build | app/debug.tsx | `debugConsoleFlags.test.tsx` "presses the ED-safe switch…" |
