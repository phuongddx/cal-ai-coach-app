#!/usr/bin/env bash
# Flow 07 — a saved scan survives quitting the app (parity DB-01 evidence).
# Seed the demo day, scan (200 scenario) and save to Lunch, terminate the app, relaunch it, and
# screenshot Today with the meal listed. Saves: DB-01/today-before-save, DB-01/today-after-relaunch.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
reset_app_data
app_open "Today" 90

step "seed the demo day (a known starting total)"
link "coachcal:///?seed=1&edSafe=0" "Today" 25
wait_for_text "12 day streak" 15 || true
sleep 1
shot DB-01 today-before-save

step "scan and save to Lunch"
link "coachcal://scan?scenario=200&capture=fixture" "" 5
wait_for_text "Capture photo, button" 25 || true
tap_label "Capture photo, button" || true
wait_for_text "Save to Lunch" 45 || true
sleep 1
tap_label "Save to Lunch" || true
wait_for_text "Saved to Lunch" 45 || true
sleep 3   # let the single-transaction write settle before the process is killed

step "quit and relaunch the app"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 2
app_open "Today" 90
wait_for_text "12 day streak" 20 || true
wait_for_text "Scanned meal" 20 || true
sleep 1
ui_dump >/dev/null && ui_labels | cut -f1 | head -40
shot DB-01 today-after-relaunch

finish
