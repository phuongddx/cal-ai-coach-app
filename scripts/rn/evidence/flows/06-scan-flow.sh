#!/usr/bin/env bash
# Flow 06 — the scan flow on the fixture feed (parity SC-02 to SC-07 evidence).
# Dev links (__DEV__ only, until U-51): coachcal://scan?scenario=<200|402|404|422>&capture=fixture
# &mode=<photo|barcode|text|label>. Every screen is reached by label.
# Saves: SC-02/viewfinder, SC-03/analyzing, SC-04/review-200-light|dark, review-402|404|422,
#        SC-05/describe-sheet, SC-06/correction-sheet, SC-07/saved-undo
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

sim_boot
sim_appearance light
app_open "Today" 90

step "SC-02 viewfinder with the fixture feed"
link "coachcal://scan?scenario=200&capture=fixture" "" 5
wait_for_text "Capture photo, button" 25 || true
sleep 1
shot SC-02 viewfinder

step "SC-03 analyzing"
tap_label "Capture photo, button" || true
wait_for_text "Analyzing your meal" 10 || true
shot SC-03 analyzing

step "SC-04 review, 200, light"
wait_for_text "Save to Lunch" 30 || true
sleep 1
shot SC-04 review-200-light

step "SC-06 correction sheet"
tap_label "Fix Issue" || true
wait_for_text "Add a note (optional)" 10 || true
sleep 1
shot SC-06 correction-sheet
tap_label "Save note" || true
sleep 1

step "SC-04 review, 200, dark"
sim_appearance dark
sleep 3
wait_for_text "Save to Lunch" 15 || true
shot SC-04 review-200-dark
sim_appearance light
sleep 2

step "SC-07 saved card with Undo"
tap_label "Save to Lunch" || true
wait_for_text "Saved to Lunch" 45 || true
sleep 0.5
shot SC-07 saved-undo

# A dev link to the scan route while the scan screen is already open does not rebuild the model, so every
# further scenario starts from a freshly opened app.
fresh_app() {
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  app_open "Today" 90
}

step "SC-04 review, 402 (free limit)"
fresh_app
link "coachcal://scan?scenario=402&capture=fixture" "" 5
wait_for_text "Capture photo, button" 25 || true
tap_label "Capture photo, button" || true
wait_for_text "See plans" 45 || true
sleep 1
shot SC-04 review-402

step "SC-04 review, 404 (barcode not found)"
fresh_app
link "coachcal://scan?scenario=404&capture=fixture&mode=barcode" "" 5
wait_for_text "Capture photo, button" 25 || true
tap_label "Capture photo, button" || true   # the barcode mode has the same shutter; the fixture feed answers 404
wait_for_text "Try again" 45 || true
sleep 1
shot SC-04 review-404

step "SC-04 review, 422 (schema error) and SC-05 describe sheet"
fresh_app
link "coachcal://scan?scenario=422&capture=fixture&mode=text" "" 5
wait_for_text "Analyze description" 25 || true
sleep 1
shot SC-05 describe-sheet
tap_xy 200 115 || true   # focus the text field (y 115 pt: under the "Describe your meal" header) before typing
type_text "two eggs on toast" || true
sleep 1
tap_label_xy "Analyze description" || true
wait_for_text "Try again" 45 || true
sleep 1
shot SC-04 review-422

finish
