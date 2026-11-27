# CoachCal Design System v2 "Ember": tokens and handoff

One brand palette replaces today's three: icon #FF8841, app lime #B4F04A and web green #0D7A4F.
Contrast is WCAG 2.x, computed with `scripts/contrast.py`. Text needs 4.5:1 and graphics or UI need 3:1. High Contrast targets 7:1 where it can.

## Rules
1. **#FF6A00 is a fill.** Its label is always black #0B0A09 (6.89:1). Never put white on orange (2.87:1).
2. **Orange text on light uses `accent-ink` #B84300.** Orange lines and charts on light use `accent-strong` #E35A00.
3. **Orange means brand only.** Caution is yellow and carbs are teal.
4. **The ember hero card is dark in both modes.** It is the one place neon orange shines on light screens: the ring there is 6.51:1.
5. Feature code must not use literal hex. Every token is in `Colors.xcassets` with Any / Dark / High Contrast / Dark + High Contrast.

## Tokens
| Token (Swift) | Light | Dark | HC light | HC dark | Use and contrast |
|---|---|---|---|---|---|
| `ccAccent` | #FF6A00 | #FF6A00 | #FF6A00 | #FF6A00 | Fills. Label `ccOnAccent` 6.89:1 |
| `ccAccentPressed` | #E35A00 | #E35A00 | #E35A00 | #E35A00 | Pressed fill. Label 5.40:1 |
| `ccOnAccent` | #0B0A09 | #0B0A09 | #000000 | #000000 | Text or icon on accent |
| `ccAccentStrong` | #E35A00 | #FF6A00 | #C24D00 | #FF8F45 | Rings, chart lines, bars. 3.67:1 white; 6.04:1 dark card |
| `ccAccentInk` | #B84300 | #FF7A1F | #8F3400 | #FF9A52 | Orange text and links. 5.47:1 white, 5.02:1 grouped, 4.73:1 tint; dark 6.66:1 card |
| `ccAccentTint` | #FFEBDC | #3A2312 | #FFEBDC | #3A2312 | Selected chip, insight icon bg |
| `ccEmber` | #141210 | #1C1A18 | #000000 | #000000 | Hero card |
| `ccEmberTrack` | #3A342F | #3A342F | #4A433D | #4A433D | Ring track on ember |
| `ccEmberText` / `2` | #F7F5F2 / #ABA6A0 | same | same | same | 17.17:1 / 7.74:1 on ember |
| `ccEmberAccent` | #FF7A1F | #FF7A1F | #FF9A52 | #FF9A52 | Orange text on ember. 7.17:1 |
| `ccBg` | #FFFFFF | #000000 | | | |
| `ccGrouped` | #F6F5F3 | #000000 | | | Grouped background |
| `ccCard` | #FFFFFF | #1C1A18 | | | |
| `ccElevated` | #FFFFFF | #2A2724 | | | Sheets |
| `ccFill` | #EFEDEA | #2A2724 | | | Control fills, tracks |
| `ccText` | #141210 | #F7F5F2 | #000000 | #FFFFFF | 18.69:1 / 15.94:1 |
| `ccText2` | #5F5B57 | #ABA6A0 | #4A4643 | #C8C3BD | 6.73:1 / 7.18:1 |
| `ccText3` | #6F6A65 | #9A958F | #54504C | #B8B3AD | 5.35:1 white, 4.91:1 grouped / 5.00:1 elevated. **Was #AEAEB2 at 2.21:1** |
| `ccGrabber` | 22% ink | 30% white | | | Visible light-mode grabber (was invisible) |
| `ccSuccess` / `Ink` / `Tint` | #22A653 / #146C34 / #E6F6EB | #4ADE80 / #4ADE80 / #12301E | | | High-confidence badge. Ink 6.51:1, 5.81:1 on tint |
| `ccCaution` / `Ink` / `Tint` | #E0A800 / #6E5300 / #FFF6D6 | #FFD43B / #FFD43B / #3A3214 | | | Medium confidence, offline. **Moved off orange.** Ink 6.69:1 on tint |
| `ccError` / `Ink` / `Tint` | #E5243B / #B3122E / #FDE8EC | #FF7088 / #FF7088 / #3A1219 | | | Low confidence, destructive. Ink 5.89:1 on tint |
| `ccInfo` / `Ink` / `Tint` | #2563EB / #1D4ED8 / #E8EFFE | #6EA8FF / #6EA8FF / #14223D | | | Water, info |
| `ccProtein` | #2563EB | #6EA8FF | | | 5.17:1 |
| `ccCarbs` | #0E8A7E | #3CCFBE | | | 4.24:1. **Moved off orange** |
| `ccFat` | #7C4DDB | #B794FF | | | 5.33:1 |
| `ccFiber` | #2E8B47 | #5AD27A | | | 4.29:1 |

Blank HC cells keep the base value. HC ink on tint is 6.83:1, just under the 7:1 target but well above AA.

## Audit contrast failures fixed
| Item | Before | After |
|---|---|---|
| textTertiary on white | 2.21:1 | 5.35:1 |
| textTertiary dark | 2.84:1 | 5.00:1 |
| Lime ring on light | 1.35:1 | 6.51:1 (orange on ember) |
| Selected camera chip | 3.08:1 | 6.89:1 |
| Analyzing pending steps | 3.66:1 | 8.69:1 |
| Light grabber | invisible | 22% ink |

## Type, spacing, shape
- **Type:** SF Pro text styles with Dynamic Type: Large Title 34, Title1 28, Title2 22, Headline 17 semibold, Body 17, Subheadline 15, Footnote 13. Numbers use SF Pro Rounded with `.monospacedDigit()`.
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 48.
- **Radii:** 10, 14, 20, 28, capsule. Use `ConcentricRectangle` on iOS 26.
- **Sizes:** 44 tap target, 56 button, 76 shutter, ring 184 with a 16 stroke.

## Component mapping
| Canvas | SwiftUI |
|---|---|
| `.btn.primary` | `CCPrimaryButton`: `ccAccent` fill, `ccOnAccent` label, 56 pt, 18 radius, `.sensoryFeedback(.impact)` |
| `.btn.secondary` | `CCSecondaryButton`: **remove the empty-action default** so it can't ship inert (audit #52 cause) |
| `.btn.destructive` | `Button(role: .destructive)` on `ccErrorTint` |
| Tab bar | System `TabView` with `.tabViewBottomAccessory` or a trailing Scan button. **No custom background.** Glass comes from iOS 26; iOS 18 falls back to standard material |
| `.badge` | `ConfidenceBadge(tier:)`: its own row, `.fixedSize()`, never truncates. Tiers 0.85 / 0.70 unchanged |
| Grams control | `GramsField`: −/+ 44 pt (step 10), tappable field opening the `.numberPad` keyboard, optional ruler `Slider`, serving chips |
| `.ember` | `EmberCard`: `ccEmber` background, orange radial glow at 30% |
| Sheets | `.presentationDetents([.medium, .large])` and `.presentationDragIndicator(.visible)` |

## Icons (SF Symbols)
Today `sun.max` · Progress `chart.line.uptrend.xyaxis` · Coach `sparkles` (was `bell`) · Profile `person.crop.circle` (was `gearshape`) · Scan `camera.fill` · Meals `sunrise` / `sun.max` / `moon` / `carrot` (no emoji) · Streak `flame.fill` · Water `drop.fill` · ED-Safe `eye.slash`.

## Engineering handoff
1. **Rename** `ccAccentLime` to `ccAccent` and add `ccAccentInk`, `ccAccentStrong`, `ccAccentTint`, `ccEmber*` and the new semantic and macro tokens. Delete the lime asset after a grep shows zero uses. Point the web `--brand` at the same values.
2. **Keep identifiers:** `scan.badge`, `scan.grams.<id>`, `scan.save`, `scan.totalKcal`, `settings.cancelSubscription`, `settings.edSafeToggle` and all others unchanged.
3. **Keep the kcal parity UI test:** 464 → 508 kcal in 3 taps on `+` at +10 g. The + button keeps `scan.grams.<id>.increment`; the new field gets `scan.grams.<id>.field`.
4. **ED-Safe leaks to close:** Food search rows, Manual log kcal, Exercise kcal field, Custom food kcal field. Also cover widgets and the Live Activity: pass `edSafe` in the app group and the ContentState.
5. **Billing:** Change plan and Cancel use `.manageSubscriptionsSheet(isPresented:)`; Restore uses `AppStore.sync()`. Read prices from StoreKit `Product.displayPrice`, never hard-code them. Read the quota limit and reset day from the server.
6. **Honest progress:** Analyzing steps and plan generation reflect real stages, with no timers.
7. **Haptics:** success on save, selection on the meal segment, light impact on −/+.
8. **Availability:** gate iOS 26 APIs (`glassEffect`, `tabViewBottomAccessory`, `ConcentricRectangle`) with `#available(iOS 26, *)`. The deployment floor stays at iOS 18.
9. **App icon:** build `icon/layer-background.svg` and `icon/layer-foreground.svg` in Icon Composer with Default, Dark, Clear and Tinted appearances. `icon/AppIcon-1024.png` is the flattened opaque fallback.
