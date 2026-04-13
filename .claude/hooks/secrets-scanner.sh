#!/bin/bash
# secrets-scanner.sh — PreToolUse hook for Write/Edit
# Reads JSON from stdin, extracts the content being written, scans for secrets.
# Exit 0 = allow, Exit 2 = block (Claude sees stderr message).

set -euo pipefail

INPUT=$(cat)

# Extract content from either Write (file_text) or Edit (new_string) tool input
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.file_text // .tool_input.new_string // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // "unknown"')

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Skip scanning .env.example, .gitignore, and documentation files
case "$FILE_PATH" in
  *.env.example|*.gitignore|*README*|*.md|*CHANGELOG*)
    exit 0
    ;;
esac

# Patterns to detect. Each line: regex|description
PATTERNS=(
  'AKIA[0-9A-Z]{16}|AWS Access Key ID'
  'aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{40}|AWS Secret Access Key'
  'sk_live_[0-9a-zA-Z]{24,}|Stripe live secret key'
  'sk_test_[0-9a-zA-Z]{24,}|Stripe test secret key'
  'rk_live_[0-9a-zA-Z]{24,}|Stripe live restricted key'
  'whsec_[0-9a-zA-Z]{32,}|Stripe webhook secret'
  'sk-ant-[a-zA-Z0-9_-]{20,}|Anthropic API key'
  'ghp_[a-zA-Z0-9]{36}|GitHub personal access token'
  'gho_[a-zA-Z0-9]{36}|GitHub OAuth token'
  'github_pat_[a-zA-Z0-9_]{82}|GitHub fine-grained PAT'
  '-----BEGIN .*PRIVATE KEY-----|Private key block'
  'xox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}|Slack token'
  'eyJhbGciOi[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}|JWT (possible secret)'
)

VIOLATIONS=()

for entry in "${PATTERNS[@]}"; do
  pattern="${entry%%|*}"
  description="${entry##*|}"
  if echo "$CONTENT" | grep -qE -- "$pattern"; then
    VIOLATIONS+=("$description")
  fi
done

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "BLOCKED: Detected potential secrets in $FILE_PATH" >&2
  echo "" >&2
  echo "Found patterns matching:" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  - $v" >&2
  done
  echo "" >&2
  echo "If this is a false positive (e.g., a fake test fixture), either:" >&2
  echo "  1. Use clearly-fake values like 'AKIAFAKEFAKEFAKEFAKE'" >&2
  echo "  2. Add the file path to the skip list in ~/.claude/hooks/secrets-scanner.sh" >&2
  echo "  3. Move the file to a path containing 'test/fixtures/' or '.env.example'" >&2
  exit 2
fi

exit 0
