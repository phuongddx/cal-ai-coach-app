# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. A turn opens at most five new threads: a further unit of the same worker goes into a
thread that is already open, with its thread id, or waits for the next turn.

## State on 2026-11-28 at 12:55

`main` is `8c954de`: merged today PR 53, 55, 54, 50, 42, 47.

| Unit | Worker | State | Next |
|---|---|---|---|
| U-74e diary evidence | Worker-S2 (thread 44b9402a) | running, holds the Simulator | drain when its pull request opens; evidence only |
| U-82 gates on GitHub Actions | Worker-G1 (thread 73e61e95) | running | gate, review, merge; then merges take their verdict from GitHub |
| U-73 correction (PR 36) | Worker-G1 (thread 0e8d9059) | running | gate, re-read the three points, merge |
| U-77 correction (PR 43) | Worker-G2 (thread 8f3ad0f1) | running | gate, re-read the points, merge |
| U-74 correction (PR 37) | Worker-G2 (thread 8f3ad0f1, after PR 43) | queued | gate, re-read the four points, merge |
| U-77c sign-in code step | Worker-S1 (thread 994c6d28) | running | gate, review, merge |
| U-72b scan, merge and stage A2 | Worker-S1 | not sent | after PR 37 and PR 43 are on `main`: send briefs/U-72b.md into the thread 994c6d28 |
| U-70 Swift cleanup | nobody | not sent | after U-82 is on `main` (the rewritten AGENTS.md must name the workflows); the worker reads the tree at dispatch; merge LAST, after the tag |

## After each merge

- U-73 (PR 36): its evidence unit (onboarding, nine steps, dark twins 47 to 55, ED-Safe rows of
  steps 8 and 9) waits for the Simulator.
- U-75 (PR 42): its evidence unit (Progress 11 and 12, Coach) waits for the Simulator.
- U-77b (PR 47) and U-77c: one evidence unit for sign-in (61, 62, 108 to 115).
- U-76 (PR 50): its evidence unit must prove the four-digit number on one line and the Fat card
  not cut at the edge (asked by Zed), the header offline on a narrow screen (note 5 of the review).
- High Contrast: `xcrun simctl ui <udid> increase_contrast enabled` switches the real setting.

## For the next owner pull request

- A gate lock: `scripts/rn/gate.sh` runs the three gates under a lock (one gate on the machine at
  a time), and rule 10 names it (the load was 62 on 11 cores on 2026-11-27 at 23:30).
- The parity rows of the units merged today (the owner sets status and evidence).
