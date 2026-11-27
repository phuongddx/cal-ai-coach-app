#!/usr/bin/env bash
# End-to-end sync scenario, curl-only steps (spec Testing "End-to-end").
# Prerequisite: scripts/rn/start-api.sh is running on a FRESH cluster (PostgreSQL 17 on 5433, API on
# 8787). The server numbers every applied operation of a user from one global sequence, so the first
# two operations get versions 1 and 2 only on an empty database: run `start-api.sh stop` then
# `start-api.sh` again before a second run.
#
#   bash scripts/rn/e2e-sync.sh 2>&1 | tee docs/rn-migration/evidence/spike/item4/e2e-transcript.txt
#
# The app-driven steps (deep links into the simulator) live at the bottom as
# comments; the integration task (T6) runs them.
set -euo pipefail

BASE="${E2E_BASE_URL:-http://127.0.0.1:8787}"
T1='spike-dev-token'
T2='spike-dev-token-2'

step() { echo; echo "=== $1 ==="; }

# Reads a dot path from a JSON document on stdin (node instead of jq: no extra install).
json_get() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const get = (o, path) => path.split(".").reduce((acc, key) => (acc === undefined || acc === null ? undefined : acc[key]), o);
    const value = get(d, process.argv[1]);
    process.stdout.write(typeof value === "undefined" ? "MISSING" : String(value));
  ' "$1"
}

expect() { # description, expected, actual
  if [ "$2" = "$3" ]; then
    echo "  ok: $1 ($3)"
  else
    echo "  FAIL: $1 — expected [$2], got [$3]"
    exit 1
  fi
}

post() { # path, token, body -> prints the response body
  curl -sS -X POST "$BASE$1" \
    -H "Authorization: Bearer $2" \
    -H 'content-type: application/json' \
    -d "$3"
}

# --- The push body for meals A and C (same ids the app's `seed` action uses) ---
PUSH_BODY='{
  "operations": [
    {
      "opId": "eeeeeeee-eeee-4eee-8eee-000000000001",
      "recordId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "kind": "upsert",
      "meal": {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "eatenAt": "2026-11-27T01:00:00.000Z",
        "name": "Overnight oats",
        "kcal": 320, "proteinG": 12, "carbsG": 45, "fatG": 9, "fiberG": 6,
        "updatedAt": 1764200400000
      },
      "clientTimestamp": 1764200400000
    },
    {
      "opId": "eeeeeeee-eeee-4eee-8eee-000000000002",
      "recordId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "kind": "upsert",
      "meal": {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "eatenAt": "2026-11-27T05:40:00.000Z",
        "name": "Chicken rice bowl",
        "kcal": 624, "proteinG": 38, "carbsG": 70, "fatG": 18, "fiberG": 4,
        "updatedAt": 1764210000000
      },
      "clientTimestamp": 1764210000000
    }
  ]
}'

echo "CoachCal RN spike — e2e sync (curl-only steps)"
echo "API: $BASE"

step "1. Push meals A and C (user 1) — both applied, numbered 1 and 2 from the one global sequence"
RESPONSE="$(post /v1/sync/push "$T1" "$PUSH_BODY")"
echo "$RESPONSE"
expect "A status"        "applied" "$(json_get accepted.0.status <<<"$RESPONSE")"
expect "A serverVersion" "1"       "$(json_get accepted.0.record.serverVersion <<<"$RESPONSE")"
expect "C status"        "applied" "$(json_get accepted.1.status <<<"$RESPONSE")"
expect "C serverVersion" "2"       "$(json_get accepted.1.record.serverVersion <<<"$RESPONSE")"

step "2. Pull with cursor 0 (user 1) — 2 rows, hasMore false"
RESPONSE="$(post /v1/sync/pull "$T1" '{"cursor": 0}')"
echo "$RESPONSE"
expect "row count"  "2"     "$(json_get rows.length <<<"$RESPONSE")"
expect "hasMore"    "false" "$(json_get hasMore <<<"$RESPONSE")"
CURSOR="$(json_get cursor <<<"$RESPONSE")"
expect "new cursor" "2" "$CURSOR"

step "3. Replay the same push — duplicates, no new change rows"
RESPONSE="$(post /v1/sync/push "$T1" "$PUSH_BODY")"
echo "$RESPONSE"
expect "A replay status" "duplicate" "$(json_get accepted.0.status <<<"$RESPONSE")"
expect "C replay status" "duplicate" "$(json_get accepted.1.status <<<"$RESPONSE")"
RESPONSE="$(post /v1/sync/pull "$T1" "{\"cursor\": $CURSOR}")"
echo "$RESPONSE"
expect "rows after replay" "0" "$(json_get rows.length <<<"$RESPONSE")"

step "4. Pull with an old cursor (0) — the same rows re-deliver harmlessly"
RESPONSE="$(post /v1/sync/pull "$T1" '{"cursor": 0}')"
echo "$RESPONSE"
expect "row count" "2" "$(json_get rows.length <<<"$RESPONSE")"
expect "A name"    "Overnight oats" "$(json_get rows.0.record.name <<<"$RESPONSE")"

step "5. User 2 sees nothing (users are isolated)"
RESPONSE="$(post /v1/sync/pull "$T2" '{"cursor": 0}')"
echo "$RESPONSE"
expect "user 2 row count" "0" "$(json_get rows.length <<<"$RESPONSE")"

step "6. Contract errors: 401 on a bad token, 400 on an unknown key"
STATUS_BAD_TOKEN="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/sync/pull" \
  -H 'Authorization: Bearer wrong-token' -H 'content-type: application/json' -d '{"cursor":0}')"
expect "bad token" "401" "$STATUS_BAD_TOKEN"
STATUS_UNKNOWN_KEY="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/sync/pull" \
  -H "Authorization: Bearer $T1" -H 'content-type: application/json' -d '{"cursor":0,"since":1}')"
expect "unknown key" "400" "$STATUS_UNKNOWN_KEY"

step "Done — all curl steps green"
cat <<'APP_STEPS'

App-driven steps (integration task T6, via deep links and the [spike] log):
  1. Online:      coachcal://debug?action=seed ; action=sync   → server has A and C (already true above)
  2. Offline:     scripts/start-api.sh stop (server stopped); on the device
                  action=force-offline, action=add-meal (B), action=edit-meal (A 450),
                  action=delete-meal (C); force-stop and relaunch the app; B present,
                  A edited, C gone, outbox = 3.
  3. Start the API again (scripts/start-api.sh), action=force-online, action=sync
                  → 3 operations pushed, outbox = 0, cursor advanced.
  4. curl the pull with the old cursor: A (edited), B, C (deleted).
                  Replay step 3's push body with curl: three `duplicate` answers.
  5. Second device: curl push editing B (user 1 token); the app pulls and shows the edit.
APP_STEPS
