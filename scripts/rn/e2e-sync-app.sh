#!/usr/bin/env bash
# App-driven end-to-end sync scenario (spike item 4, steps 1-5), run on the iOS Simulator.
#
# The app side reads the shipped local schema (U-12): the mirror `diary_entries` (+ the nutrition in
# `diary_entry_details`), the outbox `pending_ops` (`quarantined` column) and the single-row
# `sync_state` (`pull_cursor`). This script was repointed from the spike tables in unit U-23 and has
# NOT been run: that unit has no Simulator. The first run on a Simulator is the check.
#
# Prerequisites: the dev client is installed on the booted simulator, Metro runs and
# writes its output to $METRO_LOG, `axe` is installed, scripts/rn/start-api.sh is NOT
# running (this script starts a fresh PostgreSQL + API itself, then stops only the API
# for the offline step so the data survives). The dev client talks to the API as the debug user
# (`extra.apiToken` = spike-dev-token); the server numbers operations from one global sequence, so on
# the fresh cluster A and C get versions 1 and 2.
#
#   bash scripts/rn/e2e-sync-app.sh 2>&1 | tee evidence/item4/e2e-app-transcript.txt
#
# Deep links: `xcrun simctl openurl` opens coachcal://debug?action=<name>. When iOS asks
# "Open in CoachCal?" the script presses Open with `axe tap --label Open`.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=sim-udid.sh
source "$(dirname "${BASH_SOURCE[0]}")/sim-udid.sh"
UDID="${SIM_UDID:-$(sim_udid)}"
[ -n "$UDID" ] || { echo "no available 'iPhone 17 Pro' on iOS 26.4 (see scripts/rn/sim-udid.sh)"; exit 2; }
BUNDLE=com.nextlabs.coachcal
LOG_DIR="${RN_SPIKE_LOG_DIR:-/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs}"
METRO_LOG="${METRO_LOG:-$LOG_DIR/t6-metro.log}"
EVID="${EVID:-$ROOT/evidence/item4}"
BASE=http://127.0.0.1:8787
STATE_FILE="$LOG_DIR/api-dev.state"
T1=spike-dev-token
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
A=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
B=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
C=cccccccc-cccc-4ccc-8ccc-cccccccccccc
FAILS=0
mkdir -p "$EVID"

step() { echo; echo "=== $1 ==="; }
ok() { echo "  ok: $1"; }
bad() { echo "  FAIL: $1"; FAILS=$((FAILS + 1)); }
expect() { if [ "$2" = "$3" ]; then ok "$1 ($3)"; else bad "$1 — expected [$2], got [$3]"; fi; }
# Every spike deep link lands on the Spike tab; coachcal:/// is the route of the Ember tab
# (axe taps on the glass tab bar do not register).
show_ember() {
  xcrun simctl openurl "$UDID" "coachcal:///"
  sleep 1.5
  axe tap --label Open --udid "$UDID" >/dev/null 2>&1 || true
  sleep 1.5
}
shot() { xcrun simctl io "$UDID" screenshot "$EVID/$1.png" >/dev/null 2>&1 && echo "  screenshot: $EVID/$1.png"; }

log_lines() { wc -l <"$METRO_LOG" | tr -d ' '; }
spike_lines_since() { tail -n +"$(($1 + 1))" "$METRO_LOG" | grep -a '\[spike\]' | cut -c1-420; }

# Open a deep link, press Open when iOS asks, wait for the action to finish, print its log lines.
link() { # action [extra query]
  local action="$1" extra="${2:-}" before i
  before="$(log_lines)"
  xcrun simctl openurl "$UDID" "coachcal://debug?action=$action${extra:+&$extra}"
  for i in $(seq 1 25); do
    sleep 1
    if tail -n +"$((before + 1))" "$METRO_LOG" | grep -aq "\"event\":\"action-done\",\"data\":{\"name\":\"$action\""; then
      spike_lines_since "$before" | sed 's/^/  | /'
      sleep 1
      return 0
    fi
    axe tap --label Open --udid "$UDID" >/dev/null 2>&1 || true
  done
  bad "action $action did not finish within 25 s"
  spike_lines_since "$before" | sed 's/^/  | /'
  return 1
}

app_db() { find "$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)/Documents/SQLite" -name coachcal.db | head -1; }
q() { sqlite3 "$(app_db)" "$1"; }
outbox_pending() { q "select count(*) from pending_ops where quarantined=0"; }
outbox_quarantined() { q "select count(*) from pending_ops where quarantined=1"; }
app_cursor() { q "select pull_cursor from sync_state where id=1"; }
# name | kcal | deleted flag, one row per diary entry (the nutrition lives in diary_entry_details).
MEAL_SELECT="select e.display_text||' | '||coalesce(d.kcal,'?')||' kcal | deleted='||(e.deleted_at is not null) from diary_entries e left join diary_entry_details d on d.entry_id=e.id"
meals_dump() { q "$MEAL_SELECT order by e.created_at"; }

json_get() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const v = process.argv[1].split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
    process.stdout.write(v === undefined ? "MISSING" : String(v));
  ' "$1"
}
post() { curl -sS -X POST "$BASE$1" -H "Authorization: Bearer $2" -H 'content-type: application/json' -d "$3"; }

# Stop or restart only the API process; PostgreSQL keeps running so the rows stay.
api_down() {
  # shellcheck disable=SC1091
  source "$STATE_FILE"
  kill "$API_PID" >/dev/null 2>&1 || true
  lsof -ti :8787 -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true
  sleep 1
}
api_up() {
  # The same environment scripts/rn/start-api.sh gives the API; fresh secrets are fine (dev tokens).
  (
    cd "$ROOT/apps/api"
    DATABASE_URL="postgres://coachcal_api@127.0.0.1:5433/coachcal" PORT=8787 AUTH_DEV_TOKENS=1 VLM_PROVIDER=fixture \
      AUTH_JWT_SECRET="$(openssl rand -hex 32)" AUTH_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
      RC_WEBHOOK_SIGNING_SECRET="$(openssl rand -hex 32)" OTP_SENDER=log \
      nohup npx tsx src/index.ts >>"$LOG_DIR/api-dev.log" 2>&1 &
    echo $! >"$LOG_DIR/api-dev.pid"
  )
  for _ in $(seq 1 60); do curl -fs "$BASE/health" >/dev/null 2>&1 && break; sleep 0.5; done
  sed -i '' "s/^API_PID=.*/API_PID=$(cat "$LOG_DIR/api-dev.pid")/" "$STATE_FILE"
}
relaunch_app() {
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  local before
  before="$(log_lines)"
  xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
  for _ in $(seq 1 60); do
    sleep 1
    tail -n +"$((before + 1))" "$METRO_LOG" | grep -aq '"event":"binding-started"' && break
  done
  sleep 3
}

step "0. Fresh start: new PostgreSQL + API, empty app state"
bash "$ROOT/scripts/rn/start-api.sh" stop >/dev/null 2>&1 || true
bash "$ROOT/scripts/rn/start-api.sh" | sed 's/^/  /' | grep -E 'ready|API:'
curl -fs "$BASE/health" && echo
relaunch_app
link reset
shot e2e-0-empty

step "1. Online: seed A and C, sync — the server holds both"
link seed
link sync
ROWS="$(post /v1/sync/pull $T1 '{"cursor":0}')"
echo "  server pull(0): $(echo "$ROWS" | cut -c1-260)..."
expect "server rows" 2 "$(json_get rows.length <<<"$ROWS")"
expect "A serverVersion" 1 "$(json_get rows.0.record.serverVersion <<<"$ROWS")"
expect "app outbox" 0 "$(outbox_pending)"
expect "app quarantined" 0 "$(outbox_quarantined)"
CURSOR1="$(app_cursor)"
expect "app cursor" 2 "$CURSOR1"
show_ember
shot e2e-1-online-seeded

step "2. Offline: stop the API, force-offline, add B, edit A, delete C, kill and relaunch the app"
api_down
if curl -fs --max-time 2 "$BASE/health" >/dev/null 2>&1; then bad "API still answers"; else ok "API is down"; fi
link force-offline
show_ember
shot e2e-2a-offline-chip
link add-meal
link edit-meal
link delete-meal
echo "  app meals before the kill:"; meals_dump | sed 's/^/    /'
expect "outbox before kill" 3 "$(outbox_pending)"
echo "  --- force-stop and relaunch the app (server still down) ---"
relaunch_app
echo "  app meals after the relaunch:"; meals_dump | sed 's/^/    /'
expect "outbox survives the kill" 3 "$(outbox_pending)"
expect "B present"  "Protein shake | 210 kcal | deleted=0" "$(q "$MEAL_SELECT where e.id='$B'")"
expect "A edited"   "450" "$(q "select kcal from diary_entry_details where entry_id='$A'")"
expect "C gone locally" 0 "$(q "select count(*) from diary_entries where id='$C' and deleted_at is null")"
expect "C tombstone queued" 1 "$(q "select count(*) from pending_ops where record_id='$C' and kind='tombstone' and quarantined=0")"
show_ember
shot e2e-2b-after-relaunch-offline
# Keep the three pending operations: they are the push body replayed in step 4. The wire operation is
# rebuilt from the outbox row and the mirror + details rows (the outbox keeps only the mirror
# snapshot). Unverified without a Simulator: a body the server rejects fails step 4 loudly.
node -e '
  const rows = JSON.parse(process.argv[1] || "[]");
  const iso = (v) => new Date(/Z|[+-]\d\d:?\d\d$/.test(String(v)) ? String(v) : String(v).replace(" ", "T") + "Z").toISOString();
  const ops = rows.map((r) => {
    const stamp = new Date(iso(r.client_timestamp)).getTime();
    const base = { opId: r.op_id, recordId: r.record_id, kind: r.kind, clientTimestamp: stamp };
    if (r.kind === "tombstone") return base; // a tombstone carries no meal
    return {
      ...base,
      meal: {
        id: r.record_id,
        eatenAt: iso(r.created_at),
        name: r.display_text,
        kcal: r.kcal ?? 0, proteinG: r.protein_g ?? 0, carbsG: r.carbs_g ?? 0, fatG: r.fat_g ?? 0, fiberG: r.fiber_g ?? 0,
        updatedAt: stamp,
      },
    };
  });
  process.stdout.write(JSON.stringify({ operations: ops }));
' "$(sqlite3 -json "$(app_db)" "select p.op_id, p.record_id, p.kind, p.client_timestamp, e.created_at, e.display_text, d.kcal, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g from pending_ops p join diary_entries e on e.id=p.record_id left join diary_entry_details d on d.entry_id=p.record_id where p.quarantined=0 order by p.created_at")" >"$EVID/e2e-replay-body.json"
echo "  replay body saved: $EVID/e2e-replay-body.json ($(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).operations.length)' "$EVID/e2e-replay-body.json") operations)"

step "3. API back, foreground app, force-online, sync — 3 operations pushed, outbox 0"
api_up
curl -fs "$BASE/health" && echo
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
sleep 2
link force-online
link sync
sleep 2
expect "outbox after sync" 0 "$(outbox_pending)"
expect "quarantined" 0 "$(outbox_quarantined)"
echo "  app cursor now: $(app_cursor)"
shot e2e-3-after-resync

step "4. Server side: old-cursor pull, replayed push answers duplicate"
RESP="$(post /v1/sync/pull $T1 "{\"cursor\": $CURSOR1}")"
echo "  server pull($CURSOR1): $RESP" | cut -c1-900
expect "rows after the old cursor" 3 "$(json_get rows.length <<<"$RESP")"
ALL="$(post /v1/sync/pull $T1 '{"cursor":0}')"
echo "$ALL" | node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  for (const r of d.rows) console.log("  seq " + r.seq + " " + r.record.name + " | " + r.record.kcal + " kcal | deleted=" + r.record.deleted + " | v" + r.record.serverVersion);
'
REPLAY="$(post /v1/sync/push $T1 "$(cat "$EVID/e2e-replay-body.json")")"
echo "  replayed push: $REPLAY" | cut -c1-600
expect "replay op 1" duplicate "$(json_get accepted.0.status <<<"$REPLAY")"
expect "replay op 2" duplicate "$(json_get accepted.1.status <<<"$REPLAY")"
expect "replay op 3" duplicate "$(json_get accepted.2.status <<<"$REPLAY")"
AFTER="$(post /v1/sync/pull $T1 '{"cursor":0}')"
expect "no new change rows after the replay" "$(json_get cursor <<<"$ALL")" "$(json_get cursor <<<"$AFTER")"

step "5. Second device: curl edits B, the app pulls it"
OPID="$(node -e 'console.log(require("crypto").randomUUID())')"
BODY="$(node -e '
  const rows = JSON.parse(process.argv[1]).rows;
  const b = rows.find((r) => r.record.id === process.argv[2]).record;
  const meal = { id: b.id, eatenAt: b.eatenAt, name: "Protein shake (edited on device 2)", kcal: 260, proteinG: b.proteinG, carbsG: b.carbsG, fatG: b.fatG, fiberG: b.fiberG, updatedAt: Date.now() };
  process.stdout.write(JSON.stringify({ operations: [{ opId: process.argv[3], recordId: b.id, kind: "upsert", meal, clientTimestamp: Date.now() }] }));
' "$ALL" "$B" "$OPID")"
SECOND="$(post /v1/sync/push $T1 "$BODY")"
echo "  second-device push: $SECOND" | cut -c1-500
expect "second device accepted" applied "$(json_get accepted.0.status <<<"$SECOND")"
link sync
echo "  app meals now:"; meals_dump | sed 's/^/    /'
expect "app pulled the second-device edit" "Protein shake (edited on device 2) | 260 kcal | deleted=0" \
  "$(q "$MEAL_SELECT where e.id='$B'")"
expect "outbox still empty" 0 "$(outbox_pending)"
sleep 1
shot e2e-5-second-device-edit
show_ember
shot e2e-5-ember-after-pull

step "Done — $FAILS failed check(s)"
exit "$FAILS"
