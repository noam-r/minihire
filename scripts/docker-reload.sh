#!/usr/bin/env bash
# Rebuild and restart the production Docker stack after code or .env changes.
# Run from the repository root:
#   ./scripts/docker-reload.sh
#   ./scripts/docker-reload.sh --no-cache
#   ENV_FILE=/path/to/.env ./scripts/docker-reload.sh
#
# Uses `docker compose`; for the legacy v1 binary, run the printed `docker-compose` equivalent.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE (set ENV_FILE=... if needed)." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

DC=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

if ! docker compose version >/dev/null 2>&1; then
  echo "This script expects Docker Compose v2 (\`docker compose\`). For v1 use:" >&2
  echo "  docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build \"\$@\" && docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d" >&2
  exit 1
fi

echo "Building (pass --no-cache to force a clean web build)..."
"${DC[@]}" build "$@"

echo "Recreating containers..."
"${DC[@]}" up -d

echo "Done. Example: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"
