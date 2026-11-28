# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 20:00

`main` is `1482777` (PR 65: the integration half of the CI on GitHub Actions). From now a merge
takes its verdict from the checks of GitHub on the head (`RN CI`, both jobs), an independent
review, and the owner's read of the evidence when the pull request carries evidence; the tree of
the merge is computed before the merge with `git merge-tree --write-tree origin/main <head>` and
compared with main after it. The tool server restarted four times between 18:36 and 18:40 and the
agents server answered "unauthorized" until 19:45.

| Unit | Worker (thread) | State | Next |
|---|---|---|---|
| PR 37 (U-74) | Worker-S2 (c22ca8d0) | the third correction: head `21d0ddf` is red on GitHub (13 tests of `DiaryDayView.test.tsx`); Worker-G2 is off the branch | when S2 reports: read the checks, a re-read of the delta, merge; then PR 63 |
| PR 63 and PR 66 (U-84 A and B) | Worker-S2 | reported; both from `cfa35a5`, so both merge after PR 37; the independent review of both runs; `test:compiler` keeps two failing tests in the scan | A after PR 37 (S2 merges main first and resolves the diary), then B |
| PR 67 (U-76e) | Worker-S1 | five rows and the two proofs; `RN CI` green on `28111f8` (merge tree `0eba0ad8b7da`); the independent review runs; the High Contrast row's sentence is wrong (the picture differs from the light row) | merge after the review; then TD-01 goes to `done` with its deviations in the owner's parity pull request |
| PR 64 (U-82b) | Worker-G1 (2f0bc688) | correction sent: the files of PR 58 leave the branch (receipt 95f97b48); its three proof runs need the merge | review, merge, then the proof runs by G1 (a docs pull request `rn/u-82b-proof`) |
| PR 58 (U-82, the iOS half) | Worker-G1 (73e61e95) | the correction of the five flows sent (receipt a091971d) | `RN iOS` green with its artifact, then review and merge |
| PR 61 (U-70) | Worker-S1 | corrected at `a1c9c25`; merges LAST | the last merge of main and the lines for the workflows right before the tag |
| U-85 (the sync store) | Worker-S1 (89c50636) | running | review, the checks, merge |
| U-77ce (the sign-in evidence) | Worker-G2 (11b3cc20) | running with the Simulator, Metro 8081 and the API slot | the owner opens every screenshot, then merge |
| item 4 of U-72b and the scan under the compiler | Worker-S1 | not briefed; waits for PR 37 and PR 63 on `main` | one unit: the picker, and the two tests of `ReviewSheetView` red under `test:compiler` |
| the diary re-capture (PR 62) | Worker-S2 | waits for PR 37 and PR 63 | with the Simulator when G2 reports |
| U-73e, U-75e, U-77e | nobody | wait for PR 66 | on GitHub runners after PR 64 and its proof, otherwise on the Simulator |
| U-72e | nobody | waits for item 4 and the scan under the compiler | - |
| U-78, U-80, U-50, U-24 | nobody | the closing plan, steps 10 and 11; not briefed | G2 after U-77ce, S2 after the diary |

## The lines the owner writes into threads

- To Worker-S1 when PR 37 and PR 63 are on main: "item 4 of U-72b and the scan under the
  compiler", one unit, a new branch from the new main.
- To Worker-S2 when PR 37 and PR 63 are merged: the re-capture of the diary rows (the delete
  confirm three times and High Contrast, the two undo toasts, the Delete of the edit sheet),
  `run-all.sh` at `0 failed`, when the Simulator is free.
- To Worker-G1 when PR 64 is merged: nothing (its message already says the proof runs start by
  themselves).

## The order to the end

1. PR 37 merged (diary code) → PR 63 (the day sheet under the compiler) merged → the diary
   evidence (PR 62) re-captured and merged → PR 66 merged.
2. PR 67 merged (Today evidence) → TD-01 `done`. PR 58 merged (the iOS workflow) → `RN iOS` is a
   verdict for a pull request that changes the app. PR 64 merged → evidence on GitHub runners.
3. The evidence units: U-77ce now; U-73e, U-75e, U-77e, U-72e after their code.
4. Every parity row with its evidence → `done`.
5. The native units of the closing plan (U-78, U-80, U-50) and U-24, or named in the report as
   what remains.
6. The tag `archive/swiftui-final` on main, then the pull request of U-70 merged last.
7. `docs/rn-migration/report.md` in Vietnamese: the six sections, the list of design deviations,
   what Phương does himself (Icon Composer, the support address, the products of the App Store,
   the promise about training models, the pages of Terms and Privacy).

## For the next owner pull request

- `standing-orders.md`: rule 10 names the checks of GitHub as the verdict and the local gate as
  the exception; a new rule on the lock of a Simulator session (`/tmp/coachcal-rn-sim.lock`).
- `plan.md`: U-84, U-85, U-82b, U-83 dropped, the verdict from GitHub, PR 65, the state of the
  evening.
- Parity rows: TD-01 `done` with its deviations that stay (after PR 67); PL-02 and QA-01 are still
  `todo` although U-51 and U-60 landed: read their evidence and set them.
- `test:compiler` joins the gate only when the two scan tests are green (a unit of Worker-S1).
- Before the merge of PR 61: the GitHub branch protection (a required check named after the
  deleted Swift workflow) and the Xcode Cloud workflow that ran `ci_post_clone.sh` (review of PR
  61, "Not checked"); `scripts/proof-capture/capture-golden-fixtures.mjs` recreates `native/`
  through its default output directory (note 18); the stale ignore lines of `.gitignore` and
  `.dockerignore` (note 17); the sentence "This is the only workflow" in `rn-ci.yml` (note 22).
- The follow-ups for the final report: the undo of a save that fails in the scan (nothing shown);
  whole centimetres for a decimal height; `purchaseSelected` without a catch in the paywall shell;
  the paragraph on testIDs in the parity detail of sign-in; the label "Report sent" in the parity
  detail of the scan; the background-task seam of the sync engine is unused; no release pipeline
  for the React Native app (findings U-70); the saved toast and the undo toast share one place on
  the diary day sheet (review of PR 37, note 7); the cut assertion of the queue test (note 6).

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
