#!/bin/bash
# typecheck.sh — PostToolUse hook for Write/Edit on .ts/.tsx files
# Scoped to the Denali project only. Runs `tsc --noEmit` and reports errors.
#
# Behavior:
#   - If not in a Denali project directory: exit 0 silently
#   - If file is not .ts/.tsx: exit 0 silently
#   - If tsc passes: exit 0 silently
#   - If tsc fails: exit 2 with error output (Claude sees it and fixes)

set -uo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Only fire on .ts or .tsx files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Only fire inside the Denali project
# Adjust this path if your Denali repo lives elsewhere
DENALI_MARKER="denali"

case "$FILE_PATH" in
  *"$DENALI_MARKER"*) ;;
  *) exit 0 ;;
esac

# Find the project root (the directory containing package.json with the app/ subfolder)
DIR=$(dirname "$FILE_PATH")
PROJECT_ROOT=""
while [ "$DIR" != "/" ]; do
  if [ -f "$DIR/app/package.json" ]; then
    PROJECT_ROOT="$DIR/app"
    break
  fi
  if [ -f "$DIR/package.json" ] && [ -f "$DIR/tsconfig.json" ]; then
    PROJECT_ROOT="$DIR"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [ -z "$PROJECT_ROOT" ]; then
  exit 0
fi

# Run tsc --noEmit from the project root
cd "$PROJECT_ROOT" || exit 0

# Check tsc is available
if ! command -v npx >/dev/null 2>&1; then
  exit 0
fi

# Run typecheck with a timeout (don't hang Claude forever).
# macOS doesn't ship `timeout` by default — fall back to running without it.
if command -v timeout >/dev/null 2>&1; then
  TSC_OUTPUT=$(timeout 60 npx --no-install tsc --noEmit --pretty false 2>&1)
elif command -v gtimeout >/dev/null 2>&1; then
  TSC_OUTPUT=$(gtimeout 60 npx --no-install tsc --noEmit --pretty false 2>&1)
else
  TSC_OUTPUT=$(npx --no-install tsc --noEmit --pretty false 2>&1)
fi
TSC_EXIT=$?

# timeout returned 124 = exceeded time limit; let it pass silently
if [ "$TSC_EXIT" -eq 124 ]; then
  exit 0
fi

if [ "$TSC_EXIT" -ne 0 ]; then
  echo "TypeScript errors detected after editing $FILE_PATH:" >&2
  echo "" >&2
  echo "$TSC_OUTPUT" | head -50 >&2
  echo "" >&2
  echo "Fix these type errors before continuing." >&2
  exit 2
fi

exit 0
