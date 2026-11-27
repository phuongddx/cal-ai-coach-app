# Design parity detail (U-22, restyled to Ember in U-71)

Per-component record of the design system (`apps/mobile/src/design`). U-22 ported
`native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/` (read in full); U-71 restyled it to
Ember: values come from `docs/design/ember/tokens.css`, the component mapping from
`docs/design/ember/design-system.md`. Test evidence: `apps/mobile/src/design/**/*.test.tsx`, run by
`npm test`. Findings: `docs/rn-migration/findings/U-71.md`.

Ember canvas sections (`docs/design/ember/index.html` anchors): **#system** Design system, **#scan**
Viewfinder / Analyzing / Review / Saved, **#core** Today / Diary / Progress / Coach, **#profile**
Profile / Settings, **#billing** Quota / Plans / Cancel, **#onboarding** 9 steps, **#glance** Widgets and
Live Activity. The PNG frames are in `docs/design/ember/frames/` (merged from main, `manifest.json`): #scan = 01–06,
#core = 07–12 (Today 07 light, 08 dark offline, 09 ED-Safe; Diary day sheet 10; Progress 11; Coach 12),
#profile = 13–16, #billing = 17–19 (Quota sheet 17, Plans 18, Cancel 19), #onboarding = 20–28, #glance =
29–35. The column below names the canvas section and, where the component is on one, the frame number.

## Tokens and ED-safe (parity rows PL-06, PL-08)

| Item | Swift source | RN file | Notes |
|---|---|---|---|
| CCSpace | Tokens.swift | `tokens.ts` `space` | `--s1`..`--s12` as `space[1]`..`space[12]` (4-pt grid); earlier `xs`..`xl5` kept |
| CCRadius | Tokens.swift | `tokens.ts` `radius` | Ember `--r-*`: sm 10 / md 14 / lg 20 / xl 28 / pill 999 (+ `full` 999, `button` 18) |
| CCSize | Tokens.swift | `tokens.ts` `size` | `--tap` 44, `--btn` 56, `--shutter` 76, `--ring` 184, `--ring-stroke` 16; earlier keys kept (findings section 2); macroBarHeight 8 |
| CCTypography | Tokens.swift | `tokens.ts` `typography` | roles → system text style points/weights (title 34/600 … tabLabel 11/500) |
| 38 Ember colors | `docs/design/ember/tokens.css` (`:root` / `.dark`) | `tokens.ts` `lightColors`/`darkColors` | every variable, light and dark; earlier keys are aliases (`legacyColorAliases`); high-contrast not ported (findings) |
| CCScaledNumber | Tokens.swift | `components/ScaledNumber.tsx` | hero 56 / plan 64 bold, tabular-nums, allowFontScaling |
| EdSafe.swift | EdSafe.swift | `edSafe.ts` | `edSafeMode()`, `edSafeHidden()`, `setEdSafeMode()`, `useEdSafeMode()`, `useEdSafeHidden()`; the only file exporting ED-safe functions (I7) |

Token parity evidence: `src/design/__tests__/tokens.test.ts` (reads `docs/design/ember/tokens.css`,
compares every variable with `tokens.ts` light and dark; mutation-proven in both directions, findings
section 7) and `src/design/__tests__/useTokens.test.tsx`
(hook follows the scheme: light default, dark, null→light).
ED-safe evidence: `src/design/__tests__/edSafe.test.ts` (off by default; flip → `edSafeHidden()`
true; rendered component re-renders through `act`; no re-render on same-value set).

## Components (parity row PL-07)

| Component (RN) | Swift type | Variants | ED-safe behavior | accessibility identifiers / labels | Test file | Ember section |
|---|---|---|---|---|---|---|
| PrimaryButton | CCPrimaryButton + CCPrimaryButtonStyle | — (one style) | none | a11y role button, state disabled | `components/PrimaryButton.test.tsx` | #system (`.btn.primary`, 56 pt, radius 18); used in #scan Review/Saved, #onboarding, #billing Plans |
| SecondaryButton | CCSecondaryButton + CCSecondaryButtonStyle | bordered | none | a11y role button | `components/SecondaryButton.test.tsx` | #system (`.btn` secondary / bordered); #profile Settings detail |
| DashedAddButton | CCDashedAddButton | — | none | default title "Add food" | `components/DashedAddButton.test.tsx` | #core Diary day (add food row) |
| Card | CCCard | — | none | — | `components/Card.test.tsx` | #system (card, radius `--r-lg`); #core Today / Progress cards |
| MacroBar | CCMacroBar | protein/carbs/fat/fiber | none (a11y-hidden, as in Swift) | hidden | `components/MacroBar.test.tsx` | #system (`.bar`, 8 pt); #core Today macros, #scan Review |
| MacroMiniCard | CCMacroMiniCard | 4 macros | none | label "Protein 82 of 130 grams" | `components/MacroMiniCard.test.tsx` | #core Today (macro cards), #scan Saved |
| InsightCard | CCInsightCard | accent / info | none | — | `components/InsightCard.test.tsx` | #core Today (insight edge), Coach |
| BadgeTile | CCBadgeTile | locked / earned | none | label "On fire, earned" / "Marathon, locked, 30-day streak" | `components/BadgeTile.test.tsx` | #core Progress (achievements) |
| StreakCard | CCStreakCard | — | none | label "12 day streak, 2 freezes left" | `components/StreakCard.test.tsx` | #core Today / Progress (streak) |
| SettingsRow | CCSettingsRow | with/without value | none | label "Daily target, 2,150" / label | `components/SettingsRow.test.tsx` | #profile Profile, Settings (frames 13, 14) |
| SettingsGroup | CCSettingsGroup | — | none | — | `components/SettingsGroup.test.tsx` | #profile Profile, Settings (frames 13, 14) |
| BannerNote | CCBannerNote | neutral / success / info; plain / markdown | none | — | `components/BannerNote.test.tsx` | #profile (ED-Safe notes), #billing Quota reached (frame 17) |
| FoodRow | CCFoodRow | meta/kcal/compactBadge/syncPending | **hides the kcal value** while the mode is on (`useEdSafeMode`) | — | `components/FoodRow.test.tsx` | #core Today (meals), Diary day; #profile Food search (frame 15) |
| SectionHeader | CCSectionHeader | — | none | a11y role header, uppercase + 0.55 spacing | `components/SectionHeader.test.tsx` | #core Diary day, #profile Settings |
| ConfidenceBadge | CCConfidenceBadge | regular / compact | **keeps the badge** (AI accuracy is not food morality) | label "Confidence Low — review needed"; tiers High ≥0.85 / Medium ≥0.70 / Low <0.70 with exact label strings | `components/ConfidenceBadge.test.tsx` | #system (`.badge`, own row); #scan Review (frames 03, 04, 05) |
| WarningChip | CCWarningChip | with/without addedKcal | **drops the kcal clause**: "Dressing not visible — review portion" instead of "— +160 kcal added (editable)" (`useEdSafeMode`) | label = the visible text | `components/WarningChip.test.tsx` | #scan Review (dark, item needs review) |
| Toast | CCToast | kcalText/undo/dismiss | **drops the kcal line** (`useEdSafeMode`) | a11y role alert; `toast:undo` pressable; auto-dismiss 4 s | `components/Toast.test.tsx` | #core Today (undo toast), #scan Saved |
| Sheet | CCSheet | — | none | grab-handle chrome only (presentation stays with the route) | `components/Sheet.test.tsx` | #system (sheets: medium/large detent, drag indicator); #core Diary day (frame 10, large detent), #scan Review / Describe, #billing Quota reached (frame 17) |
| ChartCard | CCChartCard + CCChartDescriptor | title/no-title | none | label "Trend. Day 0: 82.4, …" from `makeChartDescriptor` (no AXChartDescriptor in RN) | `components/ChartCard.test.tsx` | #core Progress (frame 11) |
| OfflineBadge | CCOfflineBadge | — | none | label "Offline — syncs later" | `components/OfflineBadge.test.tsx` | #core Today (frame 08, dark offline) |
| OptionCard | CCOptionCard | selected / unselected | none | label "Lose weight, A mild deficit, selected"; state selected; U-71b adds optional `iconName` (Ember icon tile + filled selected check, testID `option-card:<title>:check`), callers unchanged | `components/OptionCard.test.tsx` | #onboarding (goal / option steps) |
| ChipOption | CCChipOption | selected / unselected | none | state selected | `components/ChipOption.test.tsx` | #system (`.chip`, selected = accent fill); #onboarding, #scan serving chips |
| ProgressRail | CCProgressRail | — | none | label "58 percent complete" | `components/ProgressRail.test.tsx` | #onboarding (step progress) |
| WheelField | CCWheelField | generic items | none | label/value texts | `components/WheelField.test.tsx` | #onboarding (height / weight / age steps) |
| Stepper | CCStepper | step/minimum | none | **identifiers `ccstepper.decrement` and `ccstepper.increment`** (identical to Swift); label = name; value "180 grams" | `components/Stepper.test.tsx` | #system (controls); #scan Review grams (identifiers kept) |
| SearchField | CCSearchField | — | none | label = placeholder | `components/SearchField.test.tsx` | #profile Food search (frame 15) |
| QuickActionTile | CCQuickActionTile | highlighted / plain | none | label = title | `components/QuickActionTile.test.tsx` | #core Today (quick actions) |
| CalorieRing | CCCalorieRing | hero / compact / goal | **ring shows fraction-of-day** ("On track", "58% of day", label "On track") while the mode is on; otherwise remaining + "N calories remaining of M goal" (`useEdSafeMode`) | testID `calorie-ring:<variant>` | `components/CalorieRing.test.tsx` | #core Today (frames 07, 08, 09): 184 pt ring, 16 pt stroke; #system rings |
| WeeklyReviewStats | CCWeeklyReviewStats | — | **swaps "% on target" and "kg this week" for "Weeks with all meals logged"** (`useEdSafeMode`); `visibleStats` and `kgValue` ported as pure functions | — | `components/WeeklyReviewStats.test.tsx` | #core Progress / Coach (weekly review, ED-Safe variant) |
| ScaledNumber | CCScaledNumber (Tokens.swift) | hero / planNumber | none | — | `components/ScaledNumber.test.tsx` | #system (type: hero number); #core Today ring center |
| DestructiveButton | `Button(role: .destructive)` on `ccErrorTint` (new in U-71) | — | none | a11y role button; `action` required | `components/DestructiveButton.test.tsx` | #system (`.btn.destructive`); #billing Cancel flow (frame 19, "Cancel subscription" in the dock) |
| EmberCard | the signature dark hero card, `--cc-ember` (new in U-71) | glow on / off | none | testID `ember-card`, `ember-card:glow` | `components/EmberCard.test.tsx` | #system (ember tokens), #core Today (hero card, frames 07, 08, 09) |
| GramsField | `GramsField` of the component mapping (new in U-71) | with / without serving chips | none | testIDs `scan.grams.<id>`, `.decrement`, `.increment`, `.field` | `components/GramsField.test.tsx` | #system (Grams control), #scan Review (frames 03, 04, 05) |
| Icon | the 51 `<symbol id="i-…">` of the canvas (new in U-71b) | 51 names, size (default 20), token color | none | decorative (`accessible={false}`) without a label; role image + label with `accessibilityLabel`; testID `icon:<name>` | `components/Icon.test.tsx` (reads `index.html`, compares names and every shape attribute) | #system (icons), every frame |
| GlassIconButton | `.glass-btn` of the canvas (new in U-71b) | tone `onSurface` / `overMedia`; `diameter` ≥ 44 | none | role button, label and testID from the caller; 44 x 44 pt minimum | `components/GlassIconButton.test.tsx` | #scan Viewfinder (frame 01), Review (03–05), #core Diary day (10), #profile (15, 16), #billing, #onboarding back |
| SheetHeader | the sheet nav row (new in U-71b) | back / close / both | none | title role header; testIDs `<id>`, `.title`, `.back`, `.close`; default labels "Back", "Close" | `components/SheetHeader.test.tsx` | #scan Review (03–05), #core Diary day (10), #profile Food search (15), Manual log (16) |
| Segment | `.chips` and `.seg` of the canvas (new in U-71b) | `chips` / `text` | none | radio group; each option a radio of ≥ 44 pt, state selected + checked, testID `<id>.<value>` | `components/Segment.test.tsx` | #scan Review meal segment (03–05), #core Progress range (11), #profile Units (13), Food search (15), Manual log (16), #onboarding sex, units, pace (22–23) |
| EdSafeNote | the leaf note card of the ED-Safe frames (new in U-71b) | icon (default eyeoff) | **renders nothing unless ED-safe mode is on** (`useEdSafeMode`) | one accessible element "title. body"; testIDs `<id>`, `.icon` | `components/EdSafeNote.test.tsx` (on and off) | #scan Review ED-Safe (frame 05), #profile Food search (15), Manual log (16) |
| FillField | `.field` 56 pt fill field (new in U-71b) | with / without unit and placeholder | none | visible label (testID `<id>.label`), input labelled "label, unit" unless overridden, testIDs `<id>`, `.unit` | `components/FillField.test.tsx` | #onboarding About you (frame 22), Goal weight (23), #profile Manual log (16) |
| GramsRuler | the drag ruler of Review (new in U-71b) | step, majorEvery | none | role adjustable, `accessibilityValue`, increment / decrement actions by `step`; testIDs `<id>`, `.value`, `.needle`, `.tick.<unit>` | `components/GramsRuler.test.tsx` | #scan Review (frames 03, 04, 05) |

All rows above also read colors only from `useTokens()` (no hex under `components/`; `EmberRestyle.test.tsx`
checks the restyled set against the Ember values in light and dark).

## Not ported

| Swift type | Reason |
|---|---|
| CCTabBar | NativeTabs (expo-router) renders the tab bar in the app shell; the UITabBarAppearance modifier has no RN equivalent to port |
| ScanFAB (Shell.swift) | App-shell component, not this unit (per brief) |
| #glance widgets and Live Activity (frames 29–35) | not a design-system component; the widget draws with the same Ember values (`ember`, `accent`, `onAccent`, `emberText`), so `tokens.ts` is the shared source for it; the widget unit owns it |
| high-contrast colorsets | No RN increased-contrast trigger wired; light/dark ported (findings) |
| SF Pro Rounded (`--cc-font-round`) | not expressible by RN `fontFamily`; exported as a string only |
| optional ruler `Slider` of the Grams control | no slider package; stepper + field + chips cover it |
| `.sensoryFeedback` haptics | no haptics package installed; follow-up |
| Sheet native detents | the route passes `sheetAllowedDetents`; `Sheet` has an in-view `detent` cap (`medium` 0.5, `large` 0.92) |

## Helper types

| Swift type | TS home |
|---|---|
| CCMacroBar.Macro | `MacroBar.tsx` `Macro` |
| CCTypography.Role | `tokens.ts` `TypographyRole` |
| CCScaledNumber.Role | `tokens.ts` `ScaledNumberRole` |
| CCConfidenceBadge.Tier | `ConfidenceBadge.tsx` `ConfidenceTier` |
| CCChartCard.Point | `ChartCard.tsx` `ChartPoint` |
| CCWeeklyReviewStats.Stat | `WeeklyReviewStats.tsx` `WeeklyStat` |
| CCCalorieRing.Variant | `CalorieRing.tsx` `RingVariant` |
| CCInsightCard.Variant | `InsightCard.tsx` `InsightVariant` |
| CCBannerNote.Variant | `BannerNote.tsx` `BannerVariant` |
| EdSafe env values | `edSafe.ts` boolean API |

## Accessibility identifiers inventory

Every `accessibilityIdentifier` in the Swift design system: `ccstepper.decrement`,
`ccstepper.increment` (Controls.swift). Both are `testID` on the RN Stepper buttons, identical
strings, unchanged by U-71. (`shell.fab` in MainShell.swift belongs to the app shell.) All other
identifiers in the old app are set on screens, not on DS components.

Added by U-71 (new testIDs, no existing one changed): `scan.grams.<id>`, `scan.grams.<id>.decrement`,
`scan.grams.<id>.increment`, `scan.grams.<id>.field` (GramsField); `ember-card`, `ember-card:glow`
(EmberCard); `sheet:grabber` (Sheet); `confidence-badge-row` and `confidence-badge-row:compact`
(ConfidenceBadge, next to the unchanged `confidence-badge` / `confidence-badge:compact`).

## ED-safe sweep (I7)

`grep -rniE 'kcal|calorie' apps/mobile/src/design/components -l`:
FoodRow.{tsx,test.tsx}, WarningChip.{tsx,test.tsx}, Toast.{tsx,test.tsx}, CalorieRing.{tsx,test.tsx},
WeeklyReviewStats.tsx — every one of the five source files calls `useEdSafeMode()`. Since U-71 the same
grep also matches `EmberCard.tsx`, `GramsField.tsx` and `EdSafeCollapse.tsx`, on comment lines only
(none renders a calorie number; `EdSafeCollapse` is the wrapper features use).
Outside `src/design`, `grep -rln edSafe apps/mobile/src` now lists `app/settings.tsx`, `app/debug.tsx`
and `app/scan/index.tsx`: they import the design module's API (wiring from other units, untouched by
U-71). The policy itself still lives only in `edSafe.ts` and the components. U-71 added no ED-safe
logic: EmberCard, GramsField and DestructiveButton show no calorie number, ConfidenceBadge still
stays on in the mode, and CalorieRing keeps its fraction-of-day branch (the `onEmber` option only
changes colors).
