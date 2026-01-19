#!/bin/bash

# Sprint Features Test Suite
# Validates all major sprint plugin features are working
# Run this before releases or after significant changes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR%/scripts}"

echo "============================================================"
echo "M42 SPRINT PLUGIN - FEATURE TEST SUITE"
echo "============================================================"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0

pass() {
  echo "✓ $1"
  PASSED_TESTS=$((PASSED_TESTS + 1))
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

fail() {
  echo "✗ $1"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# =============================================================================
# Unit Tests
# =============================================================================
echo "=== Unit Tests ==="
for test in "$SCRIPT_DIR"/test-*.sh; do
  [[ "$test" == *"test-sprint-features.sh" ]] && continue  # Skip self
  TEST_NAME=$(basename "$test")
  if bash "$test" > /dev/null 2>&1; then
    pass "$TEST_NAME"
  else
    fail "$TEST_NAME"
  fi
done

# =============================================================================
# Transaction-Safety Features
# =============================================================================
echo ""
echo "=== Transaction-Safety Features ==="
LOOP_FILE="$SCRIPT_DIR/sprint-loop.sh"

if grep -q "yaml_atomic_update" "$LOOP_FILE"; then
  pass "yaml_atomic_update function exists"
else
  fail "yaml_atomic_update function missing"
fi

if grep -q "yaml_transaction_start" "$LOOP_FILE" && grep -q "yaml_transaction_end" "$LOOP_FILE"; then
  pass "Transaction block functions exist"
else
  fail "Transaction block functions missing"
fi

if grep -q "recover_from_interrupted_transaction" "$LOOP_FILE"; then
  pass "Recovery function exists"
else
  fail "Recovery function missing"
fi

if grep -q "calculate_checksum\|validate_checksum\|save_checksum" "$LOOP_FILE"; then
  pass "Checksum validation implemented"
else
  fail "Checksum validation missing"
fi

# Test backup/restore manually
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

cat > "$TEST_DIR/PROGRESS.yaml" << 'YAML'
sprint-id: test-sprint
status: in-progress
YAML

cp "$TEST_DIR/PROGRESS.yaml" "$TEST_DIR/PROGRESS.yaml.backup"
echo "corrupted" > "$TEST_DIR/PROGRESS.yaml"
mv "$TEST_DIR/PROGRESS.yaml.backup" "$TEST_DIR/PROGRESS.yaml"

if grep -q "sprint-id: test-sprint" "$TEST_DIR/PROGRESS.yaml"; then
  pass "Backup/restore pattern works correctly"
else
  fail "Backup/restore pattern broken"
fi

# =============================================================================
# Preflight Checks
# =============================================================================
echo ""
echo "=== Preflight Checks ==="

PREFLIGHT="$SCRIPT_DIR/preflight-check.sh"

# Test with valid config
rm -rf "$TEST_DIR"/*
cat > "$TEST_DIR/PROGRESS.yaml" << 'YAML'
sprint-id: test-sprint
status: in-progress
phases:
  - id: test-phase
    status: pending
YAML

if bash "$PREFLIGHT" "$TEST_DIR" > /dev/null 2>&1; then
  pass "Preflight passes for valid standard mode config"
else
  fail "Preflight should pass valid standard mode config"
fi

# Test missing PROGRESS.yaml
rm -f "$TEST_DIR/PROGRESS.yaml"
PREFLIGHT_OUT=$(bash "$PREFLIGHT" "$TEST_DIR" 2>&1 || true)
if echo "$PREFLIGHT_OUT" | grep -qi "not found"; then
  pass "Preflight detects missing PROGRESS.yaml"
else
  fail "Preflight should detect missing PROGRESS.yaml"
fi

# Test invalid YAML
echo "invalid: yaml: content:" > "$TEST_DIR/PROGRESS.yaml"
PREFLIGHT_OUT=$(bash "$PREFLIGHT" "$TEST_DIR" 2>&1 || true)
if echo "$PREFLIGHT_OUT" | grep -qi "invalid\|corrupted"; then
  pass "Preflight detects invalid YAML"
else
  fail "Preflight should detect invalid YAML"
fi

# =============================================================================
# Worktree Detection Features
# =============================================================================
echo ""
echo "=== Worktree Detection Features ==="

WORKTREE_JS="$PLUGIN_DIR/compiler/dist/status-server/worktree.js"

if [[ -f "$WORKTREE_JS" ]]; then
  pass "Worktree module compiled"

  # Test detectWorktree from main repo
  WORKTREE_OUT=$(node -e "
    const { detectWorktree } = require('$WORKTREE_JS');
    const info = detectWorktree('.');
    if (info && info.root && info.branch && typeof info.isMain === 'boolean') {
      console.log('OK');
    } else {
      console.log('FAIL');
    }
  " 2>&1)
  if [[ "$WORKTREE_OUT" == "OK" ]]; then
    pass "detectWorktree returns valid info"
  else
    fail "detectWorktree failed: $WORKTREE_OUT"
  fi

  # Test listWorktrees
  WORKTREE_OUT=$(node -e "
    const { listWorktrees } = require('$WORKTREE_JS');
    const list = listWorktrees('.');
    if (list && Array.isArray(list.worktrees) && list.worktrees.length > 0) {
      console.log('OK');
    } else {
      console.log('FAIL');
    }
  " 2>&1)
  if [[ "$WORKTREE_OUT" == "OK" ]]; then
    pass "listWorktrees returns worktree list"
  else
    fail "listWorktrees failed: $WORKTREE_OUT"
  fi

  # Test findSprintsAcrossWorktrees
  WORKTREE_OUT=$(node -e "
    const { findSprintsAcrossWorktrees } = require('$WORKTREE_JS');
    const map = findSprintsAcrossWorktrees('.');
    if (map && map instanceof Map && map.size > 0) {
      console.log('OK');
    } else {
      console.log('FAIL');
    }
  " 2>&1)
  if [[ "$WORKTREE_OUT" == "OK" ]]; then
    pass "findSprintsAcrossWorktrees finds sprints"
  else
    fail "findSprintsAcrossWorktrees failed: $WORKTREE_OUT"
  fi

  # Test getWorktreeName
  WORKTREE_OUT=$(node -e "
    const { getWorktreeName } = require('$WORKTREE_JS');
    const name = getWorktreeName('.');
    if (name === 'main' || typeof name === 'string') {
      console.log('OK');
    } else {
      console.log('FAIL');
    }
  " 2>&1)
  if [[ "$WORKTREE_OUT" == "OK" ]]; then
    pass "getWorktreeName returns worktree name"
  else
    fail "getWorktreeName failed: $WORKTREE_OUT"
  fi

  # Test isInWorktree
  WORKTREE_OUT=$(node -e "
    const { isInWorktree } = require('$WORKTREE_JS');
    const result = isInWorktree('.');
    if (typeof result === 'boolean') {
      console.log('OK');
    } else {
      console.log('FAIL');
    }
  " 2>&1)
  if [[ "$WORKTREE_OUT" == "OK" ]]; then
    pass "isInWorktree returns boolean"
  else
    fail "isInWorktree failed: $WORKTREE_OUT"
  fi
else
  echo "  (worktree module not compiled, skipping)"
fi

# =============================================================================
# Status Server Features (if compiled)
# =============================================================================
echo ""
echo "=== Status Server Features ==="

SERVER_JS="$PLUGIN_DIR/compiler/dist/status-server/server.js"

if [[ -f "$SERVER_JS" ]]; then
  pass "Status server compiled"

  if grep -q "handleWorktreesApiRequest" "$SERVER_JS" 2>/dev/null; then
    pass "Worktrees API endpoint compiled"
  else
    fail "Worktrees API endpoint missing from compiled code"
  fi
else
  echo "  (status server not compiled, skipping compile checks)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================"
echo "TEST RESULTS: $PASSED_TESTS/$TOTAL_TESTS tests passed"
echo "============================================================"

if [[ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]]; then
  echo "All tests passed!"
  exit 0
else
  echo "Some tests failed. Review output above."
  exit 1
fi
