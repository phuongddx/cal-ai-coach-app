# T1 findings: app shell, glass, Ember (spike item 1)

Run on iPhone 17 Pro, iOS 26.4 Simulator (UDID 85024D2F-71DE-43C0-8E11-CE58F4578FC3), Debug dev client
built in T0, JS served by Metro on 8081. Evidence is in `evidence/item1/`.

## Answers to the D1 questions

| | Answer | Evidence |
|---|---|---|
| (a) Real Liquid Glass tab bar, minimizes on scroll? | **Yes to both.** `NativeTabs` renders the system iOS 26 floating glass tab bar (UITabBarController). With `minimizeBehavior="onScrollDown"` the bar collapses to a single round glass button at bottom-left (selected tab icon) when the list scrolls, and expands again on scroll up. | `ember-light-content-behind-tabbar.png` (expanded, content blurred behind), `ember-light-scrolled.png` and `ember-dark-scrolled.png` (minimized) |
| (b) Does `GlassView` blur/refract content scrolling behind it? | **Yes.** The sticky week strip is a `GlassView`; while the dark hero card scrolls under it, the ring, big number and text behind it are blurred and tinted, and the orange ring bends at the glass edge. The header calendar button and the Scan button are `GlassView` too (Scan tinted orange, interactive). `isLiquidGlassAvailable()` returns `true` (shown in the console JSON). | `ember-light-scrolled.png`, `ember-dark-scrolled.png`, `spike-console-dark.png` |
| (c) Rounded design via `ui-rounded`? | **Yes.** `fontFamily: 'ui-rounded'` renders SF Rounded (bold/heavy numbers, semibold labels) with `fontVariant: ['tabular-nums']`; the big kcal number and macro numbers align. | all Ember shots |
| (d) SF Symbols via `expo-symbols`? | **Yes.** `SymbolView` rendered `sun.max`, `chart.line.uptrend.xyaxis`, `sparkles`, `person.crop.circle`, `ladybug` (as tab icons via `NativeTabs.Trigger.Icon sf=`), plus `calendar`, `flame.fill`, `fork.knife`, `camera.fill` at regular, semibold and bold weights. | all shots |
| (e) Bottom-accessory API for Scan? | **An API exists, it does not fit.** The spec/docs said there is none; expo-router 58.0.33 ships `NativeTabs.BottomAccessory` (+ `usePlacement`). Per its API shape (and Apple's `UITabAccessory`) it is a full-width capsule above the tab bar, not a single round trailing button; **I did not render it in this task**, so that is from the API, not from a screenshot. Workaround used: an absolutely positioned `GlassView` circle in the root layout (`pointerEvents="box-none"`, `paddingBottom: 104`). Cost: the button is not part of the tab bar, so it does not move when the bar minimizes (it sits above where the expanded bar is, and stays there when the bar collapses), it overlaps the list's last visible row, and it is visual only here. | `ember-light.png`, `ember-light-scrolled.png` |
| (f) Swift, plugin or workaround? | **No Swift, no new config plugin, no native file touched.** Workarounds listed below. | |

## Workarounds, plugins, native files

- Swift: none. Native files edited: none. `app.config.ts`, `package.json`, `package-lock.json` unchanged.
- Config plugins: only the ones already in `app.config.ts` from T0 (expo-router, expo-widgets, HealthKit untouched).
- Scan button: floating `GlassView` overlay instead of a tab-bar accessory (see (e)).
- Offline chip replaces the calendar glass button in the header when `isOffline`; toggled from the console
  (`spike:ui:toggle-offline`) because there is no network layer yet (T4/T5 own that).
- Disk was 4.1 GB free (rule: stop native builds under 6 GB). **No native rebuild was run**; everything is JS served to the T0 binary, which is why no native change is possible in this task.

## Pitfalls and places the docs were wrong

1. **React Compiler is on (`experiments.reactCompiler: true`) and silently caches zero-argument store reads.**
   `const run = getLastRuns()[item]` in the console rendered once and never updated: the log said
   `action-done` but the card stayed on "running seed…". Fix: read an external store only through the return
   value of `useSyncExternalStore`, and make the snapshot stable (`listSpikeActions` now returns a cached array;
   returning a fresh array from `getSnapshot` would loop). Anything later (T2 to T6) that reads a module-level
   store inside a component must follow the same rule. Jest does not catch this because the compiler does not run in the jest-expo preset used here.
2. `StyleSheet.absoluteFillObject` no longer exists in RN 0.88 types (TS2551); use explicit `position: 'absolute'` + 0 edges.
3. `NativeTabs.BottomAccessory` exists although the spec says it does not (see (e)).
4. `xcrun simctl openurl ccspike://…` shows a system "Open in CoachCal Spike?" confirmation on iOS 26.4 each time
   (the first call after launch can queue two). Automation has to tap **Open** (`axe tap --label Open`), once per queued dialog,
   before the deep link runs. Plan scripts that assume a silent deep link will screenshot the dialog instead.
5. `axe tap --label Ember` works only when the tab bar is expanded; `axe tap --id` needs the screen to be the
   one that owns the testID. `axe describe-ui` lists `ember:*` and `spike:ui:*` ids for both screens.
6. RNTL 14 testID containers include child label text, so assert with regex (`/82 \/ 130 g/`) not exact strings.
7. `expo-file-system` is available only transitively; `first-render.txt` uses the new `File`/`Paths` API
   (`Paths.document`). It is written once, on the first Ember render (`src/spike/firstRender.ts`); the Metro log
   shows the ISO and file URI (`evidence/item1/spike-log-excerpt.txt`).
8. Light mode hero card is deliberately dark in both modes (spec D1), so light and dark differ only below it.

## Verified vs not verified

- Verified in the simulator: all five tabs, Ember in light and dark, offline chip (light and dark), minimize on scroll, glass blur
  over scrolled content, console status and JSON after the fix, `seed` action through deep link and button, first-render log.
- Verified by commands: `npm test` (all workspaces pass), `npx tsc --noEmit` in `apps/mobile`, `npm run typecheck`.
- Not verified: Release build, a physical device, Android, VoiceOver/Dynamic Type, dark/light switching while the app
  stays open (it was done, but only checked by screenshots), pixel parity with the SwiftUI app (the side-by-side shows the
  intended D1 design, which differs from the old SwiftUI Today screen by spec: ring card, week strip, streak card).
