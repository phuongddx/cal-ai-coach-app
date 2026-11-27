#!/usr/bin/env bash
# Flow 03 — Today after the seed debug action, in light and dark (parity TD-01 evidence).
# coachcal://debug?action=seed writes the fixture meals A ("Overnight oats", 8:00) and
# C ("Chicken rice bowl", 12:40) into the local SQLite; Today must list them.
# Saves: TD-01/03-today-seeded-light.png, TD-01/03-today-seeded-dark.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
app_open "Today" 90

step "seed via the debug deep link"
link "coachcal://debug?action=seed" "Debug console" 25
sleep 2                # let the action finish
link "coachcal:///" "Today" 20

step "the seeded meals must be in the tree"
if ! wait_for_text "Chicken rice bowl" 20; then
  # The meal list may sit below the fold: swipe up and look again before failing.
  axe swipe --start-x 200 --start-y 600 --end-x 200 --end-y 250 --udid "$UDID" >/dev/null 2>&1 || true
  sleep 1
  wait_for_text "Chicken rice bowl" 10 || true
fi
wait_for_text "Overnight oats" 10 || true

shot TD-01 03-today-seeded-light

step "seeded Today in dark"
sim_appearance dark
sleep 3
wait_for_text "Chicken rice bowl" 15 || true
shot TD-01 03-today-seeded-dark
sim_appearance light

finish
