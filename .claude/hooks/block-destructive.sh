#!/usr/bin/env bash
# PreToolUse hook: block destructive bash commands
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Destructive patterns to block
BLOCKED_PATTERNS=(
  'rm\s+-rf\s'
  'rm\s+-fr\s'
  'rm\s+--recursive\s+--force'
  '\bDROP\s+TABLE\b'
  '\bDROP\s+DATABASE\b'
  '\bTRUNCATE\b'
  '\bdocker\s+rm\b'
  '\bdocker\s+stop\b'
  '\bdocker\s+container\s+rm\b'
  'git\s+push\s+--force'
  'git\s+push\s+-f\b'
  '\bkill\s+-9\b'
  '\bgcloud\s+.*\bdelete\b'
  'git\s+reset\s+--hard'
  'git\s+clean\s+-fd'
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny", "reason": "Blocked destructive command matching pattern: '"$pattern"'"}}'
    exit 2
  fi
done

exit 0
