#!/usr/bin/env bash
# Runs every gate on one checkout with PostgreSQL 17 and the API up, then stops both.
# Usage: gate-integrate.sh <worktree> <log prefix>
# Jest runs with a 120 s test timeout: a native build on the same machine makes the 15 s limit
# of apps/mobile fire on suites that pass in CI. The count of suites over 15 s is printed.
set -u
# One gate on the machine at a time: the same lock the workers take through scripts/rn/gate.sh.
# A lock left by a dead process is removed.
GATELOCK="${COACHCAL_GATE_LOCK:-/tmp/coachcal-rn-gate.lock}"
while ! mkdir "$GATELOCK" 2>/dev/null; do
  pid=$(cat "$GATELOCK/pid" 2>/dev/null || true)
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then rm -rf "$GATELOCK"; continue; fi
  sleep 5
done
echo $$ > "$GATELOCK/pid"
trap 'rm -rf "$GATELOCK"' EXIT
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
W="$1"
P="${2:-gate}"
L=/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs
cd "$W" || exit 2
echo "head $(git rev-parse HEAD)"
echo "tree $(git rev-parse 'HEAD^{tree}')"
echo "dirty=$(git status --short | wc -l | tr -d ' ') load=$(uptime | sed 's/.*load averages*: //')"

bash scripts/rn/start-api.sh >"$L/$P-api-start.log" 2>&1
echo "start-api exit=$?"
tail -1 "$L/$P-api-start.log"

npm run test --workspaces --if-present -- --testTimeout=120000 --verbose >"$L/$P-test.log" 2>&1
echo "npm test exit=$?"
grep -E "^(Tests|Test Suites):" "$L/$P-test.log"
echo "sql-skip lines: $(grep -c 'sql-skip' "$L/$P-test.log")  FAIL lines: $(grep -c '^FAIL ' "$L/$P-test.log")"
echo "tests slower than 15 s (would time out at the usual limit): $(grep -oE '\([0-9]+(\.[0-9]+)? s\)' "$L/$P-test.log" | tr -d '( s)' | awk '$1 >= 15' | wc -l | tr -d ' ')"
grep -E "\((1[5-9]|[2-9][0-9]|[0-9]{3,})(\.[0-9]+)? s\)" "$L/$P-test.log" | head -10

npm run typecheck >"$L/$P-typecheck.log" 2>&1
tc=$?
if [ "$tc" != "0" ] && grep -q "was not rewritten within" "$L/$P-typecheck.log"; then
  # The typed-routes step has a 120 s watchdog; a loaded machine trips it before tsc runs. One rerun.
  echo "typecheck stopped at the typed-routes watchdog; rerunning once"
  npm run typecheck >"$L/$P-typecheck-2.log" 2>&1
  tc=$?
fi
echo "typecheck exit=$tc  tsc errors: $(cat "$L/$P-typecheck.log" "$L/$P-typecheck-2.log" 2>/dev/null | grep -c 'error TS')"

npm run parity:check >"$L/$P-parity.log" 2>&1
echo "parity exit=$?"
tail -1 "$L/$P-parity.log"

for s in smoke-scan smoke-auth; do
  bash "scripts/rn/$s.sh" >"$L/$P-$s.log" 2>&1
  echo "$s exit=$?"
  tail -2 "$L/$P-$s.log"
done

bash scripts/rn/e2e-sync.sh >"$L/$P-e2e-sync.log" 2>&1
echo "e2e-sync exit=$?"
tail -1 "$L/$P-e2e-sync.log"

bash scripts/rn/start-api.sh stop >"$L/$P-api-stop.log" 2>&1
echo "stop exit=$?"
echo "listeners left on 5433/8787: $(lsof -nP -iTCP:5433 -iTCP:8787 -sTCP:LISTEN | grep -c LISTEN)"
