#!/bin/bash

# Worktree Cleanup Integration Tests
# Tests end-to-end worktree cleanup scenarios.
#
# Test Scenarios:
# 1. Worktree cleanup works after completion
# 2. Cleanup modes: never, on-complete, on-merge
# 3. Safety checks prevent cleanup of active sprints
# 4. Force flag overrides safety checks
# 5. Branch deletion based on merge status
# 6. Sprint status shows all worktrees correctly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR%/scripts}"
RUNTIME_DIR="$PLUGIN_DIR/runtime"

echo "============================================================"
echo "WORKTREE CLEANUP INTEGRATION TESTS"
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
# Test 1: Gather Cleanup Context
# =============================================================================
echo "=== Test: Gather Cleanup Context ==="

TEST_DIR=$(mktemp -d)
trap "cleanup_test_repo '$TEST_DIR'" EXIT
create_test_repo "$TEST_DIR" > /dev/null

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection } from './dist/worktree.js';
import { gatherCleanupContext } from './dist/cleanup.js';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  enabled: true,
  branch: 'sprint/cleanup-ctx-test',
  path: '../cleanup-ctx-wt',
  cleanup: 'on-complete'
};

const result = createWorktree(config, 'cleanup-ctx-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Create PROGRESS.yaml with worktree config
const progressSection = buildWorktreeProgressSection(result, config);
const progressYaml = \`sprint-id: cleanup-ctx-sprint
status: completed
worktree:
  enabled: true
  branch: \${progressSection.branch}
  path: \${progressSection.path}
  cleanup: on-complete
  working-dir: \${progressSection['working-dir']}
\`;

fs.writeFileSync(path.join(result.sprintDir, 'PROGRESS.yaml'), progressYaml);

// Gather context
const context = gatherCleanupContext(result.sprintDir);

console.log(JSON.stringify({
  hasContext: context !== null,
  sprintId: context?.sprintId,
  status: context?.status,
  worktreePath: context?.worktreePath,
  branch: context?.branch,
  hasRepoRoot: !!context?.repoRoot
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"hasContext":true'; then
  pass "gatherCleanupContext returns valid context"
else
  fail "Gather cleanup context" "$RESULT"
fi

if echo "$RESULT" | grep -q '"status":"completed"'; then
  pass "Context includes sprint status"
else
  fail "Status in context" "$RESULT"
fi

if echo "$RESULT" | grep -q '"branch":"sprint/cleanup-ctx-test"'; then
  pass "Context includes branch name"
else
  fail "Branch in context" "$RESULT"
fi

# Cleanup
CLEANUP_CTX_WT="$(dirname "$TEST_DIR")/cleanup-ctx-wt"
git -C "$TEST_DIR" worktree remove --force "$CLEANUP_CTX_WT" 2>/dev/null || true

# =============================================================================
# Test 2: shouldAutoCleanup for Different Modes
# =============================================================================
echo ""
echo "=== Test: shouldAutoCleanup for Different Cleanup Modes ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { shouldAutoCleanup } from './dist/cleanup.js';

// Test 'never' mode
const neverContext = {
  sprintId: 'test',
  sprintDir: '/test',
  status: 'completed',
  worktreeConfig: { enabled: true, branch: 'test', path: '/wt', cleanup: 'never', 'working-dir': '/wt' },
  worktreePath: '/wt',
  branch: 'test',
  hasUncommittedChanges: false,
  hasUnpushedCommits: false,
  isMergedToMain: false,
  repoRoot: '/repo'
};

const neverResult = shouldAutoCleanup(neverContext);

// Test 'on-complete' with completed status
const completeContext = {
  ...neverContext,
  worktreeConfig: { ...neverContext.worktreeConfig, cleanup: 'on-complete' }
};
const completeResult = shouldAutoCleanup(completeContext);

// Test 'on-complete' with in-progress status
const inProgressContext = {
  ...completeContext,
  status: 'in-progress'
};
const inProgressResult = shouldAutoCleanup(inProgressContext);

// Test 'on-merge' with merged branch
const mergedContext = {
  ...neverContext,
  worktreeConfig: { ...neverContext.worktreeConfig, cleanup: 'on-merge' },
  isMergedToMain: true
};
const mergedResult = shouldAutoCleanup(mergedContext);

// Test 'on-merge' with unmerged branch
const unmergedContext = {
  ...mergedContext,
  isMergedToMain: false
};
const unmergedResult = shouldAutoCleanup(unmergedContext);

console.log(JSON.stringify({
  never: { shouldCleanup: neverResult.shouldCleanup, reason: neverResult.reason },
  onCompleteCompleted: { shouldCleanup: completeResult.shouldCleanup },
  onCompleteInProgress: { shouldCleanup: inProgressResult.shouldCleanup },
  onMergeMerged: { shouldCleanup: mergedResult.shouldCleanup },
  onMergeUnmerged: { shouldCleanup: unmergedResult.shouldCleanup }
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"never":{"shouldCleanup":false'; then
  pass "cleanup: never prevents auto-cleanup"
else
  fail "cleanup: never mode" "$RESULT"
fi

if echo "$RESULT" | grep -q '"onCompleteCompleted":{"shouldCleanup":true'; then
  pass "cleanup: on-complete allows cleanup when status is completed"
else
  fail "cleanup: on-complete with completed status" "$RESULT"
fi

if echo "$RESULT" | grep -q '"onCompleteInProgress":{"shouldCleanup":false'; then
  pass "cleanup: on-complete blocks cleanup when status is in-progress"
else
  fail "cleanup: on-complete with in-progress status" "$RESULT"
fi

if echo "$RESULT" | grep -q '"onMergeMerged":{"shouldCleanup":true'; then
  pass "cleanup: on-merge allows cleanup when branch is merged"
else
  fail "cleanup: on-merge with merged branch" "$RESULT"
fi

if echo "$RESULT" | grep -q '"onMergeUnmerged":{"shouldCleanup":false'; then
  pass "cleanup: on-merge blocks cleanup when branch is not merged"
else
  fail "cleanup: on-merge with unmerged branch" "$RESULT"
fi

# =============================================================================
# Test 3: Safety Checks Prevent Active Sprint Cleanup
# =============================================================================
echo ""
echo "=== Test: Safety Checks Prevent Active Sprint Cleanup ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { performSafetyChecks } from './dist/cleanup.js';

// In-progress sprint
const inProgressContext = {
  sprintId: 'test',
  sprintDir: '/test',
  status: 'in-progress',
  worktreeConfig: { enabled: true, branch: 'test', path: '/wt', cleanup: 'on-complete', 'working-dir': '/wt' },
  worktreePath: '/wt',
  branch: 'test',
  hasUncommittedChanges: false,
  hasUnpushedCommits: false,
  isMergedToMain: false,
  repoRoot: '/repo'
};

const inProgressCheck = performSafetyChecks(inProgressContext);

// Completed sprint with uncommitted changes
const uncommittedContext = {
  ...inProgressContext,
  status: 'completed',
  hasUncommittedChanges: true
};

const uncommittedCheck = performSafetyChecks(uncommittedContext);
const uncommittedForceCheck = performSafetyChecks(uncommittedContext, { force: true });

// Completed sprint with unpushed commits
const unpushedContext = {
  ...inProgressContext,
  status: 'completed',
  hasUnpushedCommits: true
};

const unpushedCheck = performSafetyChecks(unpushedContext);
const unpushedForceCheck = performSafetyChecks(unpushedContext, { force: true });

console.log(JSON.stringify({
  inProgress: { safe: inProgressCheck.safe, forceOverridable: inProgressCheck.forceOverridable },
  uncommitted: { safe: uncommittedCheck.safe, forceOverridable: uncommittedCheck.forceOverridable },
  uncommittedForce: { safe: uncommittedForceCheck.safe },
  unpushed: { safe: unpushedCheck.safe, forceOverridable: unpushedCheck.forceOverridable },
  unpushedForce: { safe: unpushedForceCheck.safe }
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"inProgress":{"safe":false,"forceOverridable":false'; then
  pass "Safety check blocks cleanup of in-progress sprint (not force overridable)"
else
  fail "In-progress safety check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"uncommitted":{"safe":false,"forceOverridable":true'; then
  pass "Safety check blocks cleanup with uncommitted changes (force overridable)"
else
  fail "Uncommitted changes safety check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"uncommittedForce":{"safe":true'; then
  pass "Force flag overrides uncommitted changes check"
else
  fail "Force override for uncommitted" "$RESULT"
fi

if echo "$RESULT" | grep -q '"unpushed":{"safe":false,"forceOverridable":true'; then
  pass "Safety check blocks cleanup with unpushed commits (force overridable)"
else
  fail "Unpushed commits safety check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"unpushedForce":{"safe":true'; then
  pass "Force flag overrides unpushed commits check"
else
  fail "Force override for unpushed" "$RESULT"
fi

# =============================================================================
# Test 4: Execute Cleanup (Dry Run)
# =============================================================================
echo ""
echo "=== Test: Execute Cleanup (Dry Run) ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection } from './dist/worktree.js';
import { gatherCleanupContext, executeCleanup } from './dist/cleanup.js';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  enabled: true,
  branch: 'sprint/dry-run-test',
  path: '../dry-run-wt',
  cleanup: 'on-complete'
};

const result = createWorktree(config, 'dry-run-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Create PROGRESS.yaml with completed status
const progressSection = buildWorktreeProgressSection(result, config);
const progressYaml = \`sprint-id: dry-run-sprint
status: completed
worktree:
  enabled: true
  branch: \${progressSection.branch}
  path: \${progressSection.path}
  cleanup: on-complete
  working-dir: \${progressSection['working-dir']}
\`;

fs.writeFileSync(path.join(result.sprintDir, 'PROGRESS.yaml'), progressYaml);

// Gather context
const context = gatherCleanupContext(result.sprintDir);

// Execute cleanup in dry run mode with force (to bypass uncommitted changes from sprint dir)
const cleanupResult = executeCleanup(context, { dryRun: true, force: true });

// Check worktree still exists (dry run should not remove it)
const worktreeStillExists = fs.existsSync(result.worktreePath);

console.log(JSON.stringify({
  success: cleanupResult.success,
  actionsCount: cleanupResult.actions.length,
  hasWorktreeRemoveAction: cleanupResult.actions.some(a => a.type === 'worktree-remove'),
  hasBranchDeleteAction: cleanupResult.actions.some(a => a.type === 'branch-delete'),
  worktreeStillExists: worktreeStillExists
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true'; then
  pass "Dry run cleanup succeeds"
else
  fail "Dry run cleanup" "$RESULT"
fi

if echo "$RESULT" | grep -q '"hasWorktreeRemoveAction":true'; then
  pass "Dry run includes worktree-remove action"
else
  fail "Worktree remove action in dry run" "$RESULT"
fi

if echo "$RESULT" | grep -q '"worktreeStillExists":true'; then
  pass "Dry run does not actually remove worktree"
else
  fail "Dry run non-destructive" "$RESULT"
fi

# Cleanup
DRY_RUN_WT="$(dirname "$TEST_DIR")/dry-run-wt"
git -C "$TEST_DIR" worktree remove --force "$DRY_RUN_WT" 2>/dev/null || true

# =============================================================================
# Test 5: Execute Actual Cleanup
# =============================================================================
echo ""
echo "=== Test: Execute Actual Cleanup ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection } from './dist/worktree.js';
import { gatherCleanupContext, executeCleanup } from './dist/cleanup.js';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  enabled: true,
  branch: 'sprint/actual-cleanup-test',
  path: '../actual-cleanup-wt',
  cleanup: 'on-complete'
};

const result = createWorktree(config, 'actual-cleanup-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

const worktreePath = result.worktreePath;

// Create PROGRESS.yaml with completed status
const progressSection = buildWorktreeProgressSection(result, config);
const progressYaml = \`sprint-id: actual-cleanup-sprint
status: completed
worktree:
  enabled: true
  branch: \${progressSection.branch}
  path: \${progressSection.path}
  cleanup: on-complete
  working-dir: \${progressSection['working-dir']}
\`;

fs.writeFileSync(path.join(result.sprintDir, 'PROGRESS.yaml'), progressYaml);

// Gather context
const context = gatherCleanupContext(result.sprintDir);

// Execute actual cleanup (force to bypass uncommitted changes from sprint dir)
const cleanupResult = executeCleanup(context, { force: true });

// Check worktree was removed
const worktreeRemoved = !fs.existsSync(worktreePath);

console.log(JSON.stringify({
  success: cleanupResult.success,
  worktreeRemoved: worktreeRemoved,
  summary: cleanupResult.summary.substring(0, 100)
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"success":true'; then
  pass "Actual cleanup succeeds"
else
  fail "Actual cleanup" "$RESULT"
fi

if echo "$RESULT" | grep -q '"worktreeRemoved":true'; then
  pass "Worktree was actually removed"
else
  fail "Worktree removal" "$RESULT"
fi

# =============================================================================
# Test 6: Sprint Status Shows All Worktrees
# =============================================================================
echo ""
echo "=== Test: Sprint Status Shows All Worktrees ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection } from './dist/worktree.js';
import { discoverSprints, formatCrossWorktreeStatus } from './dist/status.js';
import * as fs from 'fs';
import * as path from 'path';

// Create first worktree with sprint
const config1 = {
  enabled: true,
  branch: 'sprint/status-test-1',
  path: '../status-wt-1',
  cleanup: 'never'
};

const result1 = createWorktree(config1, 'status-sprint-1', 'test', '$TEST_DIR');

if (!result1.success) {
  console.log(JSON.stringify({ error: 'First worktree failed: ' + result1.error }));
  process.exit(1);
}

// Create PROGRESS.yaml for first sprint
const progress1 = \`sprint-id: status-sprint-1
status: in-progress
worktree:
  enabled: true
  branch: sprint/status-test-1
  path: ../status-wt-1
\`;
fs.writeFileSync(path.join(result1.sprintDir, 'PROGRESS.yaml'), progress1);

// Create second worktree with sprint
const config2 = {
  enabled: true,
  branch: 'sprint/status-test-2',
  path: '../status-wt-2',
  cleanup: 'never'
};

const result2 = createWorktree(config2, 'status-sprint-2', 'test', '$TEST_DIR');

if (!result2.success) {
  console.log(JSON.stringify({ error: 'Second worktree failed: ' + result2.error }));
  process.exit(1);
}

// Create PROGRESS.yaml for second sprint
const progress2 = \`sprint-id: status-sprint-2
status: completed
worktree:
  enabled: true
  branch: sprint/status-test-2
  path: ../status-wt-2
\`;
fs.writeFileSync(path.join(result2.sprintDir, 'PROGRESS.yaml'), progress2);

// Discover sprints across all worktrees
const discovered = discoverSprints('$TEST_DIR', { currentOnly: false });

// Format status
const formattedStatus = formatCrossWorktreeStatus(discovered, false);

console.log(JSON.stringify({
  sprintCount: discovered.sprints.length,
  worktreesChecked: discovered.worktreesChecked,
  hasBothSprints: discovered.sprints.some(s => s.sprintDir.includes('status-sprint-1')) &&
                  discovered.sprints.some(s => s.sprintDir.includes('status-sprint-2')),
  formattedHasTotal: formattedStatus.includes('Total:'),
  formattedHasActive: formattedStatus.includes('active')
}));
" 2>&1) || true

# Check that we found at least 2 sprints (might have more from previous test remnants)
SPRINT_COUNT=$(echo "$RESULT" | grep -o '"sprintCount":[0-9]*' | grep -o '[0-9]*')
if [[ "$SPRINT_COUNT" -ge 2 ]]; then
  pass "Status discovers sprints in multiple worktrees (found $SPRINT_COUNT)"
else
  fail "Sprint discovery across worktrees" "$RESULT"
fi

if echo "$RESULT" | grep -q '"hasBothSprints":true'; then
  pass "Both sprints are included in status"
else
  fail "Both sprints in status" "$RESULT"
fi

if echo "$RESULT" | grep -q '"formattedHasTotal":true'; then
  pass "Formatted status includes total count"
else
  fail "Formatted status total" "$RESULT"
fi

# Cleanup
STATUS_WT1="$(dirname "$TEST_DIR")/status-wt-1"
STATUS_WT2="$(dirname "$TEST_DIR")/status-wt-2"
git -C "$TEST_DIR" worktree remove --force "$STATUS_WT1" 2>/dev/null || true
git -C "$TEST_DIR" worktree remove --force "$STATUS_WT2" 2>/dev/null || true

# =============================================================================
# Test 7: Keep Branch Option
# =============================================================================
echo ""
echo "=== Test: Keep Branch Option ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection, checkBranchExists } from './dist/worktree.js';
import { gatherCleanupContext, executeCleanup } from './dist/cleanup.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const config = {
  enabled: true,
  branch: 'sprint/keep-branch-test',
  path: '../keep-branch-wt',
  cleanup: 'on-complete'
};

const result = createWorktree(config, 'keep-branch-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Create PROGRESS.yaml with completed status
const progressSection = buildWorktreeProgressSection(result, config);
const progressYaml = \`sprint-id: keep-branch-sprint
status: completed
worktree:
  enabled: true
  branch: \${progressSection.branch}
  path: \${progressSection.path}
  cleanup: on-complete
  working-dir: \${progressSection['working-dir']}
\`;

fs.writeFileSync(path.join(result.sprintDir, 'PROGRESS.yaml'), progressYaml);

// Gather context
const context = gatherCleanupContext(result.sprintDir);

// Execute cleanup with keepBranch option (force to bypass uncommitted changes)
const cleanupResult = executeCleanup(context, { keepBranch: true, force: true });

// Check branch still exists
const branchCheck = checkBranchExists('sprint/keep-branch-test', '$TEST_DIR');

// Check worktree was removed
const worktreeRemoved = !fs.existsSync(result.worktreePath);

console.log(JSON.stringify({
  success: cleanupResult.success,
  worktreeRemoved: worktreeRemoved,
  branchKept: branchCheck.exists,
  hasSkipAction: cleanupResult.actions.some(a => a.type === 'skip' && a.description.includes('Keeping branch'))
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"branchKept":true'; then
  pass "keepBranch option preserves branch"
else
  fail "Keep branch option" "$RESULT"
fi

if echo "$RESULT" | grep -q '"worktreeRemoved":true'; then
  pass "Worktree still removed when keeping branch"
else
  fail "Worktree removal with keepBranch" "$RESULT"
fi

if echo "$RESULT" | grep -q '"hasSkipAction":true'; then
  pass "Cleanup actions include skip for kept branch"
else
  fail "Skip action for kept branch" "$RESULT"
fi

# =============================================================================
# Test 8: Terminal States Allow Cleanup
# =============================================================================
echo ""
echo "=== Test: Terminal States Allow Cleanup ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { isTerminalState, TERMINAL_STATES } from './dist/cleanup.js';

const states = ['pending', 'in-progress', 'completed', 'blocked', 'paused'];
const results = {};

for (const state of states) {
  results[state] = isTerminalState(state);
}

console.log(JSON.stringify({
  results: results,
  terminalStates: TERMINAL_STATES
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"pending":false'; then
  pass "pending is not a terminal state"
else
  fail "pending terminal check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"in-progress":false'; then
  pass "in-progress is not a terminal state"
else
  fail "in-progress terminal check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"completed":true'; then
  pass "completed is a terminal state"
else
  fail "completed terminal check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"blocked":true'; then
  pass "blocked is a terminal state"
else
  fail "blocked terminal check" "$RESULT"
fi

if echo "$RESULT" | grep -q '"paused":true'; then
  pass "paused is a terminal state"
else
  fail "paused terminal check" "$RESULT"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================"
echo "WORKTREE CLEANUP TEST RESULTS: $PASSED_TESTS/$TOTAL_TESTS passed"
echo "============================================================"

if [[ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]]; then
  echo "All worktree cleanup tests passed!"
  exit 0
else
  echo "Some tests failed. Review output above."
  exit 1
fi
