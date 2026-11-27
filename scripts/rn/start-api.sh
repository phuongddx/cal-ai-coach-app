#!/usr/bin/env bash
# Throwaway PostgreSQL 17 + sync API for spike item 4 (spec D4, plan "Places").
#
#   scripts/start-api.sh          # initdb into a temp dir, port 5433, API on 8787
#   scripts/start-api.sh stop     # stop both, delete the cluster dir
#
# Nothing is registered as a service; the cluster lives in a temp dir and is
# deleted on stop. Logs land in the spike log directory.
set -euo pipefail

# initdb fails on the non-interactive shell's missing locale (build-recipe pitfall 1).
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PG_PORT=5433
API_PORT="${API_PORT:-8787}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${RN_SPIKE_LOG_DIR:-/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs}"
STATE_FILE="$LOG_DIR/t3-dev-api.state"
DB_USER="$(id -un)"
DB_URL="postgres://$DB_USER@127.0.0.1:$PG_PORT/coachcal_spike"

mkdir -p "$LOG_DIR"

wait_for() { # description, url/command results via curl
  local attempt
  for attempt in $(seq 1 60); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

start() {
  if [ -f "$STATE_FILE" ]; then
    echo "[start-api] state file exists: $STATE_FILE"
    echo "[start-api] if you believe nothing is running, delete it and retry."
    exit 1
  fi

  local cluster
  cluster="$(mktemp -d "${TMPDIR:-/tmp}/coachcal-spike-pg.XXXXXX")"

  echo "[start-api] initdb -> $cluster"
  "$PG_BIN/initdb" -D "$cluster" -A trust >/dev/null

  echo "[start-api] starting PostgreSQL 17 on port $PG_PORT (trust auth, 127.0.0.1 only — throwaway)"
  "$PG_BIN/pg_ctl" -D "$cluster" -l "$LOG_DIR/t3-postgres.log" \
    -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $cluster" start

  wait_for "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PG_PORT"
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS coachcal_spike;" \
    -c "CREATE DATABASE coachcal_spike;"
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U "$DB_USER" -d coachcal_spike \
    -v ON_ERROR_STOP=1 -f "$ROOT/apps/api/src/schema.sql" >/dev/null
  echo "[start-api] schema.sql applied to coachcal_spike"

  echo "[start-api] starting the sync API on port $API_PORT"
  (
    cd "$ROOT/apps/api"
    DATABASE_URL="$DB_URL" PORT="$API_PORT" \
      nohup npx tsx src/index.ts >"$LOG_DIR/t3-api.log" 2>&1 &
    echo $! >"$LOG_DIR/t3-api.pid"
  )

  wait_for curl -fs "http://127.0.0.1:$API_PORT/health"

  cat >"$STATE_FILE" <<STATE
CLUSTER=$cluster
API_PID=$(cat "$LOG_DIR/t3-api.pid")
DB_URL=$DB_URL
STATE

  echo "[start-api] ready."
  echo "  API:          http://127.0.0.1:$API_PORT  (GET /health answers {ok:true})"
  echo "  PostgreSQL:   $DB_URL"
  echo "  Tokens:       apps/api/dev-tokens.json (spike-dev-token, spike-dev-token-2)"
  echo "  Stop both:    $ROOT/scripts/rn/start-api.sh stop"
  echo "  Logs:         $LOG_DIR/t3-postgres.log, $LOG_DIR/t3-api.log"
  echo "  Cluster dir:  $cluster (deleted on stop)"
}

stop() {
  if [ ! -f "$STATE_FILE" ]; then
    echo "[start-api] no state file at $STATE_FILE — checking ports anyway"
  else
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  fi

  if [ -n "${API_PID:-}" ] && kill "$API_PID" >/dev/null 2>&1; then
    echo "[start-api] stopped the API (pid $API_PID)"
  else
    echo "[start-api] API not running (or pid gone)"
  fi
  lsof -ti ":$API_PORT" -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true

  if [ -n "${CLUSTER:-}" ] && [ -d "$CLUSTER" ]; then
    "$PG_BIN/pg_ctl" -D "$CLUSTER" stop -m fast >/dev/null 2>&1 || true
    rm -rf "$CLUSTER"
    echo "[start-api] stopped PostgreSQL and deleted $CLUSTER"
  fi

  rm -f "$STATE_FILE" "$LOG_DIR/t3-api.pid"
  echo "[start-api] done."
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  *) echo "usage: scripts/start-api.sh [start|stop]"; exit 2 ;;
esac
