#!/usr/bin/env bash
# Flow 06 — the launch arguments on a device (parity PL-05 evidence, U-81).
# Each Swift `--cc*` argument that U-79 did not launch is launched here on the seeded app, and the
# effect is read from the screen: a switch of the Debug console (the CheckBox value is 1) or the
# route the root gate shows. `--ccFreshStart` runs LAST: it wipes the local data, so the app that
# follows shows onboarding again. Saves: PL-05/launch-args-fresh-start.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

# The value of a Debug console switch in the last dump: "1" or "0" (empty when the row is missing).
flag_value() {
  ui_labels_with_value | awk -F'\t' -v t="$1" '$1 == t && $2 == "CheckBox" {print $3; exit}'
}
ui_labels_with_value() {
  jq -r '.. | objects | select(.AXLabel != null) | "\(.AXLabel)\t\(.type)\t\(.AXValue)"' "$DUMP_FILE"
}
console_flag() { # <flag title> <expected value>
  ui_dump >/dev/null || { bad "ui_dump failed"; return 1; }
  expect "switch $1 on the Debug console" "$2" "$(flag_value "$1")"
}

sim_boot
app_open "Today" 120   # the seeded app (flow 01)

step "--ccForceOffline: the sync engine reports offline"
app_open "Today" 90 --ccForceOffline
link "coachcal://debug" "Debug console" 25
sleep 2
console_flag "--ccForceOffline" 1
wait_for_text "Ember offline chip follows the engine: offline" 20 || true

step "--ccDisableAnimations: the switch is set at launch"
app_open "Today" 90 --ccDisableAnimations
link "coachcal://debug" "Debug console" 25
sleep 2
console_flag "--ccDisableAnimations" 1

step "--ccFixtureCapture: the scan flow uses fixtures"
app_open "Today" 90 --ccFixtureCapture
link "coachcal://debug" "Debug console" 25
sleep 2
console_flag "--ccFixtureCapture" 1

step "--ccRequireSignIn: the gate asks for a session (seeded target, no session)"
app_open "Sign in to CoachCal" 90 --ccRequireSignIn
shot PL-05 launch-args-require-sign-in
link "coachcal://debug" "Debug console" 25
sleep 2
console_flag "--ccRequireSignIn" 1

step "--ccFreshStart: the local data is wiped, so the gate shows onboarding"
app_open "Track calories with a photo" 120 --ccFreshStart
wait_for_text "Get started" 15 || true
shot PL-05 launch-args-fresh-start

finish
