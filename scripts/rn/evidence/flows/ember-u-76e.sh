#!/usr/bin/env bash
# Flow ember-u-76e — the evidence of Today on Ember (parity TD-01, unit U-76e).
#
# Rows (each next to its frame by scripts/rn/evidence/side-by-side.mjs, written by the owner of the page):
#   u76e-today-light.png            frame 07  the seeded Today, light            (proof 2 in light)
#   u76e-today-dark-offline.png     frame 08  dark, launched with --ccForceOffline (proof 2 in dark)
#   u76e-header-offline.png         third look: the header offline, cropped from the shot above
#   u76e-today-ed-safe.png          frame 09  launched with --ccEDSafe           (proof 2 under ED-Safe)
#   u76e-empty-light.png / -dark    derived   a day without meals, goal 2150     (proof 1 in light and dark)
#   u76e-today-high-contrast.png    derived   increase_contrast enabled on the Simulator
#
# Data: the demo persona (target 2150) comes from coachcal:///?seed=1 after a fresh install; the persona also
# logs "Spaghetti Bolognese" today, so the empty day is the persona followed by the Debug console action
# `reset` (it empties the diary rows, not the target); the frames' meals are the Debug console action `seed`.
#
# Measurements printed to the transcript:
#   proof 1: the ring frame from the accessibility dump and the pixel extent and number of lines of the number
#            inside the ring (python3 over the full-size screenshot);
#   proof 2: the frame of each of the four macro cards from the dump, against the screen width.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib.sh"

SCREEN_W=402

# frame_of <label regex>: "x y w h" of the first element whose label matches, from a fresh dump.
frame_of() {
  ui_dump >/dev/null || { echo "none"; return 1; }
  ui_labels | awk -F'\t' -v re="$1" '$1 ~ re { printf "%s %s %s %s\n", $3, $4, $5, $6; found = 1; exit } END { if (!found) print "none" }'
}

# measure_macros <name>: the four macro cards against the width of the screen (proof 2).
measure_macros() {
  local name="$1" macro f x y w h right cut=0
  step "proof 2 ($name): the macro cards against the screen width $SCREEN_W pt"
  ui_dump >/dev/null || { bad "ui_dump failed (macro cards, $name)"; return 1; }
  for macro in Protein Carbs Fat Fiber; do
    f="$(ui_labels | awk -F'\t' -v m="$macro" '$1 ~ "^" m " [0-9]+ of [0-9]+ grams$" { printf "%s %s %s %s %s\n", $1, $3, $4, $5, $6; exit }')"
    if [ -z "$f" ]; then bad "no card for $macro in the dump ($name)"; cut=1; continue; fi
    x="$(awk '{print $(NF-3)}' <<<"$f")"; y="$(awk '{print $(NF-2)}' <<<"$f")"
    w="$(awk '{print $(NF-1)}' <<<"$f")"; h="$(awk '{print $NF}' <<<"$f")"
    right="$(awk -v x="$x" -v w="$w" 'BEGIN { printf "%.1f", x + w }')"
    echo "  macro-card $macro ($name): x=$x y=$y w=$w h=$h right-edge=$right of $SCREEN_W"
    if awk -v x="$x" -v r="$right" -v s="$SCREEN_W" 'BEGIN { exit !(x >= 0 && r <= s) }'; then :; else cut=1; fi
  done
  if [ "$cut" -eq 0 ]; then ok "all four macro cards sit inside 0..$SCREEN_W pt ($name)"; else bad "a macro card is cut at the edge or missing ($name)"; fi
}

# measure_ring <name> <full-size png>: proof 1. The ring frame comes from the dump; the number's
# pixel extent and its number of lines from the screenshot (3 px per pt on the iPhone 17 Pro).
measure_ring() {
  local name="$1" png="$2" f
  step "proof 1 ($name): the number inside the ring"
  f="$(frame_of 'calories remaining of')"
  echo "  ring label frame (x y w h, pt): $f"
  [ "$f" != "none" ] || { bad "no ring element in the dump ($name)"; return 1; }
  python3 - "$png" $f <<'PY'
import sys
from PIL import Image
png, rx, ry, rw, rh = sys.argv[1], *map(float, sys.argv[2:6])
img = Image.open(png).convert("RGB")
scale = img.width / 402.0
# the inner disc of the ring: the ring is 150 pt, the stroke 13 pt; look inside 2 x (13 + 8) pt of the frame
pad = 21
x0, y0 = int((rx + pad) * scale), int((ry + pad) * scale)
x1, y1 = int((rx + rw - pad) * scale), int((ry + rh - pad) * scale)
def light(p): return p[0] > 140 and p[1] > 140 and p[2] > 140  # the number (near white) and its caption (grey) on the ember card
rows = []
cols = {}
for y in range(y0, y1):
    xs = [x for x in range(x0, x1) if light(img.getpixel((x, y)))]
    rows.append((y, xs))
# bands of consecutive rows holding light pixels = lines of text
bands, cur = [], []
for y, xs in rows:
    if xs: cur.append((y, xs))
    elif cur: bands.append(cur); cur = []
if cur: bands.append(cur)
print(f"  inner box (px): x {x0}..{x1}, y {y0}..{y1} ({(x1-x0)/scale:.1f} x {(y1-y0)/scale:.1f} pt)")
print(f"  text bands inside the ring: {len(bands)} (the number, then the caption \"kcal left\")")
for i, band in enumerate(bands):
    xs = [x for _, xs in band for x in xs]
    h = (band[-1][0] - band[0][0] + 1) / scale
    w = (max(xs) - min(xs) + 1) / scale
    print(f"  band {i+1}: height {h:.1f} pt, width {w:.1f} pt, x {min(xs)/scale:.1f}..{max(xs)/scale:.1f} pt")
if bands:
    big = max(bands, key=lambda b: b[-1][0] - b[0][0])
    xs = [x for _, xs in big for x in xs]
    w = (max(xs) - min(xs) + 1) / scale
    inner = (rw - 2 * 13)
    print(f"  the number: ONE band, width {w:.1f} pt of the {rw:.0f} pt ring ({100*w/rw:.0f}%), of the {inner:.0f} pt inside the stroke ({100*w/inner:.0f}%)")
PY
}

step "setup: a fresh install, the demo persona (target 2150), light"
sim_boot
sim_appearance light
xcrun simctl ui "$UDID" increase_contrast disabled >/dev/null 2>&1 || true
app_install_fresh
app_open "Track calories with a photo" 150
app_open "Today" 120 --ccSeedNoTargets
link "coachcal:///?seed=1" "Today" 25
wait_for_text "Spaghetti Bolognese" 30 || bad "the demo persona was not seeded"
sleep 2
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 1
app_open "Today" 90

# ---- the empty day (proof 1) ------------------------------------------------------------------------
step "the empty day: the persona, then the Debug console action reset (diary rows only)"
link "coachcal://debug?action=reset" "Debug console" 25
sleep 2
link "coachcal:///" "Today" 20
wait_for_text "calories remaining" 20 || true
wait_for_text "No meals logged yet" 15 || bad "the day still holds meals"
sleep 1
shot TD-01 u76e-empty-light
measure_ring empty-light "$TMP_DIR/TD-01-u76e-empty-light.png"
measure_macros empty-light

step "the empty day in dark"
sim_appearance dark
sleep 3
wait_for_text "calories remaining" 15 || true
shot TD-01 u76e-empty-dark
measure_ring empty-dark "$TMP_DIR/TD-01-u76e-empty-dark.png"
sim_appearance light
sleep 2

# ---- the seeded Today (rows 07, 08, 09) ---------------------------------------------------------------
step "the meals of the frames: the Debug console action seed"
link "coachcal://debug?action=seed" "Debug console" 25
sleep 2
link "coachcal:///" "Today" 20
wait_for_text "Chicken rice bowl" 20 || true
wait_for_text "Overnight oats" 10 || true
sleep 1
shot TD-01 u76e-today-light
measure_macros light
measure_ring seeded-light "$TMP_DIR/TD-01-u76e-today-light.png"

step "the meals below the fold: scroll and capture"
axe swipe --start-x 200 --start-y 700 --end-x 200 --end-y 250 --udid "$UDID" >/dev/null 2>&1 || true
sleep 2
shot TD-01 u76e-today-light-meals
axe swipe --start-x 200 --start-y 250 --end-x 200 --end-y 800 --udid "$UDID" >/dev/null 2>&1 || true
sleep 1

step "High Contrast (the setting of the Simulator: increase_contrast)"
xcrun simctl ui "$UDID" increase_contrast enabled || bad "simctl ui increase_contrast enabled failed"
sleep 3
wait_for_text "calories remaining" 15 || true
shot TD-01 u76e-today-high-contrast
measure_macros high-contrast
xcrun simctl ui "$UDID" increase_contrast disabled || bad "simctl ui increase_contrast disabled failed"
sleep 2

step "dark, offline (--ccForceOffline)"
sim_appearance dark
sleep 2
app_open "Today" 90 --ccForceOffline
wait_for_text "Offline · syncs later" 30 || bad "the offline chip is not on screen"
sleep 2
shot TD-01 u76e-today-dark-offline
measure_macros dark-offline
measure_ring dark-offline "$TMP_DIR/TD-01-u76e-today-dark-offline.png"

step "the header offline (third look): the frames of the date, the chip and the diary button"
ui_dump >/dev/null || true
ui_labels | awk -F'\t' '$1 == "Select date" || $1 ~ /Offline/ || $1 == "Open diary" || $1 ~ /^Today$/ { printf "  header element [%s] %s x=%s y=%s w=%s h=%s\n", $1, $2, $3, $4, $5, $6 }'
# the top 330 px rows of the 1206-wide screenshot hold the status bar and the header
python3 - "$TMP_DIR/TD-01-u76e-today-dark-offline.png" "$EV_DIR/TD-01/u76e-header-offline.png" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
# 3 px per pt: the top 140 pt hold the status bar, the date, "Today", the chip and the diary button (the week strip starts below)
img.crop((0, 0, img.width, 140 * 3)).save(dst, optimize=True)
PY
if [ -f "$EV_DIR/TD-01/u76e-header-offline.png" ]; then
  echo "  screenshot: $EV_DIR/TD-01/u76e-header-offline.png ($(( $(stat -f%z "$EV_DIR/TD-01/u76e-header-offline.png") / 1024 )) KB)"
else
  bad "cropping the header failed"
fi

step "light, offline: the header with the light chip"
sim_appearance light
sleep 3
wait_for_text "Offline · syncs later" 15 || true
shot TD-01 u76e-today-light-offline

step "ED-Safe on (--ccEDSafe), light"
app_open "Today" 90 --ccEDSafe
wait_for_text "Steady meals keep energy even" 30 || bad "the ED-Safe guidance sentence is not on screen"
sleep 2
shot TD-01 u76e-today-ed-safe
measure_macros ed-safe
if ui_dump >/dev/null && grep -qF "calories remaining" "$DUMP_FILE"; then bad "ED-Safe still shows the number left"; else ok "ED-Safe shows no number left"; fi

step "put the Simulator back: terminate the app, light, contrast off"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sim_appearance light
xcrun simctl ui "$UDID" increase_contrast disabled >/dev/null 2>&1 || true

finish
