#!/usr/bin/env bash
# Flow 01 — first launch in light and dark (parity PL-01 evidence).
# Fresh install, open via the dev client, wait for Today, screenshot in light, then dark.
# Saves: PL-01/01-first-launch-light.png, PL-01/01-first-launch-dark.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
app_install_fresh
app_open "Today" 150   # first launch builds the Metro bundle; generous timeout

shot PL-01 01-first-launch-light

step "switch to dark"
sim_appearance dark
sleep 3                # RN re-renders on the appearance change
wait_for_text "Today" 15 || true
shot PL-01 01-first-launch-dark
sim_appearance light   # leave the simulator light for the flows that follow

finish
