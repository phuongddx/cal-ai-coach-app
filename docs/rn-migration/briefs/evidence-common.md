# The evidence of a screen on the Simulator (the common brief of every evidence unit)

Owner: CoachCal bot. Every unit that captures a screen of the React Native app next to its Ember
frame follows this brief; the message of the owner adds what is particular to the unit: its rows
(the table in `briefs/evidence-rows.md`), its worktree, its branch, its writable feature, and
which Simulator and Metro port it holds.

Parity: the rows of the unit go from `partial` to `done` only through this evidence.

## The rule of the unit

- One row of evidence for every frame of your table: a screenshot of the app on the Simulator,
  next to its Ember frame, written by the tool. Light, dark, ED-Safe and High Contrast where the
  design has them or your table asks for them.
- The code of the screen is on `main`. You change it only for a difference the evidence shows
  and only inside the writable feature of your unit; a fix gets its test first. Behavior, the
  sentences of the tests and the identifiers stay (rule 22).
- A difference you cannot fix inside your feature (it needs a design component, an endpoint, a
  native module or a decision) is written in its row with the reason. You never hide it by
  cropping, by a private copy of a component, or by a color written as a literal.
- Nothing is drawn that the app has no source for. If the frame shows a number, a card or a claim
  the app cannot back, the row says so.

## The Simulator, the app, the data

- You hold the slot the owner named in your message: one device (found by name through
  `scripts/rn/sim-udid.sh`, or by `SIM_UDID` when the owner names a second device) and one Metro
  port (`METRO_PORT`, 8081 unless the owner names another). No other unit touches them while you
  hold them. You never shut down, erase or install on a device that is not yours: no
  `simctl shutdown all`, no `erase all`.
- The app is the development client built in U-79:
  `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-native/apps/mobile/build-output/CoachCal-dev.app`.
  `bash scripts/rn/check-native-modules.sh` exits 0 on it (standing order 21). No native build.
- The data the frames draw: a wiped store (`--ccFreshStart --ccSeedNoTargets`), then the demo
  persona (`coachcal:///?seed=1`: the target 2150, the water card, the catalog), then the meal
  seed of the Debug console (`coachcal://debug?action=seed`: "Overnight oats" in Breakfast and
  "Chicken rice bowl" in Lunch of today). A fresh install shows onboarding first (flow 01 brings
  the app to the seeded Today). Re-seed between phases so a chip of one phase never leaks into a
  frame that draws none.
- Dark: `xcrun simctl ui <udid> appearance dark`, and `light` after. ED-Safe: a launch with
  `--ccEDSafe`. High Contrast: `xcrun simctl ui <udid> increase_contrast enabled`, and
  `disabled` after; the row says the setting was the one of the Simulator.
- Stop Metro and shut the Simulator down before you report: `lsof -nP -iTCP:<port> -sTCP:LISTEN`
  prints nothing.

## What the harness cannot do (learned on the diary capture of 2026-11-28)

`docs/rn-migration/findings/U-74.md`, section 12, on the branch of PR 37 once it is merged
(otherwise `git show origin/rn/u-74-diary-ember:docs/rn-migration/findings/U-74.md`), holds the
whole list. In short:

- `axe tap --id` never matches: the testIDs of React Native do not reach `AXUniqueId`. Tap by
  accessibility label, or by coordinates taken from a dump. The elements of the topmost sheet come
  last in a dump.
- `axe type` drops characters into a controlled input. Paste instead: `axe clipboard copy --stdin`
  and the Paste callout of the field.
- A tap with y below about 60 is eaten by the status bar: tap near the bottom edge of the element.
- iOS drops an element of a ScrollView that is off-screen from the accessibility tree: scroll
  before you look for it.
- Keep dumps at least one second apart: `axe describe-ui` wedges under tight polling while a sheet
  animates, and then only a reboot of the Simulator clears it.
- Flow 01 can fail loudly on a cold Metro: run it again once.
- A command that can run over a minute writes to a log file in the log directory and gets a long
  timeout (standing order 11). Never pipe a long run through `tail` alone: the output of a run
  that exceeds the timeout of the shell is lost.

## How the evidence is written

- Each row with `node scripts/rn/evidence/side-by-side.mjs` into
  `docs/rn-migration/evidence/ember/<unit>.md`. The screenshots go under
  `docs/rn-migration/evidence/<parity id>/`. Open every screenshot before you commit it; the tool
  refuses one over 700 KB.
- One flow file: `scripts/rn/evidence/flows/ember-<unit>.sh`. A function you need in `lib.sh`
  goes into the findings, not into `lib.sh`.
- `bash scripts/rn/evidence/run-all.sh` ends with `0 failed`.
- **Standing order 23:** `run-all.sh` rewrites the screenshot of every row it covers. After it
  runs, restore every screenshot outside the rows of your unit (`git checkout -- <path>`). Your
  pull request changes no screenshot outside its own rows.

## Scope

Writable, nothing else:

- `docs/rn-migration/evidence/<parity id>/**`, `docs/rn-migration/evidence/ember/<unit>.md`,
  `docs/rn-migration/evidence/transcripts/**`
- `scripts/rn/evidence/flows/ember-<unit>.sh`
- the feature of your unit, as the message of the owner names it (or nothing under `apps/`, when
  the message says evidence only)
- `docs/rn-migration/findings/<unit>.md`, and the parity detail of the unit

Forbidden: everything else. In particular `apps/mobile/src/design/**` (a gap goes into the
findings), any package file, `packages/**`, `apps/api/**`, `docs/design/**` (read only),
`docs/rn-migration/parity.tsv`, `scripts/rn/evidence/lib.sh`.

## Acceptance

- Every row of your table is in the page of the unit, written by the tool, with its screenshot;
  or it is named missing in your report with the reason.
- Every difference is in its row with its reason, and the findings hold the lists "Differences
  fixed in this unit" and "Differences that stay".
- `bash scripts/rn/gate.sh` is green at the repo root on the pushed head (it runs the three gates
  one at a time on the machine).
- The pull request against `main` is open, with your report as its body.
- No screenshot outside your rows differs from `origin/main`.
- Metro is stopped and the Simulator is shut down when you report.

## Timebox

4 hours from the moment the Simulator is yours. On expiry: restore the screenshots of other rows,
push, open the pull request, stop Metro, shut the Simulator down, report partial.

## Deliverable

1. Commits with Conventional Commits, scope `rn`. No AI attribution anywhere: no
   `Co-Authored-By` trailer, no "Generated with" footer, no session link.
2. `git push -u origin <your branch>`, then `gh pr create --base main` with your report as the
   body.
3. Your final message is the report in the format of `standing-orders.md`, plus the pull request
   URL and one line per row of your table: captured, or missing with the reason.

## What the owner does with the pull request

She opens every screenshot against its frame, reads every difference, has the code changes
reviewed by a reader who did not write them, runs the gates on a tree that holds the pull request,
and merges with a merge commit. A row whose screenshot does not show what its line says is
refused.
