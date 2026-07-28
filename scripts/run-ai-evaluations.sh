#!/usr/bin/env bash
# Enqueue AI evaluations for all unprocessed candidates, then process them.
# Keeps running the worker in batches until no queued runs remain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[enqueue] Queuing evaluations for unprocessed candidates..."
pnpm enqueue-ai-evaluations "$@"

echo ""
echo "[worker] Processing queued runs..."
while true; do
  output=$(pnpm ai:worker -- --once --limit 20 2>/dev/null)
  processed=$(echo "$output" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')

  if [ -z "$processed" ] || [ "$processed" -eq 0 ]; then
    echo "[worker] No more runs to process. Done."
    break
  fi

  echo "[worker] Processed $processed run(s), checking for more..."
done
