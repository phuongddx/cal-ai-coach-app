#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v xcodegen >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install xcodegen
  else
    echo "error: xcodegen is required and Homebrew is unavailable to install it" >&2
    exit 1
  fi
fi

cd "$ROOT/native"
xcodegen generate

for package in Modules/*; do
  echo "Running package tests in $package"
  (cd "$package" && swift test)
done

if [ -n "${CI_DESTINATION:-}" ]; then
  destination="$CI_DESTINATION"
else
  destination="platform=iOS Simulator,name=iPhone 16,OS=26.5"
fi

xcodebuild test \
  -project CoachCal.xcodeproj \
  -scheme CoachCal \
  -destination "$destination" \
  -derivedDataPath DerivedData
