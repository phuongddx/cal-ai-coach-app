#!/usr/bin/env bash
# Owner tool: copies the Ember design project of Designer into docs/design/ember, byte for byte.
#
#   bash scripts/rn/ember-sync.sh ["<OpenDesign project folder>"]
#
# The default folder is the project "CoachCal Redesign v2". Left out: the files of the design tool
# itself (.file-versions, index.html.artifact.json) and previews/ (exports; the repository keeps
# frames/, written by ember-frames.cjs). Files that live only in the repository (README.md,
# FRAMES.md, frames/) stay. Every copied line is printed, so a review sees what changed.
# After a sync: node scripts/rn/gen-tokens.mjs, then ember-frames.cjs capture.
set -eu
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${1:-/Users/ddphuong/Library/Application Support/Open Design/namespaces/release-stable/data/projects/coachcal-redesign-v2-7be4}"
DST="$ROOT/docs/design/ember"
if [ ! -d "$SRC" ]; then echo "ember-sync: no project folder at $SRC" >&2; exit 1; fi
mkdir -p "$DST"
rsync -a --delete \
  --exclude '.file-versions' --exclude 'index.html.artifact.json' --exclude 'previews/' \
  --exclude 'README.md' --exclude 'FRAMES.md' --exclude 'frames/' \
  --itemize-changes "$SRC/" "$DST/" | grep -vE '^\.d' || true
echo "ember-sync: docs/design/ember equals the project (without previews)"
