#!/usr/bin/env bash
# PostToolUse hook: audit log every tool invocation as JSONL
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {} | tostring' | head -c 200)

LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/audit-$(date +%Y-%m-%d).jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "$INPUT" | jq -c --arg ts "$TIMESTAMP" --arg tool "$TOOL_NAME" --arg input "$TOOL_INPUT" \
  '{timestamp: $ts, tool: $tool, input: ($input[:200])}' >> "$LOG_FILE" 2>/dev/null || true

exit 0
