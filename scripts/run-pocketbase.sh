#!/usr/bin/env bash

set -euo pipefail

POCKETBASE_VERSION="${POCKETBASE_VERSION:-0.37.5}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POCKETBASE_DIR="$PROJECT_ROOT/pocketbase"
POCKETBASE_BINARY="$POCKETBASE_DIR/pocketbase"
POCKETBASE_DATA_DIR="$POCKETBASE_DIR/pb_data"

download_pocketbase() {
  local arch

  case "$(uname -m)" in
    x86_64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac

  local archive
  archive="$(mktemp)"

  echo "Downloading PocketBase v$POCKETBASE_VERSION..."
  curl -fsSL -o "$archive" "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${arch}.zip"
  unzip -o "$archive" -d "$POCKETBASE_DIR" >/dev/null
  rm -f "$archive"
  chmod +x "$POCKETBASE_BINARY"
}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download PocketBase." >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required to extract the PocketBase archive." >&2
  exit 1
fi

mkdir -p "$POCKETBASE_DATA_DIR"

if [ ! -x "$POCKETBASE_BINARY" ]; then
  download_pocketbase
fi

# Expose only submission-service vars to PocketBase (migration seeding). Do not `source` the whole
# .env here — values like APPLICATION_EMAIL_FROM="Name <email>" use `<` and break the shell.
if [ -f "$PROJECT_ROOT/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
      POCKETBASE_SUBMISSION_SERVICE_EMAIL=*)
        export "POCKETBASE_SUBMISSION_SERVICE_EMAIL=${line#POCKETBASE_SUBMISSION_SERVICE_EMAIL=}"
        ;;
      POCKETBASE_SUBMISSION_SERVICE_PASSWORD=*)
        export "POCKETBASE_SUBMISSION_SERVICE_PASSWORD=${line#POCKETBASE_SUBMISSION_SERVICE_PASSWORD=}"
        ;;
    esac
  done < "$PROJECT_ROOT/.env"
fi

cd "$POCKETBASE_DIR"
exec ./pocketbase serve --http=127.0.0.1:8090 --dir="$POCKETBASE_DATA_DIR" --migrationsDir="$POCKETBASE_DIR/pb_migrations"
