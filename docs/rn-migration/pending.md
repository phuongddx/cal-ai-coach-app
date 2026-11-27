# Messages the owner could not send

A turn that a worker result started cannot address that worker ("cannot assign work back to an
ancestor"). The messages below wait here and go out in the next turn another worker starts. A turn
also opens at most five new threads: the sixth call of a turn is refused.

## Pending since 2026-11-27 about 22:58: U-76 stage A to Worker-S2

Refused as the sixth new thread of its turn. Send it first in the next turn, on a new thread, no
rework flag (it is a new unit).

- Worktree `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-u-76`, branch
  `rn/u-76-today-ember`, from main at `2680208`, `node_modules` present (539 entries).
- Brief: `docs/rn-migration/briefs/U-76.md` (now with the line that `run-all` rewrites the
  screenshots of other rows).
- The message to send: the one drafted at 22:58, in short: a new unit, stage A is JS only; Worker-S2
  does not hold the Simulator slot (it goes to Worker-G2 for the stage B of U-74 after PR 46 merges);
  the four points of the build; the fact that the development client of U-79 holds every native
  module (ExpoCrypto included) so no rebuild is needed; the three gates; the report with
  `Stage: A done` and `Status: partial`.
- The correction of U-81 (thread ea675fb2) comes first if the two compete.

## After PR 46 merges

- The go for the stage B of U-74 to Worker-G2, on a new thread: merge `main` first (it holds the
  harness of U-81), the Simulator slot and Metro 8081 are theirs, restore the screenshots of other
  rows after `run-all`, the development client holds every native module (the string check, not
  `ls Frameworks`).
- The owner docs pull request: standing order 21 with a check script, the line on `run-all`, the
  stale note of the parity row AU-01, the decisions of U-77b, the three things that wait for
  Phương, the follow-ups (a direct test of a signed-out deep link to a guarded route).
