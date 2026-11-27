# Ember frames: what every frame of the canvas shows and what the RN app must build

One section per frame of `docs/design/ember/index.html`, in canvas order. For every frame: what it
shows from top to bottom with its copy verbatim, the RN files that implement that screen today, the
identifiers that must survive, what differs from today's screen, the behavior the frame needs and
whether that is client work or a follow-up, and the `docs/rn-migration/parity.tsv` rows it covers.
Two tables at the end map parity rows to frames and list the screens the design does not show.

Companion documents: `design-system.md` (tokens, rules, component mapping, handoff notes),
`tokens.css` (the token source per D12), `README.md` (decisions and invariants).

## How many frames the canvas holds

Measured from the manifest, which the capture tool wrote from the canvas — repeatable without a
browser:

```sh
node -e "const m=require('./docs/design/ember/frames/manifest.json'); const k={},s={};
for (const f of m) { k[f.kind]=(k[f.kind]||0)+1; s[f.section]=(s[f.section]||0)+1; }
console.log(m.length, JSON.stringify(k)); console.log(JSON.stringify(s))"
# → 107 {"screen":84,"glanceable":7,"panel":16}
#   {"scan":6,"core":6,"profile":4,"billing":3,"onboarding":9,"diaryedit":12,"export":6,
#    "darkmode":12,"hc":3,"auth":7,"target":4,"scansheets":6,"paywallstates":3,"darkmore":4,
#    "glance":7,"icon":11,"glance2":4}
```

The static file plus the generators agree. The static `index.html` holds 25 `figure.frame`
elements — the 19 phones of `#scan`, `#core`, `#profile` and `#billing`
(`grep -c 'class="phone' docs/design/ember/index.html` → 19) plus the 6 Icon Composer renders of
`#icon`. The three generators render the rest from templates:

- `screens.js`: 9 onboarding steps (light) + the same 9 again in `#onbDark` + 7 glanceables + 5
  icon variants = 30 runtime frames.
- `screens-additions.js`: 12 diary-edit + 6 export + 3 dark billing + 3 high contrast = 24 runtime
  frames.
- `screens-more.js`: 7 sign-in + 4 edit-goal + 6 scan sheets + 3 paywall states + 4 glance2 + 4
  dark profile band = 28 runtime frames.

25 static + 82 runtime = 107. Of the 107, **84 are phone screens, 7 glanceables and 16 panels**
(the panels: 11 icon frames, the High Contrast token table, and the 4 second-glance-band frames).

Every frame of the manifest is a PNG under `frames/` at 2x (a phone screen is 780×1690) named
`NN-<section>-<caption>.png`, in canvas order; this document cites each block's exact file name.
Frames 01 to 28 kept their first-round file names; from 29 on the frames are new or renumbered (the
glance band moved from 29–35 to 85–91, the icon band from 36–40 to 92–96).

Each section has the seven parts the unit brief names. Token names (`--cc-accent`, `--cc-text-2`,
…) are from `tokens.css`; hex values quoted in a frame are the canvas' inline values, which the
token table maps (for example `#FF7A1F` on ember is `--cc-ember-accent`).

Conventions used below:

- **Identifiers that must survive** lists every `testID` of today's RN screen and every
  `accessibilityIdentifier` of the Swift screen it replaced (`grep` over `apps/mobile/src` and
  `native/App`), including the design-system identifiers riding on the screen (`ccstepper.*`,
  `confidence-badge`, `toast:undo`, …). Design-system components keep their own identifiers; a
  feature identifier that Swift put on a DS component is carried by a wrapper `View` with the same
  string. A name marked *(RN-only)* or *(Swift-only)* is a one-sided identifier — the restyle unit
  keeps the string that exists today and records the placement.
- **Behavior** says what the app cannot do yet and classifies it: *client* (U-unit work, no new
  endpoint or dependency), *native* (needs the native slot or a new native dependency),
  *backend* (needs a server change), *store* (needs StoreKit products/configuration). The plan's
  phase-4 table already lists three follow-ups — Analyzing with server stages, haptics, billing —
  confirmed below; the glanceable ED-Safe flag and the server entitlement read are the additions.
- **Parity rows** are the `parity.tsv` ids whose `ember` cell names the frame.

---

## 1 · Scan loop (`#scan`)

### Viewfinder

1. **Frame:** "Viewfinder" — `01-scan-viewfinder.png`, anchor `#scan`, dark over a full-bleed camera image (`background #000`,
   photo placeholder). Phone size 390×844.
2. **Shows**, top to bottom:
   - Close glass button, top-left, `aria-label "Close"`, `#i-x` icon, `rgba(0,0,0,.45)` surface,
     white glyph.
   - Free-scan chip, top-centre: `#i-scan` icon + copy **"2 of 3 free scans left this week"**,
     `rgba(0,0,0,.55)` surface, `#F7F5F2` text, 13 px, 32 pt tall.
   - Flash glass button, top-right, `aria-label "Flash off"`, `#i-flash`.
   - Corner brackets: 312×312 SVG, `#FF6A00` stroke 5, rounded corners.
   - Guidance: **"Fit the whole plate in the frame"** (600 15 px `#F7F5F2`) and **"Good light helps
     the estimate"** (400 13 px `#ABA6A0`).
   - Mode chips (bottom 150): **"Food"** selected — black-on-orange chip (6.89:1), **"Barcode"**,
     **"Label"**, **"Describe"** on `rgba(42,39,36,.85)` with `#F7F5F2` text.
   - Bottom controls (bottom 46): library glass button (`#i-image`, 52 pt, `aria-label "Choose from
     library"`), shutter 76 pt (`--shutter`) white ring with a 60 pt `--cc-accent` inner circle
     (`aria-label "Take photo"`), flip glass button (`#i-flip`, `aria-label "Switch camera"`).
   - Interactions: chips switch the capture mode; Describe opens the describe sheet; shutter
     captures; library opens the photo picker.
3. **Implemented today by:** `apps/mobile/src/features/scan/CaptureViewfinderView.tsx` (seam
   `apps/mobile/src/features/scan/scanCapture.ts`, route `apps/mobile/src/app/scan/index.tsx`).
4. **Identifiers that must survive:** RN `scan.shutter`, `scan.library`, `scan.flip`, `scan.zoom`,
   `scan.modePill.photo`, `scan.modePill.barcode`, `scan.modePill.label`, `scan.coachMark`,
   `scan.fixtureFeed` *(RN-only test helper)*, `scan.cameraDenied`, `scan.openSettings`,
   `scan.barcodePicker` *(RN-only)*, `scan.tryAgain`, `scan.errorCard`, `scan.searchManually`;
   Swift `scan.shutter`, `scan.library`, `scan.flip`, `scan.zoom`, `scan.modePill`,
   `scan.modePill.<photo|barcode|label>`, `scan.coachMark`, `scan.cameraDenied`,
   `scan.openSettings`, `scan.tryAgain`, `scan.errorCard`, `scan.searchManually`.
5. **Differences from today's screen:** the RN pill row has three modes (`photo`, `barcode`,
   `label`); the frame adds **"Describe"** as a fourth chip (the `text` mode exists in the model and
   the sheet exists, so this is placement). The frame removes the fake **"1.0×"** zoom readout —
   `scan.zoom` must stay on whatever zoom affordance remains, or the unit records its removal with
   the owner. The selected chip is black-on-orange instead of today's selected tint. The
   free-scan counter chip does not exist today. Guidance copy and the always-visible close button
   match the caption fixes (#13, #10, #39, #11).
6. **Behavior the frame needs:** the free-scan counter comes from the server; today the client
   learns quota only from the 402 envelope of a spent scan, and no `GET` entitlement read exists —
   **backend follow-up** (a read endpoint, or the client shows the last known entitlement state).
   Everything else (Describe chip, chip contrast, guidance) is **client** (U-72).
7. **Parity rows:** SC-02 (and the shell of SC-01/PL-01 behind every frame).

### Analyzing

1. **Frame:** "Analyzing" — `02-scan-analyzing.png`, anchor `#scan`, dark (`#000`), blurred plate backdrop.
2. **Shows**, top to bottom:
   - 200×200 thumb, radius 32, `0 0 0 3px #FF6A00` ring plus a soft orange glow, over the blurred
     plate.
   - **"Reading your plate"** (700 28 px `#F7F5F2`) and **"Usually under 5 seconds"** (400 15 px
     `#ABA6A0`).
   - Three checklist rows (600 17 px, gap 14): **"Photo uploaded"** — filled `#FF6A00` circle with
     a black check; **"Finding each food"** — `#FF6A00` spinner ring, `#F7F5F2` text;
     **"Estimating portions"** — idle 2 px `#57504A` ring, text `#ABA6A0` (8.69:1 on black).
   - **"Cancel"** button pinned at the bottom, `rgba(42,39,36,.9)` surface, `#F7F5F2` label.
3. **Implemented today by:** `apps/mobile/src/features/scan/AnalyzingView.tsx` (state from
   `scanModel.ts`).
4. **Identifiers that must survive:** RN `scan.analyzing`, `scan.analyzing.thumb`,
   `scan.checklist` *(RN-only)*, `scan.step.<step>`, `scan.cancel`; Swift `scan.analyzing`,
   `scan.analyzing.thumb`, `scan.step.<step.rawValue>`, `scan.cancel`.
5. **Differences from today's screen:** today the three steps advance on a 0.5 s dwell timer with a
   fourth escalation step after the 5 s watchdog; the frame ticks a step only when the server
   reports that stage and never runs a timer. The escalation row survives as the fourth step only
   while an escalation is real. If the server reports no stages, the frame shows only the spinner
   thumb and the "Usually under 5 seconds" line. Pending-step contrast rises to 8.69:1 (#21, #54).
6. **Behavior the frame needs:** real server-reported stages — the scan API answers in one request
   and reports none, so honest steps need a server change: **backend follow-up** (the plan's phase-4
   table says the same; confirmed). Removing the timer and showing only observed facts is **client**
   (U-72).
7. **Parity rows:** SC-03.

### Review (light)

1. **Frame:** "Review (light)" — `03-scan-review-light.png`, anchor `#scan`, light (`--cc-bg`), plain phone, scroll under a
   pinned dock.
2. **Shows**, top to bottom:
   - Nav bar: back glass button (`aria-label "Back to camera"`, `#i-back`), title **"Review"**,
     close glass button (`aria-label "Close"`, `#i-x`).
   - Header row: 72 pt thumb, radius 18; editable title **"Chicken rice bowl"** (700 22 px) with a
     `#i-pencil` glyph in `--cc-text-3`; **"High confidence"** badge (`data-id scan.badge`) on its
     own row under the title — confidence only, no dish claim.
   - Total card (`--cc-grouped` background, no border): label **"Total · AI estimate"** (13 px
     `--cc-text-2`); **"624"** (700 44 px SF Pro Rounded, `data-id scan.totalKcal`) + **"kcal"**
     (600 17 px `--cc-text-2`); right column of macro dots: **"P 41 g"** (`--cc-protein`),
     **"C 72 g"** (`--cc-carbs`), **"F 17 g"** (`--cc-fat`).
   - Section head **"3 items · tap grams to type"**.
   - Expanded item card: **"Jasmine rice"** + **"234 kcal"**; a −/+ pair of 44 pt fill buttons
     (`aria-label "Decrease rice by 10 grams"` / `"Increase rice by 10 grams"`, radius 14) around a
     tappable grams **field** (44 pt tall, 2 px `--cc-accent` border, **"180"** 700 22 px Rounded +
     "g" + text caret) — kcal is never typed; a drag **ruler** (10 px ticks, 50 px major ticks,
     3 px `--cc-accent-strong` needle, labels 100 · 150 · **180** in `--cc-accent-ink` 700 · 200 ·
     250); serving chips **"½ cup"**, **"1 cup · 160 g"**, **"1½ cup"** (32 pt, 13 px).
   - Collapsed item cards: **"Roast chicken thigh"** / 320 kcal / **"140 g"** fill pill (44 pt);
     **"Cucumber"** / **"70 kcal incl. dressing"** / **"60 g"**.
   - Ghost row **"Add a missing item"** (`#i-plus`, 15 px).
   - Dock: meal segment **Breakfast / Lunch (selected, `--cc-accent-ink`) / Dinner / Snack** — the
     default follows the time of day; primary **"Save to Lunch"** (`data-id scan.save`, 56 pt,
     `--cc-accent` fill, `--cc-on-accent` label); note row **"Something wrong? Report it"**
     (underlined, `--cc-text-2`).
3. **Implemented today by:** `apps/mobile/src/features/scan/ReviewSheetView.tsx` (state
   `scanModel.ts`, arithmetic via `@coachcal/core`, route `apps/mobile/src/app/scan/index.tsx`).
4. **Identifiers that must survive:** RN `scan.review`, `scan.badge`, `scan.titleField`,
   `scan.totalKcal`, `scan.warningChip`, `scan.mealPicker`, `scan.save`, `scan.close`,
   `scan.retake`, `scan.grams.<itemId>`, `scan.itemKcal.<itemId>`, `scan.fixIssue.<itemId>`,
   `scan.reviewNeeded.<itemId>`, DS `ccstepper.decrement`, `ccstepper.increment`,
   `stepper:<name>`, `confidence-badge`, `confidence-badge:compact`, `warning-chip`; Swift the same
   strings (`scan.grams.<item.id>`, `scan.itemKcal.<item.id>`, `scan.fixIssue.<item.id>`,
   `scan.reviewNeeded.<item.id>`, `ccstepper.decrement`, `ccstepper.increment`). Handoff note 3
   names the future field `scan.grams.<id>.field` next to the kept `scan.grams.<id>.increment`.
5. **Differences from today's screen:** grams move from stepper-only to the typed field + steppers
   + ruler + serving chips (the 464→508 kcal parity path on `scan.grams.<id>.increment` keeps
   working); the badge takes its own row and drops the dish type; the "Fix Issue" entry is relabelled
   **"Something wrong? Report it"** (identifier `scan.fixIssue.<id>` stays); the meal segment
   defaults by time of day and tints `--cc-accent-ink` instead of the system blue; the "+ Add a
   missing item" row is new; collapsed rows show the per-item kcal line under the name.
6. **Behavior the frame needs:** typed grams, ruler and serving chips are **client** (U-72); the
   kcal-recompute invariant (I6) and the unresolved-gate already exist. No endpoint.
7. **Parity rows:** SC-04, SC-01, SC-06.

### Review (dark, item needs review)

1. **Frame:** "Review (dark, item needs review)" — `04-scan-review-dark-item-needs-review.png`, anchor `#scan`, dark (`--cc-bg #000`, cards
   `--cc-card`).
2. **Shows**, top to bottom:
   - Same nav bar as Review (light).
   - Header: **"Mixed salad"** with **"Medium confidence"** badge — the medium tier is caution
     yellow, not brand orange.
   - Total card: **"412"** kcal, macros **"P 18 g" / "C 22 g" / "F 28 g"**.
   - Section head **"3 items"**.
   - Unresolved item card, 1.5 px `--cc-error` border: **"Dressing (unsure)"** + mini **"Low"**
     badge; explainer **"We couldn't tell if this is oil-based. Oil is the most common miss in
     photo estimates."**; two 44 pt secondary answers **"Oil vinaigrette"**, **"Yogurt dressing"**;
     ghost destructive **"Remove item"** (`--cc-error-ink`).
   - Collapsed items: **"Mixed greens"** 22 kcal / **"90 g"**; **"Feta"** 158 kcal / **"60 g"**.
   - Dock: meal segment; **disabled** primary whose label states the blocker: **"Resolve 1 item to
     save"**.
3. **Implemented today by:** `apps/mobile/src/features/scan/ReviewSheetView.tsx` +
   `apps/mobile/src/features/scan/CorrectionCaptureView.tsx` (the unresolved item gates Save today;
   resolution goes through the correction sheet).
4. **Identifiers that must survive:** as Review (light), plus RN `scan.correction.sheet`,
   `scan.correction.close`, `scan.correction.note`, `scan.correction.save`,
   `scan.correction.kind.<option>`; Swift `scan.correction.close`, `scan.correction.note`,
   `scan.correction.save`, `scan.correction.kind.<candidate.rawValue>`.
5. **Differences from today's screen:** the unresolved card shows the explainer plus **one-tap
   answers** instead of only the "Fix Issue" escape; Save's disabled label states the count
   ("Resolve 1 item to save") instead of the plain disabled state; the medium badge moves to
   caution yellow (token change; the tier thresholds 0.85/0.70 are unchanged).
6. **Behavior the frame needs:** the blocking rule exists ("Save is disabled while an item is
   unresolved"); the one-tap answers are **client** (U-72 — the model already records a resolution
   per item). No endpoint, no new dependency.
7. **Parity rows:** SC-04, SC-06, SC-01.

### Review (ED-Safe)

1. **Frame:** "Review (ED-Safe)" — `05-scan-review-ed-safe.png`, anchor `#scan`, light with ED-Safe mode on.
2. **Shows**, top to bottom:
   - Nav bar; header **"Chicken rice bowl"** with **"High confidence"** badge (both stay).
   - Where the total card was: a neutral note card (`--cc-grouped`, no border, 40 pt `--cc-accent-tint`
     icon tile with `#i-leaf` in `--cc-accent-ink`): **"A balanced plate: protein, carbs and veg."**
     and **"Numbers are hidden in ED-Safe mode."** (`--cc-text-2`).
   - Section head **"3 items"**; grouped cells: **"Jasmine rice"** / **"180 g"**, **"Roast chicken
     thigh"** / **"140 g"**, **"Cucumber"** / **"60 g"** — grams pills stay, no kcal anywhere, no
     macro split.
   - Dock: meal segment + **"Save to Lunch"**.
3. **Implemented today by:** `apps/mobile/src/features/scan/ReviewSheetView.tsx` with the policy in
   the design system (`EdSafeCollapse`, `useEdSafeHidden` in components; the feature holds no
   branch — invariant I7).
4. **Identifiers that must survive:** exactly the Review (light) set — the badge, the grams
   wrappers and `scan.save` all stay visible and addressable in ED-Safe.
5. **Differences from today's screen:** today's ED-Safe review collapses every kcal figure and
   leaves the space empty; the frame replaces the collapsed total with the leaf note card. Grams,
   badge, meal segment and Save are already kept.
6. **Behavior the frame needs:** the note card is **client** (U-72) — a component-level ED-Safe
   branch, no endpoint.
7. **Parity rows:** SC-04, PL-08.

### Saved

1. **Frame:** "Saved" — `06-scan-saved.png`, anchor `#scan`, light.
2. **Shows**, top to bottom:
   - 96 pt `--cc-accent` circle with a black check (`stroke-width 3`) and a 12 px `--cc-accent-tint`
     halo.
   - **"Saved to Lunch"** (700 28 px); **"Chicken rice bowl · 624 kcal"** (400 15 px
     `--cc-text-2`).
   - Ember card: row **"Today so far"** / **"1,284 / 2,100 kcal"** (Rounded, `--cc-ember-text-2`);
     10 pt bar at 61% `#FF6A00` on `--cc-ember-track`; **"12-day logging streak"** (600 15 px,
     `#i-flame` in `--cc-ember-accent`).
   - Undo card: `#i-undo` in `--cc-text-2`; **"Logged by mistake?"** + **"Undo stays here until you
     leave"** (400 13 px `--cc-text-2`); `--cc-accent-tint` chip **"Undo"** (44 pt).
   - Dock: primary **"Scan another"**, ghost **"View diary"**.
3. **Implemented today by:** `apps/mobile/src/features/scan/ScanSavedView.tsx` (Toast + today peek
   + streak card; undo tombstones through the repository).
4. **Identifiers that must survive:** RN `scan.savedToast`, `scan.todaySoFar`, `scan.todayKcal`,
   `scan.streakCard`, `scan.addMore`, `scan.viewDiary`, DS `toast`, `toast:undo`; Swift the same six
   `scan.*` strings.
5. **Differences from today's screen:** today the saved state is a toast that auto-dismisses after
   4 s over a peek; the frame is a full screen whose Undo stays until the user leaves (the toast's
   kcal line still drops under ED-Safe, as the component already does). "Today so far" moves onto
   the ember card (hidden under ED-Safe). The streak line uses the SVG flame, not an emoji.
6. **Behavior the frame needs:** persistent Undo is **client** (U-72) — the tombstone flow exists;
   only the dismissal timing changes. No endpoint.
7. **Parity rows:** SC-07, SC-01.

---

## 2 · Today, Diary, Progress, Coach (`#core`)

The tab bar in every frame of this band is the standard floating glass with four tabs — **Today**
(`#i-sun`), **Progress** (`#i-chart`), **Coach** (`#i-spark`, was bell), **Profile** (`#i-user`, was
gear) — and a trailing Scan FAB (`#i-camera`, `aria-label "Scan food"`); no custom background
(iOS 26 glass, iOS 18 material fallback, D14).

### Today (light)

1. **Frame:** "Today (light)" — `07-core-today-light.png`, anchor `#core`, light, Today tab.
2. **Shows**, top to bottom:
   - Header: **"Tuesday, 24 Nov"** (subtitle), **"Today"** (large title), calendar glass button
     (`aria-label "Open diary"`, `#i-cal`).
   - Week strip: seven 44×56 cells, radius 14, day initial + number (17 px Rounded); the selected
     day ("S 24") is `--cc-accent-tint` with `--cc-accent-ink`.
   - Ember card (`data-id today.ring`): 150 pt ring (`--ring`), 16 pt stroke, track `#3A342F`, arc
     `#FF6A00` (6.51:1 on ember); centre **"816"** (700 36 px Rounded, `#F7F5F2`) + **"kcal left"**
     (500 13 px `#ABA6A0`); right column **"Eaten 1,284"**, **"Goal 2,100"** (values 700 20 px
     Rounded `#F7F5F2`) and **"Burned +180"** (value `--cc-ember-accent`).
   - Macro card, 2×2 grid (labels and values never wrap): **"Protein 82 / 130 g"** (63%,
     `--cc-protein`), **"Carbs 140 / 210 g"** (67%, `--cc-carbs`), **"Fat 38 / 70 g"** (54%,
     `--cc-fat`), **"Fiber 14 / 30 g"** (47%, `--cc-fiber`).
   - Water card: 40 pt `--cc-info-tint` tile with `#i-drop` in `--cc-info-ink`; **"Water"** (600
     16 px) + **"1.25 of 2 L"** (13 px `--cc-text-2`); chip **"+ 250 ml"** (44 pt).
   - Section head **"Meals"** with a **"Diary"** link; meal row: thumb, **"Chicken rice bowl"**,
     **"Lunch · 12:40"** + mini **"High"** badge, kcal **"624"**.
3. **Implemented today by:** `apps/mobile/src/features/ember/EmberView.tsx` through the route
   `apps/mobile/src/app/(tabs)/index.tsx` (the spike screen the restyle builds on), water card
   `apps/mobile/src/features/diary/screens/WaterCard.tsx`.
4. **Identifiers that must survive:** RN `ember:scroll`, `ember:date`, `ember:ring`,
   `ember:kcal-left`, `ember:eaten`, `ember:goal`, `ember:burned`, `ember:macro:<key>`,
   `ember:meal:<id>`, `ember:meal-kcal:<id>`, `ember:week:<key>`, `ember:streak`,
   `ember:glass-header-button`, `ember:glass-week`, `ember:empty`, `today.waterCard`,
   `water-droplet-ring` *(RN-only test helper)*; Swift `today.ring`, `today.weekStrip`,
   `today.dayCell`, `today.dateSelector`, `today.foodRow`, `today.recentMeals`, `today.emptyState`,
   `today.streakCard`, `today.waterCard`, `today.startSetup`, `offline.badge`. The RN `ember:*`
   names and the Swift `today.*` names are the same elements with different strings — the restyle
   unit keeps today's RN strings (the evidence harness addresses them) and records the mapping.
5. **Differences from today's screen:** the ring moves onto the ember card (lime ring 1.35:1 →
   orange 6.51:1); the macros join a 2×2 grid **and fiber joins the grid** (today's spike renders
   three macros); the week-strip cells grow to 44 pt; the Health Score placeholder is removed until
   a score engine exists (#18); water shows litres ("1.25 of 2 L") instead of glasses in normal
   mode; the calendar entry point is a header button.
6. **Behavior the frame needs:** the burned figure needs Apple Health steps — steps read, the
   burned write and background delivery are not ported (PL-13): **native follow-up** (U-42's
   remaining scope). Everything else is **client** (U-76): tokens, grid, strip, water format.
7. **Parity rows:** TD-01, PL-01 (shell).

### Today (dark, offline)

1. **Frame:** "Today (dark, offline)" — `08-core-today-dark-offline.png`, anchor `#core`, dark (`--cc-bg #000`, warm cards `--cc-card
   #1C1A18`), Today tab.
2. **Shows**, top to bottom:
   - Header: date + "Today"; instead of the calendar button, a caution chip **"Offline · syncs
     later"** (`--cc-caution-tint` background, `--cc-caution-ink` text, 32 pt).
   - Ember card as in Today (light).
   - Macro grid as in Today (light).
   - Streak card: `--cc-accent-tint` tile with `#i-flame`; **"12-day streak"** (600 16 px) +
     **"1 freeze available"** (13 px `--cc-text-2`).
   - Meals: **"Overnight oats"** — "Breakfast · 8:05" + mini **"Medium"** badge — 410;
     **"Chicken rice bowl"** — "Lunch · 12:40 · **syncs later**" (`#ABA6A0`, 7.18:1) — 624.
3. **Implemented today by:** `EmberView.tsx` (offline chip `ember:offline`) + DS `OfflineBadge`
   (label "Offline — syncs later"); meal rows are the DS `FoodRow` (which has a `syncPending` flag).
4. **Identifiers that must survive:** as Today (light) plus RN `ember:offline`, DS `offline-badge`;
   Swift `offline.badge`.
5. **Differences from today's screen:** the offline state becomes a caution-tint chip in the header
   (today's badge sits on the card); the pending meal row carries the "syncs later" suffix in
   `--cc-text-2`/`#ABA6A0`; true-black background with warm `#1C1A18` cards (token swap).
6. **Behavior the frame needs:** nothing new — offline detection and the pending flag exist;
   **client** restyle only (U-76).
7. **Parity rows:** TD-01.

### Today (ED-Safe)

1. **Frame:** "Today (ED-Safe)" — `09-core-today-ed-safe.png`, anchor `#core`, light with ED-Safe on, Today tab.
2. **Shows**, top to bottom:
   - Header as usual (no offline chip).
   - Ember card: ring centre **"On track"** (700 22 px `#F7F5F2`) + **"2 of 3 meals"** (500 13 px
     `#ABA6A0`); right text **"Steady meals keep energy even. Dinner is next."** (400 15 px
     `#ABA6A0`, the second sentence `#F7F5F2`) — no number, no goal.
   - Macro grid **stays** (grams are visible, as the toggle copy promises).
   - Water card: **"5 of 8 glasses"** + chip **"+ 1 glass"**.
   - Meals **without kcal figures**: "Overnight oats" (mini "Medium" badge), "Chicken rice bowl"
     (mini "High" badge) — badges stay.
   - No red "over" state anywhere.
3. **Implemented today by:** `EmberView.tsx` + the DS components that own the policy
   (`FoodRow` hides kcal, `CalorieRing` shows "On track" framing; `EdSafeCollapse` for whole
   blocks).
4. **Identifiers that must survive:** as Today (light); the hidden kcal elements keep their
   identifiers on the collapsed wrappers so the evidence harness still addresses the screen.
5. **Differences from today's screen:** the ember card's ED-Safe content (status phrase + meal
   count + guidance sentence) replaces the ring numbers; water stays in glasses under ED-Safe; the
   meal rows drop the kcal value (already true through `FoodRow`).
6. **Behavior the frame needs:** the "On track · N of M meals" summary and the guidance sentence
   are **client** (U-76) — derived from data the model already has. No endpoint, no dependency.
7. **Parity rows:** TD-01, PL-08.

### Diary day (sheet, large detent)

1. **Frame:** "Diary day (sheet, large detent)" — `10-core-diary-day-sheet-large-detent.png`, anchor `#core`, dimmed backdrop (`#2b2724`), sheet
   on `--cc-grouped` with a 38 pt top radius.
2. **Shows**, top to bottom:
   - Grabber 36×5 in `--cc-grabber` — visible in light mode (it was invisible).
   - Nav bar: back glass button (`aria-label "Previous day"`), **"Tue, 24 Nov"**, close glass
     button (`aria-label "Close"`).
   - Summary card: **"Eaten 1,284"**, **"Goal 2,100"**, **"Left 816"** (700 20 px Rounded; "Left"
     in `--cc-accent-ink`).
   - Breakfast section (`#i-sunrise` icon + **"Breakfast"**, kcal **"410 kcal"** right-aligned):
     row "Overnight oats" — **"260 g"** + mini "Medium" badge — **410**.
   - Lunch section (`#i-sun`): "Chicken rice bowl" — **"380 g"** + mini "High" — **624**;
     "Avocado toast" — **"1 slice · from search"** — **250**.
   - Dinner section (`#i-moon`): dashed add button **"Add dinner"** (48 pt, 1.5 px dashed
     `--cc-separator`, `--cc-accent-ink`).
   - Exercise section (`#i-run`, **"−180 kcal"**): row **"Brisk walk · 40 min"** — **180** in
     `--cc-text-2`.
   - Detents: medium + large with a visible drag indicator.
3. **Implemented today by:** `apps/mobile/src/features/diary/screens/DiaryDayView.tsx` (route
   `apps/mobile/src/app/diary.tsx`; model `diaryDayModel.ts`, snapshot `diarySnapshot.ts`).
4. **Identifiers that must survive:** RN `diary.addFood.<slot>`, `diary.foodRow`,
   `diary.exerciseRow`, `diary.addExercise`, `diary.toast`, DS `food-row:<title>`,
   `food-row-kcal:<title>`; Swift the same five `diary.*` strings plus `diary.previousDay` /
   `diary.nextDay` on the pager buttons.
5. **Differences from today's screen:** section headers use SVG meal icons (sunrise / sun / moon /
   carrot) instead of emoji; every food row carries its grams and its confidence or source
   ("from search") beside the kcal; the grabber is visible; one dashed style for every add button;
   the sheet states its detents (medium, large).
6. **Behavior the frame needs:** none new — day sections, tombstoning, deep link, ED-Safe summary
   collapse all exist. Grams on the row come from the detail payload (exists); the "from search"
   source string rides on the detail items (exists for scan and search entries): **client** restyle
   (U-74) with no endpoint.
7. **Parity rows:** DY-01.

### Progress

1. **Frame:** "Progress" — `11-core-progress.png`, anchor `#core`, light, Progress tab.
2. **Shows**, top to bottom:
   - Large title **"Progress"**; range segment **"Week / Month (selected) / 3M / Year"**.
   - Weight trend card: label **"Weight trend"**; **"80.6"** (700 28 px Rounded) + "kg";
     **"−1.8 kg in 30 days"** (600 13 px `--cc-success-ink`); tint chip **"Log weight"** (44 pt);
     area chart 326×150 — `--cc-accent` fill at 10% under an `--cc-accent-strong` 3 px line with an
     end dot, gridlines at 83/82/81 (the y-axis fits the data), x labels "27 Oct" → "24 Nov",
     `aria-label "Weight trend from 82.4 to 80.6 kilograms over 30 days"`.
   - Weekly energy card: **"Weekly energy"**, **"avg 1,980 kcal"**; seven bars in
     `--cc-accent-strong`; today's bar is `--cc-fill` with a dashed border and the "S" label in
     `--cc-accent-ink`; a dashed average line crosses the bars.
   - Badges: section head **"Badges"** + **"All"**; 3-column grid — **"First scan"** (`#i-camera`,
     `--cc-accent-ink`), **"7-day streak"** (`#i-flame`), **"30 days"** locked (`#i-lock`,
     `--cc-text-2`).
3. **Implemented today by:** `apps/mobile/src/features/progress/screens/ProgressView.tsx`,
   `WeightTrendView.tsx`, `WeeklyEnergyView.tsx`, `AchievementsView.tsx`, `WeightLogSheet.tsx`
   (route `apps/mobile/src/app/(tabs)/progress.tsx`; chart descriptor
   `weightChartDescriptor.ts`).
4. **Identifiers that must survive:** RN `progress.logWeight`, `progress.saveWeight`,
   `progress.closeWeightSheet`, DS `chart-card`, `streak-card`, `badge-tile:<name>`; Swift
   `progress.logWeight`, `progress.closeWeightSheet`, `progress.saveWeight` (the wheel, the weekly
   columns and the badge tiles carry a11y labels, not identifiers).
5. **Differences from today's screen:** the range segment (Week/Month/3M/Year) is new — today's
   stack has no range switch; the weight chart gains the area fill and a y-axis that fits the data;
   today's partial bar becomes dashed; all chart strokes move to `--cc-accent-strong` (one hue,
   3.67:1); badge tiles use the SVG icon set instead of emoji.
6. **Behavior the frame needs:** the range segment queries the existing series over a window —
   **client** (U-75); the VoiceOver audio-graph descriptor extends today's text descriptor —
   **client** enhancement. No endpoint, no dependency.
7. **Parity rows:** PG-01, PG-02, PG-03, PG-04.

### Coach

1. **Frame:** "Coach" — `12-core-coach.png`, anchor `#core`, light, Coach tab (icon `#i-spark`).
2. **Shows**, top to bottom:
   - **"Good afternoon"** (subtitle, no emoji) + large title **"Coach"**.
   - Ember card: eyebrow **"THIS WEEK"** (600 13 px `--cc-ember-accent`, letter-spacing .02em);
     **"Protein hit target on 5 of 7 days. Your best week yet."** (700 22 px `#F7F5F2`); three
     stat tiles on `#2A2724`, radius 14: **"19 meals logged"**, **"5/7 protein days"**, **"12 day
     streak"** (values 700 22 px Rounded, labels 12 px `#ABA6A0`).
   - Section head **"Insights"**.
   - Insight card 1 (4 px `--cc-accent` left edge, `--cc-accent-tint` tile, `#i-sunrise`):
     **"Breakfast is your lightest meal"** + **"On days with a 400+ kcal breakfast you snacked less
     after 9 pm."** + action **"See the days"** (600 15 px `--cc-accent-ink`, 44 pt min-height,
     `#i-chev`).
   - Insight card 2 (`--cc-info-tint` tile, `#i-drop`): **"Water dips on weekends"** + **"Saturday
     and Sunday average 0.9 L."** + action **"Set a reminder"**.
   - Footnote: **"Insights come from your own logs. They are not medical advice."** (12 px
     `--cc-text-2`).
3. **Implemented today by:** `apps/mobile/src/features/coach/screens/CoachView.tsx` and
   `WeeklyReviewCard.tsx` (DS `InsightCard`, `WeeklyReviewStats`; route
   `apps/mobile/src/app/(tabs)/coach.tsx`).
4. **Identifiers that must survive:** RN `weekly-review-stats`, `weekly-stat:<id>`,
   `insight-card:<variant>`, `streak-card`; Swift declares none on this flow (its three
   identifiers are Progress's).
5. **Differences from today's screen:** the weekly review becomes the ember hero card with three
   stat tiles; the greeting drops the emoji; each insight card gains exactly one action row (the
   tab had no controls before); the trust copy stays.
6. **Behavior the frame needs:** "See the days" opens a day list for the insight — **client**
   (U-75) when it stays local (the plan: actions that need no endpoint are U-75, the rest go to the
   backend follow-up list). "Set a reminder" schedules a meal reminder through local notifications
   — the scheduling rules are ported (PL-10); the wiring is the remaining U-42 scope: **client +
   native wiring**, no new endpoint. The weekly sentence derives from `coachSnapshot` data that
   exists: **client**.
7. **Parity rows:** CH-01.

---

## 3 · Profile, Settings, food search, manual log (`#profile`)

### Profile

1. **Frame:** "Profile" — `13-profile-profile.png`, anchor `#profile`, light, Profile tab (icon `#i-user`).
2. **Shows**, top to bottom:
   - Large title **"Profile"**.
   - User card (`data-id profile.userCard`): 56 pt `--cc-accent` avatar with a black **"M"**;
     **"Minh"** (600 17 px) + **"CoachCal Plus · renews 12 Dec"** (13 px `--cc-text-2`); chevron.
   - Three stat cards: **"2,100 kcal / day"**, **"80.6 kg now"**, **"76 kg goal"** (values 700 20 px
     Rounded, captions 12 px `--cc-text-2`).
   - Section head **"Plan"**; group: **"Daily target"** — **"2,100 kcal"** (orange `#i-target`
     tile, black glyph); **"Macro split"** — **"30/45/25"** (`--cc-fat` tile, `#i-chart`);
     **"Goal weight"** — **"76 kg"** (`--cc-fiber` tile, `#i-flag`); each row a chevron that opens
     a picker.
   - Section head **"App"**; group: **"Apple Health"** — value **"Connected"** in
     `--cc-success-ink` (`#E5243B` tile, `#i-heart`); **"Units"** with an inline kg/lb segment
     (140 pt wide, 30 pt rows); **"Settings"** row (`#i-help`).
3. **Implemented today by:** `apps/mobile/src/features/profile/ProfileView.tsx` (route
   `apps/mobile/src/app/(tabs)/profile.tsx`; model `profileModel.ts`).
4. **Identifiers that must survive:** RN `profile.userCard`, `profile.row.dailyTarget`,
   `profile.row.macroRatios`, `profile.row.goalWeight`, `profile.row.appleHealth`,
   `profile.healthNote`, `profile.row.settings`; Swift the same strings plus
   `profile.stat.dailyTarget`, `profile.stat.daysLogged`, `profile.stat.weight`.
5. **Differences from today's screen:** the name comes from the account instead of the hard-coded
   "Alex"; the user card's subtitle shows the plan line with a renewal date; the quick stats change
   to kcal/day · kg now · kg goal; Apple Health shows its real connection status as the row value
   (today: a footnote revealed on tap — `profile.healthNote` stays for the footnote path); a Units
   kg/lb segment appears (today the units row is inert text); rows without an action lose their
   chevron.
6. **Behavior the frame needs:** the plan line needs the entitlement state (free tier exists;
   "Plus · renews …" needs a subscription — **store follow-up**); the account display name has no
   backend field (sign-in is e-mail) — **client** (derive from the account, or a profile field is a
   backend follow-up); the kg/lb switch is real unit conversion across the app — **client**
   engineering, a new feature neither app has; the Health status value reads the existing health
   access state — **client**.
7. **Parity rows:** PR-01.

### Settings

1. **Frame:** "Settings" — `14-profile-settings.png`, anchor `#profile`, light, pushed from Profile.
2. **Shows**, top to bottom:
   - Nav bar: back glass button (`aria-label "Back to Profile"`), title **"Settings"**.
   - Section head **"Subscription"**; card: **"CoachCal Plus · Yearly"** (700 17 px) +
      **"Renews 12 Dec 2026 for {price}."** — the price is the canvas' dotted-underlined placeholder
      (D13: filled at run time from the store product, never a sample) — then
      **"Billed by Apple. No hidden fees."** (15 px
     `--cc-text-2`) + mini **"Active"** badge; 44 pt buttons **"Change plan"** (secondary) and
     **"Cancel subscription"** (`data-id settings.cancelSubscription`, destructive); ghost row
     **"Billing history · Restore purchases"**.
   - Section head **"Wellbeing"**; group: **"ED-Safe mode"** (`--cc-fat` tile, `#i-eyeoff`) with
     small copy **"Hides every calorie number in the app, widgets and Live Activities. You keep
     confidence, grams, water and streaks."** and the toggle (`data-id settings.edSafeToggle`);
     **"Add burned calories back"** (orange tile, `#i-run`) with small copy **"Exercise from Apple
     Health raises today's target."** and its toggle (on).
   - Section head **"Your data"**; group: **"Export diary as CSV"** (`#i-download`, chevron);
     **"Help and FAQ"** (`#i-help`); **"Contact us"** (`#i-mail`); **"Delete account"** destructive
     (`#i-trash`).
   - A failed export shows an inline error row under the export row (not drawn in the frame).
3. **Implemented today by:** `apps/mobile/src/features/profile/SettingsDetailView.tsx` (route
   `apps/mobile/src/app/settings.tsx`; model `settingsModel.ts`, copy `settingsCopy.ts`).
4. **Identifiers that must survive:** RN `settings.subscriptionCard`, `settings.planValue`,
   `settings.changePlan`, `settings.cancelSubscription`, `settings.billingNote`,
   `settings.edSafeToggle`, `settings.wellnessCard`, `settings.wellnessError`,
   `settings.burnAddBackToggle`, `settings.burnAddBackNote`, `settings.row.export`,
   `settings.row.help`, `settings.row.contact`, `settings.row.deleteAccount`,
   `settings.deleteConfirm`, `settings.cancelDelete` *(RN-added)*, `settings.version`; Swift the
   same strings except `settings.cancelDelete` (Swift's confirmation dialog has no cancel
   identifier) plus the DEBUG-only `debug.toggleOffline`.
5. **Differences from today's screen:** the subscription card is live — today it is display-only
   "Free" with inert `settings.changePlan` / `settings.cancelSubscription`; the frame wires Change
   plan and Cancel to the store, adds "Billing history · Restore purchases", and shows the renewal
   date and price together. The ED-Safe subtitle extends to widgets and Live Activities. The burn
   add-back small copy states its effect. Labels are sentence case. The delete flow, the export
   share and the version caption stay.
6. **Behavior the frame needs:** Change plan / Cancel / Restore / Billing history need
   StoreKit products, a StoreKit configuration and a purchase SDK (none exists; PL-16) —
   **store + native follow-up** (the plan's billing row); the manage-subscriptions sheet and
   `AppStore.sync()` need a native equivalent (D14 fallback to the App Store page if the SDK cannot
   express it). The burned add-back toggle persists today with **no consumer** — consuming it needs
   the HealthKit burned write (PL-13) and a targets integration: **native + client follow-up**.
   The ED-Safe copy change and the error row are **client**.
7. **Parity rows:** PR-02.

### Food search (ED-Safe)

1. **Frame:** "Food search (ED-Safe)" — `15-profile-food-search-ed-safe.png`, anchor `#profile`, light on `--cc-grouped`, sheet titled
   for the target meal.
2. **Shows**, top to bottom:
   - Nav bar: close glass button (`aria-label "Close"`), title **"Add to Dinner"**.
   - Search field: 44 pt, radius 12, `--cc-fill` background, `#i-search`; query **"salmon"**.
   - Segment **"Search (selected) / Saved / Recent"**.
   - Section head **"Results"**; rows (ED-Safe: serving size in the kcal slot): **"Salmon fillet,
     baked · Generic"** — **"100 g"** — orange-tint add button (`aria-label "Add Salmon fillet,
     baked"`); **"Smoked salmon · Generic"** — **"50 g"**; **"Salmon poke bowl · Restaurant"** —
     **"1 bowl"**; **"Salmon sushi roll · Generic"** — **"6 pcs"**.
   - Dashed card: **"Can't find it? Describe it or log manually"** (`#i-pencil` in
     `--cc-accent-ink`, chevron).
   - With ED-Safe off, the kcal figure returns in the same slot ("206 kcal").
3. **Implemented today by:** `apps/mobile/src/features/diary/screens/FoodSearchView.tsx` (model
   `foodSearchModel.ts`).
4. **Identifiers that must survive:** RN `search.field`, `search.back`, `search.emptyState`,
   `search.foodRow`, `search.createCustom`, DS `search-field`; Swift the same five `search.*`
   strings.
5. **Differences from today's screen:** the ED-Safe leak is closed — today's row footnote shows
   "kcal · protein g protein · basis" in every mode; the frame shows the serving size under
   ED-Safe and kcal in the same slot when off. The Search/Saved/Recent segment restructures
   today's recents-before-query into explicit tabs (Saved meals live in the add-food sheet today).
   The dashed "Can't find it?" row adds the describe escape beside manual logging. The add button
   per row is new (today the row itself is the tap target).
6. **Behavior the frame needs:** the leak fix, the segment and the escapes are **client** (U-74);
   the serving-size string needs serving data on seed rows (the catalog carries per-100g values
   and per-serving customs — seeds may need serving captions; a data note, not an endpoint).
   Search stays local per LOG-04; the frame's "Restaurant" rows are illustrative of the server
   cascade, not a new client behavior.
7. **Parity rows:** DY-03, PL-08.

### Manual log (ED-Safe)

1. **Frame:** "Manual log (ED-Safe)" — `16-profile-manual-log-ed-safe.png`, anchor `#profile`, light on `--cc-grouped`, sheet.
2. **Shows**, top to bottom:
   - Nav bar: back glass button, title **"Log manually"**.
   - Segment **"Food (selected) / Exercise / Custom food"**.
   - Section head **"Food"**; rows: **"Name"** — **"Grandma's pho"**; **"Amount"** — **"1 large
     bowl"**; **"Meal"** — **"Dinner"** in `--cc-accent-ink` with a chevron.
   - Note card on `--cc-accent-tint` (`#i-eyeoff` in `--cc-accent-ink`): **"No numbers needed."**
     + **"We'll estimate the energy from the name and amount and keep it hidden, so your plan
     stays accurate."**
   - Section head **"Same rule on the other tabs"**; rows: **"Exercise"** — small **"Activity and
     minutes only. Burned kcal is hidden."**; **"Custom food"** — small **"Name and serving only.
     Nutrition fields fold into "Advanced", collapsed and blurred."**
   - Dock: primary **"Add to Dinner"**.
3. **Implemented today by:** `apps/mobile/src/features/diary/screens/ManualLogSheet.tsx`
   (model `manualLogModel.ts`, math `diaryMath.ts`); the sibling tabs
   `ExerciseLogSheet.tsx` and `CustomFoodSheet.tsx`.
4. **Identifiers that must survive:** RN `manual.close`, `manual.stepper`, `manual.kcal`,
   `manual.save`, DS `ccstepper.decrement` / `ccstepper.increment`; Swift the same four `manual.*`
   strings. Siblings: RN `exercise.close`, `exercise.typeField`, `exercise.kcalField`,
   `exercise.save`; `custom.close`, `custom.save`, `custom.basis.<option>` plus the
   `custom.<field>Field` identifiers — all present in Swift with the same strings.
5. **Differences from today's screen:** today `manual.kcal` displays the derived kcal figure; under
   ED-Safe the figure is hidden and the "No numbers needed" note takes its place (grams and Save
   stay). The Exercise tab hides `exercise.kcalField` under ED-Safe (activity and minutes only).
   The Custom food tab folds the nutrition fields into a collapsed, blurred "Advanced" group under
   ED-Safe. The kcal field stays for the Exercise and Custom food tabs when the mode is off. The
   Food/Exercise/Custom-food segment replaces today's separate sheet entries.
6. **Behavior the frame needs:** all four leak closures are **client** (U-74) — the kcal is already
   derived, never typed, and the estimate needs no server call; hiding is a component-level policy
   branch (I7). No endpoint, no dependency.
7. **Parity rows:** DY-05, PL-08 (the leak list also covers the Exercise and Custom food tabs of
   DY-06/DY-04).

---

## 4 · Quota, Plans, Cancel (`#billing`)

All prices in this band are placeholders; D13 decides the paywall reads prices from the store at
run time and shows none until products exist.

### Quota reached (sheet)

1. **Frame:** "Quota reached (sheet)" — `17-billing-quota-reached-sheet.png`, anchor `#billing`, sheet (520 pt) over a dimmed backdrop.
2. **Shows**, top to bottom:
   - Grabber (`--cc-grabber`) and a close glass button at the top right (`aria-label "Close"`,
     `#i-x`) — the sheet can also be swiped down.
   - 64 pt `--cc-accent-tint` tile with `#i-scan` in `--cc-accent-ink`.
   - Title (`data-id scan.quotaTitle`): **"You've used this week's 3 free scans"** (700 26 px).
   - Body: **"Scans reset Monday. You can still log anything by search, barcode or description,
     for free."** (400 17 px `--cc-text-2`).
   - Dock: primary **"See plans"**; secondary **"Log manually, free"** — equal-weight free path.
3. **Implemented today by:** `apps/mobile/src/features/scan/QuotaReachedView.tsx` (state
   `quotaReached` in `scanModel.ts`, fed by the 402 envelope's entitlement).
4. **Identifiers that must survive:** RN `scan.quotaTitle`, `scan.quotaBody`, `scan.seePlans`,
   `scan.logManually`, `scan.plansSheet`, `scan.plansTitle`, `scan.plansLogManually`; Swift the
   same six `scan.*` strings (the minimal plans sheet of today shares these).
5. **Differences from today's screen:** the frame adds a close button (today's sheet offers no
   explicit close) and the body names the free paths in one line; the limit and the reset day are
   read from the server's entitlement instead of any hard-coded copy; "See plans" opens the full
   paywall frame below.
6. **Behavior the frame needs:** the 402 envelope already carries `{tier, scansUsed, scanLimit,
   windowResetAt}` (BE-08 done) — the sheet's numbers are **client** (U-77) formatting of that
   state. No new endpoint.
7. **Parity rows:** PR-02, SC-01.

### Plans / paywall

1. **Frame:** "Plans / paywall" — `18-billing-plans-paywall.png`, anchor `#billing`, light, full screen with dock.
2. **Shows**, top to bottom:
   - Nav bar: ghost **"Restore"** at the left, close glass button at the right — both always
     visible.
   - Ember hero: **"COACHCAL PLUS"** (600 13 px `--cc-ember-accent`, letter-spacing .04em);
     **"Unlimited scans and a coach who shows the maths."** (700 26 px `#F7F5F2`).
   - Four feature rows: **"Unlimited photo, barcode and label scans"**, **"Weekly coach review and
     insights"**, **"CSV export and Apple Health sync"** (each with an `--cc-accent-ink` check) and
     the info row **"Manual logging is free on every plan"** (`--cc-text-2`).
   - Yearly option (selected): 2 px `--cc-accent` border, `--cc-accent-tint` background, orange
     radio with a black check; **"Yearly"** + **"{trial} free, then {yearly} / year"** on the same
     line (all three are the canvas' dotted-underlined placeholders, filled at run time from the
     store product — D13); right side **"{perMonth}"** (700 17 px Rounded) + **"per month"**.
   - Monthly option: 1.5 px `--cc-separator` border; **"Monthly"** + **"{monthly} / month, no trial"**;
     right side **"{monthly}"**.
   - Dock: primary **"Start {trial} free trial"**; note **"Free for {trial}, then {yearly}/year. We'll
     remind you 2 days before you're charged. Cancel any time in Settings."** with **"Terms"** and
     **"Privacy"** links.
3. **Implemented today by:** no screen yet — today's only billing surface is the minimal plans
   sheet reachable from quota (`scan.plansSheet`, `scan.plansTitle`, `scan.plansLogManually`).
4. **Identifiers that must survive:** none from Swift (the old app has no IAP code; PL-16) and
   none in RN beyond the minimal sheet's three strings above, which stay on whatever replaces
   them; the unit that builds this frame names the new identifiers and records them.
5. **Differences from today's screen:** the frame is the real paywall — plan options with price and
   trial terms on the same line (App Review 3.1.2(c)), the terms repeated under the button,
   Restore and Close always visible, nothing pre-ticked except the plan choice, no guilt-trip
   patterns (5.6). Per D13 the canvas prices are placeholders: the built screen reads
   `Product.displayPrice` and shows no sample price until products exist.
6. **Behavior the frame needs:** StoreKit products, a StoreKit configuration and a purchase SDK —
   **store + native follow-up** (the plan's billing row; confirmed). The screen shell, the option
   cards and the honest-copy layout are **client** (U-77) and render store-sourced (empty) prices.
7. **Parity rows:** PR-02.

### Cancel flow

1. **Frame:** "Cancel flow" — `19-billing-cancel-flow.png`, anchor `#billing`, light, pushed screen.
2. **Shows**, top to bottom:
   - Nav bar: back glass button, title **"Cancel subscription"**.
   - Title **"Here's what happens if you cancel"** (700 26 px).
   - Three check rows (`--cc-success-ink` checks, 16 px): **"Plus stays on until 12 Dec 2026. You
     won't be charged again."**; **"Your diary, weight and streaks are kept."**; **"Manual logging
     stays free. Photo scans drop to 3 a week."**
   - Note (13 px `--cc-text-2`): **"Apple handles the cancellation. The next step opens Apple's
     subscription sheet inside CoachCal."**
   - Dock: destructive **"Cancel subscription"** and secondary **"Keep Plus"** — equal visual
     weight, no survey wall, no "are you sure?" loop.
3. **Implemented today by:** no screen yet.
4. **Identifiers that must survive:** none from Swift or RN (the inert settings buttons are the
   only cancel-related identifiers and they stay in Settings); new identifiers are the unit's to
   name.
5. **Differences from today's screen:** the frame is the missing informational step between the
   Settings button and Apple's sheet.
6. **Behavior the frame needs:** a subscription to cancel and the in-app manage-subscriptions
   presentation (`manageSubscriptionsSheet` in the handoff) — **store + native follow-up**; the
   informational screen itself is **client** (U-77).
7. **Parity rows:** PR-02.

---

## 5 · Onboarding (`#onboarding`, 9 steps)

Shared scaffold for steps 2–9: a 9-segment progress rail (4 pt, filled `--cc-accent-strong` up to
the current step, `--cc-fill` after), a nav row with back glass button (from step 2), the caption
**"Step N of 9"** (600 13 px `--cc-text-2`) and a ghost **"Skip"** (before step 7), the step title
(700 28 px) and subhead (400 17 px `--cc-text-2`), and a pinned primary **"Continue"**. Steps share
one behavior contract: locked copy, engine-clamped numbers, `onboarding.continue` on the CTA and
`onboarding.title.<title>` on every scaffold title.

### 1 · Welcome

1. **Frame:** "1 · Welcome" — `20-onboarding-1-welcome.png`, anchor `#onboarding`, dark over a real plate photo.
2. **Shows:** plate photo with `#FF6A00` corner brackets (stroke 6); **"High confidence · 624
   kcal"** badge on `#12301E`/`#4ADE80`; eyebrow **"COACHCAL"** (600 13 px `--cc-ember-accent`);
   **"Snap your plate. See the estimate and how sure we are."** (700 34 px `#F7F5F2`); dock:
   primary **"Get started"** and ghost **"I already have an account"** (`#F7F5F2`).
3. **Implemented today by:** `apps/mobile/src/features/onboarding/ValueHeroScreen.tsx` (route
   `apps/mobile/src/app/onboarding/index.tsx`, flow `OnboardingFlowView.tsx`).
4. **Identifiers that must survive:** RN `onboarding.getStarted` (+ the scaffold's
   `onboarding.title.<title>` where present); Swift `onboarding.getStarted`.
5. **Differences from today's screen:** the value is shown, not described — a real plate, the
   brackets and the confidence badge instead of today's text hero; no e-mail gate before the value.
   The frame's hero sentence differs from the locked Swift copy: OB-01 locks the copy and the tests
   assert it, so the restyle keeps the locked strings and restyles the stage (photo, brackets,
   badge) around them — any copy change is an owner decision, not a restyle side-effect.
6. **Behavior the frame needs:** none new — the flow, the sign-in entry and the skip-free start
   exist: **client** restyle (U-73).
7. **Parity rows:** OB-01, OB-02.

### 2 · Goal

1. **Frame:** "2 · Goal" — `21-onboarding-2-goal.png`, anchor `#onboarding`, light.
2. **Shows:** title **"What brings you here?"** + **"This sets your starting plan. You can change
   it any time."**; four option cards (icon tile + title + sub + orange check when selected):
   **"Lose weight · A gentle, steady deficit"** (selected), **"Maintain · Keep things steady"**,
   **"Gain muscle · A small surplus with more protein"**, **"Just eat better · No calorie target.
   Focus on balance"**.
3. **Implemented today by:** `apps/mobile/src/features/onboarding/GoalPickerScreen.tsx`.
4. **Identifiers that must survive:** RN `onboarding.goalCard.<lose|maintain|gain|habit>`, DS
   `option-card:<title>`; Swift `onboarding.goalCard.<goal.rawValue>`.
5. **Differences from today's screen:** the option cards gain icon tiles and the selected check;
   the subhead lines are shortened. Copy stays locked.
6. **Behavior the frame needs:** none new — the four goals (including the no-target "habit" goal
   that suits ED-Safe from day one) exist: **client**.
7. **Parity rows:** OB-01, OB-04.

### 3 · About you

1. **Frame:** "3 · About you" — `22-onboarding-3-about-you.png`, anchor `#onboarding`, light.
2. **Shows:** title **"A few basics"** + **"Used only to estimate your energy needs."**; label
   **"Sex used for the formula"** with segment **"Female (selected) / Male / Prefer not to say"**;
   two-column fields **"Age 29 years"** and **"Height 172 cm"** (56 pt fill fields, 700 22 px
   Rounded values); field **"Current weight 80.6 kg"**; unit segment **"Metric (selected) /
   Imperial"** (160 pt).
3. **Implemented today by:** `apps/mobile/src/features/onboarding/BodyMetricsScreen.tsx`.
4. **Identifiers that must survive:** RN `onboarding.sexFemale`, `onboarding.sexMale`,
   `onboarding.heightField`, `onboarding.weightField`, `onboarding.dobField`, `onboarding.dobGate`,
   DS `wheel-field:<label>`, `wheel-value:<label>`, `wheel-scroll:<label>`; Swift the same six
   `onboarding.*` strings.
5. **Differences from today's screen:** the sex segment gains **"Prefer not to say"**; the fields
   become typed 56 pt fields instead of wheels; the frame omits the DOB wheel — the under-18 gate
   (`onboarding.dobField`, `onboarding.dobGate`, its verbatim footnote and the blocked-continue
   test) is behavior and identifier that must survive, so the unit keeps it and records the
   deviation; the Metric/Imperial segment is new (today units are metric-only, as in Swift).
6. **Behavior the frame needs:** "Prefer not to say" means averaging both Mifflin formulas — a new
   path through `TargetsEngine`, whose behavior tests are locked: **client code but an owner
   decision** (engine change), flagged for the owner. The imperial switch is full unit conversion
   — **client engineering**, a new feature. The typed fields are **client**.
7. **Parity rows:** OB-01, OB-06.

### 4 · Goal weight and pace

1. **Frame:** "4 · Goal weight and pace" — `23-onboarding-4-goal-weight-and-pace.png`, anchor `#onboarding`, light.
2. **Shows:** title **"Where would you like to be?"**; field **"Goal weight 76 kg"**; label
   **"Pace"** with segment **"Relaxed / Steady (selected) / Faster"**; card on `--cc-grouped`:
   **"About 0.4 kg a week. Most people can keep this pace without feeling hungry all the time."**;
   caution card on `--cc-caution-tint` (`--cc-caution-ink`, `#i-info`): **"We never suggest going
   below 1,200 kcal (women) or 1,500 kcal (men) without a clinician."**
3. **Implemented today by:** `apps/mobile/src/features/onboarding/GoalWeightPaceScreen.tsx` +
   `PaceSlider.tsx`.
4. **Identifiers that must survive:** RN `onboarding.goalWeightField`, `onboarding.goalWeightHero`,
   `onboarding.paceSlider`, `onboarding.paceValue`, `onboarding.safetyFloor`; Swift the same five.
5. **Differences from today's screen:** the pace slider becomes a three-option segment with the
   plain-words card; the safety floor banner moves to caution yellow (it was not orange-branded
   before either, but the token is now explicitly `--cc-caution-*`); copy stays locked where tests
   assert it (the floor sentence).
6. **Behavior the frame needs:** none new — pace options are already `TargetsEngine`-clamped and
   the floor banner text is locked: **client** restyle.
7. **Parity rows:** OB-01, OB-07.

### 5 · Activity and diet

1. **Frame:** "5 · Activity and diet" — `24-onboarding-5-activity-and-diet.png`, anchor `#onboarding`, light.
2. **Shows:** title **"How active are you?"**; three option cards: **"Mostly sitting · Desk job,
   little exercise"**, **"Lightly active · Walks, 1–2 workouts a week"** (selected), **"Active ·
   3–5 workouts a week"**; heading **"Any diet we should know about?"**; chips **"None"**,
   **"Vegetarian"** (selected), **"Vegan"**, **"Halal"**, **"Low carb"**, **"Gluten free"** — 44 pt
   tall.
3. **Implemented today by:** `apps/mobile/src/features/onboarding/ActivityDietScreen.tsx`.
4. **Identifiers that must survive:** RN `onboarding.activityHeader`, `onboarding.dietHeader`,
   `onboarding.activityCard.<sedentary|light|moderate|active|athlete>`,
   `onboarding.dietChip.<lowercased style>`, DS `option-card:<title>`, `chip-option:<title>`;
   Swift `onboarding.activityCard.<level.rawValue>` and the headers.
5. **Differences from today's screen:** the frame collapses five activity levels to three cards
   and two screens into one; the diet chip set differs (today: standard, highprotein, vegetarian,
   vegan, keto). The activity/diet vocabulary is model state asserted by tests — mapping the
   frame's three cards onto the five stored levels (and any chip-set change) is a model-touching
   choice the unit records: **client**, with the vocabulary kept unless the owner decides
   otherwise.
6. **Behavior the frame needs:** none new — **client** restyle; chips at 44 pt.
7. **Parity rows:** OB-01, OB-05.

### 6 · Projection

1. **Frame:** "6 · Projection" — `25-onboarding-6-projection.png`, anchor `#onboarding`, light.
2. **Shows:** title **"Here's a realistic path"** + **"Based on a steady 0.4 kg a week."**; chart
   card (326×170, `aria-label "Projected weight from 80.6 to 76 kilograms by late March"`):
   `--cc-accent-strong` 3.5 px curve, a 35%-opacity confidence band around it, endpoint dots, grid
   lines at 81 / 78.5 / 76, x labels **"Today"** → **"Late Mar"**; caption **"Real weight goes up
   and down day to day. The shaded band shows the normal range."** (15 px `--cc-text-2`).
3. **Implemented today by:** `apps/mobile/src/features/onboarding/ProjectionScreen.tsx`.
4. **Identifiers that must survive:** RN `onboarding.projectionChart`, `onboarding.projectionStart`,
   `onboarding.projectionGoal`, `onboarding.projectionDisclaimer` (plus the stat cards'
   `onboarding.projectionKg` / `onboarding.projectionWeeks` a11y labels); Swift the same four
   `onboarding.projection*` strings.
5. **Differences from today's screen:** the curve gains the shaded normal-range band and the axis
   labels (today's chart draws line, band endpoints and gridlines but no axis value labels — a
   recorded gap); the kg-and-weeks-only rule (no calorie strings) is kept by today's test and
   holds here.
6. **Behavior the frame needs:** none new — **client** (draw the band labels).
7. **Parity rows:** OB-01, OB-10.

### 7 · Privacy, Health and ED-Safe

1. **Frame:** "7 · Privacy, Health and ED-Safe" — `26-onboarding-7-privacy-health-and-ed-safe.png`, anchor `#onboarding`, light.
2. **Shows:** title **"You choose what we see"**; three toggle rows: **"Connect Apple Health"** —
   small **"Read weight and workouts. Write meals. You'll see Apple's permission sheet next."**
   (toggle on, `#E5243B` tile, `#i-heart`); **"Meal reminders"** — small **"Up to 3 a day. Never
   about weight."** (toggle off, `--cc-info` tile, `#i-bell`); **"ED-Safe mode"** — small **"Hide
   calorie numbers everywhere, including your plan on the next screen."** (toggle off, `--cc-fat`
   tile, `#i-eyeoff`); shield note: **"Photos are used to estimate your meal and are not used to
   train models."** with a **"Privacy policy"** link.
3. **Implemented today by:** `apps/mobile/src/features/onboarding/PrivacyHealthScreen.tsx` (the
   connect button runs the injected HealthKit request; denial shows the footnote).
4. **Identifiers that must survive:** RN `onboarding.healthConnect`, `onboarding.healthConnectNote`,
   `onboarding.privacyPromise`; Swift the same three.
5. **Differences from today's screen:** one connect button becomes three toggles; ED-Safe can be
   chosen here — before any number appears, so the plan reveal respects it from its first frame;
   the meal-reminders toggle is new; the privacy promise stays.
6. **Behavior the frame needs:** the step-7 ED-Safe choice writes the same stored key
   (`edSafeMode`) the Settings toggle owns — **client** (U-73) with the design flag applied
   immediately. The reminders toggle needs the notifications wiring (the scheduling rules are
   ported; scheduling through expo-notifications is U-42's remaining scope): **client + native
   wiring**, no endpoint.
7. **Parity rows:** OB-01, OB-03.

### 8 · Building your plan

1. **Frame:** "8 · Building your plan" — `27-onboarding-8-building-your-plan.png`, anchor `#onboarding`, light, dock with a disabled button.
2. **Shows:** 140 pt ring (`--cc-fill` track, `--cc-accent-strong` arc at 69%) with `#i-spark` in
   the centre; **"Working out your numbers"** (700 26 px); formula card (15 px, rows justified
   space-between): **"Resting energy (Mifflin-St Jeor)"** — **"1,590"**; **"× Lightly active
   1.375"** — **"2,186"**; **"− Steady pace"** — **"−440"**; separator; **"Daily target"** —
   **"1,750 kcal"** in `--cc-accent-ink`; dock: disabled primary **"Almost there"**.
3. **Implemented today by:** `apps/mobile/src/features/onboarding/GeneratingPlanScreen.tsx`.
4. **Identifiers that must survive:** RN `onboarding.generating`, `onboarding.generatingPercent`,
   `onboarding.genStep.<0..3>`; Swift the same strings.
5. **Differences from today's screen:** today the step shows a ring, a percent readout and a
   4-step checklist ("Calculating TDEE / Setting macro ratios / Applying safety floor / Generating
   weekly plan") within a 2 s window; the frame shows the real formula line by line as it
   completes, with no fake loading bar, and under ED-Safe shows only **"Balancing your meals"**.
   The percent readout's identifier must survive on whatever readout remains (or its removal is
   recorded); the checklist steps are the real computation stages on both sides.
6. **Behavior the frame needs:** the formula lines come from `TargetsEngine` outputs the model
   already computes — **client** (U-73). The ED-Safe variant copy is **client**. No endpoint.
7. **Parity rows:** OB-01, OB-08.

### 9 · Your plan

1. **Frame:** "9 · Your plan" — `28-onboarding-9-your-plan.png`, anchor `#onboarding`, light, dock **"Start logging"** with the note
   **"Next: an optional look at CoachCal Plus. You can close it."**
2. **Shows:** title **"Your plan is ready"**; ember card: 120 pt ring (18 pt stroke, track
   `#3A342F`, arc `#FF6A00` nearly full) with centre **"1,750"** (700 26 px Rounded) + **"kcal /
   day"**; macro dots **"Protein 130 g"** (`#6EA8FF`), **"Carbs 175 g"** (`#3CCFBE`), **"Fat 60
   g"** (`#B794FF`) with values in `#F7F5F2`; group rows **"Goal"** — **"76 kg by late March"** and
   **"Free scans"** — **"3 a week"**; footnote **"You can edit any of this in Profile. The scan
   limit comes from your plan."** (13 px `--cc-text-2`).
3. **Implemented today by:** `apps/mobile/src/features/onboarding/PlanRevealScreen.tsx` +
   `MacroRing.tsx`.
4. **Identifiers that must survive:** RN `plan.reveal`, `plan.kcalHero`, `plan.weeklyRange`,
   `plan.adjust`, `plan.medicalDisclaimer`, `plan.safetyFloor`, `plan.persistError` (plus
   `plan.macro.<protein|carbs|fat>`, `plan.edit<Macro>` and the `plan.edit<Macro>.increment` /
   `.decrement` pairs); Swift the same `plan.*` strings.
5. **Differences from today's screen:** the reveal moves onto the ember card; the "Free scans — 3
   a week" row and the "scan limit comes from your plan" footnote are new (the limit stated before
   any paywall); the paywall is offered once after this screen and can always be closed. Today's
   inline edit panel keeps `plan.adjust` and the `plan.edit*` identifiers — the frame's "You can
   edit any of this in Profile" copy moves the edit target, so the unit either keeps the panel or
   records the relocation with the identifiers preserved.
6. **Behavior the frame needs:** the scan-limit row reads the plan/entitlement (the free tier's
   limit exists in the 402 state; a pre-scan read is the viewfinder's backend follow-up) — the row
   itself is **client** with the value from the entitlement state; the once-off paywall hand-off is
   **client + store follow-up** (no products yet; the offer closes). The persist path and the
   medical disclaimer exist.
7. **Parity rows:** OB-01, OB-09.

---

## 6 · Diary edit (`#diaryedit`, 12 frames)

The edit sheet of a food already logged in the diary — new in Ember, the SwiftUI app has no edit
sheet (row DY-08). One screen in three appearances (light, dark, ED-Safe), then its three
companions: the delete confirm, the saved state and the deleted + undo state, each also in three
appearances. Built by U-74, stage A2 (the row DY-08 brief).

### Edit item (light)

1. **Frame:** "Edit item (light)" — `29-diaryedit-edit-item-light.png`, anchor `#diaryedit`, light,
   sheet (`--cc-grouped`, 38 pt top radius, grabber) pushed inside the Diary day sheet.
2. **Shows**, top to bottom:
   - Nav bar: back glass button (`aria-label "Back to Tue, 24 Nov"`), title **"Edit item"**.
   - Header: 64 pt thumb; **"Chicken rice bowl"** (700 20 px) with a `#i-pencil` glyph
     (`aria-label "Rename Chicken rice bowl"`); **"High confidence"** badge + **"12:40 · scan"**
     (13 px `--cc-text-2`).
   - Meal segment **Breakfast / Lunch (selected) / Dinner / Snack** (`aria-label "Meal"`).
   - Total card: **"Total · was 624"** (13 px `--cc-text-2`); **"650 kcal"** (700 30 px Rounded) —
     recomputed from the current grams; right: **"P 42 g · C 79 g · F 17 g"** with macro dots.
   - Section head **"3 items · tap grams to type"**.
   - Expanded item card: **"Jasmine rice"** + **"260 kcal"**; the Review grams control: −/+ 44 pt
     fill buttons (`aria-label "Decrease rice by 10 grams"` / `"Increase rice by 10 grams"`) around
     the typed field (44 pt, 2 px `--cc-accent` border, **"200"** 700 22 px Rounded + "g" + caret,
     `aria-valuenow 200`); drag ruler with labels 100 · 150 · **200** (in `--cc-accent-ink` 700) ·
     250 · 300; serving chips **"½ cup"**, **"1 cup · 160 g"**, **"1½ cup"**.
   - Collapsed rows: **"Roast chicken thigh"** / 320 kcal / **"140 g"** gram pill (`aria-label
     "Roast chicken thigh, 140 grams. Tap to edit"`); **"Cucumber"** / "70 kcal incl. dressing" /
     **"60 g"**.
   - Dock: primary **"Save changes"**; under it **"Delete item"** with `#i-trash` in
     `--cc-error-ink` — never the primary.
3. **Implemented today by:** no screen — the diary has no edit sheet (DY-08, todo; U-74 stage A2
   builds it). Today a row tap opens the add-food sheet and the delete path is DiaryDayView's custom
   confirm. The grams control exists as the DS `GramsField` + `GramsRuler` (U-71/U-71b).
4. **Identifiers that must survive:** RN `diary.foodRow`, `diary.toast`, DS `ccstepper.decrement`,
   `ccstepper.increment`, `food-row:<title>`, `food-row-kcal:<title>`. The edit sheet's own ids are
   new, named by the unit that builds it — design-system.md additions §8 fixes their names:
   `diary.edit.grams.<id>.field` (next to the kept `.increment` / `.decrement`),
   `diary.edit.save`, `diary.edit.delete`, `diary.toast.undo`. Swift: none (the screen is new).
5. **Differences from today's screen:** the whole sheet is new. It reuses the Review grams control
   (typed field, 44 pt −/+ at 10 g, ruler, serving chips); the total shows "was 624" so the change
   is visible before saving; Delete sits under Save in red ink; the meal segment and rename sit
   above the items.
6. **Behavior the frame needs:** per the owner's decision ("Delete and edit in the diary"): the
   kcal is recomputed from the edited grams (the client rule, I6), the write goes through the diary
   repository with one pending op and `notifyLocalMutation()` — **client** (U-74, stage A2, DY-08).
   No endpoint.
7. **Parity rows:** DY-08, DY-01 (the sheet stack it pushes inside), PL-08 (its ED-Safe twin).

### Edit item (dark)

`30-diaryedit-edit-item-dark.png` — the same sheet on dark; the selected meal segment pill uses
`--cc-fill-elevated` #3A3632 (accent-ink 4.59:1) and the grams field border stays a graphic
(accent), not text. The rest as frame 29.

### Edit item (ED-Safe)

`31-diaryedit-edit-item-ed-safe.png` — the total card and the per-item kcal lines are gone; a
neutral note card takes their place (`--cc-accent-tint` tile, `#i-leaf`): **"Adjust the grams if the
portion looks off."** + **"Numbers are hidden in ED-Safe mode."**. The expanded item shows
**"was 180 g"** where the kcal line was; the confidence badge, the grams, the meal segment and Save
stay. The rest as frame 29.

### Delete confirm (light)

1. **Frame:** "Delete confirm (light)" — `32-diaryedit-delete-confirm-light.png`, anchor
   `#diaryedit`, the system action sheet over the dimmed edit sheet.
2. **Shows:** title **"Delete Chicken rice bowl?"**; body **"This removes 624 kcal from Lunch. You
   can undo for 5 seconds."** (13 px `--cc-text-2`); destructive **"Delete item"** (56 pt,
   `--cc-error-ink`); **"Cancel"** as the separate bottom button, as iOS draws it.
3. **Implemented today by:** DiaryDayView.tsx renders a custom card modal ("Delete …?" / "This will
   remove it from …. This can't be undone." / Delete / Cancel); the dialog buttons carry no
   identifiers today.
4. **Identifiers that must survive:** none declared on the dialog today; the action sheet is new,
   named by the unit (`diary.edit.delete` per design-system.md §8). The kept rule: a delete is never
   silent and never double-confirmed.
5. **Differences from today's screen:** the custom card modal becomes the system action sheet
   (RN `ActionSheetIOS` with `destructiveButtonIndex`); the message states what will change and
   that Undo exists — today's copy says the opposite ("This can't be undone.").
6. **Behavior the frame needs:** the 5 s Undo toast after the delete (the owner's decision; the
   Swift app tombstoned with no undo window) — **client** (U-74). No endpoint.
7. **Parity rows:** DY-08.

### Delete confirm (dark)

`33-diaryedit-delete-confirm-dark.png` — same action sheet on `--cc-elevated`; the rest as frame 32.

### Delete confirm (ED-Safe)

`34-diaryedit-delete-confirm-ed-safe.png` — the message drops the kcal figure:
**"It will be removed from Lunch. You can undo for 5 seconds."** Same two buttons. The rest as
frame 32.

### Saved (light)

1. **Frame:** "Saved (light)" — `35-diaryedit-saved-light.png`, anchor `#diaryedit`, back on the
   Diary day sheet after Save.
2. **Shows:** summary card **"Eaten 1,310 / Goal 2,100 / Left 790"** ("Left" in
   `--cc-accent-ink`); Breakfast 410 kcal; Lunch **"900 kcal"** with the edited row tinted
   `--cc-accent-tint` and labelled **"Edited"** — **"Chicken rice bowl · 400 g · High · Edited ·
   650"** — plus **"Avocado toast · 1 slice · from search · 250"**; dashed **"Add dinner"**;
   Exercise **"Brisk walk · 40 min · 180"**; dark ember toast **"Changes saved — Chicken rice bowl ·
   400 g"** with an **"Undo"** action (`aria-label "Undo changes"`).
3. **Implemented today by:** DiaryDayView.tsx + DS `Toast` (`diary.toast` with Undo) — today a save
   through the add-food sheet shows that toast; there is no edit path and no "Edited" tag.
4. **Identifiers that must survive:** RN `diary.toast`, `diary.foodRow`, DS `food-row:<title>`,
   `food-row-kcal:<title>`; the toast's Undo action is DS `toast:undo`. `diary.toast.undo` is the
   new undo id the unit names.
5. **Differences from today's screen:** the edited row is tinted for 2 s and keeps a persistent
   **"Edited"** label, so colour is not the only cue; totals update at once; the toast offers Undo
   for 5 s and stays while VoiceOver is on.
6. **Behavior the frame needs:** the owner's decision — a saved toast with its own undo, the
   "Edited" label that persists — **client** (U-74). No endpoint.
7. **Parity rows:** DY-08, DY-01.

### Saved (dark)

`36-diaryedit-saved-dark.png` — the same day sheet on dark; the rest as frame 35.

### Saved (ED-Safe)

`37-diaryedit-saved-ed-safe.png` — the summary reads **"Logged 3 items / Weight 80.4 kg"** (weight
stays visible in ED-Safe); no kcal anywhere, including the toast. The rest as frame 35.

### Deleted + Undo (light)

1. **Frame:** "Deleted + Undo (light)" — `38-diaryedit-deleted-undo-light.png`, anchor
   `#diaryedit`, the day sheet after the delete.
2. **Shows:** the row is gone (Lunch holds only "Avocado toast · 250"); summary **"Eaten 660 / Goal
   2,100 / Left 1,440"**; ember toast **"Chicken rice bowl deleted — Removed from Lunch"** with
   **"Undo"** (`aria-label "Undo delete"`).
3. **Implemented today by:** the tombstone path of the diary repository exists (the Swift port);
   today there is no edit-row delete and no undo window.
4. **Identifiers that must survive:** RN `diary.toast`, DS `toast:undo`; `diary.toast.undo` names
   the undo action.
5. **Differences from today's screen:** the row leaves with a 200 ms collapse (reduced motion: a
   cross-fade); Undo restores the item and its position; after 5 s the delete is sent to the
   server. Today's confirm says "This can't be undone." — the frame replaces the second confirm
   with the undo window.
6. **Behavior the frame needs:** the owner's decision (undo toast for five seconds, no second
   confirm) — **client** (U-74). No endpoint.
7. **Parity rows:** DY-08.

### Deleted + Undo (dark)

`39-diaryedit-deleted-undo-dark.png` — the same on dark; the rest as frame 38.

### Deleted + Undo (ED-Safe)

`40-diaryedit-deleted-undo-ed-safe.png` — the summary counts items, not kcal (**"Logged 2 items /
Weight 80.4 kg"**); the rest as frame 38.

---

## 7 · Export errors (`#export`, 6 frames)

The CSV export sheet with its three failure states, light and dark. The sheet opens from Settings →
"Export diary as CSV". Built by U-77 (the Settings unit; PL-14 binds the tap to the file share).

### Export: Write failed (light)

1. **Frame:** "Export: Write failed (light)" — `41-export-export-write-failed-light.png`, anchor
   `#export`, sheet (610 pt) over a dimmed backdrop.
2. **Shows:** title **"Export diary"** + close glass button; sub **"A CSV of your meals, grams,
   nutrition and weight."**; range chips **"Last 7 days / Last 30 days (selected) / All time"**
   (`role=radio`, `aria-label "Date range"`); error card on `--cc-error-tint` (`#i-alert` in
   `--cc-error-ink`, `role=alert`): **"Couldn't create the file"** (600 17 px) + **"Your iPhone may
   be low on storage. Free up some space, then try again. Nothing in your diary changed."** (15 px)
   + **"Error EXP-WRITE · 24 Nov, 12:41"** (13 px `--cc-text-2`); dock: primary **"Try again"**,
   secondary **"Contact us"** (`#i-mail`), footnote **"Contact us attaches the error code, never
   your diary."**
3. **Implemented today by:** the Settings row `settings.row.export`
   (`SettingsDetailView.tsx`) → the CSV share of `apps/mobile/src/platform/csv/csvExportFile.ts`
   (U-42). Today the tap shares the text fallback, not a file, and there is no sheet: the range
   chips, the states and the file row are new.
4. **Identifiers that must survive:** RN `settings.row.export`, `settings.row.contact`; the sheet
   and its state cards are new, named by the unit that builds it.
5. **Differences from today's screen:** the whole sheet is new. The failure becomes an inline error
   card in the sheet — never a dead-end alert — and says what to try and that the diary is safe.
6. **Behavior the frame needs:** per the owner's decisions the Export tap opens the share with the
   file (`exportCsvAndShare`, U-77) and the write failure is recoverable in place: **client**
   (U-77). The EXP-WRITE code is a client-side code; "Contact us" pre-attaches it. No endpoint.
7. **Parity rows:** PR-02, PL-14.

### Export: Write failed (dark)

`42-export-export-write-failed-dark.png` — dark sheet surface `--cc-elevated`; chips, the file row
and the secondary button use `--cc-fill-elevated` so they keep their shape. The rest as frame 41.

### Export: No data in range (light)

1. **Frame:** "Export: No data in range (light)" — `43-export-export-no-data-in-range-light.png`,
   anchor `#export`, same sheet, range "Last 7 days".
2. **Shows:** title, sub and chips as frame 41 (Last 7 days selected); empty card on
   `--cc-fill-elevated`: 48 pt `--cc-elevated` tile with `#i-cal`, **"Nothing logged in the last 7
   days"** (600 17 px) + **"There is no file to make for these dates. Pick a longer range to export
   what you have logged."** (15 px `--cc-text-2`); dock: primary **disabled and labelled with the
   reason** — **"No entries in the last 7 days"** (`aria-disabled`) — and secondary **"Choose All
   time"**.
3. **Implemented today by:** nothing — the sheet is new (as frame 41). Today an empty range still
   produces a (header-only) file.
4. **Identifiers that must survive:** `settings.row.export`; the rest new, named by the unit.
5. **Differences from today's screen:** new state; the disabled primary states why and the one-tap
   fix is the secondary button. If the diary is empty for all time, the chips hide and the copy
   becomes "Log your first meal to export".
6. **Behavior the frame needs:** the empty check over the existing series — **client** (U-77). No
   endpoint.
7. **Parity rows:** PR-02, PL-14.

### Export: No data in range (dark)

`44-export-export-no-data-in-range-dark.png` — the same on dark; the rest as frame 43.

### Export: Share sheet cancelled (light)

1. **Frame:** "Export: Share sheet cancelled (light)" —
   `45-export-export-share-sheet-cancelled-light.png`, anchor `#export`, same sheet, range "Last 30
   days".
2. **Shows:** info card on `--cc-info-tint` (`#i-info` in `--cc-info-ink`, `role=status`):
   **"Not shared"** + **"Your file is still ready. Share it again, or choose "Save to Files" in the
   share sheet."**; file row on `--cc-fill-elevated` (`#i-receipt`):
   **"coachcal-diary-2026-10-26_2026-11-….csv"** + **"42 KB · 31 days · 96 entries"**; dock:
   primary **"Share again"** (`#i-share`), secondary **"Done"**.
3. **Implemented today by:** nothing — the share today resolves silently; there is no sheet and no
   file row.
4. **Identifiers that must survive:** `settings.row.export`; the rest new, named by the unit.
5. **Differences from today's screen:** closing the share sheet is not an error — no red, no alert.
   RN `Share.share()` resolves with `dismissedAction`; the frame answers it with a neutral note that
   keeps the file one tap away.
6. **Behavior the frame needs:** a dismissed share is not an error (the owner's decision) —
   **client** (U-77). No endpoint.
7. **Parity rows:** PR-02, PL-14.

### Export: Share sheet cancelled (dark)

`46-export-export-share-sheet-cancelled-dark.png` — the same on dark; the rest as frame 45.

---

## 8 · Dark mode: onboarding and billing (`#darkmode`, 12 frames)

The `.dark` token set on the onboarding steps and the billing surfaces. Same layout, same copy,
only tokens change (sheets on dark sit on `--cc-elevated` over a #0E0D0C backdrop so the sheet edge
reads). Onboarding dark is built by U-73, billing dark by U-77.

### 1 · Welcome (dark)

`47-darkmode-1-welcome-dark-same-in-both-modes.png` — the welcome stage on dark; the canvas captions
it "same in both modes" (the photo stage is dark in light mode too). Brackets, badge, eyebrow,
hero sentence, dock as frame 20. The rest as frame 20.

### 2 · Goal (dark)

`48-darkmode-2-goal-dark.png` — the four option cards on dark (`--cc-card` #1C1A18, selected on
`--cc-accent-tint` #3A2312 with the orange check). The rest as frame 21.

### 3 · About you (dark)

`49-darkmode-3-about-you-dark.png` — the segment, the two-column 56 pt fields and the unit segment
on dark. The rest as frame 22.

### 4 · Goal weight and pace (dark)

`50-darkmode-4-goal-weight-and-pace-dark.png` — the pace segment and the caution floor card on dark
(caution ink #FFD43B on tint #3A3214). The rest as frame 23.

### 5 · Activity and diet (dark)

`51-darkmode-5-activity-and-diet-dark.png` — the three activity cards and the diet chips on dark.
The rest as frame 24.

### 6 · Projection (dark)

`52-darkmode-6-projection-dark.png` — the projection chart card on dark (`--cc-accent-strong`
#FF6A00 curve, band and grid lines on the dark card). The rest as frame 25.

### 7 · Privacy, Health and ED-Safe (dark)

`53-darkmode-7-privacy-health-and-ed-safe-dark.png` — the three toggle rows on dark (Apple Health
tile keeps its red, reminders blue, ED-Safe purple). The rest as frame 26.

### 8 · Building your plan (dark)

`54-darkmode-8-building-your-plan-dark.png` — the ring and the formula card on dark; the disabled
**"Almost there"** dock. The rest as frame 27.

### 9 · Your plan (dark)

`55-darkmode-9-your-plan-dark.png` — the ember reveal card and the Goal / Free scans rows on dark.
The rest as frame 28.

### Quota reached (dark sheet)

`56-darkmode-quota-reached-dark-sheet.png` — the quota sheet on dark: sheet surface `--cc-elevated`
#2A2724 (not black) so it lifts off the dimmed app; scan tile, title **"You've used this week's 3
free scans"**, body, dock **"See plans"** + **"Log manually, free"** as frame 17. The free path
keeps equal weight; the limit and the reset day come from the server. The rest as frame 17.

### Plans / paywall (dark)

`57-darkmode-plans-paywall-dark.png` — the paywall on dark: ember hero with a `--cc-border` edge,
feature rows, yearly option selected (`--cc-accent-tint` #3A2312, 2 px accent border), monthly
below; every price the `{trial}` / `{yearly}` / `{perMonth}` / `{monthly}` placeholder as frame 18
(D13; the light paywall uses the same placeholders). The rest as frame 18.

### Cancel flow (dark)

`58-darkmode-cancel-flow-dark.png` — the informational cancel step on dark: three check rows with
**"{expiryDate}"** in the first (the subscription's expiration date at run time), note, dock
**"Cancel subscription"** (destructive tint #3A1219 with #FF7088 text, 6.19:1) + **"Keep Plus"** as
frame 19. The rest as frame 19.

---

## 9 · High Contrast: edit item (`#hc`, frames 59 and 60)

The `.hc` (light) and `.dark.hc` appearances of the edit sheet, drawn when iOS "Increase Contrast"
is on. Only ten tokens change (frame 103, the token table, holds the list and sits at canvas
position 103 — catalogued after the icon band below). The tokens are U-71c's delivery; the screens
themselves are built by their restyle unit (U-74 for the edit sheet) and inherit the appearances
from the tokens.

### Edit item (High Contrast light)

`59-hc-edit-item-high-contrast-light.png` — frame 29 with the HC light tokens: accent ink darkens
to #8F3400, accent strong to #C24D00, secondary text to #4A4643, on-accent to pure black. The rest
as frame 29.

### Edit item (High Contrast dark)

`60-hc-edit-item-high-contrast-dark.png` — frame 30 with the HC dark tokens: accent text brightens
to #FF9A52, text to pure white, secondary text to #C8C3BD. The rest as frame 30.

## 10 · Sign in (`#auth`, 7 frames)

The sign-in flow: the entry step with the three providers, the e-mail step, its error state and the
reset-link screen. Built by U-77b (row AU-01).

**The owner's decision for this band (taken after plan.md):** the frames draw a password; the app
signs in with a code sent to the e-mail and keeps that (parity AU-01). The entry step takes frames
61 and 62 as they are. The e-mail step takes the look of frames 63 to 67 with **the code where the
frame has a password**. The segment "Sign in | Create account", **"Forgot password?"**, the
reset-link screen and the two notes under the dock are not drawn. The back button of the entry step
is not drawn (the root gate puts nothing behind it). The privacy line "Meal photos are only used
for your estimate, never to train models." and the footnote about Terms and Privacy Policy are not
drawn until Phương supplies the promise and the pages.

### Sign in (light)

1. **Frame:** "Sign in (light)" — `61-auth-sign-in-light.png`, anchor `#auth`, light, full screen.
2. **Shows:** back glass button (`aria-label "Back"`, not built: see the decision above); 64 pt
   app mark (the Ember ring on orange); **"Sign in to keep your diary safe"** (700 32 px);
   **"Your meals, weight and streaks are backed up and stay in sync on your other devices."** (400
   17 px `--cc-text-2`); two trust rows (`#i-shield`, `#i-lock` in `--cc-accent-ink`): **"We never
   post anywhere or read your contacts."** and **"Meal photos are only used for your estimate,
   never to train models."**; dock: **"Sign in with Apple"** (black, brand button), **"Continue
   with Google"** (white, bordered, brand button), "or" divider, secondary **"Continue with
   email"** (`#i-mail`), footnote **"By continuing you agree to our Terms and Privacy Policy"**.
3. **Implemented today by:** `apps/mobile/src/features/auth/SignInScreen.tsx` (route
   `apps/mobile/src/app/sign-in.tsx`; U-20).
4. **Identifiers that must survive:** RN `auth.signInApple`, `auth.signInGoogle`,
   `auth.emailField`, `auth.sendCode`, `auth.otpField`, `auth.verifyCode`, `auth.form`; Swift the
   same strings (`SignInView.swift`, per the networking-auth detail file). In the app the provider
   buttons are the native ones (`AppleAuthenticationButton` style BLACK on light / WHITE on dark,
   corner radius 14; Google's own button assets) — the canvas marks are only for the mock.
5. **Differences from today's screen:** the entry step gains the value headline, the trust rows and
   the terms footnote (footnote and the photo line wait for Phương — the decision above); Apple
   first, then Google, then email, matching today's order. No skip button is drawn.
6. **Behavior the frame needs:** the three providers exist (U-20; Apple and Google were never
   called for real — no credentials, NW-03). The copy lines held back by the decision are a content
   follow-up, not client work. Otherwise **client** (U-77b).
7. **Parity rows:** AU-01, PL-01 (root gate).

### Sign in (dark)

`62-auth-sign-in-dark.png` — the Apple button flips to white with black text, Google to its dark
theme (#131314 fill, #8E918F border, #E3E3E3 text), as both guidelines require. The rest as
frame 61.

### Email + password (light)

1. **Frame:** "Email + password (light)" — `63-auth-email-password-light.png`, anchor `#auth`,
   light, pushed from the entry step.
2. **Shows:** nav bar: back glass button, title **"Email"**; **"Sign in with email"** (700 28 px);
   segment **"Sign in (selected) / Create account"** (`role=radiogroup`); field **"Email"** with
   **"minh@example.com"** (52 pt, `--cc-fill`); field **"Password"** focused — 2 px `--cc-accent`
   border, dot mask, caret, eye glass button (`aria-label "Show password"`, 44 pt); ghost row
   **"Forgot password?"**; dock: primary **"Sign in"**, note **"Create account asks for at least 8
   characters and shows the rule before you type."**
3. **Implemented today by:** `SignInScreen.tsx` (the e-mail step of the code flow).
4. **Identifiers that must survive:** RN `auth.emailField`, `auth.sendCode`, `auth.otpField`,
   `auth.verifyCode`, `auth.form`; Swift the same.
5. **Differences from today's screen:** the frame's password field becomes the code field
   (`auth.otpField`, the "6-digit code" field) — the owner's decision; the segment, the
   "Forgot password?" row and the dock note are not drawn. `textContentType` /
   `autoComplete` (email, one-time-code) stay so Keychain can fill.
6. **Behavior the frame needs:** the code flow exists (U-20/U-21; the OTP throttle answers 429 —
   the contract follow-up in plan.md). The show-password eye has no counterpart for a code field
   and is not built. **Client** (U-77b).
7. **Parity rows:** AU-01.

### Email + password (dark)

`64-auth-email-password-dark.png` — fields on `--cc-fill`; the focus ring is accent (a graphic),
the caret too. The rest as frame 63.

### Wrong password (light)

1. **Frame:** "Wrong password (light)" — `65-auth-wrong-password-light.png`, anchor `#auth`, the
   e-mail step after a failed sign-in.
2. **Shows:** as frame 63, with the field border in `--cc-error` and an inline alert under it
   (`role=alert`, `#i-alert`, `--cc-error-ink`): **"That email and password don't match. Check
   them, or reset your password."**; dock note **"After 5 wrong tries we pause sign-in for 1
   minute."**; the primary stays enabled and labelled **"Sign in"**.
3. **Implemented today by:** `SignInScreen.tsx` (the error path of the code flow).
4. **Identifiers that must survive:** `auth.emailField`, `auth.otpField`, `auth.verifyCode`,
   `auth.form`.
5. **Differences from today's screen:** the error is inline under the field, announced, and never
   says which of the two was wrong — today's screen surfaces the envelope error; the frame fixes
   the copy pattern. The rate-limit note after 5 tries comes from the server.
6. **Behavior the frame needs:** the wording maps to the code flow ("That code doesn't match…");
   the server rate limit exists (BE-06). **Client** (U-77b).
7. **Parity rows:** AU-01.

### Wrong password (dark)

`66-auth-wrong-password-dark.png` — error ink #FF7088 on black is 7.3:1. The rest as frame 65.

### Reset link sent (light)

1. **Frame:** "Reset link sent (light)" — `67-auth-reset-link-sent-light.png`, anchor `#auth`,
   light, after "Forgot password?".
2. **Shows:** 64 pt `--cc-accent-tint` tile with `#i-mail` in `--cc-accent-ink`; **"Check your
   email"** (700 28 px); **"We sent a link to minh@example.com. Open it on this iPhone to set a new
   password. The link works for 1 hour."** (400 17 px, the address in `--cc-text` 700); **"Can't
   find it? Look in Junk or Promotions."** (15 px); dock: primary **"Open Mail"**, secondary
   disabled **"Resend link in 0:42"** (unlocks after 60 s and counts down), ghost **"Use a
   different email"**.
3. **Implemented today by:** nothing — the code flow has no reset-link screen (the owner's
   decision: not drawn).
4. **Identifiers that must survive:** none — the screen is not built; new ids would be the unit's.
5. **Differences from today's screen:** none to build (decision above). The frame stays in the
   catalog as the reference if a reset flow returns.
6. **Behavior the frame needs:** none — **not built** per the owner's decision.
7. **Parity rows:** AU-01 (derived; the row's screen keeps the code flow).

---

## 11 · Edit goal sheet (`#target`, 4 frames)

The Profile goal sheet, restyled and restructured. Built by U-77 (row PR-03); frame 71 is not
built — it guards an engine follow-up.

### Edit goal sheet (light)

1. **Frame:** "Edit goal sheet (light)" — `68-target-edit-goal-sheet-light.png`, anchor `#target`,
   light, large-detent sheet from Profile → Daily target or Goal weight.
2. **Shows:** title **"Edit goal"** + close glass button; current-weight row on
   `--cc-fill-elevated` (`#i-scale` in `--cc-text-2`): **"Current weight · 80.6 kg"** (600 16 px) +
   **"From Apple Health, today"** (13 px `--cc-text-2`) + chip **"Update"** (44 pt); label **"Goal
   weight"**; the grams stepper reused for kilograms: −/+ 44 pt (`aria-label "Decrease Goal weight
   by 0.5 kilograms"` / `"Increase …"`), field **"76.0 kg"** (700 22 px Rounded, 2 px accent
   border, `aria-valuenow 76`); ruler 72 · 74 · **76** (in `--cc-accent-ink` 700) · 78 · 80; label
   **"Pace"**; group of three radio rows: **"Gentle · 0.25 kg a week"**, **"Steady · 0.5 kg a
   week"** (selected, 600, orange check, **"Recommended"** tint tag), **"Faster · 0.75 kg a week ·
   harder to keep up"**; ember result card: **"Daily target"** / **"1,750 kcal · was 2,100"** (700
   30 px Rounded, the old value kept) + right **"76 kg / late March"**; dock: primary **"Save
   goal"**, footnote **"Past days in your diary don't change."**
3. **Implemented today by:** `apps/mobile/src/features/profile/TargetEditSheet.tsx` (model
   `targetEditModel.ts`, U-41; route entry from Profile).
4. **Identifiers that must survive:** RN `settings.targetEdit.goalWeight`, `settings.targetEdit.kcal`,
   `settings.targetEdit.kcalDown`, `settings.targetEdit.kcalUp`,
   `settings.targetEdit.safetyFloor`, `settings.targetEdit.save`; Swift the same strings
   (`TargetEditSheet.swift`). The stepper labels and the ruler are DS (`ccstepper.*`, the grams
   ruler a11y labels).
5. **Differences from today's screen:** the wheel fields become the stepper + ruler in 0.5 kg steps
   (lb when Units = lb); pace becomes three named options, never a free number; the result updates
   live on the ember card and shows the old target; the current-weight row reads Health with an
   Update chip that opens the weight log; today's sheet has no current-weight row and no pace
   group.
6. **Behavior the frame needs:** every save goes through `TargetsEngine` (already true, PR-03's
   rule); the live recompute is **client** (U-77). The current-weight value needs the Health weight
   read (U-42 ported it; wiring it into the sheet is **client**). No endpoint.
7. **Parity rows:** PR-03, PR-01 (the entry point).

### Edit goal sheet (dark)

`69-target-edit-goal-sheet-dark.png` — sheet on `--cc-elevated`; the current-weight row and the
pace group use `--cc-fill-elevated` so they keep their shape. The rest as frame 68.

### Edit goal sheet (ED-Safe)

`70-target-edit-goal-sheet-ed-safe.png` — per the 27/11 decision ED-Safe hides only kcal: the goal
weight, the pace rows and Save stay; the ember card shows **"Goal date / 76 kg around late March /
Your meal plan adjusts on its own. Numbers stay hidden."** instead of the daily target. The rest as
frame 68.

### Goal below healthy range (light)

1. **Frame:** "Goal below healthy range (light)" —
   `71-target-goal-below-healthy-range-light.png`, anchor `#target`, the sheet with a 54 kg goal.
2. **Shows:** the stepper border turns `--cc-caution`; ruler 50–58; caution card on
   `--cc-caution-tint` (`#i-info` in `--cc-caution-ink`, `role=alert`): **"54 kg is below the
   healthy range for your height. We'll plan for 59 kg, the lowest weight in that range. A doctor
   or dietitian can help with a different goal."**; dock primary renames the outcome:
   **"Save 59 kg goal"**.
3. **Implemented today by:** today's sheet floors on the engine's flat minimum and shows the locked
   safety-floor banner (`settings.targetEdit.safetyFloor`).
4. **Identifiers that must survive:** `settings.targetEdit.goalWeight`, `settings.targetEdit.save`,
   `settings.targetEdit.safetyFloor`.
5. **Differences from today's screen:** the frame's guardrail is height-based ("below the healthy
   range **for your height**") and renames the button to the clamped value. **Not built**: the
   owner's decision keeps the flat minimum the engine returns; the height-based minimum is an
   engine follow-up, and the copy never says "BMI". The caution colours (not error red) and the
   no-blame copy are the pattern for whichever floor ships.
6. **Behavior the frame needs:** the height-based floor — **engine follow-up** (a `TargetsEngine`
   change whose behavior tests are locked; owner decision). The rest of the pattern (caution
   styling, clamped Save label) is **client** (U-77) when the engine ships it.
7. **Parity rows:** PR-03.

---

## 12 · Scan sheets: Describe and Report a problem (`#scansheets`, 6 frames)

The two sheets of the scan loop round 3: Describe a meal (typing, estimating) and Report a problem
(the renamed Fix Issue), with their dark and sent states. Built by U-72 (SC-05 and the review's
report path).

### Describe a meal: typing (light)

1. **Frame:** "Describe a meal: typing (light)" —
   `72-scansheets-describe-a-meal-typing-light.png`, anchor `#scansheets`, large-detent sheet with
   the keyboard up.
2. **Shows:** title **"Describe your meal"** + close glass button; text box focused (2 px accent
   border, caret) with **"2 scrambled eggs with butter, 1 slice of sourdough toast and a flat white
   with oat milk"**; under it **"Amounts help: "1 cup", "a palm-sized piece"."** and the counter
   **"89/500"**; hint chips **"+ Amount"**, **"+ How it was cooked"**, **"+ Brand"** (insert a
   prompt at the caret); above the keyboard: **"Breakfast · uses 1 of your 2 free scans left this
   week"** (13 px `--cc-text-2`) and the pill primary **"Estimate"** (48 pt).
3. **Implemented today by:** `apps/mobile/src/features/scan/DescribeMealSheet.tsx` (SC-05, U-30;
   the field is clamped to 500 characters on the client).
4. **Identifiers that must survive:** RN `scan.describeTitle`, `scan.describeField`,
   `scan.describeSubmit`, `scan.describe.back`, `scan.describe.mealPicker`, `scan.describe.search`;
   Swift: the sheet exists (SC-05) and carries no distinct identifiers beyond the review's — the
   RN strings are the contract.
5. **Differences from today's screen:** the sheet gains the hint chips, the counter, the meal +
   quota line that rides above the keyboard, and the focused-on-open field; today's sheet is a plain
   field with a submit.
6. **Behavior the frame needs:** the quota line reads the server's remaining count and is hidden on
   Plus — the pre-scan entitlement read is a **backend follow-up** (the owner's decision: the line
   is not shown until the server sends the limit before a scan). The rest is **client** (U-72); the
   scan itself is `kind: "text"` (exists).
7. **Parity rows:** SC-05, SC-02 (the Describe entry), SC-01.

### Describe a meal: typing (dark)

`73-scansheets-describe-a-meal-typing-dark.png` — iOS dark keyboard; the field on
`--cc-fill-elevated` with the accent focus ring. The rest as frame 72.

### Describe a meal: estimating (light)

1. **Frame:** "Describe a meal: estimating (light)" —
   `74-scansheets-describe-a-meal-estimating-light.png`, anchor `#scansheets`, the sheet after
   Estimate.
2. **Shows:** sub **"We estimate each item and show how sure we are. You can fix anything before
   saving."**; the text stays visible (box unfocused); label **"Meal"** with chips **Breakfast
   (selected) / Lunch / Dinner / Snack**; status card (`role=status`, `aria-live="polite"`):
   **"Estimating · step 2 of 3"** with a spinner and three rows — **"Found 3 foods"** (green
   check), **"Finding each food"** (search, accent), **"Adding it up"** (idle, `--cc-text-2`);
   dock: disabled primary **"Estimating…"** + ghost **"Cancel"**.
3. **Implemented today by:** `DescribeMealSheet.tsx` + the analyzing state of `scanModel.ts`.
4. **Identifiers that must survive:** `scan.describeField`, `scan.describeSubmit`,
   `scan.describe.mealPicker`, `scan.step.<step>` (the checklist steps), `scan.cancel`.
5. **Differences from today's screen:** the keyboard drops and the text stays visible; the steps
   are the same three the Live Activity shows (find foods, match each food, add it up), announced
   politely.
6. **Behavior the frame needs:** real server-reported stages — **backend follow-up** (the owner's
   decision: the screen shows only what the client observes and runs no timer; the plan's phase-4
   table says the same). Cancel stops the request and refunds nothing because the credit is only
   claimed server-side — existing behavior. Success pushes the normal Review screen with the
   confidence badge; a typed 422 shows the Review error state (and the Live Activity's couldn't-read
   card, frame 107). **Client** (U-72).
7. **Parity rows:** SC-05, SC-03, SC-01.

### Report a problem (light)

1. **Frame:** "Report a problem (light)" — `75-scansheets-report-a-problem-light.png`, anchor
   `#scansheets`, large-detent sheet.
2. **Shows:** title **"Report a problem"** + close glass button; label **"Which item?"** with item
   chips **"Jasmine rice (selected) / Roast chicken thigh / Cucumber / Whole meal"** (the entry
   point preselects: the per-item ⋯ menu preselects that item, "Something wrong? Report it" under
   Save preselects Whole meal); label **"What's wrong?"**; group of five radio rows: **"Wrong food ·
   It isn't jasmine rice"** (selected, check), **"Wrong amount · More or less than that"**,
   **"Shouldn't be here · I didn't eat this"**, **"Nutrition looks off · The numbers seem wrong"**,
   **"Something else"**; ghost row **"Fix it now: rename the item"** (`#i-pencil`); note box
   **"It's brown rice, not jasmine"** (`aria-label "Add a note, optional"`); **"Include the
   photo"** with the toggle off and small **"Off by default. Only used to check this report."**;
   dock: primary **"Send report"**.
3. **Implemented today by:** `apps/mobile/src/features/scan/CorrectionCaptureView.tsx` (SC-06:
   issue kind + note against one item, entered from `scan.fixIssue.<id>`).
4. **Identifiers that must survive:** RN `scan.fixIssue.<itemId>`, `scan.correction.sheet`,
   `scan.correction.close`, `scan.correction.note`, `scan.correction.save`,
   `scan.correction.kind.<option>`; Swift the same strings. The five-reason vocabulary and the
   item chips are new, named by the unit.
5. **Differences from today's screen:** "Fix Issue" is renamed **Report a problem** with an honest
   label; five reasons replace today's kind list; the direct fix ("Fix it now") is offered first so
   a report is never the only way to correct a number; the photo toggle is drawn but **not built**
   (decision below).
6. **Behavior the frame needs:** the owner's decision — a report unlocks Save, as the correction of
   the SwiftUI app did, and nothing leaves the device; the photo toggle is not drawn until an
   endpoint with storage exists (**backend follow-up** for the endpoint; the toggle itself stays
   out of the build). The rest is **client** (U-72). No endpoint for the report itself.
7. **Parity rows:** SC-06, SC-04 (the review it returns to), SC-01.

### Report a problem (dark)

`76-scansheets-report-a-problem-dark.png` — item chips and the reason group sit on
`--cc-fill-elevated`; the selected chip is accent with a black label. The rest as frame 75.

### Report sent (light)

1. **Frame:** "Report sent (light)" — `77-scansheets-report-sent-light.png`, anchor `#scansheets`,
   520 pt sheet.
2. **Shows:** 64 pt `--cc-success-tint` tile with a green check; **"Thanks, report sent"** (700 26
   px); **"We read every report to make estimates better. Your review hasn't changed: to fix this
   meal now, edit the item."** (400 17 px `--cc-text-2`); dock: primary **"Back to review"**,
   secondary **"Rename Jasmine rice"** (`#i-pencil`).
3. **Implemented today by:** the correction sheet's dismissal path (no sent state today).
4. **Identifiers that must survive:** `scan.correction.close`, `scan.correction.save`; the sent
   state is new, named by the unit.
5. **Differences from today's screen:** new state — it confirms in plain words, says the review is
   unchanged, and offers the matching direct fix.
6. **Behavior the frame needs:** per the decision the sent copy says the report is saved on this
   device; a network failure keeps the form and queues the report (sent with the next sync) —
   **client** (U-72). No endpoint.
7. **Parity rows:** SC-06, SC-04.

---

## 13 · Paywall without prices (`#paywallstates`, 3 frames)

The paywall's two non-ready states around the shell. Built by U-77.

**The owner's decision:** the paywall is a shell with three states and no price — it ends in the
failed state until a store is connected.

### Paywall: loading prices (light)

1. **Frame:** "Paywall: loading prices (light)" —
   `78-paywallstates-paywall-loading-prices-light.png`, anchor `#paywallstates`, light, full
   screen.
2. **Shows:** nav **"Restore"** ghost + close glass button; ember hero **"COACHCAL PLUS /
   Unlimited scans and a coach who shows the maths."**; the four feature rows with real names; the
   yearly option selected (2 px accent border, tint background, orange radio with black check) with
   grey skeleton slots where the price line and the right-side price sit; monthly below with
   skeletons; dock: disabled primary with a spinner — **"Loading prices…"** — and note **"Prices
   come from the App Store in your currency."** + **"Terms · Privacy"**.
3. **Implemented today by:** nothing — today's only billing surface is the minimal plans sheet
   (`scan.plansSheet`, `scan.plansTitle`, `scan.plansLogManually`).
4. **Identifiers that must survive:** the minimal sheet's three strings above stay on whatever
   replaces it; the states and skeleton are new, named by the unit.
5. **Differences from today's screen:** new state. The skeleton shows only after 300 ms (no flash);
   plan names are real, prices are skeletons, the button is disabled and says why; Restore and
   Close always work; Reduce Motion: no shimmer, static skeleton.
6. **Behavior the frame needs:** products to load — **store + native follow-up** (PL-16); until
   then the shell renders and the state machine simply never leaves this state for long — the
   owner's decision makes the failed state the resting one. **Client** (U-77) for the shell.
7. **Parity rows:** PR-02.

### Paywall: prices failed (light)

1. **Frame:** "Paywall: prices failed (light)" —
   `79-paywallstates-paywall-prices-failed-light.png`, anchor `#paywallstates`, after a timeout (8
   s) or a StoreKit error.
2. **Shows:** as frame 78, with a caution card (`--cc-caution-tint`, `#i-info` in
   `--cc-caution-ink`, `role=alert`): **"Prices didn't load."** (600) + **"Check your connection
   and try again. You'll always see the price before you pay."** + secondary **"Try again"** (44
   pt); the plans stay visible but unselectable (`aria-disabled`) with **"Price unavailable"** in
   the price slots; dock: disabled primary **"Prices unavailable"**, note **"Already subscribed?
   Restore works without prices."** + **"Terms · Privacy"**.
3. **Implemented today by:** nothing (as frame 78).
4. **Identifiers that must survive:** as frame 78.
5. **Differences from today's screen:** new state; caution, not red — nothing the person did; we
   never show a buy button without a price next to it (3.1.2(c)).
6. **Behavior the frame needs:** the shell ends here until a store is connected (the owner's
   decision) — the resting state of the built screen. **Client** (U-77); products are the **store +
   native follow-up**.
7. **Parity rows:** PR-02.

### Paywall: prices failed (dark)

`80-paywallstates-paywall-prices-failed-dark.png` — caution ink #FFD43B on #3A3214 is 9.9:1. The
rest as frame 79.

---

## 14 · Dark: Profile, Settings, food search, manual log (`#darkmore`, 4 frames)

The `.dark` clones of the profile band (canvas section 3). No new tokens; built by U-77 (frames 81,
82) and U-74 (frames 83, 84).

### Profile (dark)

`81-darkmore-profile-dark.png` — frame 13 on dark: cards on `--cc-card` #1C1A18 over black; the
avatar keeps its orange fill with a black initial; the system icon tiles keep their colours. The
rest as frame 13.

### Settings (dark)

`82-darkmore-settings-dark.png` — frame 14 on dark: the subscription card shows the real renewal
price from StoreKit (`{price}`); Cancel uses the destructive tint #3A1219 with #FF7088 text
(6.19:1). The rest as frame 14.

### Food search (dark, ED-Safe)

`83-darkmore-food-search-dark-ed-safe.png` — frame 15 on dark: search field and segment on
`--cc-fill`; add buttons use accent-tint #3A2312 with accent-ink #FF7A1F (5.64:1). The rest as
frame 15.

### Manual log (dark, ED-Safe)

`84-darkmore-manual-log-dark-ed-safe.png` — frame 16 on dark: the same rule as light, no kcal field
under ED-Safe; the note card uses accent-tint. The rest as frame 16.

## 15 · Widgets and Live Activity (`#glance`, 7 glanceables)

The widget surface is ember (`#141210`) with the brand ring for the first time; the Live Activity
covers the scan-in-progress and ready-to-review states and their ED-Safe variants. The ED-Safe
flag travels through the shared app group and the activity's ContentState.

### Small widget

1. **Frame:** "Small widget" — `85-glance-small-widget.png`, anchor `#glance`, 170×170, ember surface.
2. **Shows:** radial orange glow top-right; "CoachCal" label (600 11 px `--cc-ember-accent`, top
   left); 112 pt ring (11 pt stroke, track `#3A342F`, arc `#FF6A00` at 61%) with centre **"816"**
   (700 26 px Rounded, `#F7F5F2`) + **"kcal left"** (500 11 px `#ABA6A0`). Tap opens Today.
   Uses `containerBackground` so StandBy and tinted Home Screens render correctly.
3. **Implemented today by:** `apps/mobile/src/widgets/CaloriesWidget.tsx` (expo-widgets; the spike
   shipped small and medium; PL-11 partial).
4. **Identifiers that must survive:** none declared in the widget targets; the snapshot contract is
   the App Group payload (`date`, `consumedKcal`, …) — keep its field names.
5. **Differences from today's screen:** the ember surface and the brand ring (today's widget is not
   ember-branded); `containerBackground`.
6. **Behavior the frame needs:** the App Group snapshot publisher and the production App Group
   (PL-11 open scope) plus the `containerBackground` support of expo-widgets on SDK 58 (unverified,
   D14) — **native follow-up** (U-78, native slot).
7. **Parity rows:** PL-11.

### Small widget · ED-Safe

1. **Frame:** "Small widget · ED-Safe" — `86-glance-small-widget-ed-safe.png`, anchor `#glance`, 170×170, ember surface.
2. **Shows:** same ring at 66% with centre **"On track"** (700 17 px) + **"2 of 3 meals"** (500 11
   px) — no number anywhere; reads the ED-Safe flag from the shared app group.
3. **Implemented today by:** not implemented — today's widget has no ED-Safe variant (PL-11 open
   scope).
4. **Identifiers that must survive:** none declared; the snapshot gains the `edSafe` flag field.
5. **Differences from today's screen:** whole frame is new.
6. **Behavior the frame needs:** the flag in the app-group payload and the variant rendering —
   **native follow-up** (U-78).
7. **Parity rows:** PL-11, PL-08.

### Medium widget

1. **Frame:** "Medium widget" — `87-glance-medium-widget.png`, anchor `#glance`, 364×170, ember surface.
2. **Shows:** 120 pt ring (61%, centre "816 / kcal left"); three macro bars — **"Protein 82/130
   g"** (63%, `#6EA8FF`), **"Carbs 140/210 g"** (67%, `#3CCFBE`), **"Fat 38/70 g"** (54%,
   `#B794FF`) on `#3A342F` tracks; orange **"Scan a meal"** button (32 pt, `#i-camera`, black
   label) that opens the camera directly through an App Intent.
3. **Implemented today by:** `apps/mobile/src/widgets/CaloriesWidget.tsx` (spike medium).
4. **Identifiers that must survive:** none declared; snapshot fields as above.
5. **Differences from today's screen:** the ember surface, the macro bars and the scan button are
   the frame's additions.
6. **Behavior the frame needs:** the scan button is a widget-level App Intent (SwiftUI concept);
   the RN equivalent is a widget tap that deep-links into the scan flow — **native follow-up**
   (U-78) to prove with expo-widgets or record a fallback (D14).
7. **Parity rows:** PL-11.

### Lock Screen widgets

1. **Frame:** "Lock Screen widgets" — `88-glance-lock-screen-widgets.png`, anchor `#glance`, circular + rectangular accessory families
   on a Lock Screen backdrop.
2. **Shows:** circular 72 pt — white ring at 61% (8 pt stroke) with **"816"** (700 17 px Rounded)
   + **"LEFT"** (600 9 px); rectangular 172×72 — **"12-day streak"** with `#i-flame`, **"1,284 of
   2,100 kcal"** (500), a 61% white bar; both render in vibrant mode, the ring drawn in white so
   the system tints it.
3. **Implemented today by:** not implemented — today's widget ships the system small/medium
   families only.
4. **Identifiers that must survive:** none declared.
5. **Differences from today's screen:** the accessory families are new.
6. **Behavior the frame needs:** accessory-family rendering through expo-widgets (coverage
   unverified on SDK 58) — **native follow-up** (U-78), with the D14 fallback recorded if the SDK
   cannot express it.
7. **Parity rows:** PL-11.

### Live Activity · Lock Screen

1. **Frame:** "Live Activity · Lock Screen" — `89-glance-live-activity-lock-screen.png`, anchor `#glance`, two 370 pt cards on the Lock Screen.
2. **Shows:** processing card — 28 pt `#FF6A00` tile with `#i-scan` (black glyph), **"Reading your
   plate"** (600 15 px `#F7F5F2`), **"~3 s"** (500 13 px `#ABA6A0`); 56 pt thumb + **"Chicken rice
   bowl"** (600 17 px) + **"Finding each food · step 2 of 3"** (500 13 px `#ABA6A0`) + a 66% orange
   bar on `#3A342F`. Ready card — 56 pt thumb + **"Ready to review"** (600 17 px) + mini **"High"**
   badge + **"624 kcal"** (600 15 px Rounded) + orange **"Review"** button (44 pt, black label).
   Active while a scan processes (steps come from the server) and when it is ready; ends when saved
   or after 8 h; height 84–160 pt. The PNG under `frames/` holds only the processing card — the
   capture tool photographs the first child of the canvas figure, and the ready card is the second;
   the canvas figure stacks both, so a restyle unit compares against both cards.
3. **Implemented today by:** the port seam only — `apps/mobile/src/features/scan/scanActivity.ts`
   is a no-op implementation behind `ScanActivityPort`; the model starts/ends the activity
   (`scanModel.ts`). The native activity is U-43's open scope (PL-12 partial).
4. **Identifiers that must survive:** none declared in the activity UI; the ContentState fields
   are the contract — keep their names and add `edSafe`.
5. **Differences from today's screen:** the whole presentation is new (today nothing renders); the
   frame adds the processing state with server steps, not only the after-save state.
6. **Behavior the frame needs:** the Live Activity UI itself (native, U-43/U-78) **and** the
   server-reported stages for the processing card — **native + backend follow-up** (the stages are
   this document's Analyzing behavior).
7. **Parity rows:** PL-12.

### Dynamic Island

1. **Frame:** "Dynamic Island" — `90-glance-dynamic-island.png`, anchor `#glance`, compact, minimal and expanded presentations.
2. **Shows:** compact 250×37 — orange `#i-scan` glyph at the leading edge and a progress ring at
   the trailing edge; minimal 37×37 — the progress ring only; expanded 370×160 — header
   **"Ready"** (600 15 px) + mini **"High confidence"** badge; **"Chicken rice bowl"** (600 17 px)
   + **"624 kcal · 3 items"** (700 30 px Rounded + footnote) + orange **"Review"** button (44 pt).
3. **Implemented today by:** nothing renders (same no-op seam as above).
4. **Identifiers that must survive:** none declared; ContentState fields as above.
5. **Differences from today's screen:** whole frame is new.
6. **Behavior the frame needs:** Dynamic Island presentations — **native follow-up** (U-78); the
   processing state's steps are the **backend** stages follow-up.
7. **Parity rows:** PL-12.

### Live Activity · ED-Safe

1. **Frame:** "Live Activity · ED-Safe" — `91-glance-live-activity-ed-safe.png`, anchor `#glance`, 370 pt ready card with ED-Safe on.
2. **Shows:** 56 pt thumb + **"Ready to review"** + mini **"High"** badge + **"3 items"** (500 13
   px `#ABA6A0`) — the `edSafe` flag in the ContentState removes the kcal figure; the confidence
   badge stays; orange **"Review"** button.
3. **Implemented today by:** nothing renders (no-op seam).
4. **Identifiers that must survive:** none declared; the ContentState `edSafe` field is the
   contract piece.
5. **Differences from today's screen:** whole frame is new.
6. **Behavior the frame needs:** the flag through ContentState and the variant UI — **native
   follow-up** (U-78).
7. **Parity rows:** PL-12, PL-08.

---

## 16 · App icon: "Ember ring" (`#icon`, 11 frames)

One idea: an open progress ring that also reads as a C, with an ember dot where the ring stops.
Built as two layers (background + foreground) for Icon Composer, so Liquid Glass adds its own
highlight; layers are square, unmasked, opaque; Default, Dark, Clear and Tinted keep the same
shapes. Files: `icon/layer-background.svg`, `icon/layer-foreground.svg`,
`icon/AppIcon-1024.svg` (plus the flattened `AppIcon-1024.png` fallback with no alpha for older
OS versions). This replaces `#FF8841` and the old mark.

The band holds eleven frames: the five drawn frames of the first catalog (92 to 96) and the six
renditions exported from `icon/AppIcon.icon` with Icon Composer's command-line renderer (97 to
102; two glass layers on a solid orange fill, Dark, Clear and Tinted from per-appearance fills).
The steps for opening and shipping it are `icon/ICON-COMPOSER.md`.

Per D13 and the `PL-17` row, **the current icon stays until the layers are built**; these frames
are the reference for that build, not a restyle of a screen.

### Default

1. **Frame:** "Default" — `92-icon-default.png`, anchor `#icon`.
2. **Shows:** `#FF6A00` background with a white 18%-opacity radial highlight; black ring and ember
   dot (black on `#FF6A00` is 6.89:1).
3. **Implemented today by:** no RN screen — the app icon asset (`app.config.ts`; PL-17: the
   current production icon, which is RGBA and must be flattened for the Store).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** replaces today's icon art.
6. **Behavior the frame needs:** the Icon Composer build with all four appearances — **design +
   native follow-up** (no runtime behavior).
7. **Parity rows:** PL-17.

### Dark

1. **Frame:** "Dark" — `93-icon-dark.png`, anchor `#icon`.
2. **Shows:** `#141210` background; `#FF6A00` ring; `#FF7A1F` dot.
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**, no runtime behavior.
7. **Parity rows:** PL-17.

### Clear

1. **Frame:** "Clear" — `94-icon-clear.png`, anchor `#icon`.
2. **Shows:** the system renders the glass; the app supplies the foreground layer only (white
   92%-opacity ring and dot on transparent).
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**.
7. **Parity rows:** PL-17.

### Tinted

1. **Frame:** "Tinted" — `95-icon-tinted.png`, anchor `#icon`.
2. **Shows:** `#1a1a1a` background; grayscale `#E8E8E8` ring and dot; iOS applies the user's tint.
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**.
7. **Parity rows:** PL-17.

### Icon Composer layers

1. **Frame:** "Icon Composer layers" — `96-icon-icon-composer-layers.png`, anchor `#icon`.
2. **Shows:** the three source files side by side — the default 1024 render, the flat background
   layer, the ring-plus-dot foreground layer on transparency; 1024×1024, square, unmasked; the
   background is a flat colour so the system adds the Liquid Glass light; export a flattened PNG
   with no alpha for older OS versions.
3. **Implemented today by:** the SVG sources in `docs/design/ember/icon/` — not yet built into the
   app icon.
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** the build target for the whole `#icon` band.
6. **Behavior the frame needs:** the Icon Composer build (Default, Dark, Clear, Tinted) and the
   flattened Store export — **follow-up**; PL-17's open "RGBA icon must be flattened" item folds
   into it.
7. **Parity rows:** PL-17.

### Default (Icon Composer rendition)

`97-icon-default.png` — the Default appearance as rendered from `icon/AppIcon.icon`
(`icon/composer/AppIcon-Default-1024.png`): orange fill, black glass ring and dot. The reference
render for U-80; the rest as frame 92.

### Dark (Icon Composer rendition)

`98-icon-dark.png` — the Dark appearance render (`icon/composer/AppIcon-Dark-1024.png`): ember-black
fill, orange ring, brighter ember dot. The rest as frame 93.

### Clear light (Icon Composer rendition)

`99-icon-clear-light.png` — the Clear appearance in light
(`icon/composer/AppIcon-ClearLight-1024.png`): system glass; the glyph keeps its shape. The rest as
frame 94.

### Clear dark (Icon Composer rendition)

`100-icon-clear-dark.png` — the Clear appearance in dark
(`icon/composer/AppIcon-ClearDark-1024.png`). The rest as frame 94.

### Tinted light (Icon Composer rendition)

`101-icon-tinted-light.png` — the Tinted appearance in light
(`icon/composer/AppIcon-TintedLight-1024.png`): ring white (the most recognisable part), dot light
grey. The rest as frame 95.

### Tinted dark (Icon Composer rendition)

`102-icon-tinted-dark.png` — the Tinted appearance in dark
(`icon/composer/AppIcon-TintedDark-1024.png`). The rest as frame 95.

---

## 17 · High Contrast tokens panel (`#hc`, canvas position 103)

### High Contrast overrides (read live from tokens.css)

1. **Frame:** "High Contrast overrides (read live from tokens.css)" —
   `103-hc-high-contrast-overrides-read-live-from-tokens-cs.png`, anchor `#hc`, a table panel.
2. **Shows:** the ten tokens that change under Increase Contrast — `--cc-on-accent`,
   `--cc-accent-strong`, `--cc-accent-ink`, `--cc-accent-tint`, `--cc-ember`, `--cc-ember-track`,
   `--cc-ember-accent`, `--cc-text`, `--cc-text-2`, `--cc-text-3` — with a swatch and hex per
   column: Light, HC light, Dark, HC dark (for example `--cc-accent-ink` #B84300 → #8F3400 →
   #FF7A1F → #FF9A52; `--cc-text-2` #5F5B57 → #4A4643 → #ABA6A0 → #C8C3BD). The canvas reads the
   values live from `tokens.css`, so the table always matches it. Caption: classes `.hc` (light)
   and `.dark.hc` (dark), applied when iOS "Increase Contrast" is on; in RN pass them as
   `highContrastLight` / `highContrastDark` to `DynamicColorIOS`.
3. **Implemented today by:** no screen — a token panel. The RN side holds `tokens.json`'s
   `color.highContrastLight` / `color.highContrastDark` (U-71c) behind the same keys.
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** the high-contrast appearances are not yet rendered by the
   app's screens; the token chain is.
6. **Behavior the frame needs:** the app decides the mode from iOS Increase Contrast
   (`AccessibilityInfo` / `UIAccessibility.isDarkerSystemColorsEnabled`; with `DynamicColorIOS` the
   high-contrast keys do it) — **delivered by U-71c**; the screens pick it up through their restyle
   units.
7. **Parity rows:** PL-06, PL-07 (the token chain).

---

## 18 · Glance, second band (`#glance2`, frames 104 to 107)

The round-3 additions to the glance band: the medium widget's ED-Safe variant, the Live Activity's
per-step processing states, its Dynamic Island processing pair and its couldn't-read failure card.
Built by U-78 (not dispatched; it needs the native slot).

### Medium widget · ED-Safe

1. **Frame:** "Medium widget · ED-Safe" — `104-glance2-medium-widget-ed-safe.png`, anchor
   `#glance2`, 364×170, ember surface.
2. **Shows:** the ring at 66% with centre **"On track"** (700 17 px) + **"2 of 3 meals"** (500 11
   px) — no numbers; right column: three meal lines — check circle **"Breakfast / Overnight
   oats"**, check **"Lunch / Chicken rice bowl"**, empty circle **"Dinner / Next"** (logged names
   only, the next meal grey); orange **"Scan a meal"** button (32 pt). Reads the ED-Safe flag from
   the shared app group, like the small widget.
3. **Implemented today by:** not implemented — the spike widget has no ED-Safe variant (PL-11 open
   scope).
4. **Identifiers that must survive:** none declared; the snapshot gains the `edSafe` flag field.
5. **Differences from today's screen:** whole frame is new; macro grams are replaced by the meals
   logged today (name only) and the next meal.
6. **Behavior the frame needs:** the flag in the app-group payload and the variant rendering —
   **native follow-up** (U-78, native slot).
7. **Parity rows:** PL-11, PL-08.

### Live Activity · processing (Lock Screen)

1. **Frame:** "Live Activity · processing (Lock Screen)" —
   `105-glance2-live-activity-processing-lock-screen.png`, anchor `#glance2`, the three step cards
   stacked.
2. **Shows:** three 370 pt cards, one per server stage: header **"Reading your plate"** (600 15 px)
   + orange `#i-scan` tile + **"step 1 of 3"** / **"step 2 of 3"** / **"step 3 of 3"**; 56 pt thumb
   + the step label — **"Spotting the foods"**, **"Finding each food"**, **"Adding it up"** — each
   with a three-part progress bar filled up to the current step. The steps run in this order: 1
   Spotting the foods (vision model), 2 Finding each food (food database lookup), 3 Adding it up
   (nutrition maths). No time estimate: steps are honest, seconds are not.
3. **Implemented today by:** the port seam only — `apps/mobile/src/features/scan/scanActivity.ts`
   is a no-op behind `ScanActivityPort` (PL-12 partial).
4. **Identifiers that must survive:** none declared in the activity UI; ContentState carries
   `step` (1–3) and the label, so wording can change without an app update — keep those field
   names and add `edSafe`.
5. **Differences from today's screen:** whole presentation is new (today nothing renders); the
   first-round frame 89 showed the step as a percentage bar, this frame shows one card per stage.
6. **Behavior the frame needs:** the server-reported stages (the Analyzing behavior — **backend
   follow-up**) and the activity UI itself (**native follow-up**, U-78). Identical under ED-Safe
   (no numbers here). Ends as "Ready to review" (frame 89's ready card).
7. **Parity rows:** PL-12.

### Dynamic Island · processing

1. **Frame:** "Dynamic Island · processing" — `106-glance2-dynamic-island-processing.png`, anchor
   `#glance2`, compact + expanded.
2. **Shows:** compact 250×37 — orange `#i-scan` glyph and **"2/3"**; expanded 370×150 — header
   **"Reading your plate"** + **"step 2 of 3"**, step label **"Finding each food"**, the same
   three-part bar as the Lock Screen. Minimal stays the progress ring of frame 90.
3. **Implemented today by:** nothing renders (no-op seam).
4. **Identifiers that must survive:** none declared; ContentState fields as frame 105.
5. **Differences from today's screen:** whole frame is new.
6. **Behavior the frame needs:** the processing presentations — **native follow-up** (U-78); the
   steps are the **backend** stages follow-up.
7. **Parity rows:** PL-12.

### Live Activity · couldn't read

1. **Frame:** "Live Activity · couldn't read" — `107-glance2-live-activity-couldn-t-read.png`,
   anchor `#glance2`, 370 pt failure card.
2. **Shows:** dimmed 56 pt thumb; **"Couldn't read this photo"** (600 17 px) + **"Too dark to see
   the food. Retake it or describe it."** (500 13 px `#ABA6A0`); **"Open"** button (44 pt,
   `#3A342F` fill).
3. **Implemented today by:** nothing renders (no-op seam).
4. **Identifiers that must survive:** none declared; the ContentState gains the failure reason
   (from the error code: too dark, no food found, blurry).
5. **Differences from today's screen:** whole frame is new.
6. **Behavior the frame needs:** for a typed 422 (unreadable photo): the reason comes from the
   error code; Open goes back to the camera with Describe one tap away; the activity ends after 15
   minutes or when the person opens it — **native follow-up** (U-78) + the error-code mapping
   **client** (U-72).
7. **Parity rows:** PL-12, SC-01.

---

## Table A — parity row to frames

Every `parity.tsv` row whose `ember` cell is not `-` (41 rows), plus the rows this catalog gives
frames for the first time (DY-08, AU-01, PR-03, the QA-04 check), and the frames each covers.

| Parity row | `ember` cell | Frames |
|---|---|---|
| PL-01 | Shell (tab bar and Scan button in every frame) | The shell itself has no frame: it is the tab bar + Scan FAB repeated in every phone-screen frame (screens.js `data-tab` chrome). Touches all 84 screen sections. |
| PL-06 | Design system (#system) | No frame — the `#system` band is the token board behind every section. The HC token panel 103 is its high-contrast slice. |
| PL-07 | Design system (#system) | No frame — the component mapping in `design-system.md`. |
| PL-08 | Today (ED-Safe); Review (ED-Safe); Food search (ED-Safe); Manual log (ED-Safe); widgets and Live Activity in ED-Safe | Today (ED-Safe) 09; Review (ED-Safe) 05; Food search (ED-Safe) 15; Manual log (ED-Safe) 16; Edit item (ED-Safe) 31; Delete confirm (ED-Safe) 34; Saved (ED-Safe) 37; Deleted + Undo (ED-Safe) 40; Edit goal sheet (ED-Safe) 70; Food search (dark, ED-Safe) 83; Manual log (dark, ED-Safe) 84; Small widget · ED-Safe 86; Live Activity · ED-Safe 91; Medium widget · ED-Safe 104 |
| PL-11 | Widgets (#glance: small, medium, Lock Screen, ED-Safe) | Small widget 85; Small widget · ED-Safe 86; Medium widget 87; Lock Screen widgets 88; Medium widget · ED-Safe 104 |
| PL-12 | Live Activity (#glance: Lock Screen, Dynamic Island, ED-Safe) | Live Activity · Lock Screen 89; Dynamic Island 90; Live Activity · ED-Safe 91; Live Activity · processing 105; Dynamic Island · processing 106; Live Activity · couldn't read 107 |
| PL-14 | — (the CSV export states ride the Settings row) | Export: Write failed 41/42; No data in range 43/44; Share sheet cancelled 45/46 |
| PL-17 | App icon "Ember ring" (#icon): not adopted, the current icon stays | Default 92; Dark 93; Clear 94; Tinted 95; Icon Composer layers 96; and the Icon Composer renditions 97, 98, 99, 100, 101, 102 |
| OB-01 | Onboarding: 9 steps (#onboarding) | All nine step frames 20–28 and their dark twins 47–55 (the flow contract and the shared scaffold) |
| OB-02 | Onboarding: 9 steps (#onboarding) | 1 · Welcome 20; its dark twin 47 |
| OB-03 | Onboarding: 9 steps (#onboarding) | 7 · Privacy, Health and ED-Safe 26; dark 53 |
| OB-04 | Onboarding: 9 steps (#onboarding) | 2 · Goal 21; dark 48 |
| OB-05 | Onboarding: 9 steps (#onboarding) | 5 · Activity and diet 24; dark 51 |
| OB-06 | Onboarding: 9 steps (#onboarding) | 3 · About you 22; dark 49 |
| OB-07 | Onboarding: 9 steps (#onboarding) | 4 · Goal weight and pace 23; dark 50 |
| OB-08 | Onboarding: 9 steps (#onboarding) | 8 · Building your plan 27; dark 54 |
| OB-09 | Onboarding: 9 steps (#onboarding) | 9 · Your plan 28; dark 55 |
| OB-10 | Onboarding: 9 steps (#onboarding) | 6 · Projection 25; dark 52 |
| TD-01 | Today (light); Today (dark, offline); Today (ED-Safe) | Today (light) 07; Today (dark, offline) 08; Today (ED-Safe) 09 |
| SC-01 | Scan loop (#scan) | All six `#scan` frames 01–06 (the state machine behind them), plus the sheet band 72–77 and the Live Activity band 105–107 that ride the same flow |
| SC-02 | Viewfinder; Describe mode | Viewfinder 01 (Describe is its fourth chip); Describe a meal: typing 72/73 |
| SC-03 | Analyzing | Analyzing 02; Describe a meal: estimating 74 |
| SC-04 | Review (light); Review (dark, item needs review); Review (ED-Safe) | Review (light) 03; Review (dark, item needs review) 04; Review (ED-Safe) 05 |
| SC-05 | Describe mode | Describe a meal: typing 72; dark 73; estimating 74 |
| SC-06 | Review (dark, item needs review) | Report a problem 75; dark 76; Report sent 77 |
| SC-07 | Saved | Saved 06 |
| DY-01 | Diary day (sheet, large detent) | Diary day (sheet, large detent) 10 |
| DY-02 | derived (no frame) | — (Table B) |
| DY-03 | Food search (ED-Safe) | Food search (ED-Safe) 15; dark ED-Safe 83 |
| DY-04 | derived (Custom food has no frame) | — (Table B) |
| DY-05 | Manual log (ED-Safe) | Manual log (ED-Safe) 16; dark ED-Safe 84 |
| DY-06 | derived (Exercise has no frame) | — (Table B) |
| DY-07 | derived (Water has no frame) | — (Table B) |
| DY-08 | Editing a food in the diary (Designer drew the frames; U-74 stage A2) | Edit item 29/30/31; Delete confirm 32/33/34; Saved 35/36/37; Deleted + Undo 38/39/40 |
| PG-01 | Progress | Progress 11 |
| PG-02 | Progress | Progress (weight trend card) 11 |
| PG-03 | Progress | Progress (weekly energy card) 11 |
| PG-04 | Progress | Progress (badges grid) 11 |
| CH-01 | Coach | Coach 12 |
| PR-01 | Profile | Profile 13; dark 81 |
| PR-02 | Settings; Quota reached (sheet); Plans / paywall; Cancel flow | Settings 14; dark 82; Quota reached (sheet) 17; dark sheet 56; Plans / paywall 18; dark 57; Cancel flow 19; dark 58; Paywall: loading prices 78; prices failed 79/80; Export states 41–46 |
| PR-03 | Edit goal sheet (was derived; Designer drew the frames) | Edit goal sheet 68/69/70; Goal below healthy range 71 (not built: engine follow-up) |
| AU-01 | Sign in (was derived; Designer drew the frames) | Sign in 61/62; Email + code 63/64; Wrong code 65/66; Reset link sent 67 (not built: owner decision) |
| QA-04 | Parity check | No frame — this catalog is its frames-side evidence: `scripts/rn/check-frames-doc.mjs` fails the build when a manifest frame is missing here or a cited name has gone stale |

---

## Table B — screens the design does not show, and the nearest frame to derive from

After three rounds some screens still have no frame. Derived from `parity.tsv` (the `derived`
cells) and the routes and sheets under `apps/mobile/src/app/` and `apps/mobile/src/features/`.
Each derivation keeps the behavior, the test sentences and the identifiers of today's screen and
takes only tokens and patterns from the named frame.

| Screen (no frame) | Parity row | Nearest frame to derive from | What it takes |
|---|---|---|---|
| Add food sheet (`AddFoodSheet.tsx`) | DY-02 | Diary day (sheet, large detent) 10 + Edit item 29 | Sheet chrome, grabber, section rhythm, the dashed tile style; the five quick-action tiles use the icon set of the canvas |
| Custom food sheet (`CustomFoodSheet.tsx`) | DY-04 | Manual log (ED-Safe) 16 | Form rows, the Advanced fold (collapsed + blurred) for nutrition fields, the accent-tint note card |
| Exercise log sheet (`ExerciseLogSheet.tsx`) | DY-06 | Manual log (ED-Safe) 16 | Same rows; "Activity and minutes only. Burned kcal is hidden." under ED-Safe; kcal field returns when off |
| Water log sheet (`WaterLogSheet.tsx`) | DY-07 | Today (light) 07 — the water card | The `--cc-info-tint` droplet tile, the ± 250 ml chip pattern, the sheet chrome of Diary day 10 |
| Weight log sheet (`WeightLogSheet.tsx`) | PG-02 | Edit goal sheet 68 — the current-weight row | The fill-field + ruler pattern in kilograms, the Update chip; the sheet chrome of Diary day 10 |
| The account-delete confirm of Settings (`settings.deleteConfirm`) | PR-02 | Delete confirm 32 | The system action sheet with a destructive button and Cancel (the frame's pattern, applied to the account) |
| The minimal plans sheet of today (`scan.plansSheet`) | PR-02 | Plans / paywall 18 | Superseded by frames 18/57/78–80; until U-77 lands, the sheet keeps its three identifiers |
| Barcode and label capture states of the viewfinder | SC-02 | Viewfinder 01 | The mode chips only; no dedicated frames for the barcode picker or the label flow |
| The debug console (`debug.tsx`) | — | none (not a product screen) | Stays out of the catalog on purpose |

Rows that used to be here and have frames now: editing a food in the diary (29–40), the export
error states (41–46), the dark variants of onboarding (47–55) and billing (56–58), the
high-contrast tokens (103), the target edit sheet (68–71), sign-in (61–67), and the medium widget
under ED-Safe (104).

---

## The behaviors the 107 frames need that the app does not have

One table, the plan's decision for each. "Built in unit X" means client work inside the named
restyle unit; anything else is a follow-up with its owner.

| The frames need | Frames | Decision |
|---|---|---|
| Server-reported scan stages (Analyzing ticks only what the server reports) | 02, 74, 89, 105 | the dwell timer goes and the screen shows only what the client observes (U-72); server stages are a backend follow-up |
| A pre-scan entitlement read (the free-scan counter before any scan) | 01, 28, 72 | not shown until the server sends the limit before a scan; a pre-scan read is a backend follow-up |
| Serving chips on the items of the review and the edit sheet | 03, 29 | the scan contract carries no servings and the VLM vocabulary is strict: contract and backend follow-up |
| Haptics (save, meal segment, minus and plus) | 03, 06, 29, and every segment | needs `expo-haptics`, a native dependency: follow-up with the next native unit |
| Live billing (store-read prices, Change plan, in-app cancel, Restore, Billing history) | 14, 17, 18, 19, 56, 57, 58, 78, 79, 80, 82 | the paywall is a shell with three states that never shows a price; it ends in the failed state until a store is connected (owner decision); products, the purchase SDK and a StoreKit configuration are store + native follow-ups; the Settings billing buttons stay visibly disabled with a note |
| ED-Safe in the glanceables (flag through App Group and ContentState) | 86, 91, 104 | native follow-up (U-78, native slot; expo-widgets coverage on SDK 58 unverified, D14) |
| Accessory families, Dynamic Island presentations, the widget scan button, the Live Activity failure card | 88, 90, 105, 106, 107 | native follow-up (U-78); the processing steps are the backend stages follow-up; the couldn't-read reason maps from the typed 422 error code (client, U-72) |
| The app icon "Ember ring" | 92–102 | adopted when Designer's complete set is in (U-80, native slot); a step that needs Icon Composer by hand is written down for Phương; until then the current icon stays (PL-17) |
| Sign-in keeps the e-mail code where the frames draw a password | 61–67 | the entry step takes 61/62 as they are; the e-mail step takes the look of 63–67 with the code in place of the password; the Sign in / Create account segment, Forgot password?, the reset-link screen (67) and the two notes under the dock are not drawn; the entry back button is not drawn (the root gate puts nothing behind it); the photo-privacy line and the Terms/Privacy footnote wait for Phương's promise and pages (owner decision) |
| The goal floor of the target sheet | 71 | the floor the engine returns, one flat minimum; the height-based minimum of the frame is an engine follow-up; the copy never says "BMI" (owner decision) |
| Report a problem | 75, 76, 77 | a report unlocks Save and stays on this device; the sent state says so; the photo toggle is not drawn until an endpoint with storage exists (backend follow-up) (owner decision) |
| Diary edit, delete and undo | 29–40 | built in stage A2 of U-74 (row DY-08): the system action sheet, an undo toast for five seconds (`diary.toast.undo`), the "Edited" label that persists, and a saved toast with its undo (owner decision) |
| The Export tap | 41–46 | U-77 binds the tap to `exportCsvAndShare`; a dismissed share is not an error; until then it shares the text, as before U-42 (owner decision) |
| One Food / Exercise / Custom food segment in the diary | 16, 84 | follow-up: it moves three sheets and their `*.close` identifiers (owner decision) |
| Onboarding "Prefer not to say" | 22, 49 | follow-up: a new path through `TargetsEngine`, whose behavior tests are locked (owner decision) |
| Metric and Imperial units | 22, 49, 68–70 | follow-up: unit conversion across the app (owner decision) |
| A meal-reminders toggle and "Set a reminder" in Coach | 26, 53, 12 | not drawn until a reminders preference exists and something calls `refreshNotifications()` (owner decision; PL-10) |
| The percent readout of onboarding step 8 | 27, 54 | removed with the fake progress; the identifier is recorded as removed (owner decision) |
| The ED-Safe choice at onboarding step 7 | 26, 53 | built in U-73: it writes the same stored key (`edSafeMode`) the Settings toggle owns |
| High Contrast appearances | 59, 60, 103 | delivered by U-71c in the token chain (`tokens.json` highContrastLight/highContrastDark); the screens pick it up through their restyle units |
| The dark appearances of every band | 47–58, 81–84 | tokens only (U-71/U-71c); the screens are their units' normal scope — nothing new to build beyond the restyle |
| Burned calories on Today | 07, 08, 09 | the burned figure needs the Apple Health steps read and the burned write (PL-13): the remaining U-42/U-76 scope, native wiring |
