#!/usr/bin/env bash
# Waits until Metro answers packager-status:running on the port (the CI twin of lib.sh's
# metro_running/metro_wait pair). Usage:
#   bash scripts/rn/ci/wait-metro.sh [seconds] [metro log for the tail on failure]
set -uo pipefail

SECONDS_TO_WAIT="${1:-120}"
LOG="${2:-}"
URL="http://localhost:${METRO_PORT:-8081}/status"

for _ in $(seq 1 "$SECONDS_TO_WAIT"); do
  if [ "$(curl -s --max-time 2 "$URL" 2>/dev/null)" = "packager-status:running" ]; then
    echo "metro serves on ${METRO_PORT:-8081}"
    exit 0
  fi
  sleep 1
done

if [ -n "$LOG" ] && [ -f "$LOG" ]; then
  echo "metro log tail:" >&2
  tail -n 40 "$LOG" >&2 || true
fi
echo "FAIL: metro did not answer packager-status:running within ${SECONDS_TO_WAIT}s" >&2
exit 1
