# Ember: the design the React Native app follows

Source of truth for how every screen of the RN app looks, from 2026-11-27. The design was made by
Designer in the OpenDesign project "CoachCal Redesign v2" and finished on 2026-11-24. It replaces the
lime accent of the SwiftUI app and the three palettes the brand had (icon, app, web).

Behavior still comes from the SwiftUI app in `native/`: the tests, the identifiers and the rules
that were ported stay. Only the look changes.

## Files

| File | What it holds |
|---|---|
| `tokens.css` | The tokens. Light in `:root`, dark in `.dark`. `apps/mobile/src/design/tokens.ts` copies these values one to one |
| `design-system.md` | The color rules, the token table with the high-contrast values, type, spacing and radii, the component mapping, and the engineering handoff notes |
| `index.html` with `screens.js` and `app.css` | The canvas with every frame. Open `index.html` in a browser; it needs no server |
| `research.md` | The references the design was built from |
| `icon/` | The "Ember ring" app icon as layers and as flattened PNG |
| `frames/` | Every frame as a PNG with a manifest (see below) |

The handoff notes in `design-system.md` are written for SwiftUI (`Colors.xcassets`,
`ConcentricRectangle`, `.manageSubscriptionsSheet`). Each unit decides the React Native equivalent,
follows the spike where it proved one (`expo-router/native-tabs`, `expo-glass-effect`), and records
fallbacks in its findings.

## Frames

| Section (anchor) | Frames |
|---|---|
| `#system` | Design system |
| `#scan` | Viewfinder, Analyzing, Review (light), Review (dark, item needs review), Review (ED-Safe), Saved; Describe mode |
| `#core` | Today (light), Today (dark, offline), Today (ED-Safe), Diary day (sheet, large detent), Progress, Coach |
| `#profile` | Profile, Settings, Food search (ED-Safe), Manual log (ED-Safe) |
| `#billing` | Quota reached (sheet), Plans / paywall, Cancel flow |
| `#onboarding` | Onboarding, 9 steps |
| `#glance` | Widgets (small, medium, Lock Screen, ED-Safe) and Live Activity (Lock Screen, Dynamic Island, ED-Safe) |
| `#icon` | App icon "Ember ring" |

A screen with no frame (editing a food in the diary, the export error, dark variants of onboarding
and billing) is derived from the tokens and the patterns of the nearest frame. The unit says so in
its findings and in the parity table (`derived`).

## Decisions taken for Phương on 2026-11-27, and his approval of the same day

Phương approved Ember on 2026-11-27. The three decisions below were taken for him by Zed before
that, and they stand.

- **Prices.** The paywall never shows the sample prices of the canvas. The old app has no products
  and no StoreKit configuration, so the screens read product ids and prices from the store at run
  time; creating the products is on the follow-up list.
- **ED-Safe** hides the calorie numbers as the frames show. Weight stays visible, as in the app today.
- **App icon.** The app icon becomes "Ember ring" as soon as Designer delivers the complete set,
  the four appearances. A step that needs Icon Composer by hand is written down for Phương. Until
  then the current icon stays.

Designer is adding to this project: the edit sheet of a food in the diary, the CSV export error
state, the dark variants of onboarding and billing, the high-contrast tokens, a `tokens.json` and
the complete icon. The app builds each of those screens now from the tokens and the patterns of the
nearest frame, and corrects it when its frame arrives.

## What never changes

- Every accessibility identifier the app has today (`scan.badge`, `scan.grams.<id>`, `scan.save`,
  `settings.edSafeToggle`, ...). The evidence harness and the tests address screens by them.
- The kcal parity test of the scan review: 464 kcal becomes 508 kcal after three taps on `+`.
- The ED-safe policy stays in the design system (invariant I7 of `docs/rn-migration/spec.md`).

## Frame images

`frames/` holds every frame as a PNG at 2x (a phone screen is 780 by 1690) with `frames/manifest.json`. A unit that restyles a screen puts its Simulator screenshot next to the frame of the same name. Regenerate them with `scripts/rn/ember-frames.cjs` when the canvas changes.

| Section | Images |
|---|---|
| Scan loop | `01-scan-viewfinder.png` `02-scan-analyzing.png` `03-scan-review-light.png` `04-scan-review-dark-item-needs-review.png` `05-scan-review-ed-safe.png` `06-scan-saved.png` |
| Today, Diary, Progress, Coach | `07-core-today-light.png` `08-core-today-dark-offline.png` `09-core-today-ed-safe.png` `10-core-diary-day-sheet-large-detent.png` `11-core-progress.png` `12-core-coach.png` |
| Profile, Settings | `13-profile-profile.png` `14-profile-settings.png` `15-profile-food-search-ed-safe.png` `16-profile-manual-log-ed-safe.png` |
| Quota, Plans, Cancel | `17-billing-quota-reached-sheet.png` `18-billing-plans-paywall.png` `19-billing-cancel-flow.png` |
| Onboarding | `20-onboarding-1-welcome.png` `21-onboarding-2-goal.png` `22-onboarding-3-about-you.png` `23-onboarding-4-goal-weight-and-pace.png` `24-onboarding-5-activity-and-diet.png` `25-onboarding-6-projection.png` `26-onboarding-7-privacy-health-and-ed-safe.png` `27-onboarding-8-building-your-plan.png` `28-onboarding-9-your-plan.png` |
| Widgets and Live Activity | `29-glance-small-widget.png` `30-glance-small-widget-ed-safe.png` `31-glance-medium-widget.png` `32-glance-lock-screen-widgets.png` `33-glance-live-activity-lock-screen.png` `34-glance-dynamic-island.png` `35-glance-live-activity-ed-safe.png` |
