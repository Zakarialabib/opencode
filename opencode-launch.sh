#!/bin/bash
# opencode-launch.sh - Launch opencode with correct project root
# Works in both PowerShell and bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CWD="$(pwd)"

echo "🔍 Searching for opencode.json..."
echo "   CWD: $CWD"
echo "   Script dir: $SCRIPT_DIR"

# Function to find project root
find_project_root() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/opencode.json" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  
  # Check root
  if [ -f "/opencode.json" ]; then
    echo "/"
    return 0
  fi
  
  return 1
}

# Try CWD first, then script directory
PROJECT_ROOT=$(find_project_root "$CWD")

if [ -z "$PROJECT_ROOT" ]; then
  PROJECT_ROOT=$(find_project_root "$SCRIPT_DIR")
fi

if [ -z "$PROJECT_ROOT" ]; then
  echo "❌ Could not find opencode.json"
  echo "   Searched from: $CWD"
  echo "   And from: $SCRIPT_DIR"
  echo ""
  echo "   Please run from the project directory or specify --project-root"
  exit 1
fi

echo "✅ Found project root: $PROJECT_ROOT"

# Verify config
if [ -f "$PROJECT_ROOT/opencode.json" ]; then
  echo "   Config: Found"
  # Could parse with jq or node if available
else
  echo "❌ Error: Config not readable"
  exit 1
fi

echo ""
echo "🚀 Launching opencode..."
echo ""

# Launch opencode with explicit project root
export OPENCODE_PROJECT_ROOT="$PROJECT_ROOT"
opencode --project-root "$PROJECT_ROOT" "$@"
