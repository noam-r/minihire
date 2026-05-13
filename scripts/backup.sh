#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/minihire}"
POCKETBASE_DATA_DIR="${POCKETBASE_DATA_DIR:-$APP_ROOT/pocketbase/pb_data}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups}"
RETENTION_COUNT="${RETENTION_COUNT:-14}"

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

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required to create a safe SQLite backup." >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "PocketBase database not found at $DB_PATH" >&2
  exit 1
fi

if [ ! -d "$STORAGE_PATH" ]; then
  echo "PocketBase storage directory not found at $STORAGE_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup '$TEMP_DIR/data.db'"
cp -R "$STORAGE_PATH" "$TEMP_DIR/storage"

tar -C "$TEMP_DIR" -czf "$ARCHIVE_PATH" data.db storage

mapfile -t backup_files < <(ls -1t "$BACKUP_DIR"/minihire-backup-*.tar.gz 2>/dev/null || true)

if [ "${#backup_files[@]}" -gt "$RETENTION_COUNT" ]; then
  for old_backup in "${backup_files[@]:$RETENTION_COUNT}"; do
    rm -f "$old_backup"
  done
fi

echo "Created backup: $ARCHIVE_PATH"
