#!/usr/bin/env bash
# Flow 04 — the diary sheet (parity DY-01 evidence).
# coachcal://diary opens the diary route (formSheet with grabber per the root layout). The sheet has no
# "Diary" title: it is recognised by its date title ("Friday, Nov 27") and its meal sections.
# Saves: DY-01/04-diary-sheet.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
app_open "Today" 90
link "coachcal://diary" "" 5
step "the diary sheet shows its date title and the meal sections"
sheet_seen=0
for _ in $(seq 1 25); do
  if ui_dump >/dev/null \
     && ui_labels | awk -F'\t' '$1 ~ /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z][a-z] [0-9]+$/ && $4 < 400 {f=1} END {exit !f}' \
     && grep -qF "Breakfast" "$DUMP_FILE"; then
    sheet_seen=1
    break
  fi
  sleep 1
done
if [ "$sheet_seen" = 1 ]; then ok "the diary sheet is open (date title and Breakfast section)"; else bad "the diary sheet did not open within 25s"; fi
sleep 1
shot DY-01 04-diary-sheet

finish
