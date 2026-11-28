# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 13:25

`main` is `769c0a0`. Landed today: PR 53, 55, 54, 50, 42, 47, 56, 43, 36.

| Unit | Worker (thread) | State | Next |
|---|---|---|---|
| U-74e diary evidence | Worker-S2 (44b9402a) | running on the Simulator (it resumed at 12:33; pictures exist in its worktree) | when its pull request opens: read every screenshot, check rule 23; after PR 37 merges it captures again the rows the four fixes change (the delete confirm, the undo toasts, Delete inside the edit sheet) |
| U-82 gates on GitHub Actions | Worker-G1 (73e61e95) | retry after a rate limit (files were intact in the worktree) | gate on the full gate, review, merge; then write the line that starts U-70 and create the worktree rn-u-70 |
| U-74 correction (PR 37) | Worker-G2 (8f3ad0f1) | running: the evidence leaves the branch, the four fixes, the three fixes found on the device stay | the full gate on a tree with it and a re-read; merge; then the lines to Worker-S1 (item 4 of U-72b) and Worker-S2 (re-capture) |
| U-77c sign-in code step | Worker-S1 (994c6d28) | PR 57 open at 6da649e; gate w5d and review running | merge if both pass |
| U-72b scan, part one | Worker-S1 (994c6d28, after U-77c) | starting (its worktree shows a merge in progress) | gate, review, merge; item 4 after PR 37 |
| U-70 Swift cleanup | Worker-G1 (73e61e95, after U-82) | queued | create the worktree rn-u-70 from `main` after U-82; merge LAST after the tag |
| U-76e Today evidence | Worker-S2 | brief ready (with the limits of the harness) | send when U-74e reports |

## The lines the owner writes into threads

- To Worker-S1 (994c6d28) when PR 37 is merged: "PR 37 is on main: do item 4 of U-72b".
- To Worker-S2 (44b9402a) when PR 37 is merged: "PR 37 is on main with the four fixes: merge
  origin/main in rn-u-74e and capture again the delete confirm (three rows and High Contrast), the
  two undo toasts, and the Delete of the edit sheet; then push and open the pull request."
- To Worker-G1 (73e61e95) when the pull request of U-82 is merged: "U-82 is merged: start U-70 in
  .worktrees/rn-u-70 on rn/u-70-swift-cleanup" (create the worktree and the node_modules first).

## After each merge

- The evidence units that remain: onboarding (U-73e), progress and coach (U-75e), profile,
  settings and billing (U-77e), Today (U-76e), scan (after PR 39), sign-in (after PR 57). Once
  the iOS workflow with Maestro is on `main`, prefer artifacts from GitHub Actions, and keep the
  machine of Phương for what only the Simulator can show (High Contrast through the real setting).
- High Contrast: `xcrun simctl ui <udid> increase_contrast enabled`.
- The limits of the harness are in `briefs/U-76e.md` (from findings U-74 section 12).

## For the next owner pull request

- `docs/rn-migration/plan.md`: the rule "do the work, then report" and the rule that an owner
  pull request with a script or a workflow runs the full gate before its merge.
- The parity rows of PR 43 and PR 36 (OB-01 to OB-10, PR-01 to PR-03: partial with the evidence of
  the merge; the Simulator evidence pending).
- An owner pull request that adds a script runs the full gate on its tree before the merge.
