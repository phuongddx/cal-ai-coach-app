#!/usr/bin/env bash
# Flow 02 — the three other tabs and back to Today (parity PL-01 evidence).
# Label taps do not register on the glass tab bar (spike pitfall 15), so every tab is tapped at
# the center of its RadioButton frame found in the accessibility dump.
# A tab is recognised by what its own screen shows (U-79): Progress has a title "Progress"; Coach and
# Profile have no title of their own (the tab name only exists in the tab bar), so they are
# recognised by their first section heading, which no other tab shows (U-76e: Ember's U-75 and U-77 screens
# renamed the headings, so the markers follow them: INSIGHTS on Coach, PLAN on Profile).
# Saves: PL-01/02-tab-progress.png, PL-01/02-tab-coach.png, PL-01/02-tab-profile.png
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
app_open "Today" 90

for entry in "Progress|Progress" "Coach|INSIGHTS" "Profile|PLAN"; do
  tab="${entry%%|*}"
  marker="${entry#*|}"
  step "tab: $tab"
  tap_label_xy "$tab" RadioButton || continue
  sleep 1.5
  expect_title "$marker" 10
  shot PL-01 "02-tab-$(tr '[:upper:]' '[:lower:]' <<<"$tab")"
done

step "back to Today"
tap_label_xy "Today" RadioButton || true
sleep 1.5
expect_title "Today" 10

finish
