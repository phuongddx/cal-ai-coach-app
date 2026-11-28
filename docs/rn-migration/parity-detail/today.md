# Parity detail — today (U-33)

Per parity row: each behavior, its Swift source, its TypeScript file, and the Jest case that proves it.
Swift sources under `native/App/Features/Today/` (`TodayFlow`, `TodayModel.swift`, `TodayView.swift`,
`WeekStripView.swift`) and the shell's `ScanFAB` (`MainShell.swift`); TypeScript under
`apps/mobile/src/features/today/` (feature) and `apps/mobile/src/app/(tabs)/index.tsx` (route, the only file
that touches the composition). Jest files under `apps/mobile/src/features/today/__tests__/`.

**Status of the visuals.** Behavior, identifiers and tests are the base. U-76 (stage A, JS only) restyles Today on
Ember: the frames "Today (light)", "Today (dark, offline)" and "Today (ED-Safe)". There are no screenshot rows
here on purpose: the Simulator evidence is stage B of U-76 (`evidence/ember/U-76.md`). What U-76 changed is in
`findings/U-76.md`.

## TD-01 — Today screen

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Totals (eaten, remaining, macros) are the `@coachcal/core` sum of the day's meals; a meal without kcal counts 0 | `TodayModel.swift` (`snapshot`) | `todayModel.ts` (`sumMacros`) | `todayModel.test.ts` › "totals follow @coachcal/core sumMacros, a meal without kcal counting 0"; `TodayView.test.tsx` › "shows the totals computed from the meals through the core rule" |
| The model reads the four sources (meals with details, active target, water logs, streak) and is not loaded before the first read | `TodayModel.swift` (ValueObservation) | `todayModel.ts` + `todayReaders.ts` | `todayModel.test.ts` › "reads the four sources for the owner and the day, and is not loaded before the first read" |
| No target: no goal and the default 8 glasses | `TodayModel.swift` | `todayModel.ts` | `todayModel.test.ts` › "shows no goal and the default 8 glasses until a target exists" |
| Re-read on the sync runtime signal; a slower earlier read cannot overwrite a newer one; a failed read keeps the last snapshot; a disposed model stops reading | `TodayModel.swift` (observation) + rule 19 | `todayModel.ts` (`subscribe`, `refresh`, `dispose`) | `todayModel.test.ts` › "re-reads on the sync runtime signal"; "a slower read that started earlier cannot overwrite a newer one"; "keeps the last snapshot when a read fails"; "a disposed model stops reading" |
| Selecting another day re-queries that day's meals; selecting the same day does nothing | `TodayModel.swift` (`select`) | `todayModel.ts` | `todayModel.test.ts` › "selecting another day re-queries the meals of that day; selecting the same day does nothing"; `TodayScreen.test.tsx` › "testSeededLaunchShowsRingWeekStripAndSelectionRequeriesDiary" |
| Week strip: last seven days, oldest first, ending today; the day progress is the elapsed fraction | `WeekStripView.swift` | `WeekStripView.tsx` + `todayModel.ts` | `todayModel.test.ts` › "the week strip is the last seven days, oldest first, ending today; day progress is the elapsed fraction"; `TodayView.test.tsx` › "marks the selected day cell and exposes the weekday-and-date label" |
| The date selector (now the date subtitle of the header) toggles the week strip | `TodayView.swift` | `TodayView.tsx` (`today.dateSelector`) | `TodayView.test.tsx` › "the date selector toggles the week strip"; "puts the date over the title and the calendar glass button on the right" |
| Meal rows list the day's meals with the title-only label; a row, the header calendar button ("Open diary") and the "Diary" link of the Meals head open the diary for that day | `TodayView.swift` (recent meals) | `TodayView.tsx` (`today.foodRow`, `today.openDiary`, `today.mealsDiary`) | `TodayView.test.tsx` › "lists the meals as today.foodRow with the title-only label, newest data from the model"; "a meal row and the Open diary link open the diary for that day"; "the Diary link of the Meals head opens the diary for the selected day" |
| The caution chip "Offline · syncs later" in the header only while offline; a meal that waits for the sync carries "syncs later" in its meta (U-76: the info banner of the earlier screen is gone) | `TodayView.swift` | `TodayView.tsx` (`offline.badge`) + route (`isOfflineFrom`) | `TodayView.test.tsx` › "shows the offline chip in the header only when offline"; "adds \"syncs later\" to a meal that waits for the sync and to no other" |
| Water card opens the water sheet; a quick add clamps at 0 and writes the delta for the selected day, then notifies | `TodayModel.swift` (`logWaterDelta`) | `todayModel.ts` + `features/diary/screens/WaterCard.tsx` | `todayModel.test.ts` › "water quick add writes the delta for the selected day and notifies"; "water quick add clamps so the day total never goes below 0"; `TodayView.test.tsx` › "the water card opens the water sheet and a quick add writes through the model" |
| The model's steps code (no reader: "—"; the count after the just-in-time ask; "Connect" when access was denied) stays; the screen no longer draws a Steps card and no longer triggers the ask (U-76: not in the frames; it returns with the Apple Health steps) | `TodayModel.swift` (steps) | `todayModel.ts`, `todayReaders.ts` | `todayModel.test.ts` › "the Steps card shows \"—\" with no reader, then the count after the JIT ask"; "the Steps card says \"Connect\" when access was denied"; `TodayView.test.tsx` › "draws no Health Score card and no Steps card"; "does not ask HealthKit for the steps when the screen appears" |
| Empty state when no target exists: verbatim copy, a Start setup entry point, never a blank screen | `TodayView.swift` (empty state) | `TodayView.tsx` (`today.emptyState`, `today.startSetup`) | `TodayScreen.test.tsx` › "testNoTargetsLaunchShowsVerbatimEmptyStateNeverBlank" |
| The state matrix of the Swift snapshot: ring label, Eaten and Goal figures (or the ED-safe guidance), meals with and without kcal in four states | `TodayDiarySnapshotTests.todayScreenSnapshotMatrix` | `TodayView.tsx` | `TodayScreen.test.tsx` › "todayScreenSnapshotMatrix" (asserts what the snapshot shows; pixels are not compared in Jest) |
| ED-safe: ring switches to weekly framing ("On track", fraction of day), Eaten and Goal and the meal kcal dropped, the guidance sentence "Steady meals keep energy even. {Meal} is next." (the meal by the clock) takes the right column, the macro grid, the water card and the streak stay. The policy lives in the design components (`CalorieRing` with `aside` and `edSafeAside`): no `edSafe` call under `features/today` | `TodayView.swift` (`.edSafeHidden()`), `CCCalorieRing` | `TodayView.tsx` (components own it) | `TodayView.test.tsx` › "under ED-safe the components drop Eaten and Goal, the number left and the meal kcal; the streak stays"; "under ED-safe shows the guidance sentence naming the next meal by the clock, and no number"; "under ED-safe the macro grid, the water card and the badges stay and no red over state is drawn"; `TodayScreen.test.tsx` › "testEDSafeRemovesHealthScoreAndSwitchesRingToWeeklyFraming" |
| The Scan button floats over the tab bar and never covers a meal's kcal: the list's bottom padding is the safe area + the button's offset and height + the xl5 gap | `MainShell.swift` (`ScanFAB`, `.padding(.bottom, 28)`), CCSpace.xl5 | `ScanFab.tsx`; `TodayView.tsx` (`todayBottomPadding`) | `TodayView.test.tsx` › "reserves the bottom inset below the last meal so the Scan button never covers a kcal"; `ScanFab` › "is the shell.fab button labelled \"Scan food\" and fires onPress"; "draws a camera glyph on the accent fill at the fab size (U-76, frame: orange with a camera)" |
| Ember card: the ring (`md`, 150 pt, 13 pt stroke) with "kcal left" in the centre and Eaten / Goal on the right; the number left stays on one line (shrinks to fit) | `CCCalorieRing` | `design/components/CalorieRing.tsx` (`md`, `aside`, `edSafeAside`) + `ScaledNumber.tsx` (`fitWidth`); `TodayView.tsx` (`HeroCard`) | `TodayView.test.tsx` › "shows Eaten and Goal beside the ring, with the grouped numbers of the frame"; "keeps a four-digit number left on one line (props the ring passes; the pixels are stage B)". The fit itself is a layout fact (Jest does not measure text): proven on the Simulator in stage B. Seen once before U-76: "1607" wrapped into "16 / 07" |
| Macro grid 2 by 2 (Protein, Carbs, Fat, Fiber): labels and values on one line, no cell cut at the screen edge | `TodayView.swift` (macros) | `TodayView.tsx` (`MacroGrid`) | `TodayView.test.tsx` › "lays the four macros out as a 2 by 2 grid whose labels and values never wrap" (props; the pixels are stage B) |
| Header: the date over "Today", the calendar glass button; week strip of 44 by 56 cells; streak card with the flame; Meals head with the "Diary" link; the empty meals text | frames 07 to 09 | `TodayView.tsx`, `WeekStripView.tsx` | `TodayView.test.tsx` › "puts the date over the title and the calendar glass button on the right"; "shows the streak as the frame does: flame tile, title and freeze line"; "says so under Meals when the day has none"; "marks the selected day cell and exposes the weekday-and-date label" |

## Identifier table

Each Swift `accessibilityIdentifier` is the `testID` of the same element; labels are the accessibility labels.
Column "U-76": kept, added, removed, or changed role.

| testID | Element | TypeScript | U-76 |
|---|---|---|---|
| `today.scroll` | the list's scroll view | `TodayView.tsx` | kept |
| `today.dateSelector` (label "Select date", hint "Shows or hides the week strip") | the date subtitle of the header; it toggles the week strip | `TodayView.tsx` | kept; was the date with a chevron, now the subtitle over the title |
| `today.openDiary` (label "Open diary") | the calendar glass button of the header; opens the diary for the selected day | `TodayView.tsx` | kept; role changed: was the text link "Open diary" in the Recent meals head, now the glass button |
| `today.weekStrip` / `today.dayCell` (label = weekday and date) | week strip and its seven cells | `WeekStripView.tsx` | kept; cells 44 by 56 |
| `today.ring` | the ember card holding the ring and its right column | `TodayView.tsx` | kept; the wrapper now holds the ring and the aside |
| `today.eaten` / `today.goalKcal` (label "Eaten 784 kilocalories") | the "Eaten" and "Goal" figures; under ED-safe empty wrappers keep the identifiers | `TodayView.tsx` | **added** (the frame's right column; replaces the line "of N kcal goal") |
| `today.edSafeGuidance` | the ED-safe guidance sentence | `TodayView.tsx` | **added** (frame 09) |
| `today.macroRow` | one row of the macro grid (two rows) | `TodayView.tsx` | **added** |
| `today.macroCard.<protein\|carbs\|fat\|fiber>` (label "Protein 82 of 130 grams") | one cell of the macro grid | `TodayView.tsx` | **added** (replaces the three mini cards and the fiber card, which had no identifier) |
| `today.healthScore` | Health Score card | — | **removed**: not in the frames, always showed a dash; returns with a score engine |
| `today.stepsCard` | Steps card | — | **removed**: not in the frames, showed a dash; returns with the Apple Health steps |
| `today.waterCard` | the water card (U-74's component) | `features/diary/screens/WaterCard.tsx` | kept, mounted as it is |
| `today.streakCard` (label "12 day streak, 1 freeze left" for the seed) | streak card | `TodayView.tsx` | kept; flame tile and freeze line |
| `today.recentMeals` / `today.foodRow` (label "Meal: <title>") | the meals card and its rows | `TodayView.tsx` | kept; the head is now "Meals" |
| `today.mealsDiary` (label "Diary") | the "Diary" link of the Meals head | `TodayView.tsx` | **added** |
| `today.emptyState` / `today.startSetup` | no-target empty state and its entry point | `TodayView.tsx` | kept |
| `offline.badge` | the caution chip "Offline · syncs later" in the header | `TodayView.tsx` | kept; was the DS badge below the title, now the chip on the caution tokens |
| `shell.fab` (label "Scan food") | the Scan button | `ScanFab.tsx` | kept; accent circle, camera glyph |

## Adaptations

- A pixel snapshot cannot run in Jest. The matrix twin asserts what the Swift snapshot shows in each state;
  the pixels are Simulator screenshots, which belong to the Ember restyle unit (this unit carries none).
- The Swift UI tests launch the app with `--cc*` arguments. Until U-51, under `__DEV__` the route takes
  `?seed=1` (demo persona, once) and `?edSafe=0|1`; the Jest twins seed through `createSeedDataManager`
  and set ED-safe through the design setter.
