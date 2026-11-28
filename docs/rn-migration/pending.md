# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 18:30

`main` is `5bf273d`. Open: PR 37 (diary, gated), PR 58 (gates on GitHub Actions, gated), PR 62
(diary evidence, waits for the re-capture), PR 61 (Swift cleanup, reviewed, merges LAST).

| Unit | Worker (thread) | State | Next |
|---|---|---|---|
| PR 37 (U-74) | Worker-G2 (8f3ad0f1, closed) | gate `w6a` green on tree `82ca97c49a98`; the re-read of the correction delta runs | merge with the tree check; then the two lines below |
| PR 58 (U-82) | Worker-G1 (2f0bc688) | gate `w6b` green on the tree with PR 37 (`64ee5cc8d5fd`); GitHub integration job green; iOS run 46136718293 in flight; the re-read of the delta runs | when the iOS run is green with artifacts and the re-read is in: merge after PR 37 with the tree check |
| U-84 views under the React Compiler | Worker-S2 (71e63cba) | running: PR A (the day sheet reads its snapshot) then PR B (the other views, a guard) | gate + review + merge of A; then S2 gets the diary re-capture with the Simulator |
| U-82b evidence harness on a GitHub runner | Worker-G1 (2f0bc688) | queued behind the end of the iOS run of PR 58 | when its three runs are green: gate + review + merge |
| U-76e Today evidence | Worker-G2 | assigned (brief changed: worker and timebox of 3 hours) | dispatch with the Simulator and port 8081 once PR 37 is on main |
| item 4 of U-72b (the picker) | Worker-S1 (994c6d28, closed) | waits for the line "PR 37 is on main" | new worktree `rn-u-72c` from the new main; a new branch |
| PR 61 (U-70) | Worker-S1 (10185721, closed) | reviewed on `5e60510`: PASS+NOTES, seven should-fixes (reviews/U-70-PR-61.md) | the correction goes to S1 after item 4 was sent; the last merge of main and the tag right before the merge |
| U-83 | nobody | dropped (replaced by U-82b) | - |
| U-73e, U-75e, U-77e, U-72e, U-77ce | nobody | rows written (briefs/evidence-rows.md) | after U-82b is merged: on GitHub runners, in parallel; otherwise on the Simulator, one at a time |
| U-78 widgets and Live Activity, U-80 the icon, U-50 telemetry, U-24 the spike files | nobody | not briefed yet (closing plan steps 10 and 11) | S1 after item 4; the native verification goes through the iOS workflow of PR 58 on GitHub |

## Could not be sent at 18:40: the agents server answered "unauthorized" to every call

- **To Worker-G1 (thread 73e61e95, rework)**: the correction of the iOS half of PR 58 (the five
  must-fixes and should-fix 6 of `reviews/U-82-PR-58-reread.md`: the strings "Today's insights" and
  "Goals & targets", the name of the seeded meal "Spaghetti Bolognese", "Scan Food" replaced by
  `scan.shutter`, `ccstepper.increment` replaced by `scan.grams.0.increment`, the ED-Safe assertion
  on the row that exists; one flow per step in `rn-ios.yml` (note 8); the findings rewritten
  (must-fix 7); the table of every string of the five flows with the file and line that renders it;
  a merge of `origin/main` once PR 65 is merged). Verdict from the checks of GitHub. Timebox 90
  minutes, before the rest of U-82b.
- The PR 61 correction (thread 10185721, receipt bc57cd08) and U-76e (thread 1c13f27f, receipt
  6b3186c4) were accepted by the server before it failed; the rework of PR 37 (receipt ab096fef)
  too.

## The lines the owner writes into threads

- To Worker-S1 (994c6d28) once PR 37 is merged: "PR 37 is on main: do item 4 of U-72b (the
  picker)" with the worktree `rn-u-72c` and a branch from the new main.
- To Worker-S1 (10185721) after that line was sent: the correction of PR 61 (the seven
  should-fixes and the notes of reviews/U-70-PR-61.md), a first pass now, the last merge of main
  and the lines for `rn-ios.yml` right before the tag.
- To Worker-G2 once PR 37 is merged: U-76e, with the Simulator and port 8081, three hours.
- To Worker-S2 once PR A of U-84 is merged: the re-capture of the diary rows (the delete confirm
  ×3 and High Contrast, the two undo toasts, the Delete of the edit sheet), `run-all.sh` at
  `0 failed`, when the Simulator is free.

## The order to the end

1. PR 37 merged (diary code) → U-84 A merged → the diary evidence (PR 62) re-captured and merged.
2. PR 58 merged (gates on GitHub Actions) → merges take their verdict from GitHub.
3. U-82b merged (evidence on GitHub runners) → the six evidence units, in parallel on GitHub.
4. Every parity row with its evidence → `done`.
5. The native units of the closing plan (U-78, U-80, U-50) and U-24, or named in the report as
   what remains.
6. The tag `archive/swiftui-final` on main, then the pull request of U-70 merged last.
7. `docs/rn-migration/report.md` in Vietnamese: the six sections, the list of design deviations,
   what Phương does himself (Icon Composer, the support address, the products of the App Store,
   the promise about training models, the pages of Terms and Privacy).

## For the next owner pull request

- `plan.md`: U-84, U-82b, U-83 dropped, the evidence on GitHub runners, the state of the evening.
- The parity rows PL-02 and QA-01 are still `todo` although U-51 and U-60 landed: read their
  evidence and set them.
- Before the merge of PR 61: the GitHub branch protection (a required check named after the deleted
  Swift workflow) and the Xcode Cloud workflow that ran `ci_post_clone.sh` (review of PR 61, "Not
  checked"); `scripts/proof-capture/capture-golden-fixtures.mjs` recreates `native/` through its
  default output directory (note 18); the stale ignore lines of `.gitignore` and `.dockerignore`
  (note 17); the sentence "This is the only workflow" in `rn-ci.yml` (note 22).
- The follow-ups for the final report: the undo of a save that fails in the scan (nothing shown);
  whole centimetres for a decimal height; `purchaseSelected` without a catch in the paywall shell;
  the paragraph on testIDs in the parity detail of sign-in; the label "Report sent" in the parity
  detail of the scan; the background-task seam of the sync engine is unused; no release pipeline
  for the React Native app (findings U-70).
