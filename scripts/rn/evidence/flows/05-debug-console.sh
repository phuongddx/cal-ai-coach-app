#!/usr/bin/env bash
# Flow 05 — the debug console (parity PL-05 evidence).
# coachcal://debug opens the spike/debug console with the four action cards.
# Saves: PL-05/05-debug-console.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
app_open "Today" 90
link "coachcal://debug" "Debug console" 25
sleep 1
shot PL-05 05-debug-console

finish
