#!/usr/bin/env bash
# Merges verified pull requests bottom-up with merge commits, one at a time, and stops at the first
# main tree that differs from the tree the gates ran on (gate-integrate.sh on rn/integrate-w4b).
# Usage: merge-verified.sh "<pr>:<reviewed head>:<expected tree>:<worker worktree name>" ...
set -u
R=/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees
L=/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs
cd "$R/rn-expo" || exit 2
git fetch -q --prune origin
for quad in "$@"; do
  pr=${quad%%:*}; rest=${quad#*:}; reviewed=${rest%%:*}; rest=${rest#*:}
  want=${rest%%:*}; wtname=${rest##*:}
  head=$(gh pr view "$pr" --json headRefOid --jq '.headRefOid[0:7]')
  if [ "$head" != "$reviewed" ]; then echo "STOP: PR $pr head is $head, reviewed $reviewed"; exit 1; fi
  att=$(gh pr view "$pr" --json body --jq .body | grep -ciE 'co-author|generated with|claude|codex|opencode|gemini|glm' || true)
  if [ "$att" != "0" ]; then echo "STOP: $att attribution line(s) in the body of PR $pr"; exit 1; fi
  wt="$R/$wtname"
  delete="--delete-branch"
  if [ -d "$wt" ]; then
    dirty=$(git -C "$wt" status --porcelain | wc -l | tr -d ' ')
    wthead=$(git -C "$wt" rev-parse --short HEAD)
    if [ "$dirty" = "0" ] && [ "$wthead" = "$reviewed" ]; then
      git worktree remove --force "$wt" && echo "removed worktree $wtname"
    else
      echo "KEEP worktree $wtname (dirty=$dirty head=$wthead): branch stays"
      delete=""
    fi
  fi
  st=UNKNOWN
  for i in $(seq 1 30); do
    st=$(gh pr view "$pr" --json mergeStateStatus --jq .mergeStateStatus)
    [ "$st" != "UNKNOWN" ] && break
    sleep 2
  done
  if [ "$st" = "CONFLICTING" ] || [ "$st" = "UNKNOWN" ] || [ "$st" = "BLOCKED" ]; then echo "STOP: PR $pr is $st"; exit 1; fi
  gh pr merge "$pr" --merge $delete >"$L/merge-$pr.log" 2>&1
  echo "gh pr merge $pr exit=$?: $(tail -1 "$L/merge-$pr.log")"
  sleep 3
  git fetch -q --prune origin
  got=$(git rev-parse --short=12 "origin/main^{tree}")
  echo "PR $pr: $(gh pr view "$pr" --json state,mergedAt,mergeCommit --jq '.state + " at " + .mergedAt + ", merge commit " + .mergeCommit.oid[0:7]'); main tree $got, expected $want"
  if [ "$got" != "$want" ]; then echo "STOP: main tree differs from the tested tree after PR $pr"; exit 1; fi
done
git worktree prune
echo "--- worktrees"; git worktree list | cat
echo "main $(git rev-parse --short origin/main)"
