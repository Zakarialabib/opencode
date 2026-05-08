#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/opencode.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: opencode.json not found at $CONFIG_FILE"
  exit 1
fi

exec npx opencode --config "$CONFIG_FILE" "$@"
