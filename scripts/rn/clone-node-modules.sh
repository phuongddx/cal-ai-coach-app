#!/usr/bin/env bash
# Give a worktree its own node_modules as an APFS clone of another worktree's.
#
#   bash scripts/rn/clone-node-modules.sh <source worktree> <target worktree>
#
# clonefile copies nothing until a file changes, so 78,000 files (about 1 GB) take 39 seconds and no
# disk. The target gets a real directory, so the workspace links inside (@coachcal/*) point at the
# target's own packages. Refuses when the two lockfiles differ: then run `npm ci` in the target.
set -euo pipefail

SRC="${1:?usage: clone-node-modules.sh <source worktree> <target worktree>}"
DST="${2:?usage: clone-node-modules.sh <source worktree> <target worktree>}"

if [ ! -d "$SRC/node_modules" ]; then
  echo "error: $SRC has no node_modules; run npm ci there first" >&2
  exit 1
fi
if [ -e "$DST/node_modules" ]; then
  echo "error: $DST/node_modules already exists" >&2
  exit 1
fi
if ! cmp -s "$SRC/package-lock.json" "$DST/package-lock.json"; then
  echo "error: package-lock.json differs between $SRC and $DST; run npm ci in $DST instead" >&2
  exit 1
fi

cp -Rc "$SRC/node_modules" "$DST/node_modules"
echo "cloned $(find "$DST/node_modules" -type f | wc -l | tr -d ' ') files into $DST/node_modules"
