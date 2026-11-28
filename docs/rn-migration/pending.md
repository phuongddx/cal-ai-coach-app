# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 13:15

`main` is `769c0a0`. Landed today: PR 53, 55, 54, 50, 42, 47, 56, 43, 36.

| Unit | Worker (thread) | State | Next |
|---|---|---|---|
| U-74e diary evidence | Worker-S2 (44b9402a) | running, holds the Simulator | when its pull request opens: read every screenshot, check rule 23, merge |
| U-82 gates on GitHub Actions | Worker-G1 (73e61e95) | running | gate on the full gate, review, merge; then write the line that starts U-70 and create the worktree rn-u-70 |
| U-74 correction (PR 37) | Worker-G2 (8f3ad0f1) | running | the evidence leaves the branch; the four fixes; then the full gate on a tree with it and a re-read |
| U-77c sign-in code step | Worker-S1 (994c6d28) | running | full gate, review, merge |
| U-72b scan, part one | Worker-S1 (994c6d28, after U-77c) | queued | when PR 37 is on `main`, write the line that releases item 4 |
| U-70 Swift cleanup | Worker-G1 (73e61e95, after U-82) | queued | create the worktree rn-u-70 from `main` after U-82; merge LAST after the tag |
| U-76e Today evidence | Worker-S2 | not sent | send briefs/U-76e.md when U-74e reports (new thread, or its thread) |

## The lines the owner writes into threads

- To Worker-S1 (994c6d28) when PR 37 is merged: "PR 37 is on main: do item 4 of U-72b".
- To Worker-G1 (73e61e95) when PR of U-82 is merged: "U-82 is merged: start U-70 in
  .worktrees/rn-u-70 on rn/u-70-swift-cleanup" (create the worktree and the node_modules first).

## After each merge

- The evidence units that remain: onboarding (U-73e), progress and coach (U-75e), profile,
  settings and billing (U-77e), Today (U-76e, brief written), scan (after PR 39), sign-in (after
  U-77c). Once the iOS workflow with Maestro is on `main`, prefer artifacts from GitHub Actions
  for these, and keep the machine of Phương for what only the Simulator can show (High Contrast
  through the real setting).
- High Contrast: `xcrun simctl ui <udid> increase_contrast enabled`.

## For the next owner pull request

- `docs/rn-migration/plan.md`: the rule "do the work, then report" (a turn never ends with a
  status message while something is left that does not depend on another bot) and the rule that an
  owner pull request with a script or a workflow runs the full gate before its merge.
- The parity rows of PR 43 and PR 36 (OB-01 to OB-10, PR-01 to PR-03: partial with the evidence of
  the merge; the Simulator evidence pending).
- An owner pull request that adds a script runs the full gate on its tree before the merge.
