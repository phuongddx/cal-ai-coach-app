#!/usr/bin/env bash
# Give a worktree its node_modules as APFS clones of another worktree's.
#
#   bash scripts/rn/clone-node-modules.sh <source worktree> <target worktree>
#
# clonefile copies nothing until a file changes, so 78,000 files (about 1 GB) take 39 seconds and no
# disk. The target gets real directories, so the workspace links inside (@coachcal/*) point at the
# target's own packages. Workspaces that keep their own node_modules (a package with a different
# version than the hoisted one, as apps/mobile does for react-native-svg) get a clone too.
#
# Safe to rerun: a node_modules that already exists in the target is left alone. Refuses when the two
# lockfiles differ: then run `npm ci` in the target.
set -euo pipefail

SRC="${1:?usage: clone-node-modules.sh <source worktree> <target worktree>}"
DST="${2:?usage: clone-node-modules.sh <source worktree> <target worktree>}"

if [ ! -d "$SRC/node_modules" ]; then
  echo "error: $SRC has no node_modules; run npm ci there first" >&2
  exit 1
fi
if ! cmp -s "$SRC/package-lock.json" "$DST/package-lock.json"; then
  echo "error: package-lock.json differs between $SRC and $DST; run npm ci in $DST instead" >&2
  exit 1
fi

clone() {
  local rel="$1"
  if [ -e "$DST/$rel" ]; then
    echo "kept $DST/$rel (already present)"
    return
  fi
  mkdir -p "$(dirname "$DST/$rel")"
  cp -Rc "$SRC/$rel" "$DST/$rel"
  echo "cloned $(find "$DST/$rel" -type f | wc -l | tr -d ' ') files into $DST/$rel"
}

clone node_modules
for ws in "$SRC"/apps/* "$SRC"/packages/*; do
  rel="${ws#"$SRC"/}/node_modules"
  [ -d "$SRC/$rel" ] && clone "$rel"
done

# The last workspace may have no nested node_modules; that failed test is not the script's result.
exit 0
