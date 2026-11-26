#!/usr/bin/env bash
#
# Measurements for the CoachCal RN spike (spec D6): app size, idle memory, cold start.
#
# Usage:
#   scripts/measure.sh debug|release          # everything, writes evidence/measurements/<mode>.txt
#   MEASURE_RUNTIME=0 scripts/measure.sh debug # dry run: only the size branch (no simulator)
#
# The built app is the newest CoachCalSpike.app under
# ~/Library/Developer/Xcode/DerivedData/CoachCalSpike-*/Build/Products/<Debug|Release>-iphonesimulator/.
# Cold start needs the T1 marker file (first-render.txt, written on the Ember screen's first
# React commit), so a full run only makes sense after the integration task (plan T6/T7).
#
# Simulator: iPhone 17 Pro, iOS 26.4 (UDID 85024D2F-71DE-43C0-8E11-CE58F4578FC3).
# All numbers are Simulator numbers (spec D6 says so, never an App Store thinned size).

set -euo pipefail

MODE="${1:-}"
UDID="85024D2F-71DE-43C0-8E11-CE58F4578FC3"
BUNDLE_ID="com.nextlabs.coachcal.rnspike"
IDLE_WAIT_SEC=15
COLD_STARTS=5
COLD_START_TIMEOUT_SEC=120

case "$MODE" in
  debug) PRODUCTS_DIR="Debug-iphonesimulator" ;;
  release) PRODUCTS_DIR="Release-iphonesimulator" ;;
  *)
    echo "usage: scripts/measure.sh <debug|release>  (MEASURE_RUNTIME=0 for size-only dry run)" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_FILE="$ROOT_DIR/evidence/measurements/$MODE.txt"
RUNTIME="${MEASURE_RUNTIME:-1}"

# host time in ms; macOS date has no %N, perl's Time::HiRes ships with the system.
now_ms() { perl -MTime::HiRes=time -e 'printf "%.0f\n", time() * 1000'; }

APP_PATH="$(ls -td ~/Library/Developer/Xcode/DerivedData/CoachCalSpike-*/Build/Products/$PRODUCTS_DIR/CoachCalSpike.app 2>/dev/null | head -1 || true)"
if [ -z "$APP_PATH" ]; then
  echo "error: no CoachCalSpike.app under DerivedData for $PRODUCTS_DIR — build it first:" >&2
  echo "  cd apps/mobile && CI=1 npx expo run:ios${MODE:+ --configuration Release} --no-bundler --device $UDID" >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/evidence/measurements"

{
  echo "# CoachCalSpike measurements — $MODE build ($(date '+%Y-%m-%d %H:%M:%S %Z'))"
  echo "# Simulator iPhone 17 Pro, iOS 26.4, UDID $UDID. All numbers are Simulator numbers."
  echo "# app: $APP_PATH"
  echo ""
} >"$OUT_FILE"

# ---------------------------------------------------------------- size

APP_KB="$(du -sk "$APP_PATH" | awk '{print $1}')"
ZIP_PATH="$(mktemp -t coachcal-spike.XXXXXX).zip"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
ZIP_KB="$(du -sk "$ZIP_PATH" | awk '{print $1}')"
rm -f "$ZIP_PATH"
APP_MB="$(awk -v kb="$APP_KB" 'BEGIN{printf "%.1f", kb/1024}')"
ZIP_MB="$(awk -v kb="$ZIP_KB" 'BEGIN{printf "%.1f", kb/1024}')"

{
  echo "## Size ($MODE)"
  echo "metric          value"
  echo "app (.app)      $APP_KB kB  ($APP_MB MB)"
  echo "zipped (.zip)   $ZIP_KB kB  ($ZIP_MB MB)"
  echo ""
} | tee -a "$OUT_FILE"

if [ "$RUNTIME" = "0" ]; then
  echo "MEASURE_RUNTIME=0 — size-only dry run; idle memory and cold start not measured." | tee -a "$OUT_FILE"
  exit 0
fi

# ---------------------------------------------------------------- simulator up

xcrun simctl bootstatus "$UDID" -b >/dev/null

if [ "$MODE" = "debug" ]; then
  if ! curl -s --max-time 2 http://localhost:8081/status | grep -q packager-status:running; then
    echo "warning: Metro is not running on :8081 — a debug cold start stalls on the" | tee -a "$OUT_FILE"
    echo "warning: dev-client launcher screen until the bundle loads. Start Metro first:" | tee -a "$OUT_FILE"
    echo "warning:   cd apps/mobile && npx expo start --dev-client --port 8081" | tee -a "$OUT_FILE"
  fi
fi

CONTAINER="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
if [ -z "$CONTAINER" ]; then
  echo "error: app $BUNDLE_ID is not installed on $UDID — launch it once with expo run:ios" >&2
  exit 1
fi
MARKER="$CONTAINER/Documents/first-render.txt"

# ---------------------------------------------------------------- idle memory

# A fresh launch for the idle reading, so the 15 s idle window starts from launch.
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
LAUNCH_OUT="$(xcrun simctl launch "$UDID" "$BUNDLE_ID")"
IDLE_PID="$(echo "$LAUNCH_OUT" | awk -F': ' '{print $NF}')"
sleep "$IDLE_WAIT_SEC"

FOOTPRINT="$(vmmap -summary "$IDLE_PID" 2>/dev/null | awk '/Physical footprint:/ {print $3; exit}' || echo unavailable)"
RSS_KB="$(ps -o rss= -p "$IDLE_PID" 2>/dev/null | tr -d ' ' || echo unavailable)"

if [ "$RSS_KB" != "unavailable" ] && [ -n "$RSS_KB" ]; then
  RSS_MB="$(awk -v kb="$RSS_KB" 'BEGIN{printf "%.1f", kb/1024}')"
  RSS_LINE="rss (ps)             $RSS_KB kB  ($RSS_MB MB)"
else
  RSS_LINE="rss (ps)             unavailable"
fi

{
  echo "## Idle memory after ${IDLE_WAIT_SEC}s (pid $IDLE_PID)"
  echo "metric               value"
  echo "physical footprint   ${FOOTPRINT:-unavailable}"
  echo "$RSS_LINE"
  echo ""
} | tee -a "$OUT_FILE"

# ---------------------------------------------------------------- cold start

echo "## Cold start ($COLD_STARTS runs: terminate -> launch -> first-render.txt appears)" | tee -a "$OUT_FILE"
COLD_VALUES=()
for i in $(seq 1 "$COLD_STARTS"); do
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  rm -f "$MARKER"

  T0="$(now_ms)"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null

  ELAPSED="timeout"
  DEADLINE=$((SECONDS + COLD_START_TIMEOUT_SEC))
  while [ "$SECONDS" -lt "$DEADLINE" ]; do
    if [ -f "$MARKER" ]; then
      ELAPSED=$(( $(now_ms) - T0 ))
      break
    fi
    sleep 0.1
  done

  COLD_VALUES+=("$ELAPSED")
  echo "run $i: $ELAPSED ms" | tee -a "$OUT_FILE"
done

MEDIAN="$(printf '%s\n' "${COLD_VALUES[@]}" | sort -n | sed -n '3p')"
echo "median: $MEDIAN ms (of ${COLD_VALUES[*]})" | tee -a "$OUT_FILE"

{
  echo ""
  echo "Notes: cold start is host time from the simctl launch call until first-render.txt appears;"
  echo "it includes simctl overhead, it is not a frame time (spec D6). Debug runs include the"
  echo "Metro bundle load unless the bundle was already cached by the dev client."
} >>"$OUT_FILE"

echo "" | tee -a "$OUT_FILE"
echo "evidence written to $OUT_FILE"
