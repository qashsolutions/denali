#!/usr/bin/env bash
# PostToolUse hook: auto-format files after Write or Edit
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"

case "$EXT" in
  py)
    if command -v ruff &>/dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null || true
      ruff check --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
  ts|tsx|js|jsx|json|css|md)
    if [ -x "$(command -v npx)" ]; then
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
