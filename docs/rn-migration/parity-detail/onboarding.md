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
| BodyMetricsView.swift (83) | `features/onboarding/BodyMetricsScreen.tsx` | OB-06; U-73 A2: height/weight are the design system's typed FillFields; the DOB wheel stays with the gate; unit toggle is absent in Swift too (kg/cm fixed) |
| GoalWeightPaceView.swift (110) | `features/onboarding/GoalWeightPaceScreen.tsx` | OB-07; U-73 A2: typed goal-weight field, the pace segment (0.25/0.50/1.00, engine-clamped on write) replaced `PaceSlider.tsx` (removed) |
| ActivityDietView.swift (73) | `features/onboarding/ActivityDietScreen.tsx` | OB-05 |
| ProjectionView.swift (218) | `features/onboarding/ProjectionScreen.tsx` | OB-10; kg + weeks only |
| PrivacyHealthView.swift (59) | `features/onboarding/PrivacyHealthScreen.tsx` | OB-03; the button runs the injected JIT request |
| GeneratingPlanView.swift (136) | `features/onboarding/GeneratingPlanScreen.tsx` | OB-08; U-73: indeterminate ring + the engine's formula lines — no percent readout, no window, instant reveal |
| PlanRevealView.swift (256) | `features/onboarding/PlanRevealScreen.tsx` + `MacroRing.tsx` | OB-09; reveal edits re-clamp through the engine |
| RootView.swift `OnboardingFlowRoute` | `app/onboarding/index.tsx` | The route builds the model's deps (owner id from the session else `DEMO_USER_ID`, clock, `disableAnimations`, HealthKit ask, `saveTarget`, `notify`); finish → `router.replace('/')` (Today tab); the root gate lands with U-51 |
| — | `features/onboarding/healthAccess.ts` | The real `requestAuthorization` of `@kingstinct/react-native-healthkit` (read/write: active energy, dietary energy, body mass, height, step count); errors map to `'denied'` |

## Per parity row

| Row | Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|---|
| OB-01 | Flow + model: step order, locked copy, generation, persist | OnboardingModel.swift, OnboardingFlowView.swift | onboardingModel.ts, OnboardingFlowView.tsx, index.tsx | `onboardingModel.test.tsx` (twin + extras), `OnboardingFlowView.test.tsx` (UI-test walk) |
| OB-02 | Value hero copy incl. ED-safe line, "Get started" CTA | ValueHeroView.swift | ValueHeroScreen.tsx | `ValueHeroScreen.test.tsx` (+ twin case 2) |
| OB-03 | JIT HealthKit ask; denial shows footnote, grant silent; "Skip for now" CTA; U-73 adds the ED-Safe switch (stored '1'/'0', applied at once; a failed write shows a banner) | PrivacyHealthView.swift | PrivacyHealthScreen.tsx, healthAccess.ts | `PrivacyHealthScreen.test.tsx` (granted/denied + the switch + the failed write), twin cases |
| OB-04 | Goal picker, single select, selection in the model | GoalPickerView.swift | GoalPickerScreen.tsx | `GoalPickerScreen.test.tsx` (+ twin case 1) |
| OB-05 | Activity level cards + diet chips, copy verbatim | ActivityDietView.swift | ActivityDietScreen.tsx | `ActivityDietScreen.test.tsx` |
| OB-06 | Body metrics: sex chips, three wheels, under-18 gate | BodyMetricsView.swift | BodyMetricsScreen.tsx | `BodyMetricsScreen.test.tsx` (+ twin cases 3–4) |
| OB-07 | Goal weight hero + typed field; pace segment (Relaxed 0.25 / Steady 0.50 / Faster 1.00, engine-clamped on write, the card prints the engine's pace); safety-floor banner on the caution tokens | GoalWeightPaceView.swift | GoalWeightPaceScreen.tsx | `GoalWeightPaceScreen.test.tsx` (+ twin cases 5–7) |
| OB-08 | U-73: indeterminate ring + formula lines the engine computed (no percent, no window); stage A2: the step HOLDS until "See your plan"; card collapses under ED-safe and the design system's balancing note shows | GeneratingPlanView.swift | GeneratingPlanScreen.tsx | `GeneratingPlanScreen.test.tsx` |
| OB-09 | Plan reveal: kcal hero on the ember card (U-73), macro rings, weekly range, edit panel, persist; ED-safe collapses hero card and range | PlanRevealView.swift | PlanRevealScreen.tsx, MacroRing.tsx | `PlanRevealScreen.test.tsx` (+ twin case 8, finish cases, ED-safe case) |
| OB-10 | Projection: kg + weeks only, no calorie strings; labeled gridlines + 35% band (U-73) | ProjectionView.swift | ProjectionScreen.tsx | `ProjectionScreen.test.tsx` (renders every string and keeps the unit out) |

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
| `onboarding.heightField` / `onboarding.weightField` / `onboarding.dobField` | U-73 A2: the two typed fields carry them on the design system's FillField (input, `.label`, `.unit`); the DOB wheel keeps its View wrapper | body metrics |
| `onboarding.dobGate` | under-18 footnote Text | body metrics |
| `onboarding.goalWeightHero` | goal weight hero row (a11y label "Goal weight N kilograms") | goal weight & pace |
| `onboarding.goalWeightField` | goal weight typed field (U-73 A2: the design system's FillField) | goal weight & pace |
| `onboarding.paceValue` | pace value Text (the engine's returned pace, "0.45 kg/wk") | goal weight & pace |
| `onboarding.paceSegment` (+ `.relaxed` / `.steady` / `.faster`) | the pace segment (U-73 A2; replaced `onboarding.paceSlider`) | goal weight & pace |
| `onboarding.edSafeError` | the failed ED-Safe policy write's banner (U-73 A2) | privacy & health |
| `onboarding.safetyFloor` | safety-floor BannerNote (success, markdown) | goal weight & pace, plan reveal |
| `onboarding.activityHeader` / `onboarding.dietHeader` | section headline Texts | activity & diet |
| `onboarding.privacyPromise` | privacy promise BannerNote (success) | privacy & health |
| `onboarding.healthConnect` | connect button (View wrapper over DS SecondaryButton) | privacy & health |
| `onboarding.healthConnectNote` | denial footnote Text | privacy & health |
| `onboarding.generating` | generating screen root | generating |
| `onboarding.edSafeToggle` | the step-7 ED-Safe switch (U-73; the route owns the stored key and the flag setter) | privacy & health |
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
| `onboarding.continue` | the pinned CTA of every step ("Continue"; "Skip for now" on privacy & health; "See your plan" on generating — U-73 A2) | every step |
| `onboarding.goalCard.<goal>` | lose, maintain, gain, habit | goal picker |
| `onboarding.activityCard.<level>` | sedentary, light, moderate, active, athlete | activity & diet |
| `onboarding.dietChip.<lowercased style without spaces>` | standard, highprotein, vegetarian, vegan, keto | activity & diet |
| `onboarding.genStep.<index>` | **removed in U-73** (the timed checklist is gone; the formula lines replaced it) | — |

DS-owned identifiers riding along (not onboarding's, but on these screens):
`option-card:<title>` (+ the U-71b `option-card:<title>:check` on the goal
cards), `chip-option:<title>`, `wheel-field:<label>`, `wheel-value:<label>`,
`wheel-scroll:<label>` (the DOB wheel), `banner:<variant>`,
`ed-safe-note` (the generating step's ED-safe variant, U-73 A2),
`progress-rail`, `settings-row:<label>`, `ccstepper.*` (not used here).
U-73 note: step 4's floor banner is no longer a `BannerNote`, so `banner:success`
no longer renders there — the banner is the feature's caution surface under the
unchanged `onboarding.safetyFloor`; `banner:*` still rides the privacy promise,
the projection disclaimer and the reveal banners.

## Gaps (recorded, none silently dropped)

1. **Plan reveal ED-safe hide** (OB-09): CLOSED in U-41 — the kcal hero and
   the weekly-range Text are wrapped in the design system's `EdSafeCollapse`
   (PR 21's component), matching the Swift `.edSafeHidden()` placement: the
   hero collapses whole, the range line collapses inside its card (headline and
   caption stay). Test: `PlanRevealScreen.test.tsx` "renders neither the kcal
   hero nor the weekly range in ED-safe mode". See
   findings/U-41.md §OB-09.
2. **A11y-hidden caption rows** (projection "Today / 12 weeks"):
   RNTL v14 queries mirror the accessibility tree, so the hiding flag makes
   the locked copy unassertable; the projection row renders without it.
   VoiceOver reads it where the Swift app stayed silent. The pace axis
   captions (Slow / Recommended / Fast) are gone with the slider — the pace
   segment replaced them in U-73 A2. See findings/U-31.md §4 and
   findings/U-73.md §9.
3. **Projection chart axis labels**: the Swift automatic axis value labels
   are not drawn; the same numbers appear in the start/goal header and the
   "Today / 12 weeks" caption. Band, line, endpoints and gridlines port.
   CLOSED in U-73 for the value labels: three gridlines now stand at real
   kilogram values with right-side labels (0.5 kg steps), the band is the
   frame's 35% opacity and the goal endpoint is hollow. The in-card x labels
   ("Today" / "Late Mar") stay un-drawn — the caption row carries them (see
   findings/U-73.md §3.19).
4. **Flow handoff**: `OnboardingFlowTests` ends on the MainShell ring
   (`today.ring`); the RN twin ends on the flow's `onFinished` (Today tab
   navigation) because the shell gate is U-51's.
