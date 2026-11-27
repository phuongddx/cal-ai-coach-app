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
| Token (Swift) | RN (TS) | Light | Dark | HC light | HC dark | Use and contrast |
|---|---|---|---|---|---|---|
| `ccAccent` | `accent` | #FF6A00 | #FF6A00 | #FF6A00 | #FF6A00 | Fills. Label `ccOnAccent` 6.89:1 |
| `ccAccentPressed` | `accentPressed` | #E35A00 | #E35A00 | #E35A00 | #E35A00 | Pressed fill. Label 5.40:1 |
| `ccOnAccent` | `onAccent` | #0B0A09 | #0B0A09 | #000000 | #000000 | Text or icon on accent |
| `ccAccentStrong` | `accentStrong` | #E35A00 | #FF6A00 | #C24D00 | #FF8F45 | Rings, chart lines, bars. 3.67:1 white; 6.04:1 dark card |
| `ccAccentInk` | `accentInk` | #B84300 | #FF7A1F | #8F3400 | #FF9A52 | Orange text and links. 5.47:1 white, 5.02:1 grouped, 4.73:1 tint; dark 6.66:1 card |
| `ccAccentTint` | `accentTint` | #FFEBDC | #3A2312 | #FFEBDC | #3A2312 | Selected chip, insight icon bg |
| `ccEmber` | `ember` | #141210 | #1C1A18 | #000000 | #000000 | Hero card |
| `ccEmberTrack` | `emberTrack` | #3A342F | #3A342F | #4A433D | #4A433D | Ring track on ember |
| `ccEmberText` / `2` | `emberText` / `emberText2` | #F7F5F2 / #ABA6A0 | same | same | same | 17.17:1 / 7.74:1 on ember |
| `ccEmberAccent` | `emberAccent` | #FF7A1F | #FF7A1F | #FF9A52 | #FF9A52 | Orange text on ember. 7.17:1 |
| `ccBg` | `bg` | #FFFFFF | #000000 | | | |
| `ccGrouped` | `grouped` | #F6F5F3 | #000000 | | | Grouped background |
| `ccCard` | `card` | #FFFFFF | #1C1A18 | | | |
| `ccElevated` | `elevated` | #FFFFFF | #2A2724 | | | Sheets |
| `ccFill` | `fill` | #EFEDEA | #2A2724 | | | Control fills, tracks |
| `ccFillElevated` | `fillElevated` | #EFEDEA | #3A3632 | | | **New 27/11.** Selected segment, secondary buttons and chips on a sheet. Dark selected segment 4.59:1 |
| `ccSegmentSelected` | `segmentSelected` | #FFFFFF | #3A3632 | #FFFFFF | #3A3632 | **New 27/11 (round 3).** Selected pill of every segmented control, on a page or in a sheet. Dark: text 11.00:1, accent-ink 4.59:1. Use instead of `card` (light) / `fillElevated` (dark) |
| `ccOnMedia` | `onMedia` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | **New 27/11 (round 3).** Glyph or label of a glass button over a photo or the camera (tone `overMedia`). Never changes with mode. Always on `ccMediaScrim` or a darker fill |
| `ccMediaScrim` | `mediaScrim` | 45% black | 45% black | 45% black | 45% black | **New 27/11 (round 3).** Glass fill behind `ccOnMedia`. Worst case (pure-white photo): white glyph 3.4:1 (graphics need 3:1) |
| `ccText` | `text` | #141210 | #F7F5F2 | #000000 | #FFFFFF | 18.69:1 / 15.94:1 |
| `ccText2` | `text2` | #5F5B57 | #ABA6A0 | #4A4643 | #C8C3BD | 6.73:1 / 7.18:1 |
| `ccText3` | `text3` | #6F6A65 | #9A958F | #54504C | #B8B3AD | 5.35:1 white, 4.91:1 grouped / 5.00:1 elevated. **Was #AEAEB2 at 2.21:1** |
| `ccGrabber` | `grabber` | 22% ink | 30% white | | | Visible light-mode grabber (was invisible) |
| `ccSuccess` / `Ink` / `Tint` | `success` / `successInk` / `successTint` | #22A653 / #146C34 / #E6F6EB | #4ADE80 / #4ADE80 / #12301E | | | High-confidence badge. Ink 6.51:1, 5.81:1 on tint |
| `ccCaution` / `Ink` / `Tint` | `caution` / `cautionInk` / `cautionTint` | #E0A800 / #6E5300 / #FFF6D6 | #FFD43B / #FFD43B / #3A3214 | | | Medium confidence, offline. **Moved off orange.** Ink 6.69:1 on tint |
| `ccError` / `Ink` / `Tint` | `error` / `errorInk` / `errorTint` | #E5243B / #B3122E / #FDE8EC | #FF7088 / #FF7088 / #3A1219 | | | Low confidence, destructive. Ink 5.89:1 on tint |
| `ccInfo` / `Ink` / `Tint` | `info` / `infoInk` / `infoTint` | #2563EB / #1D4ED8 / #E8EFFE | #6EA8FF / #6EA8FF / #14223D | | | Water, info |
| `ccProtein` | `protein` | #2563EB | #6EA8FF | | | 5.17:1 |
| `ccCarbs` | `carbs` | #0E8A7E | #3CCFBE | | | 4.24:1. **Moved off orange** |
| `ccFat` | `fat` | #7C4DDB | #B794FF | | | 5.33:1 |
| `ccFiber` | `fiber` | #2E8B47 | #5AD27A | | | 4.29:1 |

Blank HC cells keep the base value. HC ink on tint is 6.83:1, just under the 7:1 target but well above AA.

**Where the values live (27/11).** `tokens.css` is the source. `:root` is light, `.dark` is dark, and the HC columns are now in `.hc` and `.dark.hc` there (they used to live only in this table). `tokens.json` is generated from `tokens.css` by `node scripts/tokens-to-json.mjs` and holds `color.light`, `color.dark`, `color.highContrastLight` and `color.highContrastDark` with the same keys as the RN column, plus `font`, `space`, `radius`, `size` and a `cssVar` map. `tokens.json` also has `border` and `separator`, which this table leaves out. Do not edit `tokens.json` by hand; `scripts/verify.mjs` fails if it drifts from the CSS.

**RN (TS) column.** It is the key in `tokens.json`. On iOS, build each color with `DynamicColorIOS` so it follows Dark Mode and Increase Contrast the way `Colors.xcassets` does:

```ts
import { DynamicColorIOS, Platform } from 'react-native';
import tokens from './tokens.json';
const { light, dark, highContrastLight, highContrastDark } = tokens.color;
type Key = keyof typeof light;
export const cc = (k: Key) =>
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: light[k], dark: dark[k], highContrastLight: highContrastLight[k], highContrastDark: highContrastDark[k] })
    : light[k]; // Android: pick from useColorScheme() until Android ships
// usage: backgroundColor: cc('accent'), color: cc('onAccent')
```

## Audit contrast failures fixed
| Item | Before | After |
|---|---|---|
| textTertiary on white | 2.21:1 | 5.35:1 |
| textTertiary dark | 2.84:1 | 5.00:1 |
| Lime ring on light | 1.35:1 | 6.51:1 (orange on ember) |
| Selected camera chip | 3.08:1 | 6.89:1 |
| Analyzing pending steps | 3.66:1 | 8.69:1 |
| Light grabber | invisible | 22% ink |
| Dark selected segment (`.seg a.on`, Review and Diary edit), 27/11 | 3.93:1 (#45403B) | 4.59:1 (`ccFillElevated` #3A3632) |

## Type, spacing, shape
- **Type:** SF Pro text styles with Dynamic Type: Large Title 34, Title1 28, Title2 22, Headline 17 semibold, Body 17, Subheadline 15, Footnote 13. Numbers use SF Pro Rounded with `.monospacedDigit()`.
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 48.
- **Radii:** 10, 14, 20, 28, capsule. Use `ConcentricRectangle` on iOS 26.
- **Sizes:** 44 tap target, 56 button, 76 shutter, ring 184 with a 16 stroke.

## Component mapping
| Canvas | SwiftUI | RN (TS) |
|---|---|---|
| `.btn.primary` | `CCPrimaryButton`: `ccAccent` fill, `ccOnAccent` label, 56 pt, 18 radius, `.sensoryFeedback(.impact)` | `<CCPrimaryButton>`: `Pressable`, `cc('accent')` bg, `cc('onAccent')` label, height 56, radius 18, `Haptics.impactAsync(Light)` |
| `.btn.secondary` | `CCSecondaryButton`: **remove the empty-action default** so it can't ship inert (audit #52 cause) | `<CCSecondaryButton>`: `onPress` is a required prop (no empty default) |
| `.btn.destructive` | `Button(role: .destructive)` on `ccErrorTint` | `<CCButton variant="destructive">` on `cc('errorTint')`, label `cc('errorInk')` |
| Tab bar | System `TabView` with `.tabViewBottomAccessory` or a trailing Scan button. **No custom background.** Glass comes from iOS 26; iOS 18 falls back to standard material | Expo Router `Tabs` (or `NativeTabs` for the system bar); no custom background |
| `.badge` | `ConfidenceBadge(tier:)`: its own row, `.fixedSize()`, never truncates. Tiers 0.85 / 0.70 unchanged | `<ConfidenceBadge tier>`: own row, `numberOfLines` unset so it never truncates |
| Grams control | `GramsField`: −/+ 44 pt (step 10), tappable field opening the `.numberPad` keyboard, optional ruler `Slider`, serving chips | `<GramsField>`: −/+ `Pressable` with `hitSlop` to 44, `TextInput keyboardType="number-pad"`, ruler via `@react-native-community/slider` (step 10), serving chips |
| `.ember` | `EmberCard`: `ccEmber` background, orange radial glow at 30% | `<EmberCard>`: `cc('ember')` bg, radial glow as an SVG/`expo-linear-gradient` layer at 30% |
| Sheets | `.presentationDetents([.medium, .large])` and `.presentationDragIndicator(.visible)` | Expo Router screen with `presentation: 'formSheet'` and `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible: true` |
| Delete confirm (Diary edit) | `.confirmationDialog` with a `role: .destructive` button | `ActionSheetIOS.showActionSheetWithOptions` with `destructiveButtonIndex` |
| `.toast` with Undo (Diary saved / deleted) | Overlay on `ccEmber`, 5 s, `AccessibilityNotification.Announcement` | Animated view on `cc('ember')`, 5 s, `AccessibilityInfo.announceForAccessibility` |
| Export share | `ShareLink` / `UIActivityViewController` | `Share.share({ url })` or `expo-sharing` `shareAsync(uri)` |

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
10. **App icon (27/11):** `icon/AppIcon.icon` is the Icon Composer file. Its six renditions are in `icon/composer/`, and opaque 1024 PNGs for `ios.icon` {light, dark, tinted} are in `icon/flat/`. The manual steps are in `icon/ICON-COMPOSER.md`.

## Additions 27/11
Canvas sections 8–11 in `index.html`. PNG previews are in `previews/<frame id>.png` (2×).

**8 · Diary item edit** (`d-edit-*`, `d-delete-*`, `d-saved-*`, `d-deleted-*` × light / dark / ed)
- Opens as a sheet from a Diary row. It reuses `GramsField` from Review: field, −/+ 44 pt at 10 g, ruler, serving chips. The meal segment and rename sit above it.
- The Total card shows "was 624" so the change is visible before saving.
- **Delete** uses the system action sheet (destructive button, Cancel). It then returns to Diary with a 5 s Undo toast. **Save** returns to Diary with the row tagged "Edited" and a 5 s Undo toast. Undo restores the previous grams and meal.
- Identifiers: `diary.edit.grams.<id>.field`, `.increment`, `.decrement`, `diary.edit.save`, `diary.edit.delete`, `diary.toast.undo`.

**9 · CSV export errors** (`x-write-*`, `x-nodata-*`, `x-cancel-*` × light / dark)
- *Write failed*: error-tint card with the code `EXP-WRITE`, plus Try again and Contact us. Contact us attaches the code.
- *No data*: the primary button is disabled and labelled "No entries in the last 7 days". "Choose All time" is the way out.
- *Share cancelled* is not an error. It uses the info tint ("Not shared") and keeps the file, with Share again and Done. Detect it with `UIActivityViewController.completionWithItemsHandler` `completed == false` on iOS; in RN, `Share.share()` resolves with `action === Share.dismissedAction`.

**10 · Dark mode** (`onb-dark-1…9`, `b-quota-dark`, `b-paywall-dark`, `b-cancel-dark`)
- Same layout and copy as light. Only tokens change. Sheets on dark use `ccElevated` over a #0E0D0C backdrop in the canvas, so the sheet edge reads.
- **Price placeholders.** The paywall shows `{trial}`, `{yearly}`, `{perMonth}` and `{monthly}` (dotted underline), never real prices. `{yearly}` and `{monthly}` = `Product.displayPrice`. `{perMonth}` = yearly price / 12 formatted with `priceFormatStyle`. `{trial}` = `subscription.introductoryOffer`. With no intro offer the CTA reads "Subscribe" and the trial line hides. Cancel uses `{expiryDate}` from `Transaction.expirationDate`. The light paywall's sample price is a placeholder too.

**11 · High Contrast** (`hc-table`, `hc-edit-light`, `hc-edit-dark`)
- `hc-table` is read live from the CSS, so it always matches `tokens.css`.
- In the canvas, add `.hc` (and `.dark.hc`) on a `.phone` to preview Increase Contrast.
- **Selector chosen: the class `.hc`, combined as `.dark.hc` for dark + High Contrast.** It is not `@media (prefers-contrast: more)`. The app decides the mode from iOS Increase Contrast (`AccessibilityInfo` / `UIAccessibility.isDarkerSystemColorsEnabled`; with `DynamicColorIOS` use the `highContrastLight` / `highContrastDark` keys), so the canvas mirrors that with a class that can be toggled per frame. The block order in `tokens.css` is fixed: `:root` (light), `.dark`, `.hc`, `.dark.hc`.

**ED-Safe rules (all new screens).** Hide every kcal number, kcal delta and kcal total, including inside the delete confirm and the Undo toast. Grams, food names, meals and **weight still show**. The Diary summary reads "Logged N items" and "Weight 80.4 kg".

## Additions 27/11, round 3 (sections 12–17)

All frames are templated in `screens-more.js`, loaded after `screens-additions.js` and before `screens.js` (so they get the status bar, home indicator and tab bar). Every one is a `figure.frame` with an `id`, exported at 390×844.

**12 · Sign in** (`auth-signin-light/dark`, `auth-email-light/dark`, `auth-error-light/dark`, `auth-reset-light`)
- Order: Apple, Google, then email. Use `AppleAuthenticationButton` (expo-apple-authentication), `buttonStyle` BLACK on light / WHITE on dark, `cornerRadius` 14, height 56. Google uses its own branded button (light: white, #747775 border, #1F1F1F text; dark: #131314, #8E918F border, #E3E3E3 text). The marks on the canvas are only for the mock.
- Email screen: one form with a Sign in / Create account segment. Set `textContentType` emailAddress / password (newPassword on create) and `autoComplete` so Keychain can fill. Show-password button is 44 pt.
- Wrong credentials: inline error under the field (`accessibilityRole="alert"`), never saying which of the two was wrong. Rate limit after 5 tries comes from Supabase Auth.
- Reset: Open Mail is primary, Resend unlocks after 60 s with a visible countdown.

**13 · Edit goal sheet** (`p-target-light`, `p-target-dark`, `p-target-ed`, `p-target-floor`)
- Large detent. Goal weight reuses the grams stepper + ruler (0.5 kg or 1 lb steps). Pace is three options: 0.25 / 0.5 (Recommended) / 0.75 kg a week.
- The ember card recomputes the daily target live with `TargetsEngine` and shows the old value. ED-Safe shows the goal date only (weight stays visible, per the 27/11 decision).
- Guardrail: a goal under BMI 18.5 for the saved height is clamped to the lowest healthy weight. The copy never says "BMI". Caution colours, not error. The button names the clamped value ("Save 59 kg goal").
- Saving changes today and future days only.

**14 · Describe and Report a problem** (`s-describe-light/dark`, `s-describe-estimating`, `s-fix-light/dark`, `s-fix-sent`)
- Describe sends `kind: "text"` to `analyze-food` (max 500 characters). The quota line uses the server's remaining count and is hidden on Plus. The three progress steps are the same as the Live Activity.
- "Fix Issue" is renamed **Report a problem**: a report never changes the diary, so the sheet offers the direct fix first. Fields: item (preselected from the row's ⋯ menu, or "Whole meal"), one of 5 reasons, an optional note (≤280), and "Include the photo" off by default. Failed sends are queued.

**15 · Paywall without prices** (`b-paywall-loading`, `b-paywall-failed`, `b-paywall-failed-dark`)
- Loading: skeleton price slots after 300 ms, CTA disabled "Loading prices…". Failed (8 s timeout or StoreKit error): caution card + Try again, plans unselectable with "Price unavailable", CTA disabled. Restore and Close always work.
- All prices on the canvas (light and dark paywall, Settings) are now placeholders: `{trial}`, `{yearly}`, `{perMonth}`, `{monthly}`, `{price}`, filled from the App Store product.

**16 · Glance** (`w-medium-ed`, `la-steps`, `la-island-processing`, `la-failed`)
- Medium widget ED-Safe: ring + "On track", meals logged today by name, next meal, Scan button. No numbers.
- Live Activity `ContentState`: `step` (1–3) + `label`. Steps: 1 Spotting the foods, 2 Finding each food, 3 Adding it up. No time estimate. Identical under ED-Safe. Failure state for a typed 422 with a reason from the error code; ends after 15 min or on open.

**17 · Dark: Profile, Settings, Food search, Manual log** (`p-profile-dark`, `p-settings-dark`, `p-search-dark`, `p-manual-dark`)
- Clones of section 3 with `.dark`; no new tokens. Dark quota and cancel were already in section 10 (`b-quota-dark`, `b-cancel-dark`).

**Round 3 tokens (CoachCal request, 27/11).**
- `--cc-segment-selected` (`segmentSelected`): the selected pill of a segmented control. Light #FFFFFF on the `fill` track; dark #3A3632 on the #2A2724 track and inside sheets. The canvas now reads it in `.seg a.on` and the old hard-coded #45403B rule is gone. Rendering is unchanged (same values as before).
- `--cc-on-media` (`onMedia`): the white glyph of glass buttons over a photo or the camera feed (`tone="overMedia"`). It is #FFFFFF in every mode, including dark and High Contrast, because the backdrop is the photo, not the theme. Always pair it with `--cc-media-scrim` (`mediaScrim`, 45% black) behind the glyph, plus the system blur where available. On the canvas: `.glassbtn.on-media` (viewfinder Close, Flash) and the library/flip buttons.
- Rule: no literal `#fff` / `rgba(0,0,0,.45)` in feature code for these. Text over media that is not on a scrim (for example a caption on a photo) needs its own gradient scrim and is not covered by these tokens.

**Icon layers.** `icon/layers/{default,dark,clear,tinted}/` holds flat SVG layers per appearance (see `icon/layers/README.md`). The no-alpha 1024 PNGs are unchanged.

**Verify.** `PLAYWRIGHT=<path to playwright> node scripts/verify.mjs` checks that `tokens.json` equals the computed CSS in all 4 modes. It checks that every text run in sections 8–15 and 17 is at least 4.5:1, renders all PNG previews, and writes `previews/verify-report.json`. Set `BASELINE=<dir>` to pixel-compare existing frames against an older copy.

