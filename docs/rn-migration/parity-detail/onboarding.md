# Onboarding parity detail (U-31)

Per-row record of the onboarding port. Source of truth:
`native/App/Features/Onboarding/` (read in full) and
`native/App/CoachCalTests/OnboardingContractTests.swift` (8 cases) /
`native/App/CoachCalUITests/OnboardingFlowTests.swift`. Test evidence:
`apps/mobile/src/features/onboarding/*.test.tsx` (44 cases), run by `npm test`
in `apps/mobile`.

## Files

| Swift source (lines) | RN file | Notes |
|---|---|---|
| OnboardingModel.swift (330) | `features/onboarding/onboardingModel.ts` | Step list as the typed `ONBOARDING_STEPS` array (same order); draft = `QuizProfile`; every editable number re-enters `TargetsEngine` (clamps, never throws); `revision`/`subscribe` is the `@Observable` seam |
| OnboardingFlowView.swift (84) | `features/onboarding/OnboardingFlowView.tsx` + `StepScaffold.tsx` | The scaffold (rail / title / subhead / pinned CTA) is the shared Group A layout; the flow renders the current step and starts generation on the generating step (Swift `.task`) |
| OnboardingCopy (in OnboardingModel.swift) | `features/onboarding/onboardingCopy.ts` | Locked strings verbatim; key names deliberately avoid the DS policy API names (I7 / findings §5) |
| ValueHeroView.swift (48) | `features/onboarding/ValueHeroScreen.tsx` | OB-02 |
| GoalPickerView.swift (40) | `features/onboarding/GoalPickerScreen.tsx` | OB-04; selection state lives in the model |
| BodyMetricsView.swift (83) | `features/onboarding/BodyMetricsScreen.tsx` | OB-06; unit toggle is absent in Swift too (kg/cm fixed); clamps via the wheel ranges |
| GoalWeightPaceView.swift (110) | `features/onboarding/GoalWeightPaceScreen.tsx` + `PaceSlider.tsx` | OB-07; pace options always engine-clamped |
| ActivityDietView.swift (73) | `features/onboarding/ActivityDietScreen.tsx` | OB-05 |
| ProjectionView.swift (218) | `features/onboarding/ProjectionScreen.tsx` | OB-10; kg + weeks only |
| PrivacyHealthView.swift (59) | `features/onboarding/PrivacyHealthScreen.tsx` | OB-03; the button runs the injected JIT request |
| GeneratingPlanView.swift (136) | `features/onboarding/GeneratingPlanScreen.tsx` | OB-08; ring + 4-step checklist, 2 s minimum window, `disableAnimations` flips instantly |
| PlanRevealView.swift (256) | `features/onboarding/PlanRevealScreen.tsx` + `MacroRing.tsx` | OB-09; reveal edits re-clamp through the engine |
| RootView.swift `OnboardingFlowRoute` | `app/onboarding/index.tsx` | The route builds the model's deps (owner id from the session else `DEMO_USER_ID`, clock, `disableAnimations`, HealthKit ask, `saveTarget`, `notify`); finish → `router.replace('/')` (Today tab); the root gate lands with U-51 |
| — | `features/onboarding/healthAccess.ts` | The real `requestAuthorization` of `@kingstinct/react-native-healthkit` (read/write: active energy, dietary energy, body mass, height, step count); errors map to `'denied'` |

## Per parity row

| Row | Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|---|
| OB-01 | Flow + model: step order, locked copy, generation, persist | OnboardingModel.swift, OnboardingFlowView.swift | onboardingModel.ts, OnboardingFlowView.tsx, index.tsx | `onboardingModel.test.tsx` (twin + extras), `OnboardingFlowView.test.tsx` (UI-test walk) |
| OB-02 | Value hero copy incl. ED-safe line, "Get started" CTA | ValueHeroView.swift | ValueHeroScreen.tsx | `ValueHeroScreen.test.tsx` (+ twin case 2) |
| OB-03 | JIT HealthKit ask; denial shows footnote, grant silent; "Skip for now" CTA | PrivacyHealthView.swift | PrivacyHealthScreen.tsx, healthAccess.ts | `PrivacyHealthScreen.test.tsx` (granted/denied), twin cases |
| OB-04 | Goal picker, single select, selection in the model | GoalPickerView.swift | GoalPickerScreen.tsx | `GoalPickerScreen.test.tsx` (+ twin case 1) |
| OB-05 | Activity level cards + diet chips, copy verbatim | ActivityDietView.swift | ActivityDietScreen.tsx | `ActivityDietScreen.test.tsx` |
| OB-06 | Body metrics: sex chips, three wheels, under-18 gate | BodyMetricsView.swift | BodyMetricsScreen.tsx | `BodyMetricsScreen.test.tsx` (+ twin cases 3–4) |
| OB-07 | Goal weight hero + wheel; pace slider clamped by the engine; safety-floor banner | GoalWeightPaceView.swift | GoalWeightPaceScreen.tsx, PaceSlider.tsx | `GoalWeightPaceScreen.test.tsx` (+ twin cases 5–7) |
| OB-08 | Ring + 4-step checklist; 2 s window; instant flip with the flag | GeneratingPlanView.swift | GeneratingPlanScreen.tsx | `GeneratingPlanScreen.test.tsx` |
| OB-09 | Plan reveal: kcal hero, macro rings, weekly range, edit panel, persist | PlanRevealView.swift | PlanRevealScreen.tsx, MacroRing.tsx | `PlanRevealScreen.test.tsx` (+ twin case 8, finish cases) |
| OB-10 | Projection: kg + weeks only, no calorie strings | ProjectionView.swift | ProjectionScreen.tsx | `ProjectionScreen.test.tsx` (renders every string and keeps the unit out) |

## Model contract (the 8 Swift twins, same behavior sentences)

| Swift case | Jest case | Key assertion |
|---|---|---|
| testGoalPickerSingleSelectUpdatesDraft | goal picker single select updates draft | lose → gain moves the single selection |
| testValueHeroShowsHeroCopyAndEdSafeLine | value hero shows hero copy and ED-safe line | hero copy + safe-mode line + a CTA button |
| testUnder18DobGateBlocksContinueAndShowsVerbatimFootnote | under-18 DOB gate blocks continue and shows verbatim footnote | footnote text; `advance()` is a no-op while blocked |
| testAdultDobAllowsContinue | adult DOB allows continue | three advances land on goalWeightPace |
| testPaceAboveSafeLimitClampsAndShowsVerbatimSafetyFloorBanner | pace above safe limit clamps and shows verbatim safety floor banner | 1.5 lands on 0.45; banner text |
| testSafePacePassesThroughUnclamped | safe pace passes through unclamped | 0.3 stays, no clamp flag |
| testMaintainToLoseRoundtripReclampsPaceThroughEngine | maintain-to-lose roundtrip reclamps pace through engine | pace restored from nil, equals the engine's value, > 0 |
| testRevealKcalEditReclampsThroughEngineFloors | reveal kcal edit reclamps through engine floors | 900 → 1200 floored; macros 90/120/40 |

Brief extras in the same file: `ONBOARDING_STEPS` order (nine steps, reveal
last, `advance()` a no-op past it), granted/denied HealthKit paths, and the
`persistAndFinish` wiring (owner id, clamped values, fiber 30 / water 8,
`notify` once, `finished` flag; a failed save shows the verbatim error and
never finishes).

## Accessibility identifiers → testIDs (same strings)

Static identifiers:

| Identifier | Element | Screen |
|---|---|---|
| `onboarding.getStarted` | hero CTA (View wrapper over the DS PrimaryButton) | value hero |
| `onboarding.sexFemale` / `onboarding.sexMale` | sex chips (View wrappers over DS ChipOption) | body metrics |
| `onboarding.heightField` / `onboarding.weightField` / `onboarding.dobField` | wheel fields (View wrappers over DS WheelField) | body metrics |
| `onboarding.dobGate` | under-18 footnote Text | body metrics |
| `onboarding.goalWeightHero` | goal weight hero row (a11y label "Goal weight N kilograms") | goal weight & pace |
| `onboarding.goalWeightField` | goal weight wheel | goal weight & pace |
| `onboarding.paceValue` | pace value Text ("0.50 kg/wk") | goal weight & pace |
| `onboarding.paceSlider` | PaceSlider (`adjustable`; a11y value "N kilograms per week") | goal weight & pace |
| `onboarding.safetyFloor` | safety-floor BannerNote (success, markdown) | goal weight & pace, plan reveal |
| `onboarding.activityHeader` / `onboarding.dietHeader` | section headline Texts | activity & diet |
| `onboarding.privacyPromise` | privacy promise BannerNote (success) | privacy & health |
| `onboarding.healthConnect` | connect button (View wrapper over DS SecondaryButton) | privacy & health |
| `onboarding.healthConnectNote` | denial footnote Text | privacy & health |
| `onboarding.generating` | generating screen root | generating |
| `onboarding.generatingPercent` | ring center Text ("…", "25%" … "100%") | generating |
| `onboarding.projectionStart` / `onboarding.projectionGoal` | start / goal kg Texts | projection |
| `onboarding.projectionChart` | SVG chart container | projection |
| `onboarding.projectionKg` / `onboarding.projectionWeeks` | stat cards (a11y labels "N kg to lose/gain", "N weeks") | projection |
| `onboarding.projectionDisclaimer` | disclaimer BannerNote (markdown) | projection |
| `plan.reveal` | "Your daily target" title | plan reveal |
| `plan.kcalHero` | kcal hero (a11y label "N calories per day") | plan reveal |
| `plan.macro.protein` / `plan.macro.carbs` / `plan.macro.fat` | macro rings (a11y labels "Protein N grams" …) | plan reveal |
| `plan.weeklyRange` | weekly range Text | plan reveal |
| `plan.adjust` | adjust button (View wrapper) | plan reveal |
| `plan.editKcal` / `plan.editProtein` / `plan.editCarbs` / `plan.editFat` | edit row value Texts | plan reveal |
| `plan.editKcal.decrement` / `.increment` (+ the other three) | edit ± buttons (Pressables) | plan reveal |
| `plan.persistError` | persist error BannerNote | plan reveal |
| `plan.medicalDisclaimer` | disclaimer footnote | plan reveal |
| `plan.safetyFloor` | floored BannerNote inside the edit panel | plan reveal |

Templated identifiers (same strings as Swift):

| Pattern | Values | Screen |
|---|---|---|
| `onboarding.title.<title>` | the scaffold title of each step ("Track calories with a photo", "What's your goal?", "About you", "Your target", "Lifestyle", "Your projection", "Privacy & Health") | every scaffold step |
| `onboarding.continue` | the pinned CTA of every step ("Continue"; "Skip for now" on privacy & health) | every step |
| `onboarding.goalCard.<goal>` | lose, maintain, gain, habit | goal picker |
| `onboarding.activityCard.<level>` | sedentary, light, moderate, active, athlete | activity & diet |
| `onboarding.dietChip.<lowercased style without spaces>` | standard, highprotein, vegetarian, vegan, keto | activity & diet |
| `onboarding.genStep.<index>` | 0–3 (Calculating TDEE / Setting macro ratios / Applying safety floor / Generating weekly plan) | generating |

DS-owned identifiers riding along (not onboarding's, but on these screens):
`option-card:<title>`, `chip-option:<title>`, `wheel-field:<label>`,
`wheel-value:<label>`, `wheel-scroll:<label>`, `banner:<variant>`,
`progress-rail`, `settings-row:<label>`, `ccstepper.*` (not used here).

## Gaps (recorded, none silently dropped)

1. **Plan reveal ED-safe hide** (OB-09): the Swift `.edSafeHidden()` collapse
   of the kcal hero and weekly range is not ported — no DS component owns the
   branch and I7 forbids the call in feature code. Both surfaces render
   unconditionally. See findings/U-31.md §5.
2. **A11y-hidden caption rows** (pace axis captions, "Today / 12 weeks"):
   RNTL v14 queries mirror the accessibility tree, so the hiding flag makes
   the locked copy unassertable; both rows render without it. VoiceOver reads
   them where the Swift app stayed silent. See findings/U-31.md §4.
3. **Projection chart axis labels**: the Swift automatic axis value labels
   are not drawn; the same numbers appear in the start/goal header and the
   "Today / 12 weeks" caption. Band, line, endpoints and gridlines port.
4. **Flow handoff**: `OnboardingFlowTests` ends on the MainShell ring
   (`today.ring`); the RN twin ends on the flow's `onFinished` (Today tab
   navigation) because the shell gate is U-51's.
