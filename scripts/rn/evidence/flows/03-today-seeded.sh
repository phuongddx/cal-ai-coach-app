#!/usr/bin/env bash
# Flow 03 — the seeded Today screen in light, dark and ED-safe (parity TD-01 evidence).
# Under __DEV__ the Today route takes two query parameters that stand in for launch arguments until
# U-51: `seed=1` writes the demo persona (the seed of the Swift app: target 2150 kcal, streak 12 with
# one freeze, 8 water glasses, one meal a day for seven days) and `edSafe=1` switches ED-safe on.
# Saves: TD-01/today-light.png, today-dark.png, today-edsafe-light.png, today-edsafe-dark.png,
#        today-light-bottom.png (scrolled to the end: the Scan button must not cover a kcal).
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
reset_app_data
app_open "Today" 90

step "seed the demo persona through the dev link"
link "coachcal:///?seed=1&edSafe=0" "Today" 25
wait_for_text "Spaghetti Bolognese" 30 || true
wait_for_text "12 day streak" 10 || true
sleep 1
shot TD-01 today-light

step "scrolled to the end of the list: the Scan button and the last meal's kcal"
axe swipe --start-x 200 --start-y 650 --end-x 200 --end-y 150 --udid "$UDID" >/dev/null 2>&1 || true
sleep 1
shot TD-01 today-light-bottom
axe swipe --start-x 200 --start-y 200 --end-x 200 --end-y 700 --udid "$UDID" >/dev/null 2>&1 || true

step "seeded Today in dark"
sim_appearance dark
sleep 3
wait_for_text "Spaghetti Bolognese" 15 || true
shot TD-01 today-dark

step "ED-safe light and dark"
link "coachcal:///?edSafe=1" "Today" 25
sleep 1.5
wait_for_text "On track" 15 || true
if ui_dump >/dev/null && grep -qF "Health Score" "$DUMP_FILE"; then bad "Health Score is still on screen under ED-safe"; else ok "no Health Score under ED-safe"; fi
shot TD-01 today-edsafe-dark
sim_appearance light
sleep 3
shot TD-01 today-edsafe-light

step "leave ED-safe off for the flows that follow"
link "coachcal:///?edSafe=0" "Today" 25
sim_appearance light

finish
