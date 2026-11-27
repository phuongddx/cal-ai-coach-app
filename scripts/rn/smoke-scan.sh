#!/usr/bin/env bash
# Smoke test for the scan pipeline against a running API (scripts/rn/start-api.sh).
#
#   bash scripts/rn/start-api.sh && bash scripts/rn/smoke-scan.sh; bash scripts/rn/start-api.sh stop
#
# Steps (one "ok" or "FAIL" line each, exit 1 if any FAIL):
#   1. GET /health
#   2. POST /v1/scan with packages/api-contract/golden/scan-request-photo.golden.json
#      (fixture VLM, cache seeded the way the legacy e2e test seeds it) and the golden numbers
#   3. POST /v1/barcode/resolve for a barcode that is not found (typed 404)
#   4. POST /v1/foods/search for a seeded food (cache hit)
#   5. the same photo scan with a real session (e-mail code sign-in, no dev token), then the account
#      is deleted again; the code is read from the API log (OTP_SENDER=log)
# The seeds go in through the owner connection and are removed again on exit.
set -uo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
API_PORT="${API_PORT:-8787}"
BASE="http://127.0.0.1:$API_PORT"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${RN_API_ENV_FILE:-${TMPDIR:-/tmp}/coachcal-rn-api.env}"
GOLDEN="$ROOT/packages/api-contract/golden"
TOKEN="${SMOKE_TOKEN:-spike-dev-token}"
USER_ID="${SMOKE_USER_ID:-11111111-1111-4111-8111-111111111111}"
UNKNOWN_BARCODE=8888888888889

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL setup: $ENV_FILE not found. Run bash scripts/rn/start-api.sh first."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

owner_sql() {
  "$PG_BIN/psql" "$TEST_OWNER_URL" -v ON_ERROR_STOP=1 -q -X "$@"
}

SCAN_ID="$(jq -r .scanId "$GOLDEN/scan-request-photo.golden.json")"

cleanup() {
  owner_sql -c "DELETE FROM public.scan_items WHERE scan_id = '$SCAN_ID'" \
            -c "DELETE FROM public.scans WHERE id = '$SCAN_ID'" \
            -c "DELETE FROM public.scan_usage WHERE user_id = '$USER_ID'" \
            -c "DELETE FROM public.food_cache WHERE cache_key IN ('search:chicken-rice', 'search:cheddar', 'barcode:$UNKNOWN_BARCODE')" \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

# Cache seeds: chicken-rice as the legacy e2e test seeds it, a cheddar row for the search,
# and a negative row so the unknown barcode never reaches a live provider.
if ! owner_sql \
  -c "INSERT INTO public.food_cache (cache_key, source, payload, expires_at) VALUES
        ('search:chicken-rice', 'fdc', '{\"kcal\":145,\"proteinG\":27,\"carbsG\":40,\"fatG\":4,\"fiberG\":2}', now() + interval '30 days'),
        ('search:cheddar', 'fdc', '{\"kcal\":402,\"proteinG\":24.9,\"carbsG\":3.09,\"fatG\":33.14,\"fiberG\":0}', now() + interval '7 days'),
        ('barcode:$UNKNOWN_BARCODE', 'negative', '{\"notFound\":true}', now() + interval '1 hour')
      ON CONFLICT (cache_key) DO UPDATE SET source = excluded.source, payload = excluded.payload, expires_at = excluded.expires_at" \
  >/dev/null; then
  echo "FAIL setup: could not seed the cache through TEST_OWNER_URL"
  exit 1
fi

FAILED=0
step() { # name, ok|fail, detail
  if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1: $3"; FAILED=1; fi
}

# Runs curl, leaves the body in $BODY and the status in $STATUS.
call() { # method path [json-body]
  local out
  if [ -n "${3:-}" ]; then
    out="$(curl -sS -m 30 -w $'\n%{http_code}' -X "$1" "$BASE$2" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data "$3")" || out=$'\n000'
  else
    out="$(curl -sS -m 30 -w $'\n%{http_code}' -X "$1" "$BASE$2")" || out=$'\n000'
  fi
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

# 1. health
call GET /health
if [ "$STATUS" = 200 ] && [ "$(jq -r .ok <<<"$BODY")" = true ]; then
  step "GET /health answers {ok:true}" ok
else
  step "GET /health answers {ok:true}" fail "status $STATUS body $BODY"
fi

# 2. photo scan from the golden request, compared with the golden response numbers
call POST /v1/scan "$(cat "$GOLDEN/scan-request-photo.golden.json")"
if [ "$STATUS" != 200 ]; then
  step "POST /v1/scan photo (fixture VLM) matches the golden response" fail "status $STATUS body $BODY"
else
  GOLDEN_RESPONSE="$GOLDEN/scan-response-200.golden.json"
  if jq -e --slurpfile g "$GOLDEN_RESPONSE" '. == $g[0]' <<<"$BODY" >/dev/null; then
    step "POST /v1/scan photo (fixture VLM) matches the golden response" ok
  else
    step "POST /v1/scan photo (fixture VLM) matches the golden response" fail \
      "got $(jq -c '{kcal: .items[0].kcal, mealKcal, scanConfidence}' <<<"$BODY")"
  fi
fi

# 3. barcode lookup that is not found
call POST /v1/barcode/resolve "{\"barcode\":\"$UNKNOWN_BARCODE\"}"
if [ "$STATUS" = 404 ] && [ "$(jq -r .error.code <<<"$BODY")" = BARCODE_NOT_FOUND ]; then
  step "POST /v1/barcode/resolve unknown barcode is a typed 404" ok
else
  step "POST /v1/barcode/resolve unknown barcode is a typed 404" fail "status $STATUS body $BODY"
fi

# 4. food search (seeded cache hit)
call POST /v1/foods/search '{"query":"cheddar"}'
if [ "$STATUS" = 200 ] && [ "$(jq -r '.results[0].source' <<<"$BODY")" = cache ] \
   && [ "$(jq -r '.results[0].per100g.kcal' <<<"$BODY")" = 402 ]; then
  step "POST /v1/foods/search answers a grounded result" ok
else
  step "POST /v1/foods/search answers a grounded result" fail "status $STATUS body $BODY"
fi

# 5. photo scan with a real session instead of the dev token
SESSION_EMAIL="smoke-scan-$RANDOM$RANDOM@example.test"
SESSION_SCAN_ID="$(uuidgen | tr 'A-Z' 'a-z')"
cleanup_session() {
  owner_sql -c "DELETE FROM public.auth_otp_codes WHERE email = '$SESSION_EMAIL'" \
            -c "DELETE FROM public.users WHERE email = '$SESSION_EMAIL'" >/dev/null 2>&1 || true
}
trap 'cleanup_session; cleanup' EXIT
call POST /v1/auth/otp/request "{\"email\":\"$SESSION_EMAIL\"}"
SESSION_CODE="$(grep "\[otp\] code for $SESSION_EMAIL:" "$API_LOG" 2>/dev/null | tail -1 | sed 's/.*: //')"
if [ "$STATUS" = 200 ] && [ -n "$SESSION_CODE" ]; then
  call POST /v1/auth/otp/verify "{\"email\":\"$SESSION_EMAIL\",\"code\":\"$SESSION_CODE\"}"
fi
if [ "$STATUS" != 200 ]; then
  step "POST /v1/scan with a real session (no dev token)" fail "could not sign in: status $STATUS body $BODY"
else
  TOKEN="$(jq -r .tokens.accessToken <<<"$BODY")"
  call POST /v1/scan "$(jq -c --arg id "$SESSION_SCAN_ID" '.scanId = $id' "$GOLDEN/scan-request-photo.golden.json")"
  if [ "$STATUS" = 200 ] && [ "$(jq -r .mealKcal <<<"$BODY")" = "$(jq -r .mealKcal "$GOLDEN/scan-response-200.golden.json")" ]; then
    step "POST /v1/scan with a real session (no dev token)" ok
  else
    step "POST /v1/scan with a real session (no dev token)" fail "status $STATUS body $(head -c 200 <<<"$BODY")"
  fi
  # The account goes away with its data (call() sends no bearer token without a body, so use curl).
  curl -sS -m 30 -o /dev/null -X DELETE "$BASE/v1/account" -H "Authorization: Bearer $TOKEN" || true
fi

exit "$FAILED"
