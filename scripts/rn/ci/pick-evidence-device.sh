#!/usr/bin/env bash
# Prints the udid of the device named 'iPhone 17 Pro' on the newest iOS runtime the runner image
# has: the device the evidence frames and screenshots are drawn on. When the image has none,
# prints the list of its devices and exits 1: the caller stops before the flows and the owner
# decides. Usage: UDID="$(bash scripts/rn/ci/pick-evidence-device.sh)".
set -euo pipefail

UDID="$(xcrun simctl list devices available -j | jq -r '
  .devices
  | to_entries[]
  | select(.key | test("com.apple.CoreSimulator.SimRuntime.iOS"))
  | .key as $runtime
  | .value[]
  | select(.isAvailable == true and .name == "iPhone 17 Pro")
  | [$runtime, .udid]
  | @tsv' | sort | tail -1 | cut -f2)"

if [ -z "$UDID" ]; then
  echo "FAIL: no 'iPhone 17 Pro' on any iOS runtime of this runner" >&2
  xcrun simctl list devices available >&2 || true
  exit 1
fi

echo "$UDID"
