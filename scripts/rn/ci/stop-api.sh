#!/usr/bin/env bash
# Stops the API scripts/rn/ci/start-api.sh started: by the recorded pid, then by anything still
# listening on the API port. There is no cluster to stop: the database is the job's postgres
# service container. Mirrors the API half of `scripts/rn/start-api.sh stop`.
set -uo pipefail

API_PORT="${API_PORT:-8787}"
ENV_FILE="${RN_API_ENV_FILE:-}"
LOG_DIR="${RN_API_ENV_FILE:+$(dirname "$RN_API_ENV_FILE")}"
PID_FILE="${LOG_DIR:+$LOG_DIR/api-dev.pid}"

if [ -n "$PID_FILE" ] && [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE")"
  if kill "$pid" >/dev/null 2>&1; then
    echo "[start-api] stopped the API (pid $pid)"
  else
    echo "[start-api] API pid $pid already gone"
  fi
else
  echo "[start-api] no pid file, checking the port anyway"
fi

# npx forks node: anything still listening on the API port goes too.
if command -v lsof >/dev/null 2>&1; then
  lsof -ti ":$API_PORT" -sTCP:LISTEN | xargs -r kill >/dev/null 2>&1 || true
fi

[ -n "$PID_FILE" ] && rm -f "$PID_FILE"
echo "[start-api] done."
