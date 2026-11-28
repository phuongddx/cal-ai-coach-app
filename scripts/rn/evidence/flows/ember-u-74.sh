#!/usr/bin/env bash
# Flow ember-u-74 — the U-74 stage B evidence: the diary on the Ember design (DY-01…DY-08).
#
# Data: a wiped local store seeds the demo persona (?seed=1: the target, the water card, the
# exercise row, the saved rail and the search catalog) plus the Debug console's meal seed
# (coachcal://debug?action=seed: "Overnight oats" into Breakfast and "Chicken rice bowl" into
# Lunch of today — the names the frames draw). The day's detail-backed entry is the persona's
# "Spaghetti Bolognese" (Dinner, 350 g), so the edit / delete / undo states run on it.
# Light first, then dark, then the ED-Safe launches (--ccEDSafe), then High Contrast; a full
# re-seed separates the phases, so one phase's "Edited" chip never leaks into a frame that draws
# none. The diary sheet is dragged to the large detent before its rows (frame 10 is large). The
# search query goes in through the clipboard paste — `axe type` drops characters against the
# compiler-memoized controlled input (the stage-B finding, fixed in FoodSearchView).
# Screenshots: docs/rn-migration/evidence/DY-0x/u74-*.png; the rows land in
# docs/rn-migration/evidence/ember/U-74.md (written with scripts/rn/evidence/side-by-side.mjs).
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

# lib.sh's shot keeps the parity 2 MB rule; the side-by-side rows refuse shots over 700 KB, so the
# flow resamples an oversized shot right after the capture.
shot_u74() {
  local id="$1" name="$2" path size
  shot "$id" "$name" || return 1
  path="$EV_DIR/$1/$2.png"
  size="$(stat -f%z "$path" 2>/dev/null || echo 0)"
  if [ "$size" -gt 716800 ]; then
    sips --resampleWidth 900 "$path" >/dev/null 2>&1 || true
    ok "resampled $path (700 KB rule of side-by-side.mjs)"
  fi
}

# The diary sheet has no title of its own: it is recognised by its date title plus a meal
# section. The large detent is proven by the title sitting above y 400 (the half-detent title
# sits at y ~476); the drag retries — a swipe during the presentation animation dismisses it.
wait_diary_large() {
  local i
  for i in $(seq 1 15); do
    if ui_dump >/dev/null \
       && ui_labels | awk -F'\t' '$1 ~ /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z][a-z] [0-9]+$/ && $4 < 700 {f=1} END {exit !f}' \
       && grep -qF "Breakfast" "$DUMP_FILE"; then
      break
    fi
    sleep 1
  done
  sleep 1
  for i in 1 2 3; do
    axe swipe --start-x 200 --start-y 480 --end-x 200 --end-y 120 --duration 0.4 --udid "$UDID" >/dev/null 2>&1 || true
    sleep 2
    if ui_dump >/dev/null \
       && ui_labels | awk -F'\t' '$1 ~ /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z][a-z] [0-9]+$/ && $4 < 400 {f=1} END {exit !f}' \
       && grep -qF "Breakfast" "$DUMP_FILE"; then
      ok "the diary sheet is open at the large detent"
      return 0
    fi
  done
  bad "the diary sheet did not reach the large detent"
  return 1
}

open_diary_large() {
  link "coachcal://diary" "" 5 || return 1
  wait_diary_large
}

# Shared tap plumbing. Taps below y 62 are eaten by the system status bar window (found in
# stage B: every sheet header sits at y ~51), so a computed center that high taps near the
# element's bottom edge instead.
aim_point() { # <x> <y> <w> <h>  -> echoes "cx cy"
  awk -v x="$1" -v y="$2" -v w="$3" -v h="$4" 'BEGIN {
    cx = x + w / 2; cy = y + h / 2;
    if (cy < 62) cy = y + h * 0.82;
    printf "%d %d", cx, cy
  }'
}

tap_point_at() { # <line>  (label x y w h)
  local line="$1" x y w h cx cy
  x="$(cut -f3 <<<"$line")"; y="$(cut -f4 <<<"$line")"
  w="$(cut -f5 <<<"$line")"; h="$(cut -f6 <<<"$line")"
  read -r cx cy <<<"$(aim_point "$x" "$y" "$w" "$h")"
  echo "  tap at ($cx, $cy)"
  tap_xy "$cx" "$cy"
}

tap_label_prefix() {
  local prefix="$1" line
  ui_dump >/dev/null || { bad "ui_dump failed before tapping '$prefix'"; return 1; }
  line="$(ui_labels | awk -F'\t' -v p="$prefix" 'index($1, p) == 1 {print; exit}')"
  if [ -z "$line" ]; then
    bad "no element labeled with the prefix $prefix in the tree"
    return 1
  fi
  echo "  tap label prefix $prefix"
  tap_point_at "$line"
}

tap_first_label() {
  local label="$1" line
  ui_dump >/dev/null || { bad "ui_dump failed before tapping '$label'"; return 1; }
  line="$(ui_labels | awk -F'\t' -v l="$label" '$1 == l {print; exit}')"
  if [ -z "$line" ]; then
    bad "no element labeled $label in the tree"
    return 1
  fi
  echo "  tap first label $label"
  tap_point_at "$line"
}

# `axe tap --id` never matches: RN testIDs do not populate AXUniqueId (found in stage B). Every
# sheet close button carries the label "Close", and the topmost sheet's elements sit LAST in the
# tree, so the top sheet's close is the last "Close" in the dump.
close_top_sheet() {
  tap_last_label "Close" || tap_label "Close" || true
  sleep 1.5
}

tap_last_label() {
  local label="$1" line
  ui_dump >/dev/null || { bad "ui_dump failed before tapping '$label'"; return 1; }
  line="$(ui_labels | awk -F'\t' -v l="$label" '$1 == l {print}' | tail -1)"
  if [ -z "$line" ]; then
    bad "no element labeled $label in the tree"
    return 1
  fi
  echo "  tap last label $label"
  tap_point_at "$line"
}

# One wipe + demo-persona seed dance (flow 01 part 2's pattern) plus the Debug console's meal
# seed, ending on a plain Today that lists both.
fresh_seed_today() {
  app_open "Today" 150 --ccFreshStart --ccSeedNoTargets
  link "coachcal:///?seed=1" "Today" 25
  wait_for_text "Spaghetti Bolognese" 30 || bad "the demo persona was not seeded"
  link "coachcal://debug?action=seed" "Debug console" 25
  sleep 2
  link "coachcal:///" "Today" 20
  wait_for_text "Chicken rice bowl" 20 || bad "the Debug meal seed did not land on Today"
  sleep 2
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  app_open "Today" 90
}

# `axe type` drops characters against the compiler-memoized controlled input (found in stage B),
# so the query goes in through the clipboard and the field's long-press Paste callout.
paste_query() {
  printf 'rice' | axe clipboard copy --stdin --udid "$UDID" >/dev/null 2>&1 || { bad "clipboard copy failed"; return 1; }
  axe tap --label "Search foods" --hold 1 --udid "$UDID" >/dev/null 2>&1 || { bad "long-press the search field failed"; return 1; }
  sleep 1.5
  tap_first_label "Paste" || return 1
  sleep 2
  return 0
}

# From the open search screen: paste the query, wait for the results card, blur the field so the
# keyboard leaves before the capture (the frames draw none).
search_results_ready() {
  tap_label_xy "Search foods" || return 1
  sleep 1
  paste_query || return 1
  wait_for_text "Results for" 20 || return 1
  tap_label_prefix "Results for" || true
  sleep 1.5
  return 0
}

# From the day sheet: open the add-food sheet, drive the search stack open, paste and reach the
# results.
open_search_with_results() {
  tap_label_xy "add, Add dinner" || return 1
  wait_for_text "Add food" 15 || return 1
  sleep 1
  tap_label_xy "Search" || return 1
  wait_for_text "Add to Dinner" 15 || return 1
  sleep 1
  search_results_ready
}

# Close the stack the search was opened from: the manual sheet, the search, the add-food sheet;
# back on the day sheet.
close_search_stack() {
  close_top_sheet
  close_top_sheet
  close_top_sheet
  wait_for_text "Breakfast" 15 || bad "the day sheet did not come back after closing the search stack"
}

sim_boot
sim_appearance light

step "seed: wipe the store, seed the demo persona and the Debug meals, land on Today"
fresh_seed_today

# --- water (DY-07, derived: the Today frame 07 carries the card) ---------------------------------
step "the water log sheet"
tap_label_prefix "Water," || true
wait_for_text "250 ml" 15 || true
sleep 1
shot_u74 DY-07 u74-water-sheet
close_top_sheet

# --- the diary day sheet in light (DY-01, frame 10) ----------------------------------------------
step "the diary day sheet in light"
open_diary_large
sleep 1
shot_u74 DY-01 u74-diary-day-light

# --- the derived sheets of the day sheet (light) --------------------------------------------------
step "the add-food sheet (DY-02, derived)"
tap_label_xy "add, Add dinner" || true
wait_for_text "Add food" 15 || true
sleep 1
shot_u74 DY-02 u74-add-food-sheet
close_top_sheet
wait_for_text "Breakfast" 15 || true

step "the exercise log sheet (DY-06, derived)"
tap_label_xy "add, Add exercise" || true
wait_for_text "Save" 15 || true
sleep 1
shot_u74 DY-06 u74-exercise-sheet
close_top_sheet
wait_for_text "Breakfast" 15 || true

# --- the search stack: custom food, search results, manual log (light, ED-Safe off) ----------------
step "the custom-food sheet (DY-04, derived)"
tap_label_xy "add, Add dinner" || true
wait_for_text "Add food" 15 || true
tap_label_xy "Search" || true
wait_for_text "Add to Dinner" 15 || true
tap_label_xy "Create custom food" || true
wait_for_text "Protein g" 15 || true
sleep 1
shot_u74 DY-04 u74-custom-food-sheet
close_top_sheet
wait_for_text "Add to Dinner" 15 || true

step "food search with ED-Safe off (DY-03; the frame 15 draws the ED-Safe state)"
search_results_ready || bad "the search stack did not reach results"
shot_u74 DY-03 u74-food-search-off-light

step "the manual log sheet with ED-Safe off (DY-05; the frame 16 draws the ED-Safe state)"
axe tap --label "Add food, White Rice, Cooked" --udid "$UDID" >/dev/null 2>&1 || tap_label_prefix "Add food, White Rice" || true
wait_for_text "Log White Rice" 15 || true
sleep 1
shot_u74 DY-05 u74-manual-log-off-light
app_relaunch "Today" 60
open_diary_large

# --- edit, delete confirmation, saved toast, deleted toast (light) --------------------------------
step "the edit sheet in light (DY-08, frame 29)"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 && ok "tapped the Spaghetti Bolognese row" || bad "tap the food row failed"
wait_for_text "Edit item" 15 || true
sleep 1
shot_u74 DY-08 u74-edit-light
close_top_sheet
wait_for_text "Breakfast" 15 || true

step "the delete confirmation in light (frame 32)"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 && ok "long-pressed the food row" || bad "long-press the food row failed"
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
sleep 1
shot_u74 DY-08 u74-delete-light
tap_label "Cancel" || true
sleep 1

step "the saved toast in light (frame 35)"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 && ok "opened the edit sheet" || bad "tap the food row failed"
wait_for_text "Edit item" 15 || true
sleep 1
tap_label_prefix "Increase Spaghetti Bolognese" && ok "stepper +10 g" || bad "tap the grams stepper failed"
tap_label_xy "Save changes" || true
wait_for_text "Changes saved" 15 || true
sleep 1.2           # the re-read removes the pre-save row render before the capture
shot_u74 DY-08 u74-saved-light
sleep 6                # the five-second undo window closes before the next capture

step "the deleted toast with undo in light (frame 38)"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 && ok "long-pressed the food row" || bad "long-press the food row failed"
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
tap_label "Delete item" || true
wait_for_text "Spaghetti Bolognese deleted" 15 || true
sleep 1.2           # the row leaves with the re-read before the capture
shot_u74 DY-08 u74-undo-light
tap_label_xy "Undo" || true
sleep 2

# --- dark: the day sheet and the DY-08 states (frames 30, 33, 36, 39) ------------------------------
step "dark phase: re-seed, then the day sheet in dark"
sim_appearance dark
fresh_seed_today
open_diary_large
sleep 2
shot_u74 DY-01 u74-diary-day-dark

step "the edit sheet in dark"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 || true
wait_for_text "Edit item" 15 || true
sleep 2
shot_u74 DY-08 u74-edit-dark
close_top_sheet
wait_for_text "Breakfast" 15 || true

step "the delete confirmation in dark"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 && ok "long-pressed the food row" || bad "long-press the food row failed"
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
sleep 2
shot_u74 DY-08 u74-delete-dark
tap_label "Cancel" || true
sleep 1

step "the saved toast in dark"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 && ok "opened the edit sheet" || bad "tap the food row failed"
wait_for_text "Edit item" 15 || true
sleep 1
tap_label_prefix "Increase Spaghetti Bolognese" || true
tap_label_xy "Save changes" || true
wait_for_text "Changes saved" 15 || true
sleep 1.2
shot_u74 DY-08 u74-saved-dark
sleep 6

step "the deleted toast with undo in dark"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 || true
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
tap_label "Delete item" || true
wait_for_text "Spaghetti Bolognese deleted" 15 || true
sleep 1.2
shot_u74 DY-08 u74-undo-dark
tap_label_xy "Undo" || true
sleep 2

# --- food search and manual log, ED-Safe on, dark (frames 83 and 84) --------------------------------
step "ED-Safe dark: re-seed, relaunch with --ccEDSafe, the search and manual log"
fresh_seed_today
app_open "Today" 60 --ccEDSafe
open_diary_large
open_search_with_results || bad "the ED-Safe dark search did not reach results"
shot_u74 DY-03 u74-food-search-ed-dark
axe tap --label "Add food, White Rice, Cooked" --udid "$UDID" >/dev/null 2>&1 || tap_label_prefix "Add food, White Rice" || true
wait_for_text "Log White Rice" 15 || true
sleep 2
shot_u74 DY-05 u74-manual-log-ed-dark
app_open "Today" 60 --ccEDSafe
open_diary_large

# --- food search and manual log, ED-Safe on, light (frames 15 and 16) -------------------------------
step "ED-Safe light: re-seed, relaunch with --ccEDSafe, the search and manual log"
sim_appearance light
fresh_seed_today
app_open "Today" 60 --ccEDSafe
open_diary_large
open_search_with_results || bad "the ED-Safe light search did not reach results"
shot_u74 DY-03 u74-food-search-ed-light
axe tap --label "Add food, White Rice, Cooked" --udid "$UDID" >/dev/null 2>&1 || tap_label_prefix "Add food, White Rice" || true
wait_for_text "Log White Rice" 15 || true
sleep 1
shot_u74 DY-05 u74-manual-log-ed-light
app_open "Today" 60 --ccEDSafe
open_diary_large

# --- the DY-08 states under ED-Safe (frames 31, 34, 37, 40) ------------------------------------------
step "the edit sheet under ED-Safe"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 || true
wait_for_text "Edit item" 15 || true
sleep 2
shot_u74 DY-08 u74-edit-ed
close_top_sheet
wait_for_text "Breakfast" 15 || true

step "the delete confirmation under ED-Safe"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 && ok "long-pressed the food row" || bad "long-press the food row failed"
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
sleep 2
shot_u74 DY-08 u74-delete-ed
tap_label "Cancel" || true
sleep 1

step "the saved toast under ED-Safe"
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 && ok "opened the edit sheet" || bad "tap the food row failed"
wait_for_text "Edit item" 15 || true
sleep 1
tap_label_prefix "Increase Spaghetti Bolognese" || true
tap_label_xy "Save changes" || true
wait_for_text "Changes saved" 15 || true
sleep 1.2
shot_u74 DY-08 u74-saved-ed
sleep 6

step "the deleted toast with undo under ED-Safe"
axe tap --label "Edit, Spaghetti Bolognese" --hold 1 --udid "$UDID" >/dev/null 2>&1 || true
wait_for_text "Delete Spaghetti Bolognese?" 15 || true
tap_label "Delete item" || true
wait_for_text "Spaghetti Bolognese deleted" 15 || true
sleep 1.2
shot_u74 DY-08 u74-undo-ed
tap_label_xy "Undo" || true
sleep 2

# --- High Contrast (frame 59): simctl offers the increase_contrast switch ----------------------------
step "High Contrast: the edit sheet (frame 59)"
xcrun simctl ui "$UDID" increase_contrast enabled || bad "simctl ui increase_contrast failed"
sleep 2
app_relaunch "Today" 60
open_diary_large
axe tap --label "Edit, Spaghetti Bolognese" --udid "$UDID" >/dev/null 2>&1 || true
wait_for_text "Edit item" 15 || true
sleep 2
shot_u74 DY-08 u74-edit-hc-light
xcrun simctl ui "$UDID" increase_contrast disabled || true

finish
