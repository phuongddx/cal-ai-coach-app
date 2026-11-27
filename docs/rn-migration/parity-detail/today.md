# Parity detail — today (U-33)

Per parity row: each behavior, its Swift source, its TypeScript file, and the Jest case that proves it.
Swift sources under `native/App/Features/Today/` (`TodayFlow`, `TodayModel.swift`, `TodayView.swift`,
`WeekStripView.swift`) and the shell's `ScanFAB` (`MainShell.swift`); TypeScript under
`apps/mobile/src/features/today/` (feature) and `apps/mobile/src/app/(tabs)/index.tsx` (route, the only file
that touches the composition). Jest files under `apps/mobile/src/features/today/__tests__/`.

**Status of the visuals.** Behavior, identifiers and tests are the base; the pixels still follow the SwiftUI
design. The Ember restyle of Today is the next unit. There are no screenshot rows here on purpose: no
Simulator evidence of the old design is carried by this unit.

## TD-01 — Today screen

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Totals (eaten, remaining, macros) are the `@coachcal/core` sum of the day's meals; a meal without kcal counts 0 | `TodayModel.swift` (`snapshot`) | `todayModel.ts` (`sumMacros`) | `todayModel.test.ts` › "totals follow @coachcal/core sumMacros, a meal without kcal counting 0"; `TodayView.test.tsx` › "shows the totals computed from the meals through the core rule" |
| The model reads the four sources (meals with details, active target, water logs, streak) and is not loaded before the first read | `TodayModel.swift` (ValueObservation) | `todayModel.ts` + `todayReaders.ts` | `todayModel.test.ts` › "reads the four sources for the owner and the day, and is not loaded before the first read" |
| No target: no goal and the default 8 glasses | `TodayModel.swift` | `todayModel.ts` | `todayModel.test.ts` › "shows no goal and the default 8 glasses until a target exists" |
| Re-read on the sync runtime signal; a slower earlier read cannot overwrite a newer one; a failed read keeps the last snapshot; a disposed model stops reading | `TodayModel.swift` (observation) + rule 19 | `todayModel.ts` (`subscribe`, `refresh`, `dispose`) | `todayModel.test.ts` › "re-reads on the sync runtime signal"; "a slower read that started earlier cannot overwrite a newer one"; "keeps the last snapshot when a read fails"; "a disposed model stops reading" |
| Selecting another day re-queries that day's meals; selecting the same day does nothing | `TodayModel.swift` (`select`) | `todayModel.ts` | `todayModel.test.ts` › "selecting another day re-queries the meals of that day; selecting the same day does nothing"; `TodayScreen.test.tsx` › "testSeededLaunchShowsRingWeekStripAndSelectionRequeriesDiary" |
| Week strip: last seven days, oldest first, ending today; the day progress is the elapsed fraction | `WeekStripView.swift` | `WeekStripView.tsx` + `todayModel.ts` | `todayModel.test.ts` › "the week strip is the last seven days, oldest first, ending today; day progress is the elapsed fraction"; `TodayView.test.tsx` › "marks the selected day cell and exposes the weekday-and-date label" |
| The date selector toggles the week strip | `TodayView.swift` | `TodayView.tsx` (`today.dateSelector`) | `TodayView.test.tsx` › "the date selector toggles the week strip" |
| Meal rows list the day's meals with the title-only label; a row and "Open diary" open the diary for that day | `TodayView.swift` (recent meals) | `TodayView.tsx` (`today.foodRow`, `today.openDiary`) | `TodayView.test.tsx` › "lists the meals as today.foodRow with the title-only label, newest data from the model"; "a meal row and the Open diary link open the diary for that day" |
| Offline banner and badge only while offline | `TodayView.swift` | `TodayView.tsx` (`offline.badge`) + route (`isOfflineFrom`) | `TodayView.test.tsx` › "shows the offline banner and badge only when offline" |
| Water card opens the water sheet; a quick add clamps at 0 and writes the delta for the selected day, then notifies | `TodayModel.swift` (`logWaterDelta`) | `todayModel.ts` + `features/diary/screens/WaterCard.tsx` | `todayModel.test.ts` › "water quick add writes the delta for the selected day and notifies"; "water quick add clamps so the day total never goes below 0"; `TodayView.test.tsx` › "the water card opens the water sheet and a quick add writes through the model" |
| Steps card: "—" with no HealthKit reader, the count after the just-in-time ask, "Connect" when access was denied | `TodayModel.swift` (steps) | `todayModel.ts`, `todayReaders.ts` | `todayModel.test.ts` › "the Steps card shows \"—\" with no reader, then the count after the JIT ask"; "the Steps card says \"Connect\" when access was denied"; `TodayView.test.tsx` › "the Steps card shows \"—\" while no HealthKit reader exists" |
| Empty state when no target exists: verbatim copy, a Start setup entry point, never a blank screen | `TodayView.swift` (empty state) | `TodayView.tsx` (`today.emptyState`, `today.startSetup`) | `TodayScreen.test.tsx` › "testNoTargetsLaunchShowsVerbatimEmptyStateNeverBlank" |
| The state matrix of the Swift snapshot: ring label, goal line, Health Score card, meals with and without kcal in four states | `TodayDiarySnapshotTests.todayScreenSnapshotMatrix` | `TodayView.tsx` | `TodayScreen.test.tsx` › "todayScreenSnapshotMatrix" (asserts what the snapshot shows; pixels are not compared in Jest) |
| ED-safe: ring switches to weekly framing ("On track", fraction of day), Health Score card removed, goal line and meal kcal dropped, streak stays. The policy lives in the design components: no `edSafe` call under `features/today` | `TodayView.swift` (`.edSafeHidden()`), `CCCalorieRing` | `TodayView.tsx` (components own it) | `TodayView.test.tsx` › "under ED-safe the components drop the goal line, the Health Score card and the meal kcal; the streak stays"; `TodayScreen.test.tsx` › "testEDSafeRemovesHealthScoreAndSwitchesRingToWeeklyFraming" |
| The Scan button floats over the tab bar and never covers a meal's kcal: the list's bottom padding is the safe area + the button's offset and height + the xl5 gap | `MainShell.swift` (`ScanFAB`, `.padding(.bottom, 28)`), CCSpace.xl5 | `ScanFab.tsx`; `TodayView.tsx` (`todayBottomPadding`) | `TodayView.test.tsx` › "reserves the bottom inset below the last meal so the Scan button never covers a kcal"; `ScanFab` › "is the shell.fab button labelled \"Scan food\" and fires onPress" |
| Hero ring: the remaining number stays on one line (shrinks to fit) | `CCCalorieRing` | `design/components/CalorieRing.tsx` + `ScaledNumber.tsx` (`fitWidth`) | not covered by Jest (a layout fact: Jest does not measure text). Seen on the Simulator: "1607" wrapped into "16 / 07" before the fix |

## Identifier table

Each Swift `accessibilityIdentifier` is the `testID` of the same element; labels are the accessibility labels.

| testID | Element | TypeScript |
|---|---|---|
| `today.scroll` | the list's scroll view | `TodayView.tsx` |
| `today.dateSelector` (label "Select date") | the header date selector that toggles the week strip | `TodayView.tsx` |
| `today.weekStrip` / `today.dayCell` (label = weekday and date) | week strip and its seven cells | `WeekStripView.tsx` |
| `today.ring` | the kcal ring card | `TodayView.tsx` |
| `today.healthScore` | Health Score card (absent in ED-safe) | `TodayView.tsx` |
| `today.stepsCard` | Steps card | `TodayView.tsx` |
| `today.streakCard` (label "12 day streak, 1 freeze left" for the seed) | streak card | `TodayView.tsx` |
| `today.recentMeals` / `today.foodRow` (label "Meal: <title>") | the recent meals list and its rows | `TodayView.tsx` |
| `today.openDiary` (label "Open diary") | link to the diary day sheet | `TodayView.tsx` |
| `today.emptyState` / `today.startSetup` | no-target empty state and its entry point | `TodayView.tsx` |
| `offline.badge` | offline badge | `TodayView.tsx` |
| `shell.fab` (label "Scan food") | the Scan button | `ScanFab.tsx` |

## Adaptations

- A pixel snapshot cannot run in Jest. The matrix twin asserts what the Swift snapshot shows in each state;
  the pixels are Simulator screenshots, which belong to the Ember restyle unit (this unit carries none).
- The Swift UI tests launch the app with `--cc*` arguments. Until U-51, under `__DEV__` the route takes
  `?seed=1` (demo persona, once) and `?edSafe=0|1`; the Jest twins seed through `createSeedDataManager`
  and set ED-safe through the design setter.
