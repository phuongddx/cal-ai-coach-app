#!/usr/bin/env bash
# lib.sh — the reusable evidence harness for the React Native migration (unit U-14).
#
# Sourced by scripts/rn/evidence/run-all.sh and every flow under scripts/rn/evidence/flows/.
# Boots the Simulator, installs the already-built dev client, serves the JavaScript from THIS
# worktree with Metro on 8081, drives the app with `axe`, and saves screenshots and transcripts
# under docs/rn-migration/evidence/.
#
# Behavior contract (brief U-14, spec section 9):
# - a failed expectation prints "FAIL", raises FAILS, and the flow goes on;
# - only a broken Simulator, Metro or app is fatal: exit code 90, run-all stops;
# - screenshots: full-size file under docs/rn-migration/evidence/tmp/ (git-ignored), a copy
#   under 2 MB at docs/rn-migration/evidence/<parity-id>/<name>.png;
# - safe under `set -euo pipefail` when every call is checked (`if`, `||`, `&&`); the library
#   itself only sets `set -uo pipefail`.

set -uo pipefail

export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# Repo root (scripts/rn/evidence/lib.sh -> three levels up). Independent of the caller's cwd.
EVID_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# The evidence Simulator is found by name (scripts/rn/sim-udid.sh); SIM_UDID overrides the lookup.
# shellcheck source=../sim-udid.sh
source "$(dirname "${BASH_SOURCE[0]}")/../sim-udid.sh"
UDID="${SIM_UDID:-$(sim_udid)}"
[ -n "$UDID" ] || { echo "FAIL fatal: no available 'iPhone 17 Pro' on iOS 26.4 (see scripts/rn/sim-udid.sh)"; exit 90; }
BUNDLE_ID="${APP_BUNDLE_ID:-com.nextlabs.coachcal}"
# The built Debug dev client (read only, built by the native unit; never rebuilt here).
APP_PATH="${COACHCAL_APP_PATH:-/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-native/apps/mobile/build-output/CoachCal-dev.app}"
DEV_CLIENT_URL="exp+coachcal://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT:-8081}"
METRO_PORT="${METRO_PORT:-8081}"
METRO_STATUS_URL="http://localhost:$METRO_PORT/status"

LOG_DIR="${COACHCAL_LOG_DIR:-/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs}"
EV_DIR="$EVID_REPO_ROOT/docs/rn-migration/evidence"
TMP_DIR="$EV_DIR/tmp"
TRANSCRIPTS_DIR="$EV_DIR/transcripts"
DUMP_FILE="$TMP_DIR/ui-dump.json"
METRO_LOG="${METRO_LOG:-$LOG_DIR/u14-metro.log}"
METRO_PID_FILE="${METRO_PID_FILE:-$LOG_DIR/u14-metro.pid}"

FATAL=90
FAILS=0

mkdir -p "$TMP_DIR" "$TRANSCRIPTS_DIR" "$LOG_DIR"

# --- transcript helpers (same style as scripts/rn/e2e-sync-app.sh) -----------------------------

step() { echo; echo "=== $1 ==="; }
ok() { echo "  ok: $1"; }
bad() { echo "  FAIL: $1"; FAILS=$((FAILS + 1)); }
expect() { if [ "$2" = "$3" ]; then ok "$1 ($3)"; else bad "$1 — expected [$2], got [$3]"; fi; }

# Only for a broken Simulator, Metro or app: stops run-all (exit code 90).
fatal() { echo "  FATAL: $1" >&2; exit "$FATAL"; }

# --- Simulator --------------------------------------------------------------------------------

sim_boot() {
  local state
  state="$(xcrun simctl list devices | grep "$UDID")" || fatal "simulator $UDID not found"
  if grep -q '(Booted)' <<<"$state"; then
    ok "simulator already booted"
  else
    step "booting the simulator"
    xcrun simctl boot "$UDID" || fatal "xcrun simctl boot failed"
    ok "boot command sent"
  fi
  xcrun simctl bootstatus "$UDID" -b >/dev/null || fatal "simulator did not finish booting"
  ok "simulator ready ($UDID)"
}

sim_appearance() {
  local mode="$1"
  xcrun simctl ui "$UDID" appearance "$mode" || fatal "simctl ui appearance $mode failed"
  ok "appearance $mode"
}

# --- app ---------------------------------------------------------------------------------------

app_install_fresh() {
  [ -d "$APP_PATH" ] || fatal "built app missing: $APP_PATH"
  step "fresh install of the built dev client"
  xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$UDID" "$APP_PATH" || fatal "simctl install failed"
  ok "uninstalled + installed $BUNDLE_ID"
  ok "app: $APP_PATH"
}

# Tap the system "Open in CoachCal?" dialog away when it is there. The dialog is native, so
# `axe tap --label Open` works on it (it is the glass in-app surfaces that ignore label taps).
# The dialog can be slow to appear when the simulator sits on the home screen, so keep trying
# for ~10 s; taps without the dialog just fail silently.
dismiss_open_dialog() {
  local i tapped=1
  for i in $(seq 1 20); do
    if axe tap --label Open --udid "$UDID" >/dev/null 2>&1; then
      ok "tapped the Open dialog button"
      tapped=0
      break
    fi
    sleep 0.5
  done
  return "$tapped"
}

# Internal: wait for a screen title, no FAIL bookkeeping (used by the retrying app_open).
# A title proves a screen mounted. Verified on iOS 26.4: during the tab-switch transition the
# incoming title can be reported at an intermediate y (< 200) before it settles (placeholder
# titles settle at y ~ 408), and on the home screen bottom elements report bogus small y. So a
# title that names a tab only counts once it sits below y=200, or (U-79: the real screens put their
# title at y ~ 100) when it is not a tab-bar RadioButton and sits below y=60; Heading titles (Today header,
# nav header) and non-tab titles count anywhere in the content area (y < 700).
_wait_title() {
  local text="$1" sec="${2:-15}" deadline="$((SECONDS + ${2:-15}))" hit tabs
  while (( SECONDS < deadline )); do
    if ui_dump >/dev/null; then
      tabs="$(ui_labels | awk -F'\t' '$2 == "RadioButton" {print $1}' | sort -u)"
      hit="$(ui_labels | awk -F'\t' -v t="$text" '
        $1 == t && $4 < 700 {
          if ($2 ~ /Heading/ || $4 + 0 > 200 || ($2 !~ /RadioButton/ && $4 + 0 > 60)) { print; exit }
        }')"
      if [ -z "$hit" ] && ! grep -qxF -- "$text" <<<"$tabs"; then
        hit="$(ui_labels | awk -F'\t' -v t="$text" '$1 == t && $4 < 700 {print; exit}')"
      fi
      if [ -n "$hit" ]; then
        ok "found title '$text' ($(printf '%s' "$hit" | cut -f2) at y=$(printf '%s' "$hit" | cut -f5))"
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

# Wait for a screen title in the content area. FAIL (not fatal) on timeout.
expect_title() {
  _wait_title "$@" || { bad "title '$1' not on screen within ${2:-15}s"; return 1; }
}

require_title() {
  expect_title "$@" || fatal "the app never showed '$1' — cannot continue"
}

# Open the dev client pointed at Metro and wait for a screen title in the content area
# (not the tab bar). Default: "Today" within 90 s on the second attempt. Fatal: the app never
# became usable. The first attempt allows 45 s; a retry covers a slow dialog or a cold dev client.
#
#   app_open [title] [seconds] [launch argument ...]
#
# Launch arguments (U-79, PL-05) are the Swift app's `--cc*` flags: when any follow the two positional
# parameters the app is terminated and launched with `xcrun simctl launch <udid> <bundle id> <args>`, so
# the process arguments reach the native module that reads them, and only then is the dev client URL
# opened (the running process keeps its arguments). A value belongs in its own argument, as in Swift:
#   app_open Today 90 --ccEDSafe --ccFixedClock 2026-11-27T09:00:00Z --ccScanScenario 402
# Without launch arguments nothing changes: the app is opened through the dev client URL only.
app_open() {
  local text="${1:-Today}" sec="${2:-90}" wait_sec
  local launch_args=()
  if [ "$#" -gt 2 ]; then launch_args=("${@:3}"); fi
  step "opening the app via the dev client URL${launch_args[*]:+ with launch arguments: ${launch_args[*]}}"
  if [ "${#launch_args[@]}" -gt 0 ]; then
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
    sleep 1
    xcrun simctl launch "$UDID" "$BUNDLE_ID" "${launch_args[@]}" >/dev/null \
      || fatal "simctl launch with arguments failed: ${launch_args[*]}"
    ok "launched $BUNDLE_ID with: ${launch_args[*]}"
  fi
  for attempt in 1 2; do
    if ! xcrun simctl openurl "$UDID" "$DEV_CLIENT_URL"; then
      # After a launch with arguments the app already reconnects to the last Metro, so a timed-out
      # openurl is only a note there; without launch arguments it stays a failure.
      if [ "${#launch_args[@]}" -gt 0 ]; then echo "  note: simctl openurl timed out (attempt $attempt)"; else bad "simctl openurl failed (attempt $attempt)"; fi
    fi
    dismiss_open_dialog || true
    if [ "$attempt" -eq 1 ]; then wait_sec=45; else wait_sec="$sec"; fi
    if _wait_title "$text" "$wait_sec"; then
      ok "app is showing '$text' (attempt $attempt)"
      return 0
    fi
    echo "  app did not show '$text' — retrying the dev client URL (attempt $attempt)"
  done
  fatal "the app never showed '$text' — cannot continue"
}

# Terminate and relaunch the built app (it reconnects to the last Metro), wait for a title.
app_relaunch() {
  local text="${1:-Today}" sec="${2:-60}"
  step "relaunching the app"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null || fatal "simctl launch failed"
  require_title "$text" "$sec"
  ok "app relaunched, showing '$text'"
}

# Open any URL (deep link), handle the dialog, wait for a title. Non-fatal: a title that never
# shows only counts as FAIL, so one broken link does not sink the whole run.
link() {
  local url="$1" text="${2:-}" sec="${3:-20}"
  step "deep link: $url"
  xcrun simctl openurl "$UDID" "$url" || { bad "simctl openurl failed for $url"; return 1; }
  dismiss_open_dialog || true
  if [ -n "$text" ]; then
    expect_title "$text" "$sec" || return 1
  fi
  return 0
}

# --- accessibility tree ------------------------------------------------------------------------

# Dump the accessibility tree into a file, print the file name. Empty output is an error.
ui_dump() {
  axe describe-ui --udid "$UDID" >"$DUMP_FILE" 2>/dev/null || return 1
  [ -s "$DUMP_FILE" ] || return 1
  echo "$DUMP_FILE"
}

# "label<TAB>type<TAB>x<TAB>y<TAB>w<TAB>h" for every labeled element, in tree order.
ui_labels() {
  jq -r '.. | objects | select(.AXLabel != null) |
    "\(.AXLabel)\t\(.type)\t\(.frame.x)\t\(.frame.y)\t\(.frame.width)\t\(.frame.height)"' "$DUMP_FILE"
}

wait_for_text() {
  local text="$1" sec="${2:-20}" deadline="$((SECONDS + ${2:-20}))"
  while (( SECONDS < deadline )); do
    if ui_dump >/dev/null && grep -qF -- "$text" "$DUMP_FILE"; then
      ok "found text: $text"
      return 0
    fi
    sleep 1
  done
  bad "text not found within ${sec}s: $text"
  return 1
}

require_text() {
  wait_for_text "$@" || fatal "the app never showed '$1' — cannot continue"
}

# --- input --------------------------------------------------------------------------------------

tap_label() {
  axe tap --label "$1" --udid "$UDID" >/dev/null 2>&1 && { ok "tap --label $1"; return 0; }
  bad "tap --label $1 failed"
  return 1
}

tap_xy() {
  axe tap -x "$1" -y "$2" --udid "$UDID" >/dev/null 2>&1 && { ok "tap at ($1, $2)"; return 0; }
  bad "tap at ($1, $2) failed"
  return 1
}

# Find an element by label (optionally narrowed to an accessibility type) in the last dump and
# tap the center of its frame. This is the reliable way to hit the glass tab bar, where
# `axe tap --label` does not register (spike pitfall 15).
tap_label_xy() {
  local label="$1" type="${2:-}" line x y w h cx cy
  ui_dump >/dev/null || { bad "ui_dump failed before tapping '$label'"; return 1; }
  line="$(ui_labels | awk -F'\t' -v l="$label" -v ty="$type" \
    '(ty == "" || $2 == ty) && $1 == l {print; exit}')"
  if [ -z "$line" ]; then
    bad "no$([ -n "$type" ] && printf ' %s' "$type") element labeled '$label' in the tree"
    return 1
  fi
  x="$(cut -f3 <<<"$line")"; y="$(cut -f4 <<<"$line")"
  w="$(cut -f5 <<<"$line")"; h="$(cut -f6 <<<"$line")"
  cx="$(awk -v x="$x" -v w="$w" 'BEGIN {printf "%d", x + w / 2}')"
  cy="$(awk -v y="$y" -v h="$h" 'BEGIN {printf "%d", y + h / 2}')"
  echo "  tap '$label' ($type) at ($cx, $cy) from frame x=$x y=$y w=$w h=$h"
  tap_xy "$cx" "$cy"
}

type_text() {
  axe type "$1" --udid "$UDID" >/dev/null 2>&1 && { ok "typed: $1"; return 0; }
  bad "axe type failed"
  return 1
}

# --- screenshots --------------------------------------------------------------------------------

# shot <parity-id> <name>: full-size PNG into evidence/tmp/ (untracked), a copy under 2 MB at
# evidence/<parity-id>/<name>.png (the file later units name in parity.tsv).
shot() {
  local parity_id="$1" name="$2" full="$TMP_DIR/$1-$2.png" out="$EV_DIR/$1/$2.png" size
  mkdir -p "$EV_DIR/$1"
  xcrun simctl io "$UDID" screenshot "$full" >/dev/null 2>&1 || { bad "screenshot failed: $1/$2"; return 1; }
  cp "$full" "$out"
  size="$(stat -f%z "$out")"
  if [ "$size" -gt 2097152 ]; then
    sips --resampleWidth 900 "$out" >/dev/null 2>&1
    size="$(stat -f%z "$out")"
    if [ "$size" -gt 2097152 ]; then
      sips --resampleWidth 700 "$out" >/dev/null 2>&1
      size="$(stat -f%z "$out")"
    fi
  fi
  echo "  screenshot: $out ($((size / 1024)) KB)"
  echo "  full-size (untracked): $full"
}

# --- Metro ---------------------------------------------------------------------------------------

metro_running() { [ "$(curl -s --max-time 2 "$METRO_STATUS_URL" 2>/dev/null)" = "packager-status:running" ]; }

metro_start() {
  step "starting Metro on $METRO_PORT"
  if metro_running; then
    fatal "port $METRO_PORT already serves Metro — stop it first (lsof -ti :$METRO_PORT)"
  fi
  if [ -n "$(lsof -ti ":$METRO_PORT" -sTCP:LISTEN 2>/dev/null)" ]; then
    fatal "port $METRO_PORT is already in use by another process"
  fi
  (
    cd "$EVID_REPO_ROOT/apps/mobile" || exit 1
    nohup npx expo start --dev-client --port "$METRO_PORT" >"$METRO_LOG" 2>&1 &
    echo $! >"$METRO_PID_FILE"
  )
  ok "metro pid $(cat "$METRO_PID_FILE"), log $METRO_LOG"
  # Whoever started Metro in this process always stops it, even on a fatal exit.
  trap 'metro_stop >/dev/null 2>&1 || true' EXIT
}

# Poll packager-status until Metro answers; fatal when the process dies early or never serves.
metro_wait() {
  local sec="${1:-120}" deadline="$((SECONDS + ${1:-120}))" pid
  pid="$(cat "$METRO_PID_FILE" 2>/dev/null || true)"
  while (( SECONDS < deadline )); do
    if metro_running; then
      ok "metro answers packager-status:running on $METRO_PORT"
      return 0
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      echo "  metro log tail:" >&2
      tail -n 20 "$METRO_LOG" >&2 || true
      fatal "metro process $pid died before serving"
    fi
    sleep 2
  done
  echo "  metro log tail:" >&2
  tail -n 20 "$METRO_LOG" >&2 || true
  fatal "metro did not answer packager-status:running within ${sec}s"
}

# Stop by the recorded pid; only if the port is still held afterwards, kill exactly the listener
# on the Metro port (never a blanket kill of node processes). Verify the port is free.
metro_stop() {
  step "stopping Metro"
  local pid waited
  pid="$(cat "$METRO_PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ]; then
    kill "$pid" >/dev/null 2>&1 || true
    for waited in $(seq 1 10); do
      [ -z "$(lsof -ti ":$METRO_PORT" -sTCP:LISTEN 2>/dev/null)" ] && break
      sleep 0.5
    done
  fi
  if [ -n "$(lsof -ti ":$METRO_PORT" -sTCP:LISTEN 2>/dev/null)" ]; then
    lsof -ti ":$METRO_PORT" -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true
    sleep 1
  fi
  if [ -n "$(lsof -ti ":$METRO_PORT" -sTCP:LISTEN 2>/dev/null)" ]; then
    bad "something still listens on $METRO_PORT"
    return 1
  fi
  ok "metro stopped, port $METRO_PORT free"
}

# --- end of a flow --------------------------------------------------------------------------------

finish() {
  echo
  echo "=== flow done — $FAILS failed ==="
  exit "$FAILS"
}
