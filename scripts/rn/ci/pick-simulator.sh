#!/usr/bin/env bash
# Prints the udid of an available iPhone on the newest iOS runtime: what the RN iOS workflow
# boots on a GitHub-hosted macOS runner (no device name is pinned; the image decides what
# exists). Usage: UDID="$(bash scripts/rn/ci/pick-simulator.sh)".
set -euo pipefail

UDID="$(xcrun simctl list devices available -j | jq -r '
  .devices
  | to_entries[]
  | select(.key | test("com.apple.CoreSimulator.SimRuntime.iOS"))
  | .key as $runtime
  | .value[]
  | select(.isAvailable == true and (.name | test("^iPhone")))
  | [$runtime, .udid, .name]
  | @tsv' | sort | tail -1 | cut -f2)"

if [ -z "$UDID" ]; then
  echo "FAIL: no available iPhone simulator on this runner" >&2
  xcrun simctl list devices available >&2 || true
  exit 1
fi

echo "$UDID"
