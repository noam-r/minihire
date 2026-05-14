#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/minihire}"
POCKETBASE_DATA_DIR="${POCKETBASE_DATA_DIR:-$APP_ROOT/pocketbase/pb_data}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
RETENTION_COUNT="${RETENTION_COUNT:-14}"
# Docker production (compose `container_name: minihire-pocketbase`): set to backup via `docker exec` + `/pb_data`.
# Example: export POCKETBASE_DOCKER_CONTAINER=minihire-pocketbase
POCKETBASE_DOCKER_CONTAINER="${POCKETBASE_DOCKER_CONTAINER:-}"

DB_PATH="$POCKETBASE_DATA_DIR/data.db"
STORAGE_PATH="$POCKETBASE_DATA_DIR/storage"
TIMESTAMP="$(date +"%Y-%m-%d-%H-%M")"
ARCHIVE_NAME="minihire-backup-$TIMESTAMP.tar.gz"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

require_host_sqlite3() {
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 is required on the host for this backup mode." >&2
    exit 1
  fi
}

backup_via_docker() {
  local c="$1"
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required when POCKETBASE_DOCKER_CONTAINER is set." >&2
    exit 1
  fi
  if ! docker exec "$c" test -f /pb_data/data.db 2>/dev/null; then
    echo "Container $c has no file /pb_data/data.db (is PocketBase running?)." >&2
    exit 1
  fi
  if ! docker exec "$c" test -d /pb_data/storage 2>/dev/null; then
    echo "Container $c has no directory /pb_data/storage." >&2
    exit 1
  fi
  if ! docker exec "$c" sh -c "command -v sqlite3 >/dev/null 2>&1"; then
    echo "Container $c must have sqlite3 (rebuild image: docker/Dockerfile.pocketbase includes apk sqlite)." >&2
    exit 1
  fi

  local snap="/tmp/minihire-backup-$$.db"
  docker exec "$c" sqlite3 /pb_data/data.db ".backup '$snap'"
  docker cp "$c:$snap" "$TEMP_DIR/data.db"
  docker exec "$c" rm -f "$snap"

  docker cp "$c:/pb_data/storage" "$TEMP_DIR/storage"
}

backup_via_host_paths() {
  require_host_sqlite3
  if [ ! -f "$DB_PATH" ]; then
    echo "PocketBase database not found at $DB_PATH" >&2
    if [ -z "$POCKETBASE_DOCKER_CONTAINER" ]; then
      echo "Hint: production Docker uses a volume inside the container. Set:" >&2
      echo "  export POCKETBASE_DOCKER_CONTAINER=minihire-pocketbase" >&2
      echo "or bind-mount pb_data and set POCKETBASE_DATA_DIR. See docs/deploy-aws.md." >&2
    fi
    exit 1
  fi

  if [ ! -d "$STORAGE_PATH" ]; then
    echo "PocketBase storage directory not found at $STORAGE_PATH" >&2
    exit 1
  fi

  sqlite3 "$DB_PATH" ".backup '$TEMP_DIR/data.db'"
  cp -R "$STORAGE_PATH" "$TEMP_DIR/storage"
}

if [ -n "$POCKETBASE_DOCKER_CONTAINER" ]; then
  backup_via_docker "$POCKETBASE_DOCKER_CONTAINER"
else
  backup_via_host_paths
fi

tar -C "$TEMP_DIR" -czf "$ARCHIVE_PATH" data.db storage

mapfile -t backup_files < <(ls -1t "$BACKUP_DIR"/minihire-backup-*.tar.gz 2>/dev/null || true)

if [ "${#backup_files[@]}" -gt "$RETENTION_COUNT" ]; then
  for old_backup in "${backup_files[@]:$RETENTION_COUNT}"; do
    rm -f "$old_backup"
  done
fi

echo "Created backup: $ARCHIVE_PATH"
