#!/bin/bash

# Worktree Creation Integration Tests
# Tests end-to-end worktree creation scenarios for parallel sprint development.
#
# Test Scenarios:
# 1. Sprint with worktree: auto-creates branch and worktree
# 2. Sprint without worktree: uses project root as cwd
# 3. Two worktrees, different sprints, run concurrently
# 4. Conflict detection prevents branch name collisions
# 5. Variable substitution in branch/path templates

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR%/scripts}"
RUNTIME_DIR="$PLUGIN_DIR/runtime"

echo "============================================================"
echo "WORKTREE CREATION INTEGRATION TESTS"
echo "============================================================"
echo ""

# Build TypeScript before running tests
echo "Building TypeScript..."
cd "$RUNTIME_DIR" && npm run build > /dev/null 2>&1
if [[ $? -ne 0 ]]; then
  echo "Build failed! Run 'npm run build' in $RUNTIME_DIR for details."
  exit 1
fi
echo "Build complete."
echo ""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

pass() {
  echo "✓ $1"
  PASSED_TESTS=$((PASSED_TESTS + 1))
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

fail() {
  echo "✗ $1"
  echo "  Error: $2"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Create a temporary git repo for testing
create_test_repo() {
  local test_dir="$1"
  mkdir -p "$test_dir"
  cd "$test_dir"
  git init -q
  git config user.email "test@test.com"
  git config user.name "Test User"
  echo "# Test Repository" > README.md
  git add .
  git commit -q -m "Initial commit"
  echo "$test_dir"
}

# Cleanup function
cleanup_test_repo() {
  local test_dir="$1"

  # Remove all worktrees first
  if cd "$test_dir" 2>/dev/null; then
    git worktree list --porcelain 2>/dev/null | grep "^worktree " | cut -d' ' -f2 | while read -r wt_path; do
      if [[ "$wt_path" != "$test_dir" ]] && [[ -d "$wt_path" ]]; then
        git worktree remove --force "$wt_path" 2>/dev/null || rm -rf "$wt_path"
      fi
    done
  fi

  rm -rf "$test_dir"
}

# =============================================================================
# Test 1: Worktree Creation with Default Templates
# =============================================================================
echo "=== Test: Worktree Creation with Default Templates ==="

TEST_DIR=$(mktemp -d)
trap "cleanup_test_repo '$TEST_DIR'" EXIT
create_test_repo "$TEST_DIR" > /dev/null

# Create sprint directory structure
SPRINT_ID="2026-01-20_feature-auth"
SPRINT_DIR="$TEST_DIR/.claude/sprints/$SPRINT_ID"
mkdir -p "$SPRINT_DIR"

# Run worktree creation test via node (using compiled JS)
RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree } from './dist/worktree.js';

const config = {
  enabled: true,
  // Uses defaults: branch 'sprint/{sprint-id}', path '../{sprint-id}-worktree'
};

const result = createWorktree(
  config,
  '$SPRINT_ID',
  'test-workflow',
  '$TEST_DIR'
);

console.log(JSON.stringify(result));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true'; then
  pass "Default template worktree creation succeeds"
else
  fail "Default template worktree creation" "$RESULT"
fi

# Check branch was created
if git -C "$TEST_DIR" branch --list "sprint/$SPRINT_ID" | grep -q "sprint/$SPRINT_ID"; then
  pass "Branch 'sprint/$SPRINT_ID' was created"
else
  fail "Branch creation" "Expected branch 'sprint/$SPRINT_ID' not found"
fi

# Check worktree path exists
EXPECTED_WT_PATH="$(dirname "$TEST_DIR")/${SPRINT_ID}-worktree"
if [[ -d "$EXPECTED_WT_PATH" ]]; then
  pass "Worktree created at expected path"
else
  fail "Worktree path creation" "Expected path '$EXPECTED_WT_PATH' not found"
fi

# Check sprint directory structure was created in worktree
if [[ -d "$EXPECTED_WT_PATH/.claude/sprints/$SPRINT_ID/context" ]]; then
  pass "Sprint context/ directory created in worktree"
else
  fail "Sprint directory structure" "context/ not found"
fi

if [[ -d "$EXPECTED_WT_PATH/.claude/sprints/$SPRINT_ID/artifacts" ]]; then
  pass "Sprint artifacts/ directory created in worktree"
else
  fail "Sprint directory structure" "artifacts/ not found"
fi

# Cleanup this test's worktree
git -C "$TEST_DIR" worktree remove --force "$EXPECTED_WT_PATH" 2>/dev/null || true

# =============================================================================
# Test 2: Custom Branch and Path Templates
# =============================================================================
echo ""
echo "=== Test: Custom Branch and Path Templates ==="

SPRINT_ID2="2026-01-21_dashboard"

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree } from './dist/worktree.js';

const config = {
  enabled: true,
  branch: 'feature/{sprint-name}',
  path: '../features/{sprint-name}-dev'
};

const result = createWorktree(
  config,
  '$SPRINT_ID2',
  'plugin-development',
  '$TEST_DIR'
);

console.log(JSON.stringify(result));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true'; then
  pass "Custom template worktree creation succeeds"
else
  fail "Custom template worktree creation" "$RESULT"
fi

if echo "$RESULT" | grep -q '"branch":"feature/dashboard"'; then
  pass "Branch template variable substitution works ({sprint-name})"
else
  fail "Branch substitution" "Expected 'feature/dashboard' in result"
fi

# Check worktree path
EXPECTED_WT_PATH2="$(dirname "$TEST_DIR")/features/dashboard-dev"
if [[ -d "$EXPECTED_WT_PATH2" ]]; then
  pass "Path template variable substitution works"
else
  fail "Path substitution" "Expected '$EXPECTED_WT_PATH2' not found"
fi

# Cleanup
git -C "$TEST_DIR" worktree remove --force "$EXPECTED_WT_PATH2" 2>/dev/null || true

# =============================================================================
# Test 3: Sprint Without Worktree Uses Project Root
# =============================================================================
echo ""
echo "=== Test: Sprint Without Worktree Uses Project Root ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { getProjectRoot } from './dist/worktree.js';
import * as path from 'path';
import * as fs from 'fs';

// Create sprint dir in main repo
const sprintDir = '$TEST_DIR/.claude/sprints/no-worktree-sprint';
fs.mkdirSync(sprintDir, { recursive: true });

const projectRoot = getProjectRoot(sprintDir);
// Normalize paths (macOS symlinks)
const normalizedRoot = fs.realpathSync(projectRoot);
const normalizedTestDir = fs.realpathSync('$TEST_DIR');

console.log(JSON.stringify({
  projectRoot: normalizedRoot,
  testDir: normalizedTestDir,
  match: normalizedRoot === normalizedTestDir
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"match":true'; then
  pass "getProjectRoot returns git repo root for sprint without worktree"
else
  fail "Project root detection" "$RESULT"
fi

# =============================================================================
# Test 4: Branch Conflict Detection
# =============================================================================
echo ""
echo "=== Test: Branch Conflict Detection ==="

# Create a branch that will conflict
git -C "$TEST_DIR" branch conflict-test-branch 2>/dev/null || true

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { checkBranchExists, createWorktree } from './dist/worktree.js';

// Check if branch exists
const branchCheck = checkBranchExists('conflict-test-branch', '$TEST_DIR');
console.log('Branch exists:', branchCheck.exists);

// Try to create worktree with existing branch name (without reuse flag)
const config = {
  enabled: true,
  branch: 'conflict-test-branch',
  path: '../conflict-worktree'
};

const result = createWorktree(
  config,
  'conflict-sprint',
  'test',
  '$TEST_DIR'
);

console.log(JSON.stringify(result));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":false'; then
  pass "Worktree creation fails when branch already exists"
else
  fail "Branch conflict detection" "$RESULT"
fi

if echo "$RESULT" | grep -q '"suggestion"'; then
  pass "Conflict error includes suggestion for resolution"
else
  fail "Conflict suggestion" "Expected suggestion in error response"
fi

# =============================================================================
# Test 5: Reuse Existing Branch Flag
# =============================================================================
echo ""
echo "=== Test: Reuse Existing Branch Flag ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree } from './dist/worktree.js';

const config = {
  enabled: true,
  branch: 'conflict-test-branch',
  path: '../reuse-test-worktree'
};

const result = createWorktree(
  config,
  'reuse-sprint',
  'test',
  '$TEST_DIR',
  { reuseExistingBranch: true }
);

console.log(JSON.stringify(result));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true'; then
  pass "Worktree creation succeeds with reuseExistingBranch flag"
else
  fail "Reuse branch" "$RESULT"
fi

if echo "$RESULT" | grep -q '"branchCreated":false'; then
  pass "branchCreated is false when reusing existing branch"
else
  fail "Branch reuse flag" "Expected branchCreated:false"
fi

# Cleanup
REUSE_WT="$(dirname "$TEST_DIR")/reuse-test-worktree"
git -C "$TEST_DIR" worktree remove --force "$REUSE_WT" 2>/dev/null || true

# =============================================================================
# Test 6: Two Worktrees for Different Sprints
# =============================================================================
echo ""
echo "=== Test: Two Worktrees for Different Sprints ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, getWorktreeInfo } from './dist/worktree.js';

// Create first worktree
const config1 = {
  enabled: true,
  branch: 'sprint/parallel-1',
  path: '../parallel-wt-1'
};

const result1 = createWorktree(config1, 'parallel-1', 'test', '$TEST_DIR');

// Create second worktree
const config2 = {
  enabled: true,
  branch: 'sprint/parallel-2',
  path: '../parallel-wt-2'
};

const result2 = createWorktree(config2, 'parallel-2', 'test', '$TEST_DIR');

// Get worktree info for both
const info1 = getWorktreeInfo(result1.worktreePath);
const info2 = getWorktreeInfo(result2.worktreePath);

console.log(JSON.stringify({
  wt1: { success: result1.success, id: info1.id, isWorktree: info1.isWorktree },
  wt2: { success: result2.success, id: info2.id, isWorktree: info2.isWorktree },
  idsAreDifferent: info1.id !== info2.id
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true.*"success":true'; then
  pass "Both parallel worktrees created successfully"
else
  fail "Parallel worktree creation" "$RESULT"
fi

if echo "$RESULT" | grep -q '"idsAreDifferent":true'; then
  pass "Parallel worktrees have different worktree IDs"
else
  fail "Worktree ID uniqueness" "Expected different IDs for parallel worktrees"
fi

if echo "$RESULT" | grep -q '"isWorktree":true.*"isWorktree":true'; then
  pass "Both directories correctly detected as worktrees"
else
  fail "Worktree detection" "Expected isWorktree:true for both"
fi

# Cleanup parallel worktrees
git -C "$TEST_DIR" worktree remove --force "$(dirname "$TEST_DIR")/parallel-wt-1" 2>/dev/null || true
git -C "$TEST_DIR" worktree remove --force "$(dirname "$TEST_DIR")/parallel-wt-2" 2>/dev/null || true

# =============================================================================
# Test 7: Worktree Isolation Validation
# =============================================================================
echo ""
echo "=== Test: Worktree Isolation Validation ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, validateWorktreeIsolation } from './dist/worktree.js';
import * as path from 'path';

// Create a worktree
const config = {
  enabled: true,
  branch: 'sprint/isolation-test',
  path: '../isolation-wt'
};

const result = createWorktree(config, 'isolation-sprint', 'test', '$TEST_DIR');

// Sprint in worktree should pass isolation check from that worktree
const sprintInWt = path.join(result.worktreePath, '.claude', 'sprints', 'isolation-sprint');
const validFromWt = validateWorktreeIsolation(sprintInWt, result.worktreePath);

// Sprint in main should fail isolation check from worktree
const sprintInMain = '$TEST_DIR/.claude/sprints/main-sprint';
const invalidCross = validateWorktreeIsolation(sprintInMain, result.worktreePath);

console.log(JSON.stringify({
  worktreeCreated: result.success,
  validFromOwn: validFromWt,
  invalidCrossWorktree: !invalidCross
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"validFromOwn":true'; then
  pass "Sprint in worktree passes isolation check from that worktree"
else
  fail "Isolation validation - own worktree" "$RESULT"
fi

if echo "$RESULT" | grep -q '"invalidCrossWorktree":true'; then
  pass "Sprint in main repo fails isolation check from different worktree"
else
  fail "Isolation validation - cross worktree" "$RESULT"
fi

# Cleanup
git -C "$TEST_DIR" worktree remove --force "$(dirname "$TEST_DIR")/isolation-wt" 2>/dev/null || true

# =============================================================================
# Test 8: Worktree Path Conflict Detection
# =============================================================================
echo ""
echo "=== Test: Worktree Path Already Exists ==="

# Create a directory that would conflict with worktree path
CONFLICT_PATH="$(dirname "$TEST_DIR")/path-conflict-dir"
mkdir -p "$CONFLICT_PATH"

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree } from './dist/worktree.js';

const config = {
  enabled: true,
  branch: 'sprint/path-conflict',
  path: '../path-conflict-dir'  // This already exists
};

const result = createWorktree(config, 'path-conflict-sprint', 'test', '$TEST_DIR');
console.log(JSON.stringify(result));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":false'; then
  pass "Worktree creation fails when path already exists"
else
  fail "Path conflict detection" "$RESULT"
fi

if echo "$RESULT" | grep -q 'already exists'; then
  pass "Error message indicates path conflict"
else
  fail "Path conflict message" "Expected 'already exists' in error"
fi

# Cleanup
rm -rf "$CONFLICT_PATH"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================"
echo "WORKTREE CREATION TEST RESULTS: $PASSED_TESTS/$TOTAL_TESTS passed"
echo "============================================================"

if [[ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]]; then
  echo "All worktree creation tests passed!"
  exit 0
else
  echo "Some tests failed. Review output above."
  exit 1
fi
