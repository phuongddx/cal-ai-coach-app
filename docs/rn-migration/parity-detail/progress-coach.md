# Parity detail — progress and coach (U-40)

Per parity row: each behavior, its Swift source, its TypeScript file, and the Jest case that proves
it. Swift sources under `native/App/Features/Progress/` and `native/App/Features/Coach/`; TypeScript
under `apps/mobile/src/features/progress/`, `apps/mobile/src/features/coach/` (features) and
`apps/mobile/src/app/(tabs)/progress.tsx`, `apps/mobile/src/app/(tabs)/coach.tsx` (routes). Jest
files under `apps/mobile/src/features/progress/__tests__/` and
`apps/mobile/src/features/coach/__tests__/`. The model twins run on a fresh seeded sql.js database
per test with the real repositories, the real snapshot loaders (the localtime day grouping is part
of the behavior) and the real StreakEngine reconcile.

## PG-01 — Progress screen (ProgressFlow)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| The tab stack: title, weight trend, weekly energy, achievements | `ProgressFlow.swift` (body) | `screens/ProgressView.tsx` | `__tests__/ProgressView.test.tsx` › "the stack shows the title and the three sections over the seed" |
| ED-safe hides the weekly-energy card entirely; the rest of the stack stays | `ProgressSnapshotTests.progressEdSafeHidesWeeklyEnergy` (backstop) + `WeeklyEnergyView.swift` (`.edSafeHidden()`) | `screens/WeeklyEnergyView.tsx` (`EdSafeCollapse` wrap; no policy branch in the feature) | `__tests__/ProgressView.test.tsx` › "the weekly-energy card vanishes in the ED-safe mode while the rest stays" |
| Model shape: observed snapshot (target, last-50 weights, week energy, streak, badges, 30-day + 730-day diary day-sets), constructor injection | `ProgressFlow.swift` (ProgressModel + ValueObservation) | `progressModel.ts` + `progressSnapshot.ts` | `__tests__/ChartDescriptor.test.tsx` › "descriptor matches seeded eight point series" (snapshot drives the points); `__tests__/StreakBadgeInsight.test.ts` › "streak reconcile counts beyond the thirty day stats window" (the 730-day window) |
| ENG-01 streak reconcile: StreakEngine over the observed day-set, persisted floor while alive, save on change | `ProgressFlow.swift` (`reconcileStreak`) | `progressModel.ts` (`reconcileStreak`) | `__tests__/StreakBadgeInsight.test.ts` › "seeded streak badges render after reconcile"; "streak reconcile counts beyond the thirty day stats window" |
| Route builds the deps (repos, owner id with the demo fallback, notify, runtime subscribe, clock, ids) | `ProgressFlow.swift` (`.task` construction) | `src/app/(tabs)/progress.tsx` | exercised by construction; the route holds no test (none under src/app) |

## PG-02 — Weight trend chart + weight log (WeightTrendView, WeightLogSheet)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Chart a11y descriptor over the logged series: 1 series, 8 seeded data points, y-range spans the data | `WeightTrendView.swift` (WeightChartDescriptor) | `weightChartDescriptor.ts` (`makeWeightChartDescriptor`, `weightYRange`) | `__tests__/ChartDescriptor.test.tsx` › "descriptor matches seeded eight point series" |
| Log weight re-observes: the write lands and the descriptor updates | `ChartDescriptorTests.testLogWeightReObservesAndDescriptorUpdates` | `progressModel.ts` (`logWeight` + refresh) | `__tests__/ChartDescriptor.test.tsx` › "log weight re-observes and descriptor updates" |
| Untrusted kg input clamps 40–250 and snaps to 0.1 at the model boundary (T-P06-02) | `ProgressFlow.swift` (`clampKg`) | `progressMath.ts` (`clampKg`, `KG_RANGE`, `KG_VALUES`) + `progressModel.ts` | `__tests__/ChartDescriptor.test.tsx` › "weight bounds clamp at model boundary" |
| Current/Goal headers, chart from 2 points, backstop copy below | `WeightTrendView.swift` (body) | `screens/WeightTrendView.tsx` | `__tests__/WeightTrendView.test.tsx` › "the card shows Current/Goal, the trend row and the log button over the seeded series"; "an empty series renders the backstop copy without a chart" |
| Trend direction row: `.1f kg lost · on track` / `.1f kg gained` / holding steady, non-color-only icon | `WeightTrendView.swift` (`trendCopy`) | `screens/WeightTrendView.tsx` (`trendCopy`) | `__tests__/WeightTrendView.test.tsx` › "buckets the three directions"; screen: "the card shows Current/Goal…" (seeded series trends up) |
| Weight log sheet: wheel 40–250 in 0.1 steps, current weight preselected (default 80), Save hands the selection over, Close dismisses | `WeightLogSheet.swift` | `screens/WeightLogSheet.tsx` | `__tests__/WeightLogSheet.test.tsx` › "the sheet shows the heading, the close, the wheel at the current weight and Save"; "a missing current weight starts the wheel at 80 kg"; "an out-of-range current weight starts the wheel clamped"; "Close dismisses without saving"; "Save hands the selection over and dismisses" |
| Log-weight sheet hand-over from the card; the save writes and dismisses | `WeightTrendView.swift` (`.sheet` + `Task { try? … }`) | `screens/WeightTrendView.tsx` (Modal + best-effort save) | `__tests__/WeightTrendView.test.tsx` › "Log weight opens the sheet; saving writes the log and dismisses" |

## PG-03 — Weekly energy (WeeklyEnergyView)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Seven day-labeled bars with value labels ("543" is today's seeded dinner), never color-only | `WeeklyEnergyView.swift` (columns) | `screens/WeeklyEnergyView.tsx` | `__tests__/ChartDescriptor.test.tsx` › "weekly energy labels are present as text" (the Swift case, ported at the same view); `__tests__/WeeklyEnergyView.test.tsx` › "the card shows the seven day columns…" |
| Day-initial captions from the local weekday (veryShortWeekdaySymbols, single letters) | `WeeklyEnergyColumn.dayInitial` | `progressMath.ts` (`dayInitial`, `VERY_SHORT_WEEKDAY_SYMBOLS`) | `__tests__/ChartDescriptor.test.tsx` › "weekly energy labels are present as text" (7 initials checked against `Intl` narrow names) |
| Avg-deficit footer: `−1721 kcal/day` for the seed (2150 − 429), `—` without data | `WeeklyEnergyView.footerText` | `screens/WeeklyEnergyView.tsx` (`footerText`) | `__tests__/ChartDescriptor.test.tsx` › "weekly energy labels are present as text"; `__tests__/WeeklyEnergyView.test.tsx` › "the card shows the seven day columns…" |
| Column a11y label `M: 543 kcal` / `M: not logged` | `WeeklyEnergyColumn.accessibilityLabel` | `screens/WeeklyEnergyView.tsx` (column) | `__tests__/WeeklyEnergyView.test.tsx` › "the card shows the seven day columns…" (today column label) |
| Hidden ENTIRELY while the mode is on; the policy lives in `EdSafeCollapse`, the feature holds no branch (I7) | `WeeklyEnergyView.swift` (`.edSafeHidden()`) | `screens/WeeklyEnergyView.tsx` (`EdSafeCollapse` wrap) | `__tests__/WeeklyEnergyView.test.tsx` › "the whole card renders nothing while the ED-safe mode is on"; `__tests__/ProgressView.test.tsx` › stack-level backstop |

## PG-04 — Achievements (AchievementsView)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Streak hero: 12-day streak, freeze chip "1 freeze left", a11y "12 day streak, 1 freeze left" | `AchievementsView.swift` (CCStreakCard mount) | `screens/AchievementsView.tsx` (`StreakCard`) | `__tests__/AchievementsView.test.tsx` › "the streak hero, the badge grids and the progress-photos row render from the seed" |
| Hero title: "Personal best: N days", or "Day 1 streak started!" from current == 1 | `AchievementsView.streakTitle` | `screens/AchievementsView.tsx` (`streakTitle`) | `__tests__/StreakBadgeInsight.test.ts` › "seeded streak badges render after reconcile" (both sentences) |
| Earned grid (3 seeded) before locked grid (2), Swift order, 3-column wrap | `AchievementsView.swift` (badgeGrid) | `screens/AchievementsView.tsx` (`BadgeGrid`) | `__tests__/AchievementsView.test.tsx` › "the streak hero…" (tile testIDs in order) |
| Locked tiles: "N days left" detail (target − progress, floored) and the locked a11y copy | `AchievementsView.lockedDaysLeft` | `screens/AchievementsView.tsx` (`lockedDaysLeft`) | `__tests__/StreakBadgeInsight.test.ts` › "seeded streak badges render after reconcile" (30-Day → 18); `__tests__/AchievementsView.test.tsx` › screen labels |
| Badge emoji per code (first-scan 📸, streak-7/30 🔥, water-habit 💧, scans-50 🎯, default 🏅) | `AchievementsView.emoji` | `screens/AchievementsView.tsx` (`badgeEmoji`) | `__tests__/AchievementsView.test.tsx` › exercised through the tile labels (the emoji renders in each tile) |
| Disabled progress-photos row: "Progress photos" / "Coming later", opacity 0.5, a11y "Progress photos, coming later" | `AchievementsView.progressPhotosRow` | `screens/AchievementsView.tsx` (`ProgressPhotosRow`) | `__tests__/AchievementsView.test.tsx` › "the streak hero…"; "a model without streak state or badges renders only the progress-photos row" |

## CH-01 — Coach screen (CoachFlow, CoachView, WeeklyReviewCard)

| Behavior | Swift source | TypeScript | Jest case |
|---|---|---|---|
| Weekly stats from the fixtures: daysLogged 7, daysOnTarget derived, weeksAllLogged 1, kgThisWeek, targetKcal 2150 | `CoachFlow.swift` (ValueObservation) | `coachModel.ts` + `coachSnapshot.ts` | `__tests__/StreakBadgeInsight.test.ts` › "weekly review stats match diary and weight fixtures" (independent raw-SQL derivation) |
| Insights render only from seeded data, newest first, three tips (COA2-01 v2) | `CoachFlow.refreshInsights` | `coachModel.ts` (`refresh` → `engagement.insights`) | `__tests__/StreakBadgeInsight.test.ts` › "seeded insights render three daily tips" |
| Greeting buckets: <12 morning, <17 afternoon, else evening; zone injectable (test pins UTC) | `CoachModel.greeting` | `coachModel.ts` (`greeting`) | `__tests__/StreakBadgeInsight.test.ts` › "greeting buckets under fixed clocks" |
| Screen: greeting, "Today's insights" + InsightCards, weekly review card, locked trust copy | `CoachView.swift` | `screens/CoachView.tsx` | `__tests__/CoachView.test.tsx` › "the coach shows the greeting, the seeded insights, the weekly review and the trust copy"; "a model without insights renders no insights header" |
| ED-safe stat swap on the review card ("Weeks with all meals logged" replaces "% on target"/"kg this week"); the branch lives in the DS component (GATE-1) | `WeeklyReviewCard.swift` + CCWeeklyReviewStats | `screens/WeeklyReviewCard.tsx` (no policy branch) + DS `WeeklyReviewStats` | `__tests__/StreakBadgeInsight.test.ts` › "ED-safe swaps kcal-derived stats for weeks stat"; `__tests__/CoachView.test.tsx` › "the ED-safe mode swaps the kcal-derived stats…" |
| Encouragement: full-week copy vs "N of 7 days" habit framing | `WeeklyReviewCard.encouragement` | `screens/WeeklyReviewCard.tsx` (`encouragement`) | `__tests__/StreakBadgeInsight.test.ts` › "weekly review stats match diary and weight fixtures"; `__tests__/CoachView.test.tsx` › "a model without insights…" |
| Trust copy rendered permanently, never conditional (T-P06-01); local rules only, no network call | `CoachView.swift` (banner) | `screens/CoachView.tsx` | `__tests__/CoachView.test.tsx` › "the coach shows the greeting…" (verbatim text) |
| Route builds the deps and passes the greeting | `CoachFlow.swift` (`.task` construction) | `src/app/(tabs)/coach.tsx` | exercised by construction; the route holds no test (none under src/app) |

## Accessibility identifier inventory

Every `accessibilityIdentifier` of the Swift Progress/Coach views is the `testID` of the same
element (same string). The Swift sources of these two flows declare exactly three; the DS
components they mount keep their own DS identifiers (see `parity-detail/design.md`).

| Swift identifier | Element | RN home |
|---|---|---|
| `progress.logWeight` | Log weight button (WeightTrendView) | `screens/WeightTrendView.tsx` wrapper View around `PrimaryButton` |
| `progress.closeWeightSheet` | weight sheet close (WeightLogSheet) | `screens/WeightLogSheet.tsx` Pressable |
| `progress.saveWeight` | weight sheet save (WeightLogSheet) | `screens/WeightLogSheet.tsx` wrapper View around `PrimaryButton` |

Adaptation: as in the diary feature, the DS `PrimaryButton` receives the feature identifier through
a wrapper View carrying the same string (`progress.logWeight`, `progress.saveWeight`). The Swift
WeightLogSheet wheel, the weekly-energy columns and the achievements views carry no identifiers —
their a11y labels port instead (wheel value, `M: 543 kcal`, streak/badge/photos labels).

## U-75 identifier changes (Ember restyle, 2026-11-27)

Added, with the reason:

| Identifier | Element | Reason |
|---|---|---|
| `progress.range` | the range Segment (Week / Month / 3M / Year) | U-75 new behavior (frame 11) |
| `progress.range.<week\|month\|3m\|year>` | the Segment's options | the DS Segment's per-option testID convention |
| `coach.seeDays.<kind>` | the "See the days" action row of an insight card | U-75 new behavior (frame 12); `<kind>` is the seeded insight kind (streak, protein render with the seed; hydration holds no days and shows no row) |
| `coach.dayList` | the expanded local day list under the card | U-75 new behavior (frame 12) |

Removed: none. Every identifier of U-40 survives with the same string. Placement moves, same
string: `chart-card` now rides on the feature chart root (`screens/WeightChart.tsx`) and
`badge-tile:<name>` on the feature badge tiles (`screens/AchievementsView.tsx`) — both because the
design-system components (`ChartCard`, `BadgeTile`) lack the Ember shape and `src/design` is
read-only for this unit (findings U-75, "Needs a design component"). `progress.logWeight`,
`progress.saveWeight`, `progress.closeWeightSheet`, `streak-card`, `weekly-review-stats`,
`weekly-stat:<id>` and `insight-card:<variant>` are unchanged on their DS components or wrapper
Views.
