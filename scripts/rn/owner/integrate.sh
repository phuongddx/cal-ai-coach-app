#!/usr/bin/env bash
# Builds an integration worktree from origin/main with the given heads merged in order, and prints
# the tree after each merge. Pair the printed trees with merge-verified.sh.
# Usage: integrate.sh <worktree name> <branch> <label>:<sha> ...
set -eu
R=/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees
L=/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs
name="$1"
branch="$2"
shift 2
cd "$R/rn-expo"
git fetch -q --prune origin
if [ -e "$R/$name" ]; then echo "STOP: $R/$name exists"; exit 1; fi
git worktree add -q "$R/$name" -b "$branch" origin/main
cd "$R/$name"
echo "main $(git rev-parse --short origin/main)"
for pair in "$@"; do
  label=${pair%%:*}
  sha=${pair##*:}
  if git merge --no-ff --no-edit -q "$sha" -m "integrate $label ($sha)" 2>"$L/integrate-merge-$label.log"; then
    echo "$label merged: head $(git rev-parse --short HEAD) tree $(git rev-parse --short=12 'HEAD^{tree}')"
  else
    echo "$label CONFLICT:"
    git diff --name-only --diff-filter=U | cat
    git merge --abort
    exit 1
  fi
done
echo "package files changed vs main: $(git diff --name-only origin/main...HEAD | grep -cE 'package(-lock)?\.json' || true)"
bash scripts/rn/clone-node-modules.sh "$R/rn-expo" "$R/$name" >"$L/clone-$name.log" 2>&1 || { echo "clone failed"; tail -2 "$L/clone-$name.log"; }
echo "node_modules entries $(ls "$R/$name/node_modules" | wc -l | tr -d ' ')"
echo "listeners on 5433/8787: $(lsof -nP -iTCP:5433 -iTCP:8787 -sTCP:LISTEN | grep -c LISTEN || true)"
uptime | sed 's/.*load averages*: /load /'
