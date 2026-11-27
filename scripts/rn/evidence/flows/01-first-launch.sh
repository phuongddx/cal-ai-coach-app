#!/usr/bin/env bash
# Flow 01 — first launch (parity PL-01 evidence), in two parts.
#
# Part 1 is the real behavior: a fresh install has no target, so the root gate shows onboarding
# (U-81 fixed a navigator that showed the Debug console instead). Saves PL-01/fresh-install-after.png.
#
# Part 2 brings the app to the seeded Today that flows 02 to 05 need. The nine onboarding steps are not
# walked here (stage B of U-73 walks them on the Simulator; the development client holds ExpoCrypto, found
# by searching its marker string in CoachCal.debug.dylib), so the demo persona is seeded the way the Debug console does it:
# launch once with --ccSeedNoTargets (the shell without a target), open coachcal:///?seed=1, stop the app.
# The target is then stored and every later launch shows Today. Saves PL-01/01-first-launch-{light,dark}.png.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
app_install_fresh

step "part 1: a fresh install shows onboarding"
app_open "Track calories with a photo" 150   # first launch builds the Metro bundle; generous timeout
wait_for_text "Get started" 15 || true
if ui_dump >/dev/null && grep -qF "Debug console" "$DUMP_FILE"; then bad "the Debug console is on screen of a fresh install"; fi
shot PL-01 fresh-install-after

step "part 2: seed the demo persona, then show Today"
app_open "Today" 120 --ccSeedNoTargets
link "coachcal:///?seed=1" "Today" 25
wait_for_text "Spaghetti Bolognese" 30 || bad "the demo persona was not seeded"
sleep 2
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 1
app_open "Today" 90

shot PL-01 01-first-launch-light

step "switch to dark"
sim_appearance dark
sleep 3                # RN re-renders on the appearance change
wait_for_text "Today" 15 || true
shot PL-01 01-first-launch-dark
sim_appearance light   # leave the simulator light for the flows that follow

finish
