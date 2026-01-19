#!/bin/bash
# Test suite for transcript-summary.sh
# RED PHASE: These tests should FAIL until implementation exists

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TARGET_SCRIPT="$PROJECT_ROOT/plugins/m42-signs/scripts/transcript-summary.sh"
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

echo "Testing: transcript-summary.sh"
echo "==============================="

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

# Test 5: Script outputs valid JSON with required fields
echo ""
echo "Test 5: Script outputs valid JSON with all required fields"
if [[ -x "$TARGET_SCRIPT" ]] && [[ -f "$TEST_TRANSCRIPT" ]]; then
  OUTPUT=$("$TARGET_SCRIPT" "$TEST_TRANSCRIPT" 2>/dev/null)
  if echo "$OUTPUT" | jq -e '.total_lines and .assistant_messages and .text_blocks and .error_count and .tool_sequence' > /dev/null 2>&1; then
    pass "Output contains all required fields (total_lines, assistant_messages, text_blocks, error_count, tool_sequence)"
  else
    fail "Output missing one or more required fields"
  fi
else
  fail "Cannot run script (script or test file missing)"
fi

# Test 6: total_lines matches actual line count
echo ""
echo "Test 6: total_lines field matches actual line count"
if [[ -x "$TARGET_SCRIPT" ]] && [[ -f "$TEST_TRANSCRIPT" ]]; then
  ACTUAL_LINES=$(wc -l < "$TEST_TRANSCRIPT")
  REPORTED_LINES=$("$TARGET_SCRIPT" "$TEST_TRANSCRIPT" 2>/dev/null | jq '.total_lines')
  if [[ "$REPORTED_LINES" == "$ACTUAL_LINES" ]]; then
    pass "total_lines ($REPORTED_LINES) matches actual ($ACTUAL_LINES)"
  else
    fail "total_lines ($REPORTED_LINES) does not match actual ($ACTUAL_LINES)"
  fi
else
  fail "Cannot run script (script or test file missing)"
fi

# Test 7: tool_sequence is an array
echo ""
echo "Test 7: tool_sequence is an array"
if [[ -x "$TARGET_SCRIPT" ]] && [[ -f "$TEST_TRANSCRIPT" ]]; then
  OUTPUT=$("$TARGET_SCRIPT" "$TEST_TRANSCRIPT" 2>/dev/null)
  if echo "$OUTPUT" | jq -e '.tool_sequence | type == "array"' > /dev/null 2>&1; then
    pass "tool_sequence is an array"
  else
    fail "tool_sequence is not an array"
  fi
else
  fail "Cannot run script (script or test file missing)"
fi

# Summary
echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
else
  exit 0
fi
