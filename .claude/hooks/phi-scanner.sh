#!/bin/bash
# phi-scanner.sh — PreToolUse hook for Write/Edit
# Scans content for PHI patterns inside log/console statements.
# This is a 70%-good defense layer, not a substitute for Semgrep or static analysis.
#
# Behavior:
#   - Only fires inside the Denali project (path-scoped)
#   - Only flags PHI patterns INSIDE log/console statement contexts
#   - Skips test files, fixtures, type definitions
#   - Exit 0 = allow, Exit 2 = block (Claude sees stderr message)

set -uo pipefail

INPUT=$(cat)

CONTENT=$(echo "$INPUT" | jq -r '.tool_input.file_text // .tool_input.new_string // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // "unknown"')

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Only fire inside Denali project
case "$FILE_PATH" in
  *denali*) ;;
  *) exit 0 ;;
esac

# Skip files where PHI-like patterns are expected and safe
case "$FILE_PATH" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)        exit 0 ;;
  */__tests__/*|*/test/*|*/tests/*|*/e2e/*)         exit 0 ;;
  */fixtures/*|*/mocks/*|*/__mocks__/*)             exit 0 ;;
  */types/*|*.d.ts)                                 exit 0 ;;
  */migrations/*|*/seeds/*)                         exit 0 ;;
  *.md|*.mdx|*.txt|*.json)                          exit 0 ;;
  *types.ts|*type.ts|*schema.ts)                    exit 0 ;;
esac

# === PHI patterns to detect (case-insensitive) ===
# These patterns look for PHI indicators INSIDE a log/console/logger call.
# Each pattern: regex matched against the full content
# We use multiline-aware grep with -P (Perl regex) where needed.

VIOLATIONS=()

# Pattern 1: console.log/error/warn/info/debug containing PHI field names
# We look for log statements that reference common PHI field names
LOG_PHI_FIELDS='(console\.(log|error|warn|info|debug)|logger\.(log|error|warn|info|debug|trace))[^;]{0,200}(patientName|patient_name|firstName|first_name|lastName|last_name|fullName|full_name|dateOfBirth|date_of_birth|dob|DOB|ssn|SSN|mbi|MBI|medicareId|medicare_id|diagnosis|diagnoses|icd10|icdCode|medication|medications|prescription|labResult|lab_result)'

if echo "$CONTENT" | grep -qiE "$LOG_PHI_FIELDS"; then
  VIOLATIONS+=("Log statement appears to reference a PHI field name (patientName, dob, ssn, mbi, diagnosis, medication, etc.)")
fi

# Pattern 2: log statement that spreads or stringifies a user/patient/profile object
LOG_PHI_OBJECTS='(console\.(log|error|warn|info|debug)|logger\.(log|error|warn|info|debug|trace))[^;]{0,200}(\.\.\.(user|patient|profile|enrollee|beneficiary|member|eob|claim)|JSON\.stringify\((user|patient|profile|enrollee|beneficiary|member|eob|claim))'

if echo "$CONTENT" | grep -qiE "$LOG_PHI_OBJECTS"; then
  VIOLATIONS+=("Log statement spreads or stringifies a user/patient/eob/claim object (likely PHI)")
fi

# Pattern 3: literal MBI number format in any non-test file
# MBI format: 1 numeric, 1 alpha (A-Z, no S/L/O/I/B/Z), 1 alphanumeric (no S/L/O/I/B/Z), 1 numeric, repeat
# Simplified check: 11-character pattern of mixed alphanumeric that looks MBI-like
MBI_PATTERN='[1-9][AC-HJKMNPR-Z][AC-HJKMNPR-Z0-9][0-9]-?[AC-HJKMNPR-Z][AC-HJKMNPR-Z0-9][0-9]-?[AC-HJKMNPR-Z]{2}[0-9]{2}'
if echo "$CONTENT" | grep -qE "$MBI_PATTERN"; then
  VIOLATIONS+=("Possible literal Medicare Beneficiary Identifier (MBI) found — use synthetic/redacted values")
fi

# Pattern 4: literal SSN format
SSN_PATTERN='[0-9]{3}-[0-9]{2}-[0-9]{4}'
# Skip well-known fake SSNs used in examples
if echo "$CONTENT" | grep -qE "$SSN_PATTERN"; then
  if ! echo "$CONTENT" | grep -qE "(123-45-6789|000-00-0000|111-11-1111)"; then
    VIOLATIONS+=("Possible literal SSN found — use synthetic/redacted values")
  fi
fi

# Pattern 5: console.log inside a route handler containing 'req.body' or 'req.user'
# This catches the common foot-gun of debug logging request bodies
LOG_REQ_BODY='(console\.(log|error|warn|info|debug)|logger\.(log|error|warn|info|debug|trace))[^;]{0,200}(req\.body|req\.user|request\.body|request\.user)'

if echo "$CONTENT" | grep -qiE "$LOG_REQ_BODY"; then
  VIOLATIONS+=("Log statement references req.body or req.user — these may contain PHI")
fi

# Pattern 6: comment-line debug statements left in code
# console.log("DEBUG:" or console.log("TODO:" — these are fine if no PHI, but flag if PHI fields present
# (already covered by patterns 1-2; this is just a reminder pattern)

# === Report ===

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "BLOCKED: Possible PHI in $FILE_PATH" >&2
  echo "" >&2
  echo "Detected patterns:" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  - $v" >&2
  done
  echo "" >&2
  echo "If this is a false positive:" >&2
  echo "  1. Use a structured logger that redacts PHI fields automatically" >&2
  echo "  2. Strip PHI before logging: log only IDs, never full objects" >&2
  echo "  3. If the file is genuinely a test/fixture, move it under" >&2
  echo "     /tests/, /fixtures/, /mocks/, or rename to *.test.ts" >&2
  echo "  4. If the pattern is too broad, edit ~/.claude/hooks/phi-scanner.sh" >&2
  echo "" >&2
  echo "This is a defense layer, not a perfect filter. Use judgment." >&2
  exit 2
fi

exit 0
