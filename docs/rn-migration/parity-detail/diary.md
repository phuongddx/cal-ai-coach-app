# Parity detail — diary (U-32)

Per parity row: each behavior, its Swift source, its TypeScript file, and the Jest case that proves
it. Swift sources under `native/App/Features/Diary/` plus `native/App/Features/Today/TodayModel.swift`
(the water half); TypeScript under `apps/mobile/src/features/diary/` (feature) and
`apps/mobile/src/app/diary.tsx` (route). Jest files under `apps/mobile/src/features/diary/__tests__/`.
The model twin runs on a fresh seeded sql.js database per test with the REAL snapshot loader (the
live-diary join and its localtime day grouping are part of the behavior under test).

## DY-01 — diary day screen and model

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Day sections in slot order, live-diary join, soft-deleted rows never render | `DiaryDayModel.swift` (ValueObservation SQL) | `diarySnapshot.ts` (`createDiaryDayLoader`) + `diaryDayModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "tombstone removes join row and enqueues exactly one pending op" |
| Day boundary groups by the LOCAL calendar day at every edge (CR-02) | `DiaryDayModel.swift` (`date(e.created_at, 'localtime')`) | `diarySnapshot.ts` | `__tests__/DiaryWaterExercise.test.ts` › "diary day boundary groups by local calendar day" |
| Section kcal sums the detail values produced by KcalArithmetic | `DiaryDayModel.swift` (`sectionKcal`, `eatenKcal`) | `diaryDayModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "section kcal sums detail values produced by KcalArithmetic" |
| Delete tombstones the mirror row and removes the detail row | `DiaryDayModel.swift` (`delete`, `deleteEntry`) | `diaryDayModel.ts` (`delete`, `deleteEntry`) | `__tests__/DiaryWaterExercise.test.ts` › "tombstone removes join row and enqueues exactly one pending op" |
| Date pager, Eaten/Goal/Left summary, section headers with emoji and kcal, dashed add buttons, exercise section | `DiaryDayView.swift` | `screens/DiaryDayView.tsx` | `__tests__/DiaryDayView.test.tsx` › "the day sheet renders the date pager, the summary and the sections"; "the next day pager button is disabled on today" |
| Food row caption: grams with the confidence badge or the "from search" source (frame; Ember) | — (frame addition) | `screens/DiaryDayView.tsx` (`FoodItemRow`) | `__tests__/DiaryDayView.test.tsx` › "the scanned food row shows its grams with the confidence badge"; "the search-logged food row shows the source caption when it has no confidence" |
| Exercise header with the burned figure (−N kcal, collapses under ED-safe) | — (frame addition) | `screens/DiaryDayView.tsx` + `diaryDayModel.ts` (`burnedKcal`) | `__tests__/DiaryDayView.test.tsx` › "the day sheet renders…"; "the summary card and the kcal clauses hide in the ED-safe mode" |
| Delete confirmation dialog (verbatim copy), destructive Delete / Cancel | `DiaryDayView.swift` (confirmationDialog) | `screens/DiaryDayView.tsx` | `__tests__/DiaryDayView.test.tsx` › "a long press on the food row opens the delete confirmation and Delete tombstones"; "Cancel leaves the entry in place" |
| Saved toast over the day sheet with Undo (tombstones every receipt entry) | `DiaryDayView.swift` (`undo`) | `screens/DiaryDayView.tsx` | `__tests__/DiaryDayView.test.tsx` › "a saved-meal re-log writes the batch, notifies, dismisses and toasts with Undo" |
| ED-safe hides the summary card, the section kcal and the exercise kcal; the policy stays in `EdSafeCollapse` (I7) | `DiaryDayView.swift` (`.edSafeHidden()`) | `screens/DiaryDayView.tsx` (`EdSafeCollapse`) | `__tests__/DiaryDayView.test.tsx` › "the summary card and the kcal clauses hide in the ED-safe mode" |
| The route opens as the diary sheet; `coachcal://diary?date=` picks the local day (WR-08) | `AppEnvironment.swift` (`linkDate`) | `src/app/diary.tsx` + `diaryMath.ts` (`linkDate`) | `__tests__/DiaryWaterExercise.test.ts` › "diary deep link date parses to local calendar day" |
| Model re-reads after every local write and sync run; notify fans out after writes | `DiaryDayModel.swift` (observation) + rule 19 | `diaryDayModel.ts` (`subscribe`, `refresh`, `deps.notify`) | exercised by every model twin; the route wires `getSyncRuntime().subscribe` |

## DY-02 — add food sheet with receipt and Undo

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Exactly five quick-action tiles (photo highlighted), saved-meals rail, backstop empty card | `AddFoodSheet.swift` | `screens/AddFoodSheet.tsx` | `__tests__/AddFoodSheet.test.tsx` › "the sheet opens on Lunch with the five quick-action tiles"; "an empty rail renders the backstop card"; "the rail renders one card per saved meal with the log label" |
| Capture tiles hand the scan mode over; Search opens the search stack | `AddFoodSheet.swift` + `AddFoodSheetRoute` | `screens/AddFoodSheet.tsx` (`AddFoodSheetRoute`, `onCapture`) | `__tests__/AddFoodSheet.test.tsx` › "the capture tiles hand the scan mode over and Search opens the search" |
| One-tap re-log decodes the payload, writes per-item kcal rows + one op per entry in ONE batch (WR-09) | `AddFoodSheetRoute.performRelog` | `addFoodModel.ts` (`performRelog`) | `__tests__/DiaryWaterExercise.test.ts` › "relog batch writes per item kcal and one op per entry" |
| Overlapping re-log batches complete whole, never half-written (WR-09) | GRDB pool serialization | `addFoodModel.ts` + `writeQueue.ts` | `__tests__/DiaryWaterExercise.test.ts` › "concurrent relog batches leave no partial state" (see findings: the batches run through the model's write queue) |
| Legacy `[{name, grams}]` payloads log unresolved (CR-01) | `SavedMealItem` (lenient Decodable) | `addFoodModel.ts` (`decodeSavedMealItems`) | `__tests__/DiaryWaterExercise.test.ts` › "relog payload decodes per item kcal leniently" |
| Re-logging a seeded rail meal lands the KcalArithmetic kcal (WR-10) | `AddFoodSheetRoute.performRelog` | `addFoodModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "seeded rail relog writes KcalArithmetic rows" |
| Receipt → toast, sheet dismissed; ED-safe drops the rail card's kcal line | `AddFoodSheetRoute.relog` + `AddFoodSheet` (`.edSafeHidden()`) | `screens/AddFoodSheet.tsx` | `__tests__/DiaryDayView.test.tsx` › "a saved-meal re-log writes the batch, notifies, dismisses and toasts with Undo" |

## DY-03 — food search

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Recents (limit 5) before a query; local LIKE search; zero network (LOG-04) | `FoodSearchModel.swift` | `foodSearchModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "custom food save then search finds it"; `__tests__/FoodSearchView.test.tsx` › "the search screen shows the Recent card before a query"; "a query surfaces the results card" |
| Debounced search at the model boundary (200 ms) | `FoodSearchModel.scheduleSearch` | `foodSearchModel.ts` (`setQuery`) | exercised by `__tests__/FoodSearchView.test.tsx` › "a query surfaces the results card" (the debounced applySearch resolves inside `findByText`) |
| Verbatim empty state + persistent Create custom food row | `FoodSearchView.swift` | `screens/FoodSearchView.tsx` | `__tests__/FoodSearchView.test.tsx` › "a query with no matches shows the verbatim empty state and the create entry" |
| Row footnote "kcal · protein g protein · basis" | `FoodSearchView.footnote` | `screens/FoodSearchView.tsx` | `__tests__/FoodSearchView.test.tsx` › "the search screen shows the Recent card before a query" |
| Custom foods join later searches (case-insensitive) | `FoodSearchModel.applySearch` | `foodSearchModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "custom food save then search finds it" |
| Search / Saved / Recent segment (Saved = the custom foods, Recent = today's recents; frame) | — (frame addition) | `screens/FoodSearchView.tsx` + `foodSearchModel.ts` (`getSaved`, `loadSaved`) | `__tests__/FoodSearchView.test.tsx` › "the segment switches between the search results, the saved customs and the recents" |
| Add button on every row, same action as the row tap (frame) | — (frame addition) | `screens/FoodSearchView.tsx` (`search.addRow.<id>`) | `__tests__/FoodSearchView.test.tsx` › "the add button logs the row like the row tap itself" |
| Dashed escape card: Describe (scan text mode) and Manual (frame) | — (frame addition) | `screens/FoodSearchView.tsx` (`search.escape.describe`, `search.escape.manual`) | `__tests__/FoodSearchView.test.tsx` › "the escape card hands over to the describe flow and to the manual entry" |
| ED-safe closes the row leak: the kcal footnote slot shows the serving size (or the basis string) and the figure returns when off (PL-08) | — (frame addition) | `screens/FoodSearchView.tsx` (`EdSafeCollapse`) | `__tests__/FoodSearchView.test.tsx` › "the search row shows the serving size in the ED-safe mode and the kcal figure when off" |

## DY-04 — custom food

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Per-100g / per-serving basis chips, serving-grams field on per-serving only | `CustomFoodSheet.swift` (Basis) | `screens/CustomFoodSheet.tsx` + `customFoodModel.ts` | `__tests__/CustomFoodSheet.test.tsx` › "the sheet shows the fields and the basis chips, per-100g selected first"; "the per-serving basis reveals the serving grams field" |
| Clamps: kcal 0–2000, gram fields 0–500, serving grams 0–5000; Save disabled without name/kcal | `CustomFoodSheet.save` / `clampedInt` / `canSave` | `customFoodModel.ts` | `__tests__/CustomFoodSheet.test.tsx` › "Save stays disabled without a name or a parsable kcal"; "saving clamps the kcal figure and reports the created row" |
| Saved through the catalog; later searches surface it (LOG-08) | `CatalogRepository.saveCustomFood` | `customFoodModel.ts` | `__tests__/DiaryWaterExercise.test.ts` › "custom food save then search finds it"; failed local write keeps the sheet: `__tests__/CustomFoodSheet.test.tsx` › "a failed local write keeps the sheet open for a retry" |
| ED-safe closes the nutrition-fields leak: the fields fold into the collapsed "Advanced" group (no blur — no package) and return flat when off (PL-08) | — (frame addition) | `screens/CustomFoodSheet.tsx` | `__tests__/CustomFoodSheet.test.tsx` › "the nutrition fields fold into the Advanced group in the ED-safe mode and unfold with it" |

## DY-05 — manual log, kcal always derived

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Manual kcal = round(per100g × grams / 100) at every stepper value (T-P04-01) | `ManualLogSheet.DiaryMath.manualKcal` | `diaryMath.ts` (`manualKcal` → core `roundKcal`) | `__tests__/DiaryWaterExercise.test.ts` › "manual log kcal matches KcalArithmetic at every stepper value" |
| Per-serving kcal scales by servings | `DiaryMath.servingKcal` | `diaryMath.ts` | `__tests__/DiaryWaterExercise.test.ts` › "serving kcal scales by servings" |
| The sheet live-recomputes; the save stores the derived kcal (integration) | `ManualLogSheet` | `screens/ManualLogSheet.tsx` | `__tests__/ManualLogSheet.test.tsx` › "the kcal live-recomputes through DiaryMath at every stepper value"; "saving passes the detail with the derived kcal, the grams and the slot"; per-serving grams × servings: "the per-serving save stores servingGrams × servings as grams" |
| The manual write goes through the diary repository (mirror + op, then detail) and notifies | `FoodSearchView.saveManual` | `manualLogModel.ts` (`createManualLogSaver`) | `__tests__/DiaryWaterExercise.test.ts` › "manual log kcal matches KcalArithmetic at every stepper value" (stored kcal 248, one op); `__tests__/FoodSearchView.test.tsx` › "saving a manual log writes the derived kcal, notifies and reports the receipt" |
| ED-safe closes the kcal leak: `manual.kcal` collapses behind the "No numbers needed." note card; grams and Save stay (PL-08) | — (frame addition) | `screens/ManualLogSheet.tsx` (`EdSafeCollapse`) | `__tests__/ManualLogSheet.test.tsx` › "the kcal figure swaps for the note card in the ED-safe mode and back when it is off" |

## DY-06 — exercise log

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Type field, 5-minute duration stepper, optional burned kcal | `ExerciseLogSheet.swift` | `screens/ExerciseLogSheet.tsx` | `__tests__/ExerciseLogSheet.test.tsx` › "the sheet shows the type field, the duration stepper and the optional kcal"; "the duration stepper moves in 5-minute steps" |
| Sheet clamps duration 0–600 and kcal 0–5000 (the repository clamps again) | `ExerciseLogSheet` ranges + repo (DB-06) | `screens/ExerciseLogSheet.tsx` (ranges) + `trackingRepository.addExercise` | `__tests__/ExerciseLogSheet.test.tsx` › "the burned kcal clamps into 0…5000 at the model boundary" |
| Save disabled without a type; save writes local-only (I4) and dismisses | `ExerciseLogSheet.save` + `DiaryDayModel.addExercise` | `diaryDayModel.ts` (`addExercise`) | `__tests__/ExerciseLogSheet.test.tsx` › "Save stays disabled while the type is empty"; "saving writes the exercise and dismisses the sheet"; the day query returns it: `__tests__/DiaryWaterExercise.test.ts` › "exercise add persists and day query returns it" |
| ED-safe closes the burned-kcal leak: `exercise.kcalField` hides behind "Activity and minutes only. Burned kcal is hidden." and returns when off (PL-08) | — (frame addition) | `screens/ExerciseLogSheet.tsx` (`EdSafeCollapse`) | `__tests__/ExerciseLogSheet.test.tsx` › "the burned kcal field hides behind the note in the ED-safe mode and returns when it is off" |

## DY-07 — water card and log sheet

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Quick-add delta clamped so the day total never goes below 0 ml; additive ledger rows | `TodayModel.logWaterDelta` | `waterModel.ts` (`createWaterModel`) | `__tests__/DiaryWaterExercise.test.ts` › "water quick add day total and clamp at zero" (see findings: the rule runs through the water model, Today is U-33) |
| Droplet tile (the frame's info-tint tile), ±250 ml chips, goal from targets (default 8) | `WaterCard.swift` / `WaterLogSheet.swift` | `screens/WaterCard.tsx` + `waterModel.ts` (`GLASS_ML`, `DEFAULT_GLASSES`) | `__tests__/WaterCard.test.tsx` › "the card shows the droplet tile, the glasses copy and the goal caption"; `__tests__/WaterLogSheet.test.tsx` › "the sheet shows the tile, the glasses and the day total"; chips: "the minus tile hands −250 to the quick-add" / "the plus tile hands +250 to the quick-add" |
| Water has no kcal framing and stays visible under ED-safe; the droplet tile is accessibility-hidden | `WaterCard.swift` | `screens/WaterCard.tsx` | policy by construction (no calorie ring reuse); tile a11y-hidden |
| Card tap opens the log sheet; Close dismisses | `TodayView.swift` (mount, U-33) / `WaterLogSheet` | `screens/WaterCard.tsx` | `__tests__/WaterCard.test.tsx` › "a tap hands over to the log sheet"; `__tests__/WaterLogSheet.test.tsx` › "Close dismisses the sheet" |

## Accessibility identifier inventory

Every `accessibilityIdentifier` of the Swift diary views is the `testID` of the same element (same
string). Swift sources: the `accessibilityIdentifier("…")` literals plus the `identifier:` argument
call sites (pager buttons, water tiles, custom-food fields).

| Swift identifier | Element | RN home |
|---|---|---|
| `diary.previousDay` / `diary.nextDay` | date pager buttons | `screens/DiaryDayView.tsx` `PagerButton` |
| `diary.foodRow` | food row (combined children) | `screens/DiaryDayView.tsx` `FoodItemRow` Pressable |
| `diary.addFood.breakfast` / `.lunch` / `.dinner` / `.snacks` | dashed add buttons | `screens/DiaryDayView.tsx` wrapper Views around `DashedAddButton` |
| `diary.exerciseRow` | exercise row | `screens/DiaryDayView.tsx` `ExerciseRowView` |
| `diary.addExercise` | add exercise button | `screens/DiaryDayView.tsx` Pressable |
| `diary.toast` | saved toast | `screens/DiaryDayView.tsx` wrapper View around `Toast` |
| `addfood.close` | sheet close | `screens/AddFoodSheet.tsx` |
| `addfood.tile.photo` / `.barcode` / `.label` / `.describe` / `.search` | quick-action tiles | `screens/AddFoodSheet.tsx` wrapper Views around `QuickActionTile` |
| `addfood.savedMealsEmpty` | empty rail card | `screens/AddFoodSheet.tsx` |
| `addfood.savedMeal` | rail card (label "Log saved meal, …") | `screens/AddFoodSheet.tsx` Pressable |
| `search.back` | back chevron | `screens/FoodSearchView.tsx` |
| `search.field` | search field | `screens/FoodSearchView.tsx` wrapper View around `SearchField` |
| `search.emptyState` | verbatim empty state | `screens/FoodSearchView.tsx` |
| `search.foodRow` | result row (label "Add food, …") | `screens/FoodSearchView.tsx` `FoodSearchRowView` |
| `search.segment.<value>` | segment option (added U-74, Ember frame) | `screens/FoodSearchView.tsx` |
| `search.addRow.<id>` | per-row add button (added U-74, Ember frame) | `screens/FoodSearchView.tsx` `FoodSearchRowView` |
| `search.escape.describe` / `search.escape.manual` | escape card actions (added U-74, Ember frame) | `screens/FoodSearchView.tsx` |
| `search.createCustom` | create-custom-food row | `screens/FoodSearchView.tsx` |
| `custom.close` | custom sheet close | `screens/CustomFoodSheet.tsx` |
| `custom.nameField` / `custom.kcalField` / `custom.proteinField` / `custom.carbsField` / `custom.fatField` / `custom.fiberField` / `custom.servingGramsField` | text fields | `screens/CustomFoodSheet.tsx` `Field` |
| `custom.basis.per100g` / `custom.basis.per_serving` | basis chips | `screens/CustomFoodSheet.tsx` wrapper Views around `ChipOption` |
| `custom.save` | save button | `screens/CustomFoodSheet.tsx` wrapper View around `PrimaryButton` |
| `manual.close` | manual sheet close | `screens/ManualLogSheet.tsx` |
| `manual.stepper` | grams stepper | `screens/ManualLogSheet.tsx` wrapper View around `Stepper` |
| `manual.kcal` | the derived kcal figure | `screens/ManualLogSheet.tsx` |
| `manual.save` | save button | `screens/ManualLogSheet.tsx` wrapper View around `PrimaryButton` |
| `exercise.close` | exercise sheet close | `screens/ExerciseLogSheet.tsx` |
| `exercise.typeField` / `exercise.kcalField` | text fields | `screens/ExerciseLogSheet.tsx` |
| `exercise.save` | save button | `screens/ExerciseLogSheet.tsx` wrapper View around `PrimaryButton` |
| `water.close` | water sheet close | `screens/WaterCard.tsx` `WaterLogSheet` |
| `water.subtract` / `water.add` | ±250 ml chips | `screens/WaterCard.tsx` `WaterLogSheet` |
| `today.waterCard` | water card (label "Water, N of M glasses") | `screens/WaterCard.tsx` |
| `ccstepper.decrement` / `ccstepper.increment` | DS stepper buttons (design system, unchanged) | DS `Stepper`; the serving and duration steppers reuse the same strings |

Removed in U-74: `water-droplet-ring` (an RN-only test helper on the accessibility-hidden ring) —
the ring became the frame's info-tint droplet tile, which carries no identifier
(`docs/rn-migration/findings/U-74.md`, section 4).

Adaptation: the DS components accept no `testID` (frozen by the brief), so where Swift put the
identifier ON a design-system component, the feature wraps it in a View carrying the same string
(`diary.addFood.*`, `addfood.tile.*`, `custom.basis.*`, `custom.save`, `manual.stepper`,
`manual.save`, `exercise.save`, `search.field`). One identifier is new and Swift-only-absent:
`water-droplet-ring`, a test helper on the accessibility-hidden ring (not a user-facing identifier).
