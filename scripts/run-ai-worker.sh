#!/usr/bin/env bash
# Poll PocketBase for requested AI runs and process one batch.
# Use from cron, systemd timer, or a process supervisor in production.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

exec pnpm ai:worker -- --once "$@"
