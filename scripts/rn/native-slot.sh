#!/usr/bin/env bash
# Helper for whoever holds the single native build slot (see docs/rn-migration/build-recipe.md).
#
#   bash scripts/rn/native-slot.sh prepare   check the tree and the disk, then run `expo prebuild`
#   bash scripts/rn/native-slot.sh release   give the disk back: Pods and this app's DerivedData only
#
# prepare stops when the working tree is dirty outside apps/mobile/ios (which is generated and ignored),
# or when the data volume has less than 6 GB free. It runs `expo prebuild --platform ios`, with
# `--clean` when apps/mobile/app.config.ts or a config plugin changed since the last prebuild.
set -euo pipefail

MIN_FREE_GB=6
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
STAMP="$MOBILE/ios/.native-slot-config.sha"

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

free_gb() {
  df -g /System/Volumes/Data | awk 'NR==2 {print $4}'
}

config_hash() {
  cat "$MOBILE/app.config.ts" "$MOBILE"/plugins/*.js 2>/dev/null | shasum -a 256 | cut -d' ' -f1
}

prepare() {
  cd "$ROOT"
  if [ -n "$(git status --porcelain)" ]; then
    echo "error: the working tree is not clean; commit or stash first (a native build must match a commit)" >&2
    git status --short >&2
    exit 1
  fi
  local free
  free="$(free_gb)"
  echo "free disk: ${free} GB (stop under ${MIN_FREE_GB} GB)"
  if [ "$free" -lt "$MIN_FREE_GB" ]; then
    echo "error: less than ${MIN_FREE_GB} GB free on /System/Volumes/Data" >&2
    exit 1
  fi

  cd "$MOBILE"
  local flags=(--platform ios)
  if [ ! -d ios ]; then
    echo "no ios/ yet: first prebuild"
  elif [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$(config_hash)" ]; then
    echo "app.config.ts or a plugin changed since the last prebuild: --clean"
    flags+=(--clean)
  fi
  npx expo prebuild "${flags[@]}"
  config_hash >"$STAMP"
  echo "prebuild done; ios/ is generated and git-ignored"
}

release() {
  # Only the two big, regenerable folders. Never ios/ itself, never other apps' DerivedData.
  rm -rf "$MOBILE/ios/Pods"
  rm -rf "$HOME"/Library/Developer/Xcode/DerivedData/CoachCal-*
  echo "released Pods and DerivedData/CoachCal-*; free disk: $(free_gb) GB"
}

case "${1:-}" in
  prepare) prepare ;;
  release) release ;;
  *)
    echo "usage: native-slot.sh prepare|release" >&2
    exit 2
    ;;
esac
