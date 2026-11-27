#!/usr/bin/env bash
# Throwaway PostgreSQL 17 + the CoachCal API (spike sync routes and the scan pipeline).
#
#   scripts/rn/start-api.sh          # initdb into a temp dir, port 5433, API on 8787
#   scripts/rn/start-api.sh stop     # stop both, delete the cluster dir, free both ports
#
# What start does:
#   1. initdb a throwaway cluster (trust auth, 127.0.0.1 only) and start it on 5433.
#   2. Create the two roles: coachcal_owner (owns the objects, runs migrations) and
#      coachcal_api (the API connection: no table privileges, EXECUTE on the SQL functions).
#   3. Create the database `coachcal` owned by coachcal_owner and run
#      apps/api/migrations/*.sql as coachcal_owner (npx tsx src/migrate.ts).
#   4. Apply the spike schema (apps/api/src/schema.sql) as the owner and grant it to the API
#      role, so the spike sync routes keep working.
#   5. Start the API on 8787 as coachcal_api with AUTH_DEV_TOKENS=1 and VLM_PROVIDER=fixture.
#   6. Write TEST_OWNER_URL and TEST_API_URL into an env file other commands can source.
#      Default $TMPDIR/coachcal-rn-api.env, override with RN_API_ENV_FILE. The Jest suites
#      read the same file when the variables are not already set; the file is deleted on stop.
#
# Nothing is registered as a service; the cluster lives in a temp dir and is deleted on stop.
set -euo pipefail

# initdb fails on the non-interactive shell's missing locale (build-recipe pitfall 1).
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PG_PORT=5433
API_PORT="${API_PORT:-8787}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${RN_SPIKE_LOG_DIR:-/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs}"
STATE_FILE="$LOG_DIR/api-dev.state"
ENV_FILE="${RN_API_ENV_FILE:-${TMPDIR:-/tmp}/coachcal-rn-api.env}"
SUPERUSER="$(id -un)"
DB_NAME=coachcal
OWNER_URL="postgres://coachcal_owner@127.0.0.1:$PG_PORT/$DB_NAME"
API_URL="postgres://coachcal_api@127.0.0.1:$PG_PORT/$DB_NAME"

mkdir -p "$LOG_DIR"

wait_for() { # a command that succeeds when ready
  local attempt
  for attempt in $(seq 1 120); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

psql_super() {
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U "$SUPERUSER" -v ON_ERROR_STOP=1 -q "$@"
}

start() {
  if [ -f "$STATE_FILE" ]; then
    echo "[start-api] state file exists: $STATE_FILE"
    echo "[start-api] run 'scripts/rn/start-api.sh stop' first, or delete it if nothing is running."
    exit 1
  fi

  local cluster
  cluster="$(mktemp -d "${TMPDIR:-/tmp}/coachcal-api-pg.XXXXXX")"

  echo "[start-api] initdb -> $cluster"
  "$PG_BIN/initdb" -D "$cluster" -A trust -U "$SUPERUSER" >/dev/null

  echo "[start-api] starting PostgreSQL 17 on port $PG_PORT (trust auth, 127.0.0.1 only, throwaway)"
  "$PG_BIN/pg_ctl" -D "$cluster" -l "$LOG_DIR/api-postgres.log" \
    -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $cluster" start >/dev/null
  wait_for "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PG_PORT"

  # Record the cluster before anything else can fail, so `stop` can always clean up.
  cat >"$STATE_FILE" <<STATE
CLUSTER=$cluster
API_PID=
STATE

  psql_super -d postgres \
    -c "CREATE ROLE coachcal_owner LOGIN CREATEDB;" \
    -c "CREATE ROLE coachcal_api LOGIN;" \
    -c "CREATE DATABASE $DB_NAME OWNER coachcal_owner;"
  echo "[start-api] roles coachcal_owner and coachcal_api, database $DB_NAME created"

  (cd "$ROOT/apps/api" && DATABASE_URL="$OWNER_URL" npx tsx src/migrate.ts)

  # The spike sync routes (meals, sync_ops, sync_changes) run as coachcal_api: create the
  # spike tables as the owner, then grant them. The scan tables get no such grant.
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U coachcal_owner -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -q -f "$ROOT/apps/api/src/schema.sql"
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U coachcal_owner -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
    -c "GRANT SELECT, INSERT, UPDATE, DELETE ON meals, sync_ops, sync_changes TO coachcal_api;" \
    -c "GRANT USAGE, SELECT ON SEQUENCE sync_changes_seq_seq TO coachcal_api;"
  echo "[start-api] migrations and the spike schema applied"

  echo "[start-api] starting the API on port $API_PORT"
  (
    cd "$ROOT/apps/api"
    DATABASE_URL="$API_URL" PORT="$API_PORT" AUTH_DEV_TOKENS=1 VLM_PROVIDER=fixture \
      nohup npx tsx src/index.ts >"$LOG_DIR/api-dev.log" 2>&1 &
    echo $! >"$LOG_DIR/api-dev.pid"
  )
  cat >"$STATE_FILE" <<STATE
CLUSTER=$cluster
API_PID=$(cat "$LOG_DIR/api-dev.pid")
STATE

  wait_for curl -fs "http://127.0.0.1:$API_PORT/health"

  mkdir -p "$(dirname "$ENV_FILE")"
  cat >"$ENV_FILE" <<ENV
export TEST_OWNER_URL=$OWNER_URL
export TEST_API_URL=$API_URL
export API_BASE_URL=http://127.0.0.1:$API_PORT
ENV

  echo "[start-api] ready."
  echo "  API:          http://127.0.0.1:$API_PORT  (GET /health answers {ok:true})"
  echo "  PostgreSQL:   owner $OWNER_URL"
  echo "                api   $API_URL"
  echo "  Env file:     $ENV_FILE  (source it for TEST_OWNER_URL and TEST_API_URL)"
  echo "  Tokens:       apps/api/dev-tokens.json (spike-dev-token, spike-dev-token-2)"
  echo "  Stop both:    $ROOT/scripts/rn/start-api.sh stop"
  echo "  Logs:         $LOG_DIR/api-postgres.log, $LOG_DIR/api-dev.log"
}

stop() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  else
    echo "[start-api] no state file at $STATE_FILE, checking the ports anyway"
  fi

  if [ -n "${API_PID:-}" ] && kill "$API_PID" >/dev/null 2>&1; then
    echo "[start-api] stopped the API (pid $API_PID)"
  else
    echo "[start-api] API not running (or pid gone)"
  fi
  # npx forks node: anything still listening on the API port goes too.
  lsof -ti ":$API_PORT" -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true

  if [ -n "${CLUSTER:-}" ] && [ -d "$CLUSTER" ]; then
    "$PG_BIN/pg_ctl" -D "$CLUSTER" stop -m fast >/dev/null 2>&1 || true
    rm -rf "$CLUSTER"
    echo "[start-api] stopped PostgreSQL and deleted $CLUSTER"
  fi

  rm -f "$STATE_FILE" "$LOG_DIR/api-dev.pid" "$ENV_FILE"
  echo "[start-api] done."
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  *) echo "usage: scripts/rn/start-api.sh [start|stop]"; exit 2 ;;
esac
