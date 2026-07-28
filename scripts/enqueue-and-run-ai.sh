#!/usr/bin/env bash
# Enqueue AI evaluations for all unprocessed candidates, then process them.
# Runs the worker in a loop until no pending runs remain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LIMIT="${1:-10}"

echo "[enqueue-and-run-ai] Enqueueing missing evaluations..."
pnpm enqueue-ai-evaluations

echo "[enqueue-and-run-ai] Processing queued runs (batch limit: $LIMIT)..."
while true; do
  OUTPUT=$(pnpm ai:worker -- --once --limit "$LIMIT" 2>/dev/null)
  PROCESSED=$(echo "$OUTPUT" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*' || echo "0")

  if [ "$PROCESSED" -eq 0 ]; then
    echo "[enqueue-and-run-ai] Done. No more pending runs."
    break
  fi

  echo "[enqueue-and-run-ai] Processed $PROCESSED run(s). Checking for more..."
done
