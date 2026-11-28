#!/usr/bin/env bash
# Owner tool: the three gates of a worktree, one gate on the machine at a time.
#
#   bash scripts/rn/gate.sh
#
# Waits while another gate holds the lock (the integration gate of the owner takes the same lock),
# then runs `npm test`, `npm run typecheck` and `npm run parity:check` at the root of the worktree
# it is called from. Stops at the first failure and prints the last lines of every step, so a
# report can quote them. A lock left behind by a dead process is removed.
#
# GATE_STEPS names other npm scripts for a quick run (for example GATE_STEPS=parity:check).
# COACHCAL_GATE_LOCK names another lock directory.
set -u
lock="${COACHCAL_GATE_LOCK:-/tmp/coachcal-rn-gate.lock}"
steps=${GATE_STEPS:-test typecheck parity:check}
logdir=$(dirname "$lock")

while ! mkdir "$lock" 2>/dev/null; do
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then rm -rf "$lock"; continue; fi
  sleep 5
done
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT

for step in $steps; do
  log="$logdir/coachcal-rn-gate-$step.log"
  echo "gate: npm run $step"
  if ! npm run "$step" > "$log" 2>&1; then
    tail -40 "$log"
    echo "gate: FAILED at npm run $step (log: $log)"
    exit 1
  fi
  tail -5 "$log"
done
echo "gate: OK ($steps)"
