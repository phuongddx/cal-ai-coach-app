# Ember frames: what every frame of the canvas shows and what the RN app must build

One section per frame of `docs/design/ember/index.html`, in canvas order. For every frame: what it
shows from top to bottom with its copy verbatim, the RN files that implement that screen today, the
identifiers that must survive, what differs from today's screen, the behavior the frame needs and
whether that is client work or a follow-up, and the `docs/rn-migration/parity.tsv` rows it covers.
Two tables at the end map parity rows to frames and list the screens the design does not show.

Companion documents: `design-system.md` (tokens, rules, component mapping, handoff notes),
`tokens.css` (the token source per D12), `README.md` (decisions and invariants).

## How many frames the canvas holds

Measured in a browser with the canvas open (`index.html` needs no server):

```sh
# in the browser, on the open canvas:
document.querySelectorAll('figure.frame').length
# → 40   (scan 6, core 6, profile 4, billing 3, onboarding 9, glance 7, icon 5)
```

The static file plus the generator agree:

```sh
grep -c '<figure class="frame"' docs/design/ember/index.html   # → 19 (static: #scan, #core, #profile, #billing)
grep -c '<figure class="frame"' docs/design/ember/screens.js   # → 11 template occurrences,
#   which render 21 runtime frames: 9 onboarding steps + 7 glanceables + 5 app-icon variants
```

Total: **40 frames = 28 phone screens + 7 glanceables + 5 app-icon variants.**
The 28 screens are the six `#scan` frames, the six `#core` frames, the four `#profile` frames, the
three `#billing` frames and the nine `#onboarding` steps (6+6+4+3+9). The 7 glanceables are the
`#glance` band. The 5 `#icon` frames are the app-icon variants of the "Ember ring"; D13 and the
`PL-17` row keep the current icon in place until the layers are built, so those five sections are
reference for the unit that builds them, not for a screen restyle. This document gives every one of
the 40 a section so the count above and the section count match.

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

1. **Frame:** "Viewfinder", anchor `#scan`, dark over a full-bleed camera image (`background #000`,
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

1. **Frame:** "Analyzing", anchor `#scan`, dark (`#000`), blurred plate backdrop.
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

1. **Frame:** "Review (light)", anchor `#scan`, light (`--cc-bg`), plain phone, scroll under a
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

1. **Frame:** "Review (dark, item needs review)", anchor `#scan`, dark (`--cc-bg #000`, cards
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

1. **Frame:** "Review (ED-Safe)", anchor `#scan`, light with ED-Safe mode on.
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

1. **Frame:** "Saved", anchor `#scan`, light.
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

1. **Frame:** "Today (light)", anchor `#core`, light, Today tab.
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

1. **Frame:** "Today (dark, offline)", anchor `#core`, dark (`--cc-bg #000`, warm cards `--cc-card
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

1. **Frame:** "Today (ED-Safe)", anchor `#core`, light with ED-Safe on, Today tab.
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

1. **Frame:** "Diary day (sheet, large detent)", anchor `#core`, dimmed backdrop (`#2b2724`), sheet
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

1. **Frame:** "Progress", anchor `#core`, light, Progress tab.
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

1. **Frame:** "Coach", anchor `#core`, light, Coach tab (icon `#i-spark`).
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

1. **Frame:** "Profile", anchor `#profile`, light, Profile tab (icon `#i-user`).
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

1. **Frame:** "Settings", anchor `#profile`, light, pushed from Profile.
2. **Shows**, top to bottom:
   - Nav bar: back glass button (`aria-label "Back to Profile"`), title **"Settings"**.
   - Section head **"Subscription"**; card: **"CoachCal Plus · Yearly"** (700 17 px) +
     **"Renews 12 Dec 2026 for $39.99."** / **"Billed by Apple. No hidden fees."** (15 px
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

1. **Frame:** "Food search (ED-Safe)", anchor `#profile`, light on `--cc-grouped`, sheet titled
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

1. **Frame:** "Manual log (ED-Safe)", anchor `#profile`, light on `--cc-grouped`, sheet.
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

1. **Frame:** "Quota reached (sheet)", anchor `#billing`, sheet (520 pt) over a dimmed backdrop.
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

1. **Frame:** "Plans / paywall", anchor `#billing`, light, full screen with dock.
2. **Shows**, top to bottom:
   - Nav bar: ghost **"Restore"** at the left, close glass button at the right — both always
     visible.
   - Ember hero: **"COACHCAL PLUS"** (600 13 px `--cc-ember-accent`, letter-spacing .04em);
     **"Unlimited scans and a coach who shows the maths."** (700 26 px `#F7F5F2`).
   - Four feature rows: **"Unlimited photo, barcode and label scans"**, **"Weekly coach review and
     insights"**, **"CSV export and Apple Health sync"** (each with an `--cc-accent-ink` check) and
     the info row **"Manual logging is free on every plan"** (`--cc-text-2`).
   - Yearly option (selected): 2 px `--cc-accent` border, `--cc-accent-tint` background, orange
     radio with a black check; **"Yearly"** + **"7 days free, then $39.99 / year"** on the same
     line; right side **"$3.33"** (700 17 px Rounded) + **"per month"**.
   - Monthly option: 1.5 px `--cc-separator` border; **"Monthly"** + **"$7.99 / month, no trial"**;
     right side **"$7.99"**.
   - Dock: primary **"Start 7-day free trial"**; note **"Free for 7 days, then $39.99/year. We'll
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

1. **Frame:** "Cancel flow", anchor `#billing`, light, pushed screen.
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

1. **Frame:** "1 · Welcome", anchor `#onboarding`, dark over a real plate photo.
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

1. **Frame:** "2 · Goal", anchor `#onboarding`, light.
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

1. **Frame:** "3 · About you", anchor `#onboarding`, light.
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

1. **Frame:** "4 · Goal weight and pace", anchor `#onboarding`, light.
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

1. **Frame:** "5 · Activity and diet", anchor `#onboarding`, light.
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

1. **Frame:** "6 · Projection", anchor `#onboarding`, light.
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

1. **Frame:** "7 · Privacy, Health and ED-Safe", anchor `#onboarding`, light.
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

1. **Frame:** "8 · Building your plan", anchor `#onboarding`, light, dock with a disabled button.
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

1. **Frame:** "9 · Your plan", anchor `#onboarding`, light, dock **"Start logging"** with the note
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

## 6 · Widgets and Live Activity (`#glance`, 7 glanceables)

The widget surface is ember (`#141210`) with the brand ring for the first time; the Live Activity
covers the scan-in-progress and ready-to-review states and their ED-Safe variants. The ED-Safe
flag travels through the shared app group and the activity's ContentState.

### Small widget

1. **Frame:** "Small widget", anchor `#glance`, 170×170, ember surface.
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

1. **Frame:** "Small widget · ED-Safe", anchor `#glance`, 170×170, ember surface.
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

1. **Frame:** "Medium widget", anchor `#glance`, 364×170, ember surface.
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

1. **Frame:** "Lock Screen widgets", anchor `#glance`, circular + rectangular accessory families
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

1. **Frame:** "Live Activity · Lock Screen", anchor `#glance`, two 370 pt cards on the Lock Screen.
2. **Shows:** processing card — 28 pt `#FF6A00` tile with `#i-scan` (black glyph), **"Reading your
   plate"** (600 15 px `#F7F5F2`), **"~3 s"** (500 13 px `#ABA6A0`); 56 pt thumb + **"Chicken rice
   bowl"** (600 17 px) + **"Finding each food · step 2 of 3"** (500 13 px `#ABA6A0`) + a 66% orange
   bar on `#3A342F`. Ready card — 56 pt thumb + **"Ready to review"** (600 17 px) + mini **"High"**
   badge + **"624 kcal"** (600 15 px Rounded) + orange **"Review"** button (44 pt, black label).
   Active while a scan processes (steps come from the server) and when it is ready; ends when saved
   or after 8 h; height 84–160 pt.
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

1. **Frame:** "Dynamic Island", anchor `#glance`, compact, minimal and expanded presentations.
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

1. **Frame:** "Live Activity · ED-Safe", anchor `#glance`, 370 pt ready card with ED-Safe on.
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

## 7 · App icon: "Ember ring" (`#icon`, 5 frames)

One idea: an open progress ring that also reads as a C, with an ember dot where the ring stops.
Built as two layers (background + foreground) for Icon Composer, so Liquid Glass adds its own
highlight; layers are square, unmasked, opaque; Default, Dark, Clear and Tinted keep the same
shapes. Files: `icon/layer-background.svg`, `icon/layer-foreground.svg`,
`icon/AppIcon-1024.svg` (plus the flattened `AppIcon-1024.png` fallback with no alpha for older
OS versions). This replaces `#FF8841` and the old mark.

Per D13 and the `PL-17` row, **the current icon stays until the layers are built**; these frames
are the reference for that build, not a restyle of a screen.

### Default

1. **Frame:** "Default", anchor `#icon`.
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

1. **Frame:** "Dark", anchor `#icon`.
2. **Shows:** `#141210` background; `#FF6A00` ring; `#FF7A1F` dot.
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**, no runtime behavior.
7. **Parity rows:** PL-17.

### Clear

1. **Frame:** "Clear", anchor `#icon`.
2. **Shows:** the system renders the glass; the app supplies the foreground layer only (white
   92%-opacity ring and dot on transparent).
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**.
7. **Parity rows:** PL-17.

### Tinted

1. **Frame:** "Tinted", anchor `#icon`.
2. **Shows:** `#1a1a1a` background; grayscale `#E8E8E8` ring and dot; iOS applies the user's tint.
3. **Implemented today by:** no RN screen (icon asset).
4. **Identifiers that must survive:** none.
5. **Differences from today's screen:** new appearance variant.
6. **Behavior the frame needs:** as Default — **follow-up**.
7. **Parity rows:** PL-17.

### Icon Composer layers

1. **Frame:** "Icon Composer layers", anchor `#icon`.
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

---

## Table A — parity row to frames

Every `parity.tsv` row whose `ember` cell is not `-` (41 rows), and the frames it covers here.

| Parity row | `ember` cell | Frames |
|---|---|---|
| PL-01 | Shell (tab bar and Scan button in every frame) | The shell itself has no frame: it is the tab bar + Scan FAB repeated in every phone-screen frame (screens.js `data-tab` chrome). Touches all 28 screen sections. |
| PL-06 | Design system (#system) | No frame — the `#system` band is the token board behind every section. |
| PL-07 | Design system (#system) | No frame — the component mapping in `design-system.md`. |
| PL-08 | Today (ED-Safe); Review (ED-Safe); Food search (ED-Safe); Manual log (ED-Safe); widgets and Live Activity in ED-Safe | Review (ED-Safe); Today (ED-Safe); Food search (ED-Safe); Manual log (ED-Safe); Small widget · ED-Safe; Live Activity · ED-Safe |
| PL-11 | Widgets (#glance: small, medium, Lock Screen, ED-Safe) | Small widget; Small widget · ED-Safe; Medium widget; Lock Screen widgets |
| PL-12 | Live Activity (#glance: Lock Screen, Dynamic Island, ED-Safe) | Live Activity · Lock Screen; Dynamic Island; Live Activity · ED-Safe |
| PL-17 | App icon "Ember ring" (#icon): not adopted, the current icon stays | Default; Dark; Clear; Tinted; Icon Composer layers |
| OB-01 | Onboarding: 9 steps (#onboarding) | All nine step frames (the flow contract and the shared scaffold) |
| OB-02 | Onboarding: 9 steps (#onboarding) | 1 · Welcome |
| OB-03 | Onboarding: 9 steps (#onboarding) | 7 · Privacy, Health and ED-Safe |
| OB-04 | Onboarding: 9 steps (#onboarding) | 2 · Goal |
| OB-05 | Onboarding: 9 steps (#onboarding) | 5 · Activity and diet |
| OB-06 | Onboarding: 9 steps (#onboarding) | 3 · About you |
| OB-07 | Onboarding: 9 steps (#onboarding) | 4 · Goal weight and pace |
| OB-08 | Onboarding: 9 steps (#onboarding) | 8 · Building your plan |
| OB-09 | Onboarding: 9 steps (#onboarding) | 9 · Your plan |
| OB-10 | Onboarding: 9 steps (#onboarding) | 6 · Projection |
| TD-01 | Today (light); Today (dark, offline); Today (ED-Safe) | Today (light); Today (dark, offline); Today (ED-Safe) |
| SC-01 | Scan loop (#scan) | All six `#scan` frames (the state machine behind them) |
| SC-02 | Viewfinder; Describe mode | Viewfinder (Describe is its fourth chip) |
| SC-03 | Analyzing | Analyzing |
| SC-04 | Review (light); Review (dark, item needs review); Review (ED-Safe) | Review (light); Review (dark, item needs review); Review (ED-Safe) |
| SC-05 | Describe mode | No dedicated frame — the Describe chip of Viewfinder plus the describe sheet restyled on the same tokens |
| SC-06 | Review (dark, item needs review) | Review (dark, item needs review) |
| SC-07 | Saved | Saved |
| DY-01 | Diary day (sheet, large detent) | Diary day (sheet, large detent) |
| DY-02 | derived (no frame) | — (Table B) |
| DY-03 | Food search (ED-Safe) | Food search (ED-Safe) |
| DY-04 | derived (Custom food has no frame) | — (Table B) |
| DY-05 | Manual log (ED-Safe) | Manual log (ED-Safe) |
| DY-06 | derived (Exercise has no frame) | — (Table B) |
| DY-07 | derived (Water has no frame) | — (Table B) |
| PG-01 | Progress | Progress |
| PG-02 | Progress | Progress (weight trend card) |
| PG-03 | Progress | Progress (weekly energy card) |
| PG-04 | Progress | Progress (badges grid) |
| CH-01 | Coach | Coach |
| PR-01 | Profile | Profile |
| PR-02 | Settings; Quota reached (sheet); Plans / paywall; Cancel flow | Settings; Quota reached (sheet); Plans / paywall; Cancel flow |
| PR-03 | derived (Target edit has no frame) | — (Table B) |
| AU-01 | derived (Ember has no sign-in frame) | — (Table B) |

---

## Table B — screens the design does not show, and the nearest frame to derive from

The `parity.tsv` `derived` rows plus the frames `README.md` names. Each derivation keeps the
behavior, the test sentences and the identifiers of today's screen and takes only tokens and
patterns from the named frame.

| Screen (no frame) | Parity row | Nearest frame to derive from | What it takes |
|---|---|---|---|
| Add food sheet (`AddFoodSheet.tsx`) | DY-02 | Diary day (sheet, large detent) | Sheet chrome, grabber, section rhythm, the dashed tile style; the five quick-action tiles use the icon set of the canvas |
| Custom food sheet (`CustomFoodSheet.tsx`) | DY-04 | Manual log (ED-Safe) | Form rows, the Advanced fold (collapsed + blurred) for nutrition fields, the accent-tint note card |
| Exercise log sheet (`ExerciseLogSheet.tsx`) | DY-06 | Manual log (ED-Safe) | Same rows; "Activity and minutes only. Burned kcal is hidden." under ED-Safe; kcal field returns when off |
| Water log sheet (`WaterLogSheet.tsx`) | DY-07 | Today (light) — the water card | The `--cc-info-tint` droplet tile, the ± 250 ml chip pattern, the sheet chrome of Diary day |
| Target edit sheet (`TargetEditSheet.tsx`) | PR-03 | 4 · Goal weight and pace (+ Profile's Plan group) | The 56 pt fill fields, the engine-clamped pace/card pattern, the caution floor card |
| Sign-in (`SignInScreen.tsx`) | AU-01 | 1 · Welcome | Dark stage, ember eyebrow, primary + ghost buttons, no number gate |
| Editing a food in the diary (README) | — | Review (light) | The grams field + 44 pt steppers + ruler + serving chips, applied to the diary row's edit sheet |
| The export error row (README) | — | Settings | An inline `--cc-error-tint` row under the export row (the frame says "not drawn here") |
| Dark variants of onboarding (README) | — | Today (dark, offline) | `.dark` tokens: `#000` bg, `#1C1A18` cards, `#F7F5F2`/`#ABA6A0` text, unchanged accent |
| Dark variants of billing (README) | — | Plans / paywall + Today (dark, offline) | Ember hero unchanged in dark; option cards on `--cc-elevated #2A2724` with `--cc-separator` borders |
| Medium widget under ED-Safe (implied by the flag) | PL-11/PL-08 | Small widget · ED-Safe | Numbers replaced by "On track" framing; bars and the scan button stay |

---

## The five behaviors the frames need that the app does not have

1. **Server-reported scan stages** — Analyzing and the Live Activity processing card tick real
   stages; the scan API answers in one request and reports none. Backend follow-up; until then the
   client shows only what it observes and runs no timer (U-72).
2. **Haptics** — success on save, selection on the meal segment, light impact on −/+ (handoff
   note 7). Needs `expo-haptics`, a native dependency that is not installed: follow-up with the
   next native unit.
3. **Live billing** — the paywall's store-read prices, Change plan, the in-app cancel sheet,
   Restore and Billing history need StoreKit products, a StoreKit configuration and a purchase
   SDK (none exists; PL-16): store + native follow-up. Until then the paywall renders no sample
   price (D13) and the Settings buttons stay inert.
4. **ED-Safe in the glanceables** — the flag through the App Group snapshot and the Live Activity
   ContentState, plus the accessory families, Dynamic Island presentations and the widget scan
   button: native follow-up (U-78, native slot; expo-widgets coverage on SDK 58 unverified, D14).
5. **A pre-scan entitlement read** — the viewfinder's "2 of 3 free scans left this week" chip and
   the plan-reveal's "Free scans · 3 a week" row need the server's quota state before any scan;
   today the client only learns it from a scan's 402 envelope (which does carry `{tier, scansUsed,
   scanLimit, windowResetAt}` — BE-08 done). Backend follow-up: a read endpoint, or the client
   falls back to the last known entitlement state.
