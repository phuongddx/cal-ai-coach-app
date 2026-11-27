#!/usr/bin/env bash
# Flow 04 — the diary sheet (parity DY-01 evidence).
# coachcal://diary opens the diary route (formSheet with grabber per the root layout).
# Saves: DY-01/04-diary-sheet.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
app_open "Today" 90
link "coachcal://diary" "" 5
wait_for_text "Eaten" 25 || true   # the day sheet has no "Diary" title: its header is the date
sleep 1
shot DY-01 04-diary-sheet

finish
