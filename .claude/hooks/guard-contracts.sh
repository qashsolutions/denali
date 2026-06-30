#!/bin/bash
# guard-contracts.sh — PreToolUse hook for Write/Edit on mobile/src/contracts/**
#
# Blocks edits to the frozen Phase 1 contracts after Wave 0 is marked complete.
# Wave 0 completion is signaled by the presence of mobile/.wave-0-complete.
# Exit 0 = allow, Exit 2 = block (Claude sees stderr message).
#
# See docs/design/phase-1-45plus.md § Build sequencing & ownership and
# mobile/CLAUDE.md § Contract rule for the policy this enforces.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Not a mobile contracts file → nothing to do.
case "$FILE_PATH" in
  *mobile/src/contracts/*) ;;  # fall through to the gate
  *) exit 0 ;;
esac

# Resolve the repo root so the marker check is cwd-independent. Falls back
# to pwd if not in a git repo (defensive — hooks should be cwd-stable).
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Wave 0 not yet complete → contracts are still being authored, allow.
if [ ! -f "$REPO_ROOT/mobile/.wave-0-complete" ]; then
  exit 0
fi

# Wave 0 complete + contract edit attempted → block.
echo "BLOCKED: $FILE_PATH is a frozen Phase 1 contract." >&2
echo "" >&2
echo "After Wave 0, mobile/src/contracts/** is frozen — changes must be additive only." >&2
echo "Consumer agents must not redefine these shapes; foundation agents implement them in Wave 1." >&2
echo "" >&2
echo "If this change is intentional (additive contract extension, not a breaking change):" >&2
echo "  1. Confirm the change is genuinely additive (a new optional field / method)." >&2
echo "  2. Remove the marker temporarily:  rm mobile/.wave-0-complete" >&2
echo "  3. Make the edit." >&2
echo "  4. Re-create the marker:           touch mobile/.wave-0-complete" >&2
echo "  5. Update docs/history/phase-1-mobile-decisions.md noting the contract change." >&2
exit 2
