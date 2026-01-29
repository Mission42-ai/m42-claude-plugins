#!/bin/bash

# Runtime CWD Integration Tests
# Tests that Claude executes in correct working directory for worktree sprints.
#
# Test Scenarios:
# 1. Claude executes in worktree root (not sprint dir)
# 2. File operations work relative to worktree
# 3. Git operations affect worktree's branch
# 4. PROGRESS.yaml still written to sprint directory
# 5. getProjectRoot correctly resolves for both worktree and non-worktree cases

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR%/scripts}"
RUNTIME_DIR="$PLUGIN_DIR/runtime"

echo "============================================================"
echo "RUNTIME CWD INTEGRATION TESTS"
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
  mkdir -p src
  echo "console.log('hello');" > src/index.js
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
# Test 1: getProjectRoot for Git Repository
# =============================================================================
echo "=== Test: getProjectRoot for Git Repository ==="

TEST_DIR=$(mktemp -d)
trap "cleanup_test_repo '$TEST_DIR'" EXIT
create_test_repo "$TEST_DIR" > /dev/null

# Create sprint directory
SPRINT_DIR="$TEST_DIR/.claude/sprints/2026-01-20_test-sprint"
mkdir -p "$SPRINT_DIR"

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { getProjectRoot } from './dist/worktree.js';
import * as fs from 'fs';

const sprintDir = '$SPRINT_DIR';
const projectRoot = getProjectRoot(sprintDir);

// Normalize paths (macOS symlinks)
const normalizedRoot = fs.realpathSync(projectRoot);
const normalizedTestDir = fs.realpathSync('$TEST_DIR');

console.log(JSON.stringify({
  projectRoot: normalizedRoot,
  testDir: normalizedTestDir,
  isGitRoot: normalizedRoot === normalizedTestDir
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"isGitRoot":true'; then
  pass "getProjectRoot returns git repository root"
else
  fail "getProjectRoot for git repo" "$RESULT"
fi

# =============================================================================
# Test 2: getProjectRoot for Worktree Sprint
# =============================================================================
echo ""
echo "=== Test: getProjectRoot for Worktree Sprint ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, getProjectRoot } from './dist/worktree.js';
import * as fs from 'fs';

// Create a worktree
const config = {
  enabled: true,
  branch: 'sprint/cwd-test',
  path: '../cwd-test-worktree'
};

const result = createWorktree(config, 'cwd-test-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Now check getProjectRoot from within the worktree's sprint directory
const projectRoot = getProjectRoot(result.sprintDir);

// Normalize paths
const normalizedRoot = fs.realpathSync(projectRoot);
const normalizedWorktreePath = fs.realpathSync(result.worktreePath);

console.log(JSON.stringify({
  worktreePath: normalizedWorktreePath,
  projectRoot: normalizedRoot,
  isWorktreeRoot: normalizedRoot === normalizedWorktreePath,
  sprintDir: result.sprintDir
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"isWorktreeRoot":true'; then
  pass "getProjectRoot returns worktree root for worktree sprint"
else
  fail "getProjectRoot for worktree" "$RESULT"
fi

# Cleanup worktree
CWD_WT="$(dirname "$TEST_DIR")/cwd-test-worktree"
git -C "$TEST_DIR" worktree remove --force "$CWD_WT" 2>/dev/null || true

# =============================================================================
# Test 3: Worktree Working Directory in PROGRESS.yaml
# =============================================================================
echo ""
echo "=== Test: Worktree Working Directory in PROGRESS.yaml ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeProgressSection } from './dist/worktree.js';

const config = {
  enabled: true,
  branch: 'sprint/workdir-test',
  path: '../workdir-test-wt',
  cleanup: 'on-complete'
};

const result = createWorktree(config, 'workdir-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Build the worktree progress section
const section = buildWorktreeProgressSection(result, config);

console.log(JSON.stringify({
  success: result.success,
  worktreePath: result.worktreePath,
  sectionWorkingDir: section['working-dir'],
  workingDirMatchesWorktree: section['working-dir'] === result.worktreePath
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"workingDirMatchesWorktree":true'; then
  pass "buildWorktreeProgressSection sets working-dir to worktree path"
else
  fail "Working directory in progress section" "$RESULT"
fi

# Cleanup worktree
WORKDIR_WT="$(dirname "$TEST_DIR")/workdir-test-wt"
git -C "$TEST_DIR" worktree remove --force "$WORKDIR_WT" 2>/dev/null || true

# =============================================================================
# Test 4: Git Operations in Worktree Affect Correct Branch
# =============================================================================
echo ""
echo "=== Test: Git Operations Affect Worktree's Branch ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, getCurrentBranch } from './dist/worktree.js';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Create a worktree
const config = {
  enabled: true,
  branch: 'sprint/git-ops-test',
  path: '../git-ops-wt'
};

const result = createWorktree(config, 'git-ops-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Check current branch in worktree
const wtBranch = getCurrentBranch(result.worktreePath);

// Check that main repo is still on main/master
const mainBranch = getCurrentBranch('$TEST_DIR');

// Make a change in worktree and commit
const testFile = result.worktreePath + '/worktree-test-file.txt';
fs.writeFileSync(testFile, 'Created in worktree');
execSync('git add . && git commit -m \"Worktree commit\"', {
  cwd: result.worktreePath,
  stdio: 'pipe'
});

// Verify commit is in worktree's branch but not in main
const wtLog = execSync('git log --oneline -1', {
  cwd: result.worktreePath,
  encoding: 'utf-8'
}).trim();

const mainLog = execSync('git log --oneline -1', {
  cwd: '$TEST_DIR',
  encoding: 'utf-8'
}).trim();

console.log(JSON.stringify({
  worktreeBranch: wtBranch,
  expectedBranch: 'sprint/git-ops-test',
  branchMatch: wtBranch === 'sprint/git-ops-test',
  mainBranch: mainBranch,
  wtHasCommit: wtLog.includes('Worktree commit'),
  mainLacksCommit: !mainLog.includes('Worktree commit')
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"branchMatch":true'; then
  pass "Worktree has correct branch checked out"
else
  fail "Worktree branch checkout" "$RESULT"
fi

if echo "$RESULT" | grep -q '"wtHasCommit":true.*"mainLacksCommit":true'; then
  pass "Git commit in worktree stays on worktree's branch only"
else
  fail "Git commit isolation" "$RESULT"
fi

# Cleanup
GIT_OPS_WT="$(dirname "$TEST_DIR")/git-ops-wt"
git -C "$TEST_DIR" worktree remove --force "$GIT_OPS_WT" 2>/dev/null || true

# =============================================================================
# Test 5: PROGRESS.yaml in Sprint Directory (not project root)
# =============================================================================
echo ""
echo "=== Test: PROGRESS.yaml Location in Sprint Directory ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree } from './dist/worktree.js';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  enabled: true,
  branch: 'sprint/progress-test',
  path: '../progress-test-wt'
};

const result = createWorktree(config, 'progress-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Simulate writing PROGRESS.yaml to sprint directory
const progressPath = path.join(result.sprintDir, 'PROGRESS.yaml');
fs.writeFileSync(progressPath, 'sprint-id: progress-sprint\nstatus: in-progress\n');

// Verify it's in the sprint directory within the worktree
const sprintDirExists = fs.existsSync(result.sprintDir);
const progressExists = fs.existsSync(progressPath);
const isInWorktree = result.sprintDir.startsWith(result.worktreePath);

// Verify PROGRESS.yaml is NOT in the main repo's sprint dir
const mainRepoSprintDir = '$TEST_DIR/.claude/sprints/progress-sprint';
const notInMainRepo = !fs.existsSync(path.join(mainRepoSprintDir, 'PROGRESS.yaml'));

console.log(JSON.stringify({
  sprintDir: result.sprintDir,
  sprintDirExists: sprintDirExists,
  progressExists: progressExists,
  isInWorktree: isInWorktree,
  notInMainRepo: notInMainRepo
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"isInWorktree":true'; then
  pass "Sprint directory is within worktree path"
else
  fail "Sprint directory location" "$RESULT"
fi

if echo "$RESULT" | grep -q '"progressExists":true'; then
  pass "PROGRESS.yaml can be written to sprint directory"
else
  fail "PROGRESS.yaml write" "$RESULT"
fi

if echo "$RESULT" | grep -q '"notInMainRepo":true'; then
  pass "PROGRESS.yaml is not in main repo's sprint directory"
else
  fail "Sprint isolation from main repo" "$RESULT"
fi

# Cleanup
PROGRESS_WT="$(dirname "$TEST_DIR")/progress-test-wt"
git -C "$TEST_DIR" worktree remove --force "$PROGRESS_WT" 2>/dev/null || true

# =============================================================================
# Test 6: File Operations Relative to Worktree
# =============================================================================
echo ""
echo "=== Test: File Operations Relative to Worktree ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, getProjectRoot } from './dist/worktree.js';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  enabled: true,
  branch: 'sprint/fileops-test',
  path: '../fileops-test-wt'
};

const result = createWorktree(config, 'fileops-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Simulate Claude creating files in the worktree root (project root)
const projectRoot = getProjectRoot(result.sprintDir);

// Create a file in src/ relative to project root
const srcDir = path.join(projectRoot, 'src');
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

const newFile = path.join(srcDir, 'new-feature.js');
fs.writeFileSync(newFile, '// Created by sprint');

// Verify the file is in the worktree, not the main repo
const inWorktree = fs.existsSync(path.join(result.worktreePath, 'src', 'new-feature.js'));
const notInMain = !fs.existsSync(path.join('$TEST_DIR', 'src', 'new-feature.js'));

console.log(JSON.stringify({
  projectRoot: fs.realpathSync(projectRoot),
  worktreePath: fs.realpathSync(result.worktreePath),
  inWorktree: inWorktree,
  notInMain: notInMain,
  correctIsolation: inWorktree && notInMain
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"correctIsolation":true'; then
  pass "File operations create files in worktree, not main repo"
else
  fail "File operation isolation" "$RESULT"
fi

# Cleanup
FILEOPS_WT="$(dirname "$TEST_DIR")/fileops-test-wt"
git -C "$TEST_DIR" worktree remove --force "$FILEOPS_WT" 2>/dev/null || true

# =============================================================================
# Test 7: Non-Worktree Sprint Uses Main Repo Root
# =============================================================================
echo ""
echo "=== Test: Non-Worktree Sprint Uses Main Repo Root ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { getProjectRoot, getWorktreeInfo } from './dist/worktree.js';
import * as fs from 'fs';
import * as path from 'path';

// Create a sprint directly in main repo (no worktree)
const mainSprintDir = '$TEST_DIR/.claude/sprints/main-sprint';
fs.mkdirSync(mainSprintDir, { recursive: true });

// Get project root
const projectRoot = getProjectRoot(mainSprintDir);

// Get worktree info
const info = getWorktreeInfo('$TEST_DIR');

// Normalize paths
const normalizedRoot = fs.realpathSync(projectRoot);
const normalizedTestDir = fs.realpathSync('$TEST_DIR');

console.log(JSON.stringify({
  projectRoot: normalizedRoot,
  testDir: normalizedTestDir,
  isMainRepo: normalizedRoot === normalizedTestDir,
  isWorktree: info.isWorktree
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"isMainRepo":true'; then
  pass "Non-worktree sprint resolves to main repo root"
else
  fail "Non-worktree project root" "$RESULT"
fi

if echo "$RESULT" | grep -q '"isWorktree":false'; then
  pass "Main repo correctly detected as not being a worktree"
else
  fail "Main repo worktree detection" "$RESULT"
fi

# =============================================================================
# Test 8: Worktree ID in Metadata
# =============================================================================
echo ""
echo "=== Test: Worktree ID in Metadata ==="

RESULT=$(cd "$RUNTIME_DIR" && node -e "
import { createWorktree, buildWorktreeMetadata, getWorktreeInfo } from './dist/worktree.js';

const config = {
  enabled: true,
  branch: 'sprint/meta-test',
  path: '../meta-test-wt'
};

const result = createWorktree(config, 'meta-sprint', 'test', '$TEST_DIR');

if (!result.success) {
  console.log(JSON.stringify({ error: result.error }));
  process.exit(1);
}

// Get worktree metadata
const metadata = buildWorktreeMetadata(result.worktreePath);

// Also get info for comparison
const info = getWorktreeInfo(result.worktreePath);

console.log(JSON.stringify({
  hasWorktreeId: 'worktree-id' in metadata,
  hasWorktreePath: 'worktree-path' in metadata,
  hasIsWorktree: 'is-worktree' in metadata,
  isWorktree: metadata['is-worktree'],
  idLength: metadata['worktree-id'].length,
  idsMatch: metadata['worktree-id'] === info.id
}));
" 2>&1) || true

if echo "$RESULT" | grep -q '"hasWorktreeId":true'; then
  pass "Metadata includes worktree-id"
else
  fail "Worktree ID in metadata" "$RESULT"
fi

if echo "$RESULT" | grep -q '"idLength":12'; then
  pass "Worktree ID is 12 characters (hash)"
else
  fail "Worktree ID format" "$RESULT"
fi

if echo "$RESULT" | grep -q '"isWorktree":true'; then
  pass "Metadata correctly indicates is-worktree: true"
else
  fail "is-worktree flag" "$RESULT"
fi

# Cleanup
META_WT="$(dirname "$TEST_DIR")/meta-test-wt"
git -C "$TEST_DIR" worktree remove --force "$META_WT" 2>/dev/null || true

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================"
echo "RUNTIME CWD TEST RESULTS: $PASSED_TESTS/$TOTAL_TESTS passed"
echo "============================================================"

if [[ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]]; then
  echo "All runtime CWD tests passed!"
  exit 0
else
  echo "Some tests failed. Review output above."
  exit 1
fi
