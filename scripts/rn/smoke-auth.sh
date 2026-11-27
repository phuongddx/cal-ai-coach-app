#!/usr/bin/env bash
# Smoke test for sessions against a running API (scripts/rn/start-api.sh, OTP_SENDER=log).
#
#   bash scripts/rn/start-api.sh && bash scripts/rn/smoke-auth.sh; bash scripts/rn/start-api.sh stop
#
# Steps (one "ok" or "FAIL" line each, exit 1 if any FAIL). No dev token is used anywhere:
#   1. request an e-mail code and read it from the API log
#   2. verify the code: a session (access + refresh token) for a new user
#   3. a protected call with the access token answers 200
#   4. refresh: new tokens, the old refresh token is rejected (401)
#   5. sign out: the access token answers 401 afterwards
#   6. sign in again, delete the account: 200, the token answers 401, the user row is gone
# The codes are rate limited per client address (20 requests an hour); each run asks for two.
set -uo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
API_PORT="${API_PORT:-8787}"
BASE="http://127.0.0.1:$API_PORT"
# shellcheck source=api-env-file.sh
source "$(dirname "${BASH_SOURCE[0]}")/api-env-file.sh"
ENV_FILE="$(api_env_file)"
EMAIL="smoke-auth-$RANDOM$RANDOM@example.test"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL setup: $ENV_FILE not found. Run bash scripts/rn/start-api.sh first."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

owner_sql() { "$PG_BIN/psql" "$TEST_OWNER_URL" -v ON_ERROR_STOP=1 -q -X -At "$@"; }

cleanup() {
  owner_sql -c "DELETE FROM public.auth_otp_codes WHERE email = '$EMAIL'" \
            -c "DELETE FROM public.users WHERE email = '$EMAIL'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

FAILED=0
step() { # name, ok|fail, detail
  if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1: $3"; FAILED=1; fi
}

# Runs curl, leaves the body in $BODY and the status in $STATUS.
call() { # method path [json-body] [bearer-token]
  local args=(-sS -m 30 -w $'\n%{http_code}' -X "$1" "$BASE$2")
  [ -n "${3:-}" ] && args+=(-H 'Content-Type: application/json' --data "$3")
  [ -n "${4:-}" ] && args+=(-H "Authorization: Bearer $4")
  local out
  out="$(curl "${args[@]}")" || out=$'\n000'
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

# Asks for a code and reads it from the API log; leaves the session response in $BODY.
sign_in() {
  call POST /v1/auth/otp/request "{\"email\":\"$EMAIL\"}"
  [ "$STATUS" = 200 ] || return 1
  local code
  code="$(grep "\[otp\] code for $EMAIL:" "$API_LOG" | tail -1 | sed 's/.*: //')"
  [ -n "$code" ] || return 2
  call POST /v1/auth/otp/verify "{\"email\":\"$EMAIL\",\"code\":\"$code\"}"
  [ "$STATUS" = 200 ]
}

# 1 + 2
if sign_in; then
  ACCESS="$(jq -r .tokens.accessToken <<<"$BODY")"
  REFRESH="$(jq -r .tokens.refreshToken <<<"$BODY")"
  USER_ID="$(jq -r .user.id <<<"$BODY")"
  step "e-mail code requested, read from the API log and verified" ok
else
  step "e-mail code requested, read from the API log and verified" fail "status $STATUS body $BODY"
  exit 1
fi

# 3
call POST /v1/sync/pull '{"cursor":0}' "$ACCESS"
if [ "$STATUS" = 200 ]; then step "protected call with the access token answers 200" ok
else step "protected call with the access token answers 200" fail "status $STATUS body $BODY"; fi

# 4
call POST /v1/auth/refresh "{\"refreshToken\":\"$REFRESH\"}"
if [ "$STATUS" = 200 ] && [ "$(jq -r .tokens.refreshToken <<<"$BODY")" != "$REFRESH" ]; then
  NEW_ACCESS="$(jq -r .tokens.accessToken <<<"$BODY")"
  call POST /v1/auth/refresh "{\"refreshToken\":\"$REFRESH\"}"
  if [ "$STATUS" = 401 ]; then step "refresh rotates the token and the old refresh token is rejected" ok
  else step "refresh rotates the token and the old refresh token is rejected" fail "old token answered $STATUS"; fi
else
  step "refresh rotates the token and the old refresh token is rejected" fail "status $STATUS body $BODY"
  NEW_ACCESS="$ACCESS"
fi

# 5 (replaying the old refresh token revoked the whole session, so use a fresh sign-in for sign out)
if sign_in; then
  ACCESS="$(jq -r .tokens.accessToken <<<"$BODY")"
  call POST /v1/auth/signout '{}' "$ACCESS"
  SIGNOUT_STATUS="$STATUS"
  call POST /v1/sync/pull '{"cursor":0}' "$ACCESS"
  if [ "$SIGNOUT_STATUS" = 200 ] && [ "$STATUS" = 401 ]; then step "sign out ends the session: the access token answers 401" ok
  else step "sign out ends the session: the access token answers 401" fail "signout $SIGNOUT_STATUS then $STATUS"; fi
else
  step "sign out ends the session: the access token answers 401" fail "could not sign in again (status $STATUS)"
fi

# 6
if sign_in; then
  ACCESS="$(jq -r .tokens.accessToken <<<"$BODY")"
  call DELETE /v1/account '' "$ACCESS"
  DELETE_STATUS="$STATUS"
  call POST /v1/sync/pull '{"cursor":0}' "$ACCESS"
  AFTER_STATUS="$STATUS"
  REMAINING="$(owner_sql -c "SELECT count(*) FROM public.users WHERE email = '$EMAIL'")"
  if [ "$DELETE_STATUS" = 200 ] && [ "$AFTER_STATUS" = 401 ] && [ "$REMAINING" = 0 ]; then
    step "account deletion answers 200, the token answers 401 and the user row is gone" ok
  else
    step "account deletion answers 200, the token answers 401 and the user row is gone" fail \
      "delete $DELETE_STATUS, token $AFTER_STATUS, rows left $REMAINING"
  fi
else
  step "account deletion answers 200, the token answers 401 and the user row is gone" fail "could not sign in again (status $STATUS)"
fi

exit "$FAILED"
