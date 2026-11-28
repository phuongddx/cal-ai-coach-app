# Review of PR 58, unit U-82, the delta after 3556ec0 (head 434791f)

The verdict of the independent re-read, as the reviewer wrote it. The reviewer did not write the
files and read only, in the integration worktree `rn-integrate-2` (main `5bf273d` with PR 37 and
PR 58 merged, head `3b57b4b`), with read-only `gh` commands. Gate `w6c` on the tree of main with
PR 58 alone (`db39ee13c906`): 1,648 tests with PostgreSQL 17, 0 sql-skip, typecheck 0, parity 0,
both smokes, the sync script. The run 46136718293 on `434791f` was still in its step of the flows
when the owner acted; the run evidence of the findings is the log of 46132732255 (at `82b7987`),
the last completed run, which failed on the meal the flows wait for.

## Findings

1. must-fix | A | `.maestro/03-today-tabs-diary-sheet.yaml:35` | Should-fix 1 did not land: the delta 3556ec0..434791f left this line untouched. The flow waits 20 s for "Today's insights" after tapping the Coach tab; nothing in `apps/mobile/src` renders it (only the Swift app, `native/App/Features/Coach/CoachView.swift:16`). The RN screen renders the title "Coach" (`apps/mobile/src/features/coach/screens/CoachView.tsx:71`) and the header "Insights" (`:78`). The step cannot pass. Wait for "Insights" (present on the seeded persona, three insights seeded at `apps/mobile/src/data/repos/seedDataManager.ts:321-338`) or for the title "Coach".
2. must-fix | A | `.maestro/03-today-tabs-diary-sheet.yaml:41` | Should-fix 2 did not land. "Goals & targets" is nowhere in `apps/mobile/src` outside two comments; Profile renders "Plan" (`apps/mobile/src/features/profile/ProfileView.tsx:123`) and "App" (`:169`). Wait for "Plan". The header comment at `:3-6` repeats both wrong strings and should change with them.
3. must-fix | C, A | `.maestro/02-seed-persona.yaml:23`, `03-today-tabs-diary-sheet.yaml:20,24,47`, `05-edsafe-today.yaml:14,17,19` | Commit 434791f switched the seed from `coachcal://debug?action=seed` to `coachcal:///?seed=1` but kept the old meal's name. `?seed=1` runs `ensureSeeded()` (`apps/mobile/src/app/(tabs)/index.tsx:77-80`), which writes 'Chicken Rice Bowl' five days back (`seedDataManager.ts:77`, date at `:147`) and only 'Spaghetti Bolognese' today (`:82`). Today lists one local day (`apps/mobile/src/features/today/todayReaders.ts:25-38`), so "Chicken rice bowl" is never on screen. The app's own test says so: `apps/mobile/src/features/today/__tests__/TodayScreen.test.tsx:89-105`. "Chicken rice bowl" (sentence case) is the debug seed action's fixture (`apps/mobile/src/data/sync/spikeActions.ts:49`), which flow 02 no longer calls. The evidence harness the commit cites waits for "Spaghetti Bolognese" (`scripts/rn/evidence/flows/01-first-launch.sh:27-28`). Flows 02, 03 and 05 all stop here. Use "Spaghetti Bolognese" and `food-row-kcal:Spaghetti Bolognese`.
4. must-fix | A | `.maestro/04-scan-fixture-recompute.yaml:28` | The flow waits 30 s for "Scan Food" after `coachcal://scan`. The capture screen in this tree has no title; its mode chips are Food, Barcode, Label, Describe (`apps/mobile/src/features/scan/CaptureViewfinderView.tsx:44-49`). The string existed only in the PR's base tree (`434791f:apps/mobile/src/features/scan/CaptureViewfinderView.tsx:30`). The flow never reaches the shutter. Wait for the id `scan.shutter` or the guidance title at `CaptureViewfinderView.tsx:163`.
5. must-fix | A, B | `.maestro/04-scan-fixture-recompute.yaml:39-44` | The three taps address `ccstepper.increment`, which the review no longer renders. It mounts `GramsField` (`apps/mobile/src/features/scan/ReviewSheetView.tsx:250`), whose plus button is `scan.grams.<id>.increment` (`apps/mobile/src/design/components/GramsField.tsx:104`), here `scan.grams.0.increment`. `ccstepper.increment` belongs to the old `Stepper` (`Stepper.tsx:56`), used only by diary sheets. The first tap fails and lines 45-46 are never reached. Tap `scan.grams.0.increment`, as the Jest twin does (`apps/mobile/src/features/scan/scanScreens.test.tsx:136`).
6. should-fix | A | `.maestro/05-edsafe-today.yaml:18-19` | `assertNotVisible: id: "food-row-kcal:Chicken rice bowl"` passes empty once finding 3 is fixed on lines 14-17 alone: no row of that title exists in either mode, so the assertion would hold even if ED-safe broke. The FoodRow kcal node is `apps/mobile/src/design/components/FoodRow.tsx:88-96`. Assert on `food-row-kcal:Spaghetti Bolognese`, with flow 03 `:23-24` as its non-ED-safe counterpart (`TodayScreen.test.tsx:100,105`).
7. should-fix | H | `docs/rn-migration/findings/U-82.md:28-38,64-72,88-90` | Claims the tree or the runs contradict: `:28,:30` "four flows" (five exist); `:31-32` flow 01 seeds via `debug?action=seed` (flow 01 stops at `:21-22`, flow 02 seeds via `?seed=1` at `02:18`); `:33,:69-72` the accessibility tree carries "Today's insights" and "Goals & targets" (findings 1, 2); `:34-36,:64-68` the plus button is `ccstepper.increment` (finding 5); `:90` "the RN iOS run green with artifacts" (in the last 15 runs RN iOS has 5 failures, 2 cancelled, 1 in progress and no success). Rewrite against the tree once the flows pass.
8. note | I | `.github/workflows/rn-ios.yml:95-108` | Flows 01, 02 and 03 share one step. A failure in the first hides the result of the others and skips steps 14 and 15; in all four runs that reached this step it failed there, so flows 04 and 05 have never run on GitHub. One flow per step would give an answer per flow.
9. note | H | `docs/rn-migration/findings/U-82.md:19,41-43`, `.github/workflows/rn-ci.yml:48,108-109` | Both cite `scripts/rn/owner/gate-integrate.sh` as the source of the 120 s flag and the `[sql-skip]` rule. That file is not on `origin/main` (`git cat-file -e` → no). Main's gate is `scripts/rn/gate.sh` (steps `test typecheck parity:check`, neither rule in it).
10. note | G | `scripts/rn/ci/start-api.sh:16-18` | Still stale, from the earlier review: the comment says the workflow sets `RN_API_ENV_FILE` at job level; it is set per step (`rn-ci.yml:98,103,122,127,136`). The line moved from 25 to 17.
11. note | E | `.github/workflows/rn-ios.yml:89`, `:34,:40,:136` | Maestro is still unpinned (`curl … | bash`; the runner got 2.13.0). The three actions are pinned by major tag, and the runner logs that `checkout@v4` and `setup-node@v4` target Node 20.
12. note | I | `.github/workflows/rn-ios.yml:8-11` | No path filter: every pull request to main, including a docs-only one, starts a macOS job of 43 minutes or more (46132732255). Adding `paths-ignore` to a required check has its own trap (a skipped check stays "Expected"), so this is a decision, not a fix.
13. note | A | `.maestro/03-today-tabs-diary-sheet.yaml:28-30` | The wait for "Progress" after tapping the tab is satisfied by the tab label itself (`apps/mobile/src/app/(tabs)/_layout.tsx:22`), so it cannot detect that the tab did not switch. The screen title also exists (`apps/mobile/src/features/progress/screens/ProgressView.tsx:40`).
14. note | G | commit `3556ec0` | Its subject is git's default `Revert "ci(ci): …"`, not the `type(scope): summary` form; harmless if the PR is squashed.

## Verified

**A. The three should-fixes and the strings**

- Should-fix 1: not landed (finding 1). Should-fix 2: not landed (finding 2). Should-fix 3: landed. `rn-ios.yml:92` exports the path before `maestro --version` at `:93`; `GITHUB_PATH` is still written at `:90`. Run 46117846102 (before, 48dcf84) failed at step 12 "Install Maestro"; runs 46122777804, 46128027791 and 46132732255 pass step 12, and the last printed `2.13.0`.
- Of the identifiers the earlier review listed: `scan.shutter` exists (`CaptureViewfinderView.tsx:203`); the stepper increment does not exist on the review (finding 5); the food-row kcal id exists as a pattern (`FoodRow.tsx:91`) but is tied to a title the seeded Today does not have (finding 3).

| Flow:line | Waits for or taps | Rendered by (this checkout) | Result |
|---|---|---|---|
| 01:15, 02:12, 02:20, 03:14, 03:52, 03:60, 04:17, 04:25, 05:11 | tap `^Open$`, optional | system alert, not the app | ok (see D) |
| 01:19 | "Track calories with a photo" | `apps/mobile/src/features/onboarding/ValueHeroScreen.tsx:47` | ok; seen in run 46132732255 |
| 01:21 | "Get started" | `ValueHeroScreen.tsx:61` | ok; same run |
| 02:15, 03:17, 04:20 | "Today" | tab label `apps/mobile/src/app/(tabs)/_layout.tsx:18`; header `apps/mobile/src/features/today/TodayView.tsx:184` | ok |
| 02:23, 03:20, 03:47, 05:14, 05:17 | "Chicken rice bowl" | nothing after `?seed=1` (`seedDataManager.ts:77,82,147`) | not rendered |
| 03:24, 05:19 | id `food-row-kcal:Chicken rice bowl` | pattern `FoodRow.tsx:91`; no row of that title | not on screen |
| 03:27, 03:29 | tap and visible "Progress" | `_layout.tsx:22`; `ProgressView.tsx:40` | ok |
| 03:33 | tap "Coach" | `_layout.tsx:26` | ok |
| 03:35 | "Today's insights" | nothing; `CoachView.tsx:78` is "Insights" | not rendered |
| 03:39 | tap "Profile" | `_layout.tsx:30` | ok |
| 03:41 | "Goals & targets" | nothing; `ProfileView.tsx:123` is "Plan", `:169` "App" | not rendered |
| 03:45 | tap "Today" | `_layout.tsx:18` | ok |
| 03:55 | "Breakfast" | `apps/mobile/src/features/diary/screens/DiaryDayView.tsx:195` via `apps/mobile/src/features/diary/diaryMath.ts:28-30`; every slot is a section (`diarySnapshot.ts:105`) | ok |
| 04:28 | "Scan Food" | nothing; `CaptureViewfinderView.tsx:44-49` | not rendered |
| 04:32 | id `scan.shutter` | `CaptureViewfinderView.tsx:203` | ok |
| 04:34 | "Review" | `ReviewSheetView.tsx:60` | ok |
| 04:36, 04:46 | "464 kcal" | `ReviewSheetView.tsx:218-220` | ok once reached |
| 04:40, 04:42, 04:44 | id `ccstepper.increment` | not on the review; `GramsField.tsx:104` | not on screen |
| 04:45 | "508 kcal" | `ReviewSheetView.tsx:218-220` | ok once reached |

Run evidence that the failures are real: the step-13 log of 46132732255 (the last completed run, at 82b7987) shows flow 01's two onboarding assertions `COMPLETED`, then `Assert that "Chicken rice bowl" is visible... FAILED`. Run 46128027791 (5e614fd) died earlier, on "Track calories with a photo" with the dialog undismissed, which confirms the dialog fix did what it meant to.

**B. The test that must stay**

Lines of `.maestro/04-scan-fixture-recompute.yaml`:

```
36:- assertVisible: "464 kcal"
39:- tapOn:
40:    id: "ccstepper.increment"
41:- tapOn:
42:    id: "ccstepper.increment"
43:- tapOn:
44:    id: "ccstepper.increment"
45:- assertVisible: "508 kcal"
46:- assertNotVisible: "464 kcal"
```

It can fail, and today it does: at line 28 first, then at line 39. With those two corrected the assertions are real and cannot pass empty. The golden 200 is one item at 320 g and 145 kcal/100 g (`packages/api-contract/golden/scan-response-200.golden.json`). The step is 10 g (`GramsField.tsx:45`). `Math.round(145 × 350 / 100)` is 508 (`packages/core/src/kcal.ts:10-11`). Both strings are compared against the single item line (`ReviewSheetView.tsx:218-220`); the total is two separate text nodes (`:102-105`) and matches neither. The Jest twin asserts the same 464 → 508 (`scanScreens.test.tsx:131-141`). Nothing between 3556ec0 and 434791f weakened lines 36 or 45-46.

**C. The seeding**

- `--ccSeedNoTargets`: parsed by exact name (`apps/mobile/src/debug/launchArgs.ts:72`); applied at launch (`apps/mobile/src/platform/launchSequence.ts:63-64`); returned as `onboardingPending` (`:84`); the gate opens the shell on `state.hasTargets || state.onboardingPending` (`apps/mobile/src/platform/rootGate.ts:30`).
- `?seed=1`: `useLocalSearchParams` (`apps/mobile/src/app/(tabs)/index.tsx:54-55`), then `ensureSeeded()` under `__DEV__` (`:77-80`). One target is written (`seedDataManager.ts:123-144`), so a later plain launch opens the shell on the target.
- Launch arguments go through `xcrun simctl launch` (`rn-ios.yml:105,114,121`). `launchApp` is used only without arguments (flow 01 `:8-10`, flow 03 `:10-11`); no flow passes `launchApp.arguments`.
- Order per flow, all right:
  - 01: no terminate needed; the flow's `launchApp` with `clearState` starts the freshly installed app.
  - 02: terminate, `simctl launch --ccSeedNoTargets`, then a flow with no `launchApp`, so the process keeps its arguments.
  - 03: runs right after 02; its own `launchApp` relaunches without arguments, which is intended.
  - 04 and 05: terminate, launch with the argument, then a flow with no `launchApp`.
- The seeding mechanism is right; only the string it waits for is wrong (finding 3).

**D. The dialog**

- Nine `openLink` commands, nine taps, each immediately after its link: 01:11→14; 02:10→11, 02:18→19; 03:12→13, 03:50→51, 03:58→59; 04:15→16, 04:23→24; 05:9→10.
- The map form is valid: the log of 46132732255 prints `Tap on (Optional) "^Open$"... COMPLETED`.
- `^Open$` is anchored at both ends, so it needs an element whose whole text is "Open". The app's similar labels are "Open diary" (`TodayView.tsx:199`) and "Open Settings" (`CaptureViewfinderView.tsx:271`), neither an exact match.

**E. Maestro**

- Version check by path in the same step: `rn-ios.yml:92-93` (run-proven, see A).
- Driver timeout: `MAESTRO_DRIVER_STARTUP_TIMEOUT: '300000'` at job level (`rn-ios.yml:31`), so every step's `maestro` process inherits it; the step-13 `env:` block of run 46132732255 lists it. Run 46122777804 (before, 47e5bfd) died with "iOS driver not ready in time … MAESTRO_DRIVER_STARTUP_TIMEOUT"; run 46128027791 (after) started the driver and ran flow 01.

**F. The prebuild**

`--platform` exists and `--no-open` does not in the installed `@expo/cli` 58.1.22 (`node_modules/@expo/cli/build/src/prebuild/index.js:28-45`: `-p, --platform <all|android|ios>`). I read the source instead of running the command. Run evidence: run 46116842300 (before, 518c3dd) failed at the prebuild step in one second; the step passed in 46117846102, 46122777804, 46128027791, 46132732255 and in 46136718293.

**G. Unchanged and still true**

- No developer path, no secret: `git grep` over the twelve files for `/Users/`, `/home/`, `ddphuong`, `.worktrees`, key patterns → nothing. The only passwords are throwaways for the job's own container (`rn-ci.yml:67`, `scripts/rn/ci/start-api.sh:30-33`); the three API secrets come from `openssl rand -hex 32` (`start-api.sh:72-74`).
- No `continue-on-error`. `if:` appears three times only: `rn-ci.yml:134` (stop the API), `rn-ios.yml:125` (collect), `rn-ios.yml:135` (upload), all `always()`. No gate step sits behind an `if`.
- Artifact upload: `rn-ios.yml:134-140`, `if: always()`, `if-no-files-found: warn`.
- `[sql-skip]` guard: `rn-ci.yml:110-118` exits 1 when the count is above 0, behind `set -o pipefail` (`:105`). Proven both ways: red proof 46116311476 printed `[sql-skip] lines: 24` and failed at that step with npm test green (API workspace 10 suites and 145 tests skipped); green 46136718260 printed `[sql-skip] lines: 0` with API 22 suites / 252 tests passed.
- Triggers: `rn-ios.yml:8-11` (`pull_request` on `main`, `workflow_dispatch`), concurrency with cancel-in-progress at `:13-16`; `rn-ci.yml:8-20`.
- Commits: 12, author and committer `PhuongDoan <95doanphuong@gmail.com>`, bodies empty except the revert's "This reverts commit …". No AI author or co-author trailer. Types: ten `ci(ci)`, one `docs(rn)`, the revert (note 14). The sabotage commit and its revert net to zero (`git diff --stat c3bd934 3556ec0` equals 6347b88's own diff).
- No package file changed: `git diff --name-only origin/main...434791f` lists 12 files. They are the unit's files, with one difference from the brief: two under `.github/workflows` (`rn-ci.yml` modified, `rn-ios.yml` added), not three; `ci.yml` is not in the diff.
- I could not read the pull request body.

**H. The findings document**

- True: the integration job's description (`U-82.md:8-20` ↔ `rn-ci.yml:55-137`, `start-api.sh:57-87`); pitfall 3 (`PG_BIN`, `smoke-scan.sh:17,37`); pitfall 6 (`.gitignore:40`); the red proof (`:83-87` ↔ run 46116311476); the green integration job (`:88-89` ↔ 46136718260: five `ok` lines per smoke, six sync steps, "all curl steps green"); `ci.yml` untouched with its path filters (`:39-40`).
- Pitfall 1, Maestro half: the tree agrees (parser at `launchArgs.ts:54-63`, simctl launches, flows that only `openLink`). The Maestro behaviour itself is a citation I did not check.
- Contradicted: `:28-38`, `:64-72`, `:90` (finding 7); `:19,41-43` (note 9).
- Tests: the command at `rn-ci.yml:50` is as documented; the 15 s default is `apps/mobile/jest.config.js:10`. `todayScreenSnapshotMatrix` is one Jest test with four states in a loop (`TodayScreen.test.tsx:76-83`), so "(4 passed)" is four states, one test.
- Device, runtime, build time: the document names none of them. It says only "an available iPhone on the newest iOS runtime … no pinned name" (`:24-26`) and "90-minute timeout" (`:21`). The logs give "Running on iPhone Air - iOS 26.5". The build step took 24:49 (46117846102), 29:57 (46122777804), 35:27 (46128027791), 30:04 (46132732255); the whole job 43:09 in 46132732255, ending in failure.

**I. Regret risks and PR 61**

- A job that passes while a suite did not run: none found in `rn-ci.yml`. All four workspaces have a `test` script, so `--if-present` skips nothing today. `smoke-scan.sh` and `e2e-sync.sh` assert and exit non-zero. In `rn-ios.yml` the problem is the opposite: it cannot pass.
- An API-only pull request: not skipped. `apps/api/**` is not in `paths-ignore` (`rn-ci.yml:11-19`), and `rn-ios.yml` has no path filter.
- PR 61: I read `origin/rn/u-70-swift-cleanup` from the local refs, without fetching; I assume it is PR 61. Its `rn-ci.yml` hunk edits the header comment (lines 4-6) and removes the two `native/**` lines (12, 17). PR 58's hunks edit the Test step (48-50) and append the integration job after line 53. They do not touch the same lines. It touches none of PR 58's other files. It also deletes `release-ipa.yml`, not only `ci.yml`.
- Run 46136718293, read once: `in_progress`, in step 7 "Build the app for the Simulator" (started 10:49:30Z), prebuild passed in 2 min 29 s.

## Not checked

- The end of run 46136718293 (not waited for).
- The pull request body.
- Whether `origin/rn/u-70-swift-cleanup` is PR 61 and is current.
- Maestro's documented behaviour: how `text` matches (whole, partial, case), what `launchApp.arguments` does on iOS, how long an optional tap waits for a late dialog.
- Whether Maestro can tap the native tab bar by label. The evidence harness records that `axe tap --label` does not register there (`scripts/rn/evidence/flows/02-tabs.sh:4-5`).
- Whether the increment buttons are reachable inside the `accessible` row of `GramsField` (`GramsField.tsx:66-72`).
- Whether the dev launcher or the system has another element with the exact text "Open".
- Whether `secrets` is allowed in job-level `env` (pitfall 2's list).
- I ran no test or build and did not run `npx expo prebuild --help`.

## Verdict

FAIL — on the tree this pull request is gated against, flows 02 to 05 each wait for or tap something the app does not render (findings 1 to 5), so the RN iOS workflow cannot pass and has never passed on this branch; merged as the gate of later merges it would turn every pull request red, while the RN CI half is green and its skip guard is proven.

## What the owner did

- PR 58 is not merged at this head. Its proven half (`.github/workflows/rn-ci.yml` and
  `scripts/rn/ci/`, byte for byte those of `434791f`) went into PR 65, an owner pull request gated
  alone on its tree, so that merges take their verdict from GitHub Actions while the iOS workflow
  is corrected; the re-read's part G and H cover exactly those bytes and the run 46136718260.
- The five must-fixes and should-fix 6 went back to the author for the iOS half (PR 58 after a
  merge of main): the strings the flows wait for, the name of the seeded meal, the two identifiers
  of the scan flow. Note 8 (one flow per step) went along as required: a run must give an answer
  per flow. Notes 10 to 14 stay for the author and the final report.
- The stale comments of note 9 and note 10 are left as they are in PR 65 on purpose: the five
  files stay byte for byte those of PR 58, so that its merge of main is clean.
