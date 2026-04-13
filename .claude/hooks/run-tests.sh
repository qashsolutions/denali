#!/usr/bin/env bash
# Stop hook: run tests before conversation ends
# Detects project type and runs appropriate test suite
set -euo pipefail

PROJECT_DIR="$CLAUDE_PROJECT_DIR"

run_node_tests() {
  local dir="$1"
  echo "Running Node.js tests in $dir..."
  cd "$dir"
  # Prefer vitest run (non-interactive, single run) over npm test (watch mode)
  if grep -q '"vitest"' package.json 2>/dev/null; then
    npx vitest run --bail 1 2>&1 | tail -20
    return "${PIPESTATUS[0]}"
  elif grep -q '"test"' package.json 2>/dev/null; then
    npm test -- --bail 2>&1 | tail -20
    return "${PIPESTATUS[0]}"
  fi
  return 0
}

run_python_tests() {
  local dir="$1"
  echo "Running Python tests in $dir..."
  cd "$dir"
  if command -v pytest &>/dev/null; then
    pytest -x --tb=short 2>&1 | tail -20
    return "${PIPESTATUS[0]}"
  elif command -v python3 &>/dev/null; then
    python3 -m pytest -x --tb=short 2>&1 | tail -20
    return "${PIPESTATUS[0]}"
  fi
  return 0
}

# Detect project type and run tests
FAILED=0

# Check for Node.js project (root or app/ subdirectory)
if [ -f "$PROJECT_DIR/app/package.json" ]; then
  run_node_tests "$PROJECT_DIR/app" || FAILED=1
elif [ -f "$PROJECT_DIR/package.json" ]; then
  run_node_tests "$PROJECT_DIR" || FAILED=1
fi

# Check for Python project
if [ -f "$PROJECT_DIR/pyproject.toml" ] || [ -f "$PROJECT_DIR/setup.py" ] || [ -f "$PROJECT_DIR/requirements.txt" ]; then
  run_python_tests "$PROJECT_DIR" || FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Tests failed. Review output above."
  exit 2
fi

echo "All tests passed."
exit 0
