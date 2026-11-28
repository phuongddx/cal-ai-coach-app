# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 13:55

`main` is `7f10adf`. Landed today: PR 53, 55, 54, 50, 42, 47, 56, 43, 36, 57, 59, 39.

| Unit | Worker (thread) | State | Next |
|---|---|---|---|
| U-74e diary evidence | Worker-S2 (44b9402a) | running on the Simulator | when its pull request opens: open every screenshot, read every row, check rule 23; after PR 37 merges it captures again the rows the four fixes change |
| U-82 gates on GitHub Actions | Worker-G1 (73e61e95) | fixing three should-fixes; the iOS job queued on GitHub | when its run is green with artifacts: review done (PASS+NOTES), merge; from then a merge takes its verdict from GitHub Actions |
| U-74 correction (PR 37) | Worker-G2 (8f3ad0f1) | running: the evidence leaves the branch, the four fixes, the three fixes found on the device stay | the full gate on a tree with it and a re-read; merge; then the lines below |
| U-70 Swift cleanup | Worker-S1 (10185721) | starting from main 7f10adf | review, gate, merge LAST after the tag |
| U-83 two evidence sessions | nobody | brief ready | after U-74e reports: the Simulator between two units (Worker-G2 after PR 37, or another) |
| U-76e, U-73e, U-75e, U-77e, U-72e, U-77ce | nobody | rows written (briefs/evidence-rows.md) | one at a time on the Simulator, two at a time after U-83 |

## The lines the owner writes into threads

- To Worker-S1 (10185721 or its scan thread) when PR 37 is merged: "PR 37 is on main: do item 4
  of U-72b (the picker)" — a new branch from main, since PR 39 is merged.
- To Worker-S2 (44b9402a) when PR 37 is merged: "PR 37 is on main with the four fixes: merge
  origin/main in rn-u-74e and capture again the delete confirm (three rows and High Contrast),
  the two undo toasts, and the Delete of the edit sheet; then push and open the pull request."
- To Worker-G1 (73e61e95) when the pull request of U-82 is merged: its next unit (an evidence
  unit, once the Simulator is free).

## The order to the end

1. PR 37 merged (diary code) → U-74e evidence merged.
2. PR 58 merged (gates on GitHub Actions) → merges take their verdict from GitHub.
3. U-83 (two Simulators) → the six evidence units, two at a time.
4. Every parity row with its evidence → `done`.
5. The tag `archive/swiftui-final` on main, then the pull request of U-70 merged last.
6. `docs/rn-migration/report.md` in Vietnamese: the six sections, the list of design deviations,
   what Phương does himself (Icon Composer, the support address, the products of the App Store,
   the promise about training models, the pages of Terms and Privacy).

## For the next owner pull request

- The parity rows of PR 39 (SC-01 to SC-07: partial with the evidence of the merge) and of PR 57.
- An owner pull request that adds a script runs the full gate on its tree before the merge.
- The follow-ups for the final report: the undo of a save that fails in the scan (nothing shown);
  whole centimetres for a decimal height; `purchaseSelected` without a catch in the paywall shell;
  the paragraph on testIDs in the parity detail of sign-in; the label "Report sent" in the parity
  detail of the scan.
