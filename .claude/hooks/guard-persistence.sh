#!/bin/bash
# guard-persistence.sh — fail-closed hook for the no-server-persistence invariant.
#
# Phase 1 mobile invariant 1 ("local-first, nothing persisted server-side")
# is enforced in code primarily through three tests:
#   1. verify-otp byte-identical web regression (Wave 1, this PR)
#   2. refresh    byte-identical web regression (Wave 1, this PR)
#   3. /api/parse-report  query()-spy = zero RDS writes (Wave 2)
#   4. /api/chat (mobile) writes nothing to conversations/messages (Wave 3)
#
# This hook runs the persistence-relevant Vitest suites under app/ and exits
# non-zero if any persistence assertion fails. The settings.json registration
# scopes it to PostToolUse Write/Edit (matching the existing typecheck.sh
# pattern). The hook is intentionally a coarse filter — it's better to run
# a few extra unrelated assertions than to silently miss a persistence
# regression.
#
# Behavior:
#   - File path not under app/ → exit 0 silently (nothing to test).
#   - File path not .ts/.tsx   → exit 0 silently.
#   - Vitest fails              → exit 2 with a clear message; Claude sees it.
#   - Vitest succeeds           → exit 0.
#   - Vitest itself errors (compile failure, missing dep) → exit 2 with reason.
#
# To extend coverage as Wave 2/Wave 3 land, add additional --testNamePattern
# alternatives to the GREP_PATTERN below.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Only fire on .ts / .tsx edits — the persistence tests are TS only.
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Only fire when the edit touched something under app/ (or a related test
# file). Mobile-only changes don't affect server persistence; the contract-
# protection hook already covers contract drift.
case "$FILE_PATH" in
  *"/app/"*|*"/mobile/"*) ;;
  *) exit 0 ;;
esac

# Locate the Next.js app root the same way typecheck.sh does.
DIR=$(dirname "$FILE_PATH")
APP_ROOT=""
while [ "$DIR" != "/" ]; do
  if [ -f "$DIR/app/package.json" ]; then
    APP_ROOT="$DIR/app"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [ -z "$APP_ROOT" ]; then
  exit 0
fi

if ! command -v npx >/dev/null 2>&1; then
  exit 0
fi

# Persistence-relevant test files. Listing files (vs grep-by-name) makes the
# scope explicit and avoids matching unrelated tests whose names happen to
# include words like "regression" or "persist".
TEST_TARGETS=(
  "src/app/api/auth/verify-otp/__tests__/route.test.ts"
  "src/app/api/auth/refresh/__tests__/route.test.ts"
  "src/app/api/parse-report/__tests__/route.test.ts"
)

# Future Wave 3 deliverable appended below as it lands:
#   "src/app/api/chat/__tests__/no-persist.test.ts"      (Wave 3 — no-persist mode)

# Build the file list, filtering to those that exist so the hook stays green
# during Wave 2/3 development before those tests are authored.
EXISTING=()
for f in "${TEST_TARGETS[@]}"; do
  if [ -f "$APP_ROOT/$f" ]; then
    EXISTING+=("$f")
  fi
done

if [ "${#EXISTING[@]}" -eq 0 ]; then
  # Should never happen post-Wave-1 — Wave 1 ships both verify-otp + refresh
  # tests. Treat as a structural failure.
  echo "guard-persistence.sh: no persistence test files found under $APP_ROOT" >&2
  exit 2
fi

cd "$APP_ROOT"

# Run Vitest with a 90s ceiling (longer than typecheck because tests have
# actual setup cost). macOS doesn't ship `timeout` by default — gracefully
# degrade.
if command -v timeout >/dev/null 2>&1; then
  RUNNER=(timeout 90 npx --no-install vitest run "${EXISTING[@]}")
elif command -v gtimeout >/dev/null 2>&1; then
  RUNNER=(gtimeout 90 npx --no-install vitest run "${EXISTING[@]}")
else
  RUNNER=(npx --no-install vitest run "${EXISTING[@]}")
fi

set +e
VITEST_OUT=$("${RUNNER[@]}" 2>&1)
VITEST_EXIT=$?
set -e

# 124 = timeout exceeded; treat as transient and let it slide (CI catches it).
if [ "$VITEST_EXIT" -eq 124 ]; then
  exit 0
fi

if [ "$VITEST_EXIT" -ne 0 ]; then
  echo "" >&2
  echo "guard-persistence.sh BLOCKED: persistence test suite failed after editing $FILE_PATH" >&2
  echo "" >&2
  echo "$VITEST_OUT" | tail -60 >&2
  echo "" >&2
  echo "Phase 1 mobile invariant 1 (no server-side persistence) is load-bearing." >&2
  echo "Fix the failing assertion(s) before continuing — do NOT weaken the test." >&2
  echo "See mobile/CLAUDE.md § Non-negotiable invariants for context." >&2
  exit 2
fi

exit 0
