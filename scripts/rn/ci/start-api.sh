#!/usr/bin/env bash
# CI twin of scripts/rn/start-api.sh: the same roles, database, migrations and API, but on a
# GitHub Actions postgres:17 service container (127.0.0.1:5432) instead of a throwaway initdb
# cluster. Run by the `integration` job of .github/workflows/rn-ci.yml.
#
# What it does (the parts of start-api.sh that come after initdb):
#   1. Create the two roles: coachcal_owner (owns the objects, runs migrations) and coachcal_api
#      (the API connection: no table privileges, EXECUTE on the SQL functions). Both must exist
#      before the migrations run: they grant EXECUTE to coachcal_api.
#   2. Create the database `coachcal` owned by coachcal_owner and run apps/api/migrations/*.sql
#      as coachcal_owner (npx tsx src/migrate.ts).
#   3. Start the API on 8787 as coachcal_api: per-run AUTH_JWT_SECRET, AUTH_ENCRYPTION_KEY and
#      RC_WEBHOOK_SIGNING_SECRET generated with openssl IN THIS JOB (never copied from a
#      machine), OTP_SENDER=log (the code is printed to the API log), Apple and Google unset
#      (their routes answer 503), AUTH_DEV_TOKENS=1, VLM_PROVIDER=fixture.
#   4. Write TEST_OWNER_URL, TEST_API_URL, API_BASE_URL and API_LOG into the env file the smoke
#      scripts and the Jest SQL harness read. RN_API_ENV_FILE names the file; the workflow sets
#      it at job level so every step shares it.
#
# No cluster state file: `scripts/rn/ci/stop-api.sh` kills the API by its pid and its port.
set -euo pipefail

# initdb/psql need the locale on a machine; keep the same env on the runner (start-api.sh pitfall 1).
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

PG_PORT="${PG_PORT:-5432}"
API_PORT="${API_PORT:-8787}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPER_URL="postgres://postgres:${POSTGRES_SUPER_PASSWORD:-postgres}@127.0.0.1:$PG_PORT/postgres"
# Letters and digits only: both passwords travel inside connection strings.
OWNER_PASSWORD="${COACHCAL_OWNER_PASSWORD:-ownerlocalci0}"
API_PASSWORD="${COACHCAL_API_PASSWORD:-apilocalci0}"
ENV_FILE="${RN_API_ENV_FILE:?RN_API_ENV_FILE must name the env file this job shares}"
LOG_DIR="$(dirname "$ENV_FILE")"
LOG_FILE="${API_LOG:-$LOG_DIR/api-dev.log}"
PID_FILE="$LOG_DIR/api-dev.pid"

wait_for() { # a command that succeeds when ready
  local attempt
  for attempt in $(seq 1 120); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

psql_super() {
  psql "$SUPER_URL" -v ON_ERROR_STOP=1 -q -X "$@"
}

mkdir -p "$LOG_DIR"

echo "[start-api] waiting for the postgres service"
wait_for psql_super -c "SELECT 1"

psql_super \
  -c "CREATE ROLE coachcal_owner LOGIN CREATEDB PASSWORD '$OWNER_PASSWORD'" \
  -c "CREATE ROLE coachcal_api LOGIN PASSWORD '$API_PASSWORD'" \
  -c "CREATE DATABASE coachcal OWNER coachcal_owner"
echo "[start-api] roles coachcal_owner and coachcal_api, database coachcal created"

(cd "$ROOT/apps/api" && \
  DATABASE_URL="postgres://coachcal_owner:$OWNER_PASSWORD@127.0.0.1:$PG_PORT/coachcal" npx tsx src/migrate.ts)
echo "[start-api] migrations applied"

echo "[start-api] starting the API on port $API_PORT"
(
  cd "$ROOT/apps/api"
  DATABASE_URL="postgres://coachcal_api:$API_PASSWORD@127.0.0.1:$PG_PORT/coachcal" \
    PORT="$API_PORT" AUTH_DEV_TOKENS=1 VLM_PROVIDER=fixture \
    AUTH_JWT_SECRET="$(openssl rand -hex 32)" \
    AUTH_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
    RC_WEBHOOK_SIGNING_SECRET="$(openssl rand -hex 32)" \
    OTP_SENDER=log \
    nohup npx tsx src/index.ts >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
)

wait_for curl -fs "http://127.0.0.1:$API_PORT/health"

cat >"$ENV_FILE" <<ENV
export TEST_OWNER_URL=postgres://coachcal_owner:$OWNER_PASSWORD@127.0.0.1:$PG_PORT/coachcal
export TEST_API_URL=postgres://coachcal_api:$API_PASSWORD@127.0.0.1:$PG_PORT/coachcal
export API_BASE_URL=http://127.0.0.1:$API_PORT
export API_LOG=$LOG_FILE
ENV

echo "[start-api] ready."
echo "  API:        http://127.0.0.1:$API_PORT  (GET /health answers {ok:true})"
echo "  PostgreSQL: postgres service container on 127.0.0.1:$PG_PORT"
echo "  Env file:   $ENV_FILE"
echo "  Logs:       $LOG_FILE"
