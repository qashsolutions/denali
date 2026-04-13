#!/usr/bin/env bash
# PreToolUse hook: protect sensitive files from writes
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to relative path from project root for pattern matching
REL_PATH="${FILE_PATH#"$CLAUDE_PROJECT_DIR"/}"

# Protected file patterns
PROTECTED=(
  '^\.env$'
  '^\.env\.'
  'docker-compose\.prod'
  'Dockerfile\.prod'
  '^\.github/workflows/'
  '^terraform/'
  '^cloudbuild\.yaml$'
  '^deploy\.sh$'
  '^\.claude/settings\.json$'
  '^\.claude/hooks/'
)

for pattern in "${PROTECTED[@]}"; do
  if echo "$REL_PATH" | grep -qE "$pattern"; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny", "reason": "Protected file: '"$REL_PATH"' matches pattern '"$pattern"'"}}'
    exit 2
  fi
done

exit 0
