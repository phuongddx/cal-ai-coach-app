#!/usr/bin/env bash
# run-all.sh — run every evidence flow in one Metro + Simulator session (unit U-14).
#
# Usage (from the repo root):
#   bash scripts/rn/evidence/run-all.sh
#   FLOWS="01-first-launch" bash scripts/rn/evidence/run-all.sh   # a subset, for debugging
#
# Starts Metro once, boots the Simulator once, runs the flows in order, writes a per-flow
# transcript plus the combined docs/rn-migration/evidence/transcripts/run-all.txt, and stops
# Metro at the end. Exit code: the number of failed expectations (fatal = 90 stops the run).
set -uo pipefail

EVID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$EVID_DIR/lib.sh"

RUN_LOG="$TRANSCRIPTS_DIR/run-all.txt"
mkdir -p "$TRANSCRIPTS_DIR" "$TMP_DIR"
: >"$RUN_LOG"
rm -f "$TMP_DIR"/*.png 2>/dev/null || true   # last run's full-size shots; disk is tight

log() { echo "$@" | tee -a "$RUN_LOG"; }

log "run-all start: $(date '+%Y-%m-%d %H:%M:%S')"
log "worktree: $EVID_REPO_ROOT"
log "simulator: $UDID / app: $BUNDLE_ID"

metro_start
metro_wait 180 || {
  metro_stop || true
  log "run-all aborted: metro unusable"
  exit "$FATAL"
}
sim_boot || {
  metro_stop || true
  log "run-all aborted: simulator unusable"
  exit "$FATAL"
}

TOTAL=0
flows=()
if [ -n "${FLOWS:-}" ]; then
  for f in $FLOWS; do flows+=("$EVID_DIR/flows/$f.sh"); done
else
  flows=("$EVID_DIR"/flows/*.sh)
fi

for flow_file in "${flows[@]}"; do
  flow_name="$(basename "$flow_file" .sh)"
  log ""
  log "########## flow $flow_name ##########"
  bash "$flow_file" 2>&1 | tee "$TRANSCRIPTS_DIR/$flow_name.txt" | tee -a "$RUN_LOG"
  rc="${PIPESTATUS[0]}"
  if [ "$rc" -eq "$FATAL" ]; then
    log "flow $flow_name hit a fatal error — stopping the run"
    TOTAL="$FATAL"
    break
  fi
  TOTAL=$((TOTAL + rc))
  log "########## flow $flow_name: $rc failed ##########"
done

metro_stop || TOTAL=$((TOTAL + 1))

log ""
log "run-all done: $TOTAL failed (transcripts: $TRANSCRIPTS_DIR)"
exit "$TOTAL"
