#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v tuist >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install tuist
  else
    echo "error: tuist is required and Homebrew is unavailable to install it" >&2
    exit 1
  fi
fi

cd "$ROOT/native"
tuist install
tuist generate --no-open

for package in Modules/*; do
  if [ "$(basename "$package")" = "CoachCalDesignSystem" ]; then
    # iOS-only SwiftUI package (no macOS platform); exercised via the app scheme on the iOS destination.
    continue
  fi
  echo "Running package tests in $package"
  (cd "$package" && swift test)
done

if [ -n "${CI_DESTINATION:-}" ]; then
  destination="$CI_DESTINATION"
else
  destination="platform=iOS Simulator,name=iPhone 16,OS=26.5"
  resolved_name="$(xcrun simctl list devices available 2>/dev/null | grep -m1 -o 'iPhone [^(]*' | tail -n 1 || true)"
  if [ -n "$resolved_name" ]; then
    destination="platform=iOS Simulator,name=$(printf '%s' "$resolved_name" | sed 's/ *$//')"
  fi
fi

# DISCOVERED DURING EXECUTION (Task 3): raw `xcodebuild test -scheme CoachCal`
# fails with "unable to resolve module dependency" even with the custom
# scheme in place — only Tuist's own build/test orchestration (`tuist
# test`, not `xcodebuild test`) reliably resolves this app+widget+local-
# package-modules graph. Do not revert this to raw xcodebuild.
tuist test CoachCal -- \
  -destination "$destination" \
  -derivedDataPath DerivedData
