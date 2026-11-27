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

## Decisions taken for Phương on 2026-11-27 (he may change them)

- **Prices.** The paywall never shows the sample prices of the canvas. The old app has no products
  and no StoreKit configuration, so the screens read product ids and prices from the store at run
  time; creating the products is on the follow-up list.
- **ED-Safe** hides the calorie numbers as the frames show. Weight stays visible, as in the app today.
- **App icon.** The current icon stays until the "Ember ring" layers are built in Icon Composer.

## What never changes

- Every accessibility identifier the app has today (`scan.badge`, `scan.grams.<id>`, `scan.save`,
  `settings.edSafeToggle`, ...). The evidence harness and the tests address screens by them.
- The kcal parity test of the scan review: 464 kcal becomes 508 kcal after three taps on `+`.
- The ED-safe policy stays in the design system (invariant I7 of `docs/rn-migration/spec.md`).
