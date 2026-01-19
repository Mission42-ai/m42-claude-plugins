#!/bin/bash
# Test suite for extract-reasoning.sh
# RED PHASE: These tests should FAIL until implementation exists

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TARGET_SCRIPT="$PROJECT_ROOT/plugins/m42-signs/scripts/extract-reasoning.sh"
TEST_TRANSCRIPT="$PROJECT_ROOT/.claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  ((PASS++))
}

fail() {
  echo "  ✗ $1"
  ((FAIL++))
}

echo "Testing: extract-reasoning.sh"
echo "=============================="

# Test 1: Script exists
echo ""
echo "Test 1: Script file exists"
if [[ -f "$TARGET_SCRIPT" ]]; then
  pass "Script exists at $TARGET_SCRIPT"
else
  fail "Script not found at $TARGET_SCRIPT"
fi

# Test 2: Script is executable
echo ""
echo "Test 2: Script is executable"
if [[ -x "$TARGET_SCRIPT" ]]; then
  pass "Script is executable"
else
  fail "Script is not executable"
fi

# Test 3: Script checks for jq
echo ""
echo "Test 3: Script checks for jq availability"
if [[ -f "$TARGET_SCRIPT" ]] && grep -q 'command -v jq' "$TARGET_SCRIPT"; then
  pass "Script contains jq availability check"
else
  fail "Script does not check for jq"
fi

# Test 4: Script uses set -euo pipefail
echo ""
echo "Test 4: Script uses set -euo pipefail"
if [[ -f "$TARGET_SCRIPT" ]] && grep -q 'set -euo pipefail' "$TARGET_SCRIPT"; then
  pass "Script uses strict mode"
else
  fail "Script does not use set -euo pipefail"
fi

# Test 5: Script outputs valid JSONL with text field
echo ""
echo "Test 5: Script outputs valid JSONL with text field"
if [[ -x "$TARGET_SCRIPT" ]] && [[ -f "$TEST_TRANSCRIPT" ]]; then
  OUTPUT=$("$TARGET_SCRIPT" "$TEST_TRANSCRIPT" 2>/dev/null | head -3)
  if echo "$OUTPUT" | head -1 | jq -e '.text' > /dev/null 2>&1; then
    pass "Output is valid JSONL with text field"
  else
    fail "Output is not valid JSONL or missing text field"
  fi
else
  fail "Cannot run script (script or test file missing)"
fi

# Test 6: Script outputs fewer lines than input (compression)
echo ""
echo "Test 6: Output is smaller than input (compression)"
if [[ -x "$TARGET_SCRIPT" ]] && [[ -f "$TEST_TRANSCRIPT" ]]; then
  INPUT_LINES=$(wc -l < "$TEST_TRANSCRIPT")
  OUTPUT_LINES=$("$TARGET_SCRIPT" "$TEST_TRANSCRIPT" 2>/dev/null | wc -l)
  if [[ "$OUTPUT_LINES" -lt "$INPUT_LINES" ]]; then
    pass "Output ($OUTPUT_LINES lines) is smaller than input ($INPUT_LINES lines)"
  else
    fail "Output ($OUTPUT_LINES lines) is not smaller than input ($INPUT_LINES lines)"
  fi
else
  fail "Cannot run script (script or test file missing)"
fi

# Summary
echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
else
  exit 0
fi
