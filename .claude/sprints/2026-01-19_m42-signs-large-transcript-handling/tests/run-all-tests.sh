#!/bin/bash
# Run all preprocessing script tests
# RED PHASE: All tests should FAIL until implementation exists

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOTAL_PASS=0
TOTAL_FAIL=0
SCRIPTS_TESTED=0

echo "=========================================="
echo "Preprocessing Scripts Test Suite"
echo "=========================================="
echo ""

run_test() {
  local test_script="$1"
  local test_name="$2"

  echo "Running: $test_name"
  echo "------------------------------------------"

  if "$test_script"; then
    echo "RESULT: PASS"
    ((TOTAL_PASS++)) || true
  else
    echo "RESULT: FAIL"
    ((TOTAL_FAIL++)) || true
  fi

  ((SCRIPTS_TESTED++)) || true
  echo ""
}

# Run individual test suites
run_test "$SCRIPT_DIR/test-extract-reasoning.sh" "extract-reasoning.sh tests"
run_test "$SCRIPT_DIR/test-transcript-summary.sh" "transcript-summary.sh tests"
run_test "$SCRIPT_DIR/test-find-learning-lines.sh" "find-learning-lines.sh tests"

echo "=========================================="
echo "FINAL SUMMARY"
echo "=========================================="
echo "Scripts tested: $SCRIPTS_TESTED"
echo "Passed: $TOTAL_PASS"
echo "Failed: $TOTAL_FAIL"
echo ""

if [[ $TOTAL_FAIL -gt 0 ]]; then
  echo "Overall: FAIL"
  exit 1
else
  echo "Overall: PASS"
  exit 0
fi
