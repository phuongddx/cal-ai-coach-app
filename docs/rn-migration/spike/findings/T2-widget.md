# T2 — Widget (spike item 2): findings and first-run checklist

Branch `spike/rn-expo-widget`. Written 2026-11-27 against `expo-widgets` 58.0.30, `@expo/ui` 58.0.30,
Expo SDK 58, `babel-preset-expo` 58.0.27.

**The widget has not run on a simulator.** Nothing in this file was observed on a device. What was
run (all JS-only, no native build): Jest, `tsc`, the real `build-layout-registry.mjs` step, and the
serialized layout evaluated in Node against stub components. The integration task (T6) is the first
run; sections 2 to 6 are its checklist.

## 1. What was built

| File | Role |
|---|---|
| `apps/mobile/src/widgets/CaloriesWidget.tsx` | `'widget'` layout: small, medium, placeholder. `createWidget('CaloriesWidget', …)` |
| `apps/mobile/src/data/widget/WidgetSnapshotPublisher.ts` | `buildTimeline`, `publish`, `reload`, `startForegroundReload`, `localDayKey`, `nextLocalMidnight` |
| `apps/mobile/src/data/widget/WidgetSnapshotPublisher.test.ts` | 19 tests (timeline cases, publish, reload, listener, action shape); the mobile workspace runs 20 with the skeleton's test |
| `apps/mobile/src/data/widget/spikeActions.ts` | `widgetSpikeAction` (`widget-publish`) and `fixtureSnapshot` |
| `apps/mobile/app.config.ts` | **unchanged**: the `expo-widgets` block already matches (see 7) |

### Registration line for T6

In the file that registers the spike actions (T1's registry under `src/spike/`):

```ts
import { widgetSpikeAction } from '../data/widget/spikeActions';
// …
registerSpikeAction(widgetSpikeAction);
```

Adjust `registerSpikeAction` to whatever name T1's registry exports; the argument is a frozen
`SpikeAction` (`name: 'widget-publish'`, `item: 'widget'`, `title: 'Publish snapshot'`).

Start the foreground reload once at app launch (for example in the root layout's effect):

```ts
import { startForegroundReload } from '../data/widget/WidgetSnapshotPublisher';
// useEffect(() => { const sub = startForegroundReload(); return () => sub.remove(); }, []);
```

Importing `WidgetSnapshotPublisher` (or the widget file) is what runs `createWidget` in the app,
which writes the layout and initial props to the app group. **If nothing in the app imports one of
them before the widget is added, the widget only has the embedded `initialLayout` (section 5).**

## 2. Rule-by-rule check of `CaloriesWidget.tsx`

Rules from `node_modules/expo-widgets/README.md`, the Expo docs page and `babel-preset-expo`'s
`widgets-plugin.js`, checked against `CaloriesWidget.tsx` at the commit that ends this branch.

| Rule | Where | Result |
|---|---|---|
| Layout function carries the `'widget'` directive as its first statement | `CaloriesWidget` body, `'widget';` | ok |
| No hooks | no `use*` call in the function | ok |
| No `async` / `await` / Promises | none | ok |
| No `import` / `require` / dynamic import inside the function | imports are at module level only; the function body has none | ok |
| No module-scope value read inside the function | the only module-scope names in the file are the imports, `placeholderProps` and `CaloriesWidget`; the function reads none of `placeholderProps` or `CaloriesWidget`. Every colour token (`surface`, `glow`, `textPrimary`, `textSecondary`, `accent`, `protein`, `carbs`, `fat`) is declared inside the function | ok, and proven by the free-identifier check below |
| Only `@expo/ui/swift-ui` components and modifiers | `Gauge`, `HStack`, `ProgressView`, `Spacer`, `Text`, `VStack`, `ZStack`; modifiers `containerBackground`, `font`, `foregroundStyle`, `frame`, `gaugeStyle`, `progressViewStyle`, `tint` | ok, all in the native renderer's supported list (section 4) |
| Root view carries `containerBackground(_, 'widget')` | every returned root (placeholder, medium, small) has `modifiers={[background]}`, where `background = containerBackground({…radialGradient…}, 'widget')` | ok (checked on all three roots by the Node run) |
| `environment.widgetFamily` picks the layout | `systemMedium` branch, everything else falls to the small layout | ok |
| Placeholder for `props.date === ''` | first branch after the tokens; shows "CoachCal" and "Open CoachCal Spike" | ok |
| Arithmetic clamps | `Math.max(0, consumedKcal)`, `Math.max(0, goal − consumed)`, `clamp01` on every fraction, goal 0 gives fraction 0 | ok, run with over-goal, zero-goal and negative inputs |
| Name equals the config | `createWidget('CaloriesWidget', …)` and `name: 'CaloriesWidget'` in `app.config.ts` | ok |
| No line comments inside the function | a `//` comment inside a serialized function is fragile; the file uses none inside (a block comment only) | ok, `0` line comments in the registry layout |

### What was actually run for these checks

1. `node node_modules/expo-widgets/scripts/build-layout-registry.mjs apps/mobile ios <out.json> <config.json>`
   with a config naming `src/widgets/CaloriesWidget.tsx`: this is the exact step Xcode runs for
   `initialLayout`. It exited 0, bundled 5 modules in 1.4 s, and wrote the layout (2,945 characters)
   and `initialProps` (`date: ''`, goals `2000/130/210/70`) for `CaloriesWidget`.
2. The serialized layout was parsed and its free identifiers listed: `Gauge, HStack, Math,
   ProgressView, Spacer, String, Text, VStack, ZStack, _jsx, _jsxs, containerBackground, font,
   foregroundStyle, frame, gaugeStyle, progressViewStyle, tint`. All of them are exports of
   `@expo/ui/swift-ui` or `@expo/ui/swift-ui/modifiers` (the 413 names `ui-globals.ts` puts on
   `globalThis`) or the jsx runtime stub (`_jsx`, `_jsxs`) or JS built-ins: **nothing is missing**,
   so a `ReferenceError` from a module-scope value cannot happen.
3. The layout was evaluated in Node with stub components and the result inspected, for
   `systemSmall` and `systemMedium`, dark and light, the placeholder, an over-goal input and a
   zero-goal input. Sample (1,284 of 2,100 kcal, protein 82/130, carbs 140/210, fat 38/70):
   - small: root `ZStack`, texts `CoachCal`, `816`, `kcal left`, Gauge value 0.611
   - medium: root `HStack`, `816`, `kcal left`, `Protein 82/130 g`, `Carbs 140/210 g`, `Fat 38/70 g`,
     ProgressView values 0.631, 0.667, 0.543
   - placeholder: root `VStack`, `CoachCal`, `Open CoachCal Spike`
   - over goal: `0` left, Gauge 1, protein bar 1 (text `400/130 g`)
   - every root's first modifier is `containerBackground` with `'widget'` and a radial gradient
     (`#141210` surface with an orange `rgba(255, 106, 0, 0.30)` glow; light scheme uses `#F7F5F2`)

   This proves the tree shape and that no name is undefined. It does **not** prove that SwiftUI
   draws it as intended.

## 3. First run: place the widget with `axe`

Simulator `iPhone 17 Pro`, iOS 26.4, UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3` (`U` below).
The app (dev client `com.nextlabs.coachcal.rnspike`) must have been **launched once** so
`createWidget` ran; then go to the home screen.

```sh
U=85024D2F-71DE-43C0-8E11-CE58F4578FC3
axe button home --udid $U                                   # home screen
axe describe-ui --udid $U                                   # find an empty spot; note its x,y in points
axe touch -x 200 -y 400 --down --up --delay 1.5 --udid $U   # long press an empty area: icons wiggle
axe tap --label "Add Widget" --udid $U                      # the "+" at the top left (label may be "Add")
axe describe-ui --udid $U                                   # gallery: look for "CoachCal Calories"
axe tap --label "CoachCal Calories" --udid $U               # opens its family pager (small, medium)
axe tap --label "Add Widget" --udid $U                      # adds the family on the current page
axe swipe …                                                 # page to the other family, add again
axe button home --udid $U                                   # leave edit mode
xcrun simctl io $U screenshot t2-home.png
```

The labels and coordinates above are what iOS 26 normally shows and are **not verified**: take an
`axe describe-ui` after each step and use the labels it prints. If the gallery search field is
easier, tap it (`axe tap --label Search`), `axe type "CoachCal"`, then tap the result.

## 4. What to look for, per family

| | Small (`systemSmall`) | Medium (`systemMedium`) |
|---|---|---|
| Background | ember surface with an orange glow at the top right (dark); cream surface (light) | same |
| Content | "CoachCal" in orange at the top left; a ring with the remaining kcal number and "kcal left" | the ring on the left; three macro rows (Protein blue, Carbs teal, Fat purple) with `82/130 g` style values and a bar each |
| Before the first publish | placeholder: "CoachCal" and "Open CoachCal Spike", no ring | same |
| After `widget-publish` (fixture 1,284 / 2,100) | ring about 61 % filled, **816** `kcal left` | the same ring, bars about 63 %, 67 %, 54 % |
| Dark / light | switch the simulator appearance and re-check text contrast | |

### The parts most likely to differ from the design (check first)

1. **Ring size and thickness.** The ring is a `Gauge` with `gaugeStyle('circularCapacity')`, which
   maps to SwiftUI `.accessoryCircularCapacity` (`GaugeStyleModifier.swift`). That style is meant
   for the Lock Screen and may draw a thin ring that does not fill the 96 and 104 point `frame`.
   The design shows a ring about 100 points wide and 16 points thick. If it is small or thin: try
   `scaleEffect(2)` on the Gauge plus a smaller `frame`, or draw the ring with `Circle`-based
   shapes (`Circle`, `Mask`, `Overlay` are supported; there is no `trim` modifier in the list, so a
   true arc is not available).
2. **Number inside the ring.** The remaining-kcal text is passed as `currentValueLabel`
   (`Slot name="currentValue"`). A `.accessoryCircularCapacity` gauge may scale or clip it. If it
   is clipped, move the number out of the Gauge into a `ZStack` over it.
3. **Glow.** `containerBackground` takes a `radialGradient` here. If the glow looks flat or
   missing, check `showsContainerBackground` in StandBy and tinted Home Screens (iOS removes the
   background there; that is expected).
4. **Colours given as `rgba(…)`.** The glow colours use `rgba(255, 106, 0, 0.30)`. The native `Color`
   converter should accept CSS colours, but this was not run; if the glow is solid orange or black,
   switch to eight-digit hex (`#FF6A004D`).
5. **Bar track colour.** `ProgressView(.linear)` uses the system track; the design's `#3A342F` track
   cannot be set (no modifier for it). A grey track is acceptable.
6. **Missing from the design on purpose:** the "Scan a meal" button (needs an App Intent) and the
   ED-Safe variant. Both are outside spec D2.

## 5. What the gallery shows before the first launch (`initialLayout`)

`app.config.ts` sets `ios.initialLayout: 'src/widgets/CaloriesWidget.tsx'`. At build time the
"Build ExpoWidgets bundle" Xcode phase (`xcode-build-bundle.sh` → `build-layout-registry.mjs`)
bundles that file, captures what `createWidget` registered, and embeds it as
`ExpoWidgetsLayoutRegistry.json` (verified above to contain the layout and `initialProps`).

At run time the widget reads, in this order (`WidgetsLayoutRegistry.swift`, `EntryView.swift`):
1. the layout stored in the app-group `UserDefaults` (written when the app runs `createWidget`),
2. else the embedded `initialLayout` layout,
3. else `EmptyWidgetView` (a blank widget).

Initial props come from the app group (`__expo_widgets_CaloriesWidget_initial_props`), else the
embedded `initialProps`. Both are `placeholderProps` (`date: ''`), so **the gallery preview and
a fresh widget show the placeholder "Open CoachCal Spike", not a number**, until the first
`publish`. If the gallery shows a **blank** widget instead, the embedded registry is missing
(check that the Xcode phase ran and that `initialLayout` is a project-relative path).

Because `placeholder()` and `getSnapshot()` use the initial props, the gallery never shows kcal
numbers; if the integration wants a nicer gallery card, change `placeholderProps.date` to a real
day key plus sample numbers (a one-line change), at the cost of showing sample numbers on a new
widget.

## 6. Ways a first run can fail, and the fix

| Symptom | Cause | Fix |
|---|---|---|
| Widget shows a red box or an empty frame; log mentions the layout | a component or modifier not in the native renderer. Supported types: Text, Slot, HStack, VStack, ZStack, Overlay, Background, Mask, Rectangle, RoundedRectangle, Capsule, Circle, Ellipse, UnevenRoundedRectangle, Image, Divider, Label, ProgressView, Spacer, Gauge, Chart, Button (iOS 17+), Fragment, Link, AccessoryWidgetBackground. Anything else renders a `RedBoxView` in debug and nothing in release | remove or replace it; do not use `Grid`, `List`, `ScrollView`, `Form`, `Picker` and so on |
| iOS draws "Please adopt containerBackground API" or a plain default card (typical symptom, not seen here) | a returned root lacks `containerBackground(_, 'widget')` (every early `return` needs it) | add the modifier on the root of each branch; here all three have `background` |
| `ReferenceError: Can't find variable: X` in the widget log | the function used a module-scope value (a const, a helper, an import) | move it inside the function; the Node check in section 2 lists every free identifier |
| Gallery lists the widget but it renders blank, or the widget never updates | `createWidget` name differs from `name` in `app.config.ts` (the storage keys are `__expo_widgets_<name>_*`) | make both `CaloriesWidget` |
| Widget is not in the gallery | the app was built before the plugin block was added, or `supportedFamilies` is empty | `expo prebuild` then rebuild in the main worktree; keep `['systemSmall', 'systemMedium']` |
| Widget keeps the placeholder after Publish | the app never ran `createWidget` (nothing imports the widget module), or the app group differs between app and extension | import the publisher at launch; the default group is `group.com.nextlabs.coachcal.rnspike` (the plugin warns that no `groupIdentifier` is set; that is expected) |
| Publish logs `widget-publish-failed` with a native-module message | running in Jest, Expo Go or a build without `expo-widgets` | only the dev client build has it; publish is best effort and never throws |
| Publish logs `widget-publish-failed` with `UpdatedTimelineWithoutLayout` | native `updateTimeline` throws when no layout is stored: `createWidget` did not run in the app (`WidgetObject.swift`) | make sure the widget module is imported at launch; `WidgetSnapshotPublisher` imports it, so importing the publisher is enough |
| Layout string throws `SyntaxError: Unexpected EOF` | a backslash or backtick inside the layout broke the template literal (the plugin escapes them; a `//` line comment inside the function is the other usual cause) | keep comments outside the function or use `/* … */` |
| Gauge or ProgressView looks wrong but renders | style modifiers are applied but SwiftUI picked another style | check section 4, item 1 |

## 7. `@expo/ui/swift-ui` used, and what was missing

Used and confirmed in the native renderer / modifier registry (`ViewRenderer.swift`,
`ViewModifierRegistry.swift`): `Text`, `VStack`, `HStack`, `ZStack`, `Spacer`, `Gauge`
(with `currentValueLabel` slot), `ProgressView`; modifiers `containerBackground`, `font`,
`foregroundStyle`, `frame`, `gaugeStyle`, `progressViewStyle`, `tint`.

Missing or not controllable (worked around, to judge on a device):
- **Ring thickness and diameter**: no direct control with `Gauge`. No `trim`, so no arc drawn from `Circle`.
- **Progress track colour**: no modifier.
- **`lineLimit`**: not exported (only `minimumScaleFactor` and `multilineTextAlignment`); the layout
  has no long text so it does not matter.
- **"Scan a meal" button**: `Button` works from iOS 17 with `onButtonPress`, but opening the camera
  from the widget needs an App Intent; out of scope here.

## 8. How to prove the midnight timeline entry on a device

What the app writes: `publish` calls `updateTimeline([{now, snapshot}, {nextMidnight, zeroed}])`,
which stores both entries in the app group and calls `reloadTimelines`. The timeline policy is
`.atEnd`, so iOS shows the first entry now and swaps to the second at its date, with the app not running.

1. **See the stored entries.** From the app (console or a dev button) call
   `caloriesWidget.getTimeline()` (default export of the widget file) and log it: expect two
   entries, the second with `date` at the next local 00:00, `consumedKcal: 0` and tomorrow's
   `date` key. Or read the app-group plist:
   `xcrun simctl get_app_container $U com.nextlabs.coachcal.rnspike groups`, then
   `plutil -p <group path>/Library/Preferences/group.com.nextlabs.coachcal.rnspike.plist` and look
   for `__expo_widgets_CaloriesWidget_timeline` (entries have `timestamp` in ms and `props`).
   The plist path is the usual layout and was **not** checked.
2. **See the swap without waiting for midnight.** `publish(snapshot, { rolloverAt: new Date(Date.now() + 120_000) })`
   (a debug call from the console, not the registered action). Kill the app, wait two minutes
   on the home screen: the widget should switch from the fixture numbers to `2100 kcal left`
   (and bars at 0). WidgetKit may delay an entry change by up to a few minutes in the simulator.
3. **Real midnight.** Publish once, leave the simulator running past 00:00 local time, screenshot.

## 9. Where the docs and plan were wrong or loose

1. **Spec D2 and the plan** say `publish` calls `updateSnapshot` now and `updateTimeline` with two
   entries. On iOS `updateSnapshot(props)` is `updateTimeline([{ date: now, props }])`
   (`expo-widgets/src/Widgets.ts`), so the second call would replace the first. One `updateTimeline`
   call with both entries is correct; `publish` does that.
2. **`updateTimeline` already reloads.** `Widget.updateTimeline` writes the entries and calls
   `WidgetCenter.reloadTimelines` natively, so the foreground `reload()` is an extra refresh (useful
   after the system dropped the timeline), not a required step after each publish.
3. **"Renders only `@expo/ui/swift-ui` components" is too wide.** The README and the Expo page do
   not list it, but the native renderer only draws the 20-odd types in section 6; everything else is
   empty or a red box. The list above comes from `ViewRenderer.swift`.
4. **`initialLayout` also supplies the initial props.** The docs describe only the layout; the
   registry also carries the `createWidget` third argument (`placeholderProps` here), which is what
   the gallery and a new widget show.
5. **Jest.** `expo-widgets` ships no Jest mock; on iOS the platform file `ExpoWidgets.native.ts` calls
   `requireNativeModule('ExpoWidgets')` at import, so a test that imports the widget file needs
   `jest.mock` of the module (the tests here mock `../../widgets/CaloriesWidget`). The non-native
   `ExpoWidgets.ts` is a stub, but jest-expo/ios does not use it.
6. **Plan wording "reload() on app foreground":** `reload()` is `WidgetCenter.reloadTimelines`; on
   its own it does not push new data, it only re-reads what `updateTimeline` stored (`WidgetObject.swift`).
