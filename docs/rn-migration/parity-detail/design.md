# Design parity detail (U-22)

Per-component record of the CoachCalDesignSystem port (`apps/mobile/src/design`). Source of truth:
`native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/` (read in full). Test evidence:
`apps/mobile/src/design/**/*.test.tsx`, run by `npm test`.

## Tokens and ED-safe (parity rows PL-06, PL-08)

| Item | Swift source | RN file | Notes |
|---|---|---|---|
| CCSpace | Tokens.swift | `tokens.ts` `space` | 4-pt grid, exact |
| CCRadius | Tokens.swift | `tokens.ts` `radius` | sm 8 / md 12 / lg 16 / xl 20 / full 9999 |
| CCSize | Tokens.swift | `tokens.ts` `size` | tapTarget 44 … macroBarHeight 6 |
| CCTypography | Tokens.swift | `tokens.ts` `typography` | roles → system text style points/weights (title 34/600 … tabLabel 11/500) |
| 23 catalog colors | Colors.xcassets | `tokens.ts` `lightColors`/`darkColors` | light = "any", dark = "dark"; high-contrast not ported (findings) |
| CCScaledNumber | Tokens.swift | `components/ScaledNumber.tsx` | hero 56 / plan 64 bold, tabular-nums, allowFontScaling |
| EdSafe.swift | EdSafe.swift | `edSafe.ts` | `edSafeMode()`, `edSafeHidden()`, `setEdSafeMode()`, `useEdSafeMode()`, `useEdSafeHidden()`; the only file exporting ED-safe functions (I7) |

Token parity evidence: `src/design/__tests__/tokens.test.ts` (the value table read by hand from
Tokens.swift and the colorsets, light and dark) and `src/design/__tests__/useTokens.test.tsx`
(hook follows the scheme: light default, dark, null→light).
ED-safe evidence: `src/design/__tests__/edSafe.test.ts` (off by default; flip → `edSafeHidden()`
true; rendered component re-renders through `act`; no re-render on same-value set).

## Components (parity row PL-07)

| Component (RN) | Swift type | Variants | ED-safe behavior | accessibility identifiers / labels | Test file |
|---|---|---|---|---|---|
| PrimaryButton | CCPrimaryButton + CCPrimaryButtonStyle | — (one style) | none | a11y role button, state disabled | `components/PrimaryButton.test.tsx` |
| SecondaryButton | CCSecondaryButton + CCSecondaryButtonStyle | bordered | none | a11y role button | `components/SecondaryButton.test.tsx` |
| DashedAddButton | CCDashedAddButton | — | none | default title "Add food" | `components/DashedAddButton.test.tsx` |
| Card | CCCard | — | none | — | `components/Card.test.tsx` |
| MacroBar | CCMacroBar | protein/carbs/fat/fiber | none (a11y-hidden, as in Swift) | hidden | `components/MacroBar.test.tsx` |
| MacroMiniCard | CCMacroMiniCard | 4 macros | none | label "Protein 82 of 130 grams" | `components/MacroMiniCard.test.tsx` |
| InsightCard | CCInsightCard | accent / info | none | — | `components/InsightCard.test.tsx` |
| BadgeTile | CCBadgeTile | locked / earned | none | label "On fire, earned" / "Marathon, locked, 30-day streak" | `components/BadgeTile.test.tsx` |
| StreakCard | CCStreakCard | — | none | label "12 day streak, 2 freezes left" | `components/StreakCard.test.tsx` |
| SettingsRow | CCSettingsRow | with/without value | none | label "Daily target, 2,150" / label | `components/SettingsRow.test.tsx` |
| SettingsGroup | CCSettingsGroup | — | none | — | `components/SettingsGroup.test.tsx` |
| BannerNote | CCBannerNote | neutral / success / info; plain / markdown | none | — | `components/BannerNote.test.tsx` |
| FoodRow | CCFoodRow | meta/kcal/compactBadge/syncPending | **hides the kcal value** while the mode is on (`useEdSafeMode`) | — | `components/FoodRow.test.tsx` |
| SectionHeader | CCSectionHeader | — | none | a11y role header, uppercase + 0.55 spacing | `components/SectionHeader.test.tsx` |
| ConfidenceBadge | CCConfidenceBadge | regular / compact | **keeps the badge** (AI accuracy is not food morality) | label "Confidence Low — review needed"; tiers High ≥0.85 / Medium ≥0.70 / Low <0.70 with exact label strings | `components/ConfidenceBadge.test.tsx` |
| WarningChip | CCWarningChip | with/without addedKcal | **drops the kcal clause**: "Dressing not visible — review portion" instead of "— +160 kcal added (editable)" (`useEdSafeMode`) | label = the visible text | `components/WarningChip.test.tsx` |
| Toast | CCToast | kcalText/undo/dismiss | **drops the kcal line** (`useEdSafeMode`) | a11y role alert; `toast:undo` pressable; auto-dismiss 4 s | `components/Toast.test.tsx` |
| Sheet | CCSheet | — | none | grab-handle chrome only (presentation stays with the route) | `components/Sheet.test.tsx` |
| ChartCard | CCChartCard + CCChartDescriptor | title/no-title | none | label "Trend. Day 0: 82.4, …" from `makeChartDescriptor` (no AXChartDescriptor in RN) | `components/ChartCard.test.tsx` |
| OfflineBadge | CCOfflineBadge | — | none | label "Offline — syncs later" | `components/OfflineBadge.test.tsx` |
| OptionCard | CCOptionCard | selected / unselected | none | label "Lose weight, A mild deficit, selected"; state selected | `components/OptionCard.test.tsx` |
| ChipOption | CCChipOption | selected / unselected | none | state selected | `components/ChipOption.test.tsx` |
| ProgressRail | CCProgressRail | — | none | label "58 percent complete" | `components/ProgressRail.test.tsx` |
| WheelField | CCWheelField | generic items | none | label/value texts | `components/WheelField.test.tsx` |
| Stepper | CCStepper | step/minimum | none | **identifiers `ccstepper.decrement` and `ccstepper.increment`** (identical to Swift); label = name; value "180 grams" | `components/Stepper.test.tsx` |
| SearchField | CCSearchField | — | none | label = placeholder | `components/SearchField.test.tsx` |
| QuickActionTile | CCQuickActionTile | highlighted / plain | none | label = title | `components/QuickActionTile.test.tsx` |
| CalorieRing | CCCalorieRing | hero / compact / goal | **ring shows fraction-of-day** ("On track", "58% of day", label "On track") while the mode is on; otherwise remaining + "N calories remaining of M goal" (`useEdSafeMode`) | testID `calorie-ring:<variant>` | `components/CalorieRing.test.tsx` |
| WeeklyReviewStats | CCWeeklyReviewStats | — | **swaps "% on target" and "kg this week" for "Weeks with all meals logged"** (`useEdSafeMode`); `visibleStats` and `kgValue` ported as pure functions | — | `components/WeeklyReviewStats.test.tsx` |
| ScaledNumber | CCScaledNumber (Tokens.swift) | hero / planNumber | none | — | `components/ScaledNumber.test.tsx` |

## Not ported

| Swift type | Reason |
|---|---|
| CCTabBar | NativeTabs (expo-router) renders the tab bar in the app shell; the UITabBarAppearance modifier has no RN equivalent to port |
| ScanFAB (Shell.swift) | App-shell component, not this unit (per brief) |
| high-contrast colorsets | No RN increased-contrast trigger wired; light/dark ported (findings) |

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
strings. (`shell.fab` in MainShell.swift belongs to the app shell.) All other identifiers in the
old app are set on screens, not on DS components.

## ED-safe sweep (I7)

`grep -rniE 'kcal|calorie' apps/mobile/src/design/components -l`:
FoodRow.{tsx,test.tsx}, WarningChip.{tsx,test.tsx}, Toast.{tsx,test.tsx}, CalorieRing.{tsx,test.tsx},
WeeklyReviewStats.tsx — every one of the five source files calls `useEdSafeMode()`.
`grep -rln 'edSafe' apps/mobile/src --include='*.ts' --include='*.tsx'` outside `src/design`
prints nothing.
