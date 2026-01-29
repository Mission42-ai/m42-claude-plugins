/**
 * Tests for Cross-Worktree Sprint Status Module
 *
 * Tests sprint discovery and status display across multiple worktrees.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

import {
  listAllWorktrees,
  findSprintsInWorktree,
  readSprintProgress,
  discoverSprints,
  formatSprintStatus,
  formatCrossWorktreeStatus,
  formatCurrentWorktreeStatus,
  getStatusColor,
  RESET_COLOR,
  GitWorktree,
  SprintProgress,
  WorktreeSprint,
} from './status.js';

// ============================================================================
// Test Utilities
// ============================================================================

function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(actual: string, substring: string, message?: string): void {
  if (!actual.includes(substring)) {
    throw new Error(message ?? `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substring)}`);
  }
}

function assertNotContains(actual: string, substring: string, message?: string): void {
  if (actual.includes(substring)) {
    throw new Error(message ?? `Expected ${JSON.stringify(actual)} to NOT contain ${JSON.stringify(substring)}`);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface GitTestContext {
  testDir: string;
  originalCwd: string;
}

function createGitTestDir(): GitTestContext {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-test-'));
  const originalCwd = process.cwd();

  // Initialize a git repo
  execSync('git init', { cwd: testDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: testDir, stdio: 'pipe' });

  // Create initial commit
  fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
  execSync('git add .', { cwd: testDir, stdio: 'pipe' });
  execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'pipe' });

  return { testDir, originalCwd };
}

function cleanupGitTestDir(ctx: GitTestContext): void {
  process.chdir(ctx.originalCwd);

  // Remove worktrees first (they lock the main repo)
  try {
    const worktreeOutput = execSync('git worktree list --porcelain', {
      cwd: ctx.testDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const worktreePaths: string[] = [];
    for (const line of worktreeOutput.split('\n')) {
      if (line.startsWith('worktree ')) {
        const wtPath = line.slice(9);
        if (wtPath !== ctx.testDir) {
          worktreePaths.push(wtPath);
        }
      }
    }

    for (const wtPath of worktreePaths) {
      try {
        execSync(`git worktree remove "${wtPath}" --force`, {
          cwd: ctx.testDir,
          stdio: 'pipe'
        });
      } catch {
        // Force remove the directory
        fs.rmSync(wtPath, { recursive: true, force: true });
      }
    }
  } catch {
    // Ignore errors
  }

  // Now remove the test directory
  fs.rmSync(ctx.testDir, { recursive: true, force: true });
}

function createSprintDir(worktreePath: string, sprintId: string, progress: Partial<SprintProgress>): string {
  const sprintDir = path.join(worktreePath, '.claude', 'sprints', sprintId);
  fs.mkdirSync(sprintDir, { recursive: true });

  const fullProgress: SprintProgress = {
    'sprint-id': sprintId,
    status: 'in-progress',
    ...progress,
  };

  const yaml = `sprint-id: ${fullProgress['sprint-id']}
status: ${fullProgress.status}
${fullProgress['worktree-id'] ? `worktree-id: ${fullProgress['worktree-id']}` : ''}
${fullProgress['worktree-path'] ? `worktree-path: ${fullProgress['worktree-path']}` : ''}
${fullProgress['working-dir'] ? `working-dir: ${fullProgress['working-dir']}` : ''}
`;

  fs.writeFileSync(path.join(sprintDir, 'PROGRESS.yaml'), yaml);

  return sprintDir;
}

// ============================================================================
// listAllWorktrees Tests
// ============================================================================

test('listAllWorktrees returns main worktree for simple repo', () => {
  const ctx = createGitTestDir();
  try {
    const worktrees = listAllWorktrees(ctx.testDir);

    assertEqual(worktrees.length, 1, 'Should have exactly one worktree');
    // Use realpath to handle macOS /var -> /private/var symlinks
    const expectedPath = fs.realpathSync(ctx.testDir);
    const actualPath = fs.realpathSync(worktrees[0].path);
    assertEqual(actualPath, expectedPath, 'Path should match test dir');
    assertEqual(worktrees[0].isMain, true, 'Should be main worktree');
    assert(worktrees[0].branch !== undefined, 'Should have branch');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('listAllWorktrees returns multiple worktrees', () => {
  const ctx = createGitTestDir();
  try {
    // Create a branch and worktree
    execSync('git branch feature-test', { cwd: ctx.testDir, stdio: 'pipe' });
    const worktreePath = path.join(path.dirname(ctx.testDir), 'test-worktree');
    execSync(`git worktree add "${worktreePath}" feature-test`, {
      cwd: ctx.testDir,
      stdio: 'pipe'
    });

    const worktrees = listAllWorktrees(ctx.testDir);

    assertEqual(worktrees.length, 2, 'Should have two worktrees');

    const mainWt = worktrees.find(w => w.isMain);
    const linkedWt = worktrees.find(w => !w.isMain);

    assert(mainWt !== undefined, 'Should have main worktree');
    assert(linkedWt !== undefined, 'Should have linked worktree');
    assertEqual(linkedWt!.branch, 'feature-test', 'Linked worktree should have feature-test branch');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('listAllWorktrees returns empty array for non-git directory', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-test-'));
  try {
    const worktrees = listAllWorktrees(testDir);
    assertEqual(worktrees.length, 0, 'Should return empty array');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// findSprintsInWorktree Tests
// ============================================================================

test('findSprintsInWorktree returns empty for worktree without sprints', () => {
  const ctx = createGitTestDir();
  try {
    const sprints = findSprintsInWorktree(ctx.testDir);
    assertEqual(sprints.length, 0, 'Should return empty array');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('findSprintsInWorktree finds sprints with PROGRESS.yaml', () => {
  const ctx = createGitTestDir();
  try {
    const sprintId = '2026-01-20_test-sprint';
    createSprintDir(ctx.testDir, sprintId, { status: 'in-progress' });

    const sprints = findSprintsInWorktree(ctx.testDir);

    assertEqual(sprints.length, 1, 'Should find one sprint');
    assertContains(sprints[0], sprintId, 'Sprint path should contain sprint ID');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('findSprintsInWorktree ignores directories without PROGRESS.yaml', () => {
  const ctx = createGitTestDir();
  try {
    // Create a sprint directory without PROGRESS.yaml
    const sprintDir = path.join(ctx.testDir, '.claude', 'sprints', 'incomplete-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprints = findSprintsInWorktree(ctx.testDir);

    assertEqual(sprints.length, 0, 'Should not find incomplete sprint');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('findSprintsInWorktree returns sprints sorted by modification time', () => {
  const ctx = createGitTestDir();
  try {
    // Create two sprints with different times
    createSprintDir(ctx.testDir, '2026-01-19_older', { status: 'completed' });

    // Wait a bit to ensure different mtime
    const now = Date.now();
    while (Date.now() - now < 100) { /* busy wait */ }

    createSprintDir(ctx.testDir, '2026-01-20_newer', { status: 'in-progress' });

    const sprints = findSprintsInWorktree(ctx.testDir);

    assertEqual(sprints.length, 2, 'Should find two sprints');
    assertContains(sprints[0], 'newer', 'Newest sprint should be first');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

// ============================================================================
// readSprintProgress Tests
// ============================================================================

test('readSprintProgress reads valid PROGRESS.yaml', () => {
  const ctx = createGitTestDir();
  try {
    const sprintDir = createSprintDir(ctx.testDir, '2026-01-20_test', {
      status: 'in-progress',
      'worktree-id': 'abc123',
      'worktree-path': '/test/path',
    });

    const { progress, error } = readSprintProgress(sprintDir);

    assertEqual(error, undefined, 'Should not have error');
    assert(progress !== null, 'Progress should not be null');
    assertEqual(progress!['sprint-id'], '2026-01-20_test', 'Sprint ID should match');
    assertEqual(progress!.status, 'in-progress', 'Status should match');
    assertEqual(progress!['worktree-id'], 'abc123', 'Worktree ID should match');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('readSprintProgress returns error for missing file', () => {
  const { progress, error } = readSprintProgress('/nonexistent/path');

  assertEqual(progress, null, 'Progress should be null');
  assert(error !== undefined, 'Should have error message');
  assertContains(error!, 'not found', 'Error should mention file not found');
});

test('readSprintProgress returns error for invalid YAML', () => {
  const ctx = createGitTestDir();
  try {
    const sprintDir = path.join(ctx.testDir, '.claude', 'sprints', 'invalid');
    fs.mkdirSync(sprintDir, { recursive: true });
    fs.writeFileSync(path.join(sprintDir, 'PROGRESS.yaml'), 'invalid: yaml: content: [');

    const { progress, error } = readSprintProgress(sprintDir);

    assertEqual(progress, null, 'Progress should be null');
    assert(error !== undefined, 'Should have error message');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

// ============================================================================
// discoverSprints Tests
// ============================================================================

test('discoverSprints finds sprints in current worktree only by default', () => {
  const ctx = createGitTestDir();
  try {
    createSprintDir(ctx.testDir, '2026-01-20_main-sprint', { status: 'in-progress' });

    // Create a worktree with its own sprint
    execSync('git branch feature-test', { cwd: ctx.testDir, stdio: 'pipe' });
    const worktreePath = path.join(path.dirname(ctx.testDir), 'status-test-wt');
    execSync(`git worktree add "${worktreePath}" feature-test`, {
      cwd: ctx.testDir,
      stdio: 'pipe'
    });
    createSprintDir(worktreePath, '2026-01-20_wt-sprint', { status: 'in-progress' });

    // Discover from main worktree, current only
    const result = discoverSprints(ctx.testDir, { currentOnly: true });

    assertEqual(result.sprints.length, 1, 'Should find one sprint in current worktree');
    assertContains(result.sprints[0].sprintDir, 'main-sprint', 'Should be main sprint');
    assert(result.sprints[0].isCurrent, 'Sprint should be marked as current');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('discoverSprints finds sprints across all worktrees with --all-worktrees', () => {
  const ctx = createGitTestDir();
  try {
    createSprintDir(ctx.testDir, '2026-01-20_main-sprint', { status: 'in-progress' });

    // Create a worktree with its own sprint
    execSync('git branch feature-test', { cwd: ctx.testDir, stdio: 'pipe' });
    const worktreePath = path.join(path.dirname(ctx.testDir), 'status-test-wt2');
    execSync(`git worktree add "${worktreePath}" feature-test`, {
      cwd: ctx.testDir,
      stdio: 'pipe'
    });
    createSprintDir(worktreePath, '2026-01-20_wt-sprint', { status: 'completed' });

    // Discover across all worktrees
    const result = discoverSprints(ctx.testDir, { currentOnly: false });

    assertEqual(result.sprints.length, 2, 'Should find two sprints across worktrees');
    assertEqual(result.worktreesChecked, 2, 'Should have checked two worktrees');

    const mainSprint = result.sprints.find(s => s.sprintDir.includes('main-sprint'));
    const wtSprint = result.sprints.find(s => s.sprintDir.includes('wt-sprint'));

    assert(mainSprint !== undefined, 'Should find main sprint');
    assert(wtSprint !== undefined, 'Should find worktree sprint');
    assert(mainSprint!.isCurrent, 'Main sprint should be current');
    assert(!wtSprint!.isCurrent, 'Worktree sprint should not be current');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('discoverSprints filters by status', () => {
  const ctx = createGitTestDir();
  try {
    createSprintDir(ctx.testDir, '2026-01-20_active', { status: 'in-progress' });
    createSprintDir(ctx.testDir, '2026-01-19_done', { status: 'completed' });

    const result = discoverSprints(ctx.testDir, {
      statusFilter: ['in-progress']
    });

    assertEqual(result.sprints.length, 1, 'Should find one in-progress sprint');
    assertContains(result.sprints[0].sprintDir, 'active', 'Should be the active sprint');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

test('discoverSprints handles worktrees with no sprints gracefully', () => {
  const ctx = createGitTestDir();
  try {
    // Create a worktree without sprints
    execSync('git branch empty-wt', { cwd: ctx.testDir, stdio: 'pipe' });
    const worktreePath = path.join(path.dirname(ctx.testDir), 'status-test-empty');
    execSync(`git worktree add "${worktreePath}" empty-wt`, {
      cwd: ctx.testDir,
      stdio: 'pipe'
    });

    const result = discoverSprints(ctx.testDir, { currentOnly: false });

    assertEqual(result.sprints.length, 0, 'Should find no sprints');
    assertEqual(result.worktreesChecked, 2, 'Should have checked both worktrees');
    assertEqual(result.worktreeErrors.length, 0, 'Should have no errors');
  } finally {
    cleanupGitTestDir(ctx);
  }
});

// ============================================================================
// formatSprintStatus Tests
// ============================================================================

test('formatSprintStatus includes current marker for current worktree', () => {
  const sprint: WorktreeSprint = {
    sprintDir: '/test/.claude/sprints/2026-01-20_test/',
    worktree: { path: '/test', branch: 'main', isMain: true, head: 'abc123' },
    progress: {
      'sprint-id': '2026-01-20_test',
      status: 'in-progress',
      'worktree-id': 'abc123def456',
    },
    isCurrent: true,
  };

  const output = formatSprintStatus(sprint, false);

  assert(output.startsWith('* '), 'Should start with current marker');
  assertContains(output, '(current)', 'Should indicate current worktree');
});

test('formatSprintStatus shows error for failed reads', () => {
  const sprint: WorktreeSprint = {
    sprintDir: '/test/.claude/sprints/2026-01-20_test/',
    worktree: { path: '/test', branch: 'main', isMain: true, head: 'abc123' },
    progress: null,
    error: 'Failed to read PROGRESS.yaml',
    isCurrent: false,
  };

  const output = formatSprintStatus(sprint, false);

  assertContains(output, 'Error:', 'Should show error');
  assertContains(output, 'Failed to read', 'Should include error message');
});

test('formatSprintStatus shows worktree-id when available', () => {
  const sprint: WorktreeSprint = {
    sprintDir: '/test/.claude/sprints/2026-01-20_test/',
    worktree: { path: '/test', branch: 'feature-x', isMain: false, head: 'abc123' },
    progress: {
      'sprint-id': '2026-01-20_test',
      status: 'completed',
      'worktree-id': 'xyz789',
      'working-dir': '/test/project',
    },
    isCurrent: false,
  };

  const output = formatSprintStatus(sprint, false);

  assertContains(output, 'Worktree ID: xyz789', 'Should show worktree ID');
  assertContains(output, 'Working Dir: /test/project', 'Should show working dir');
  assertContains(output, 'feature-x', 'Should show branch name');
});

// ============================================================================
// formatCrossWorktreeStatus Tests
// ============================================================================

test('formatCrossWorktreeStatus shows no sprints message when empty', () => {
  const result = {
    sprints: [],
    currentWorktree: { isWorktree: false, path: '/test', id: 'abc', mainWorktreePath: '/test' },
    worktreesChecked: 1,
    worktreeErrors: [],
  };

  const output = formatCrossWorktreeStatus(result, false);

  assertContains(output, 'No sprints found', 'Should show no sprints message');
});

test('formatCrossWorktreeStatus shows total count', () => {
  const result = {
    sprints: [
      {
        sprintDir: '/test/.claude/sprints/sprint1/',
        worktree: { path: '/test', branch: 'main', isMain: true, head: 'abc' },
        progress: { 'sprint-id': 'sprint1', status: 'in-progress' as const },
        isCurrent: true,
      },
      {
        sprintDir: '/wt/.claude/sprints/sprint2/',
        worktree: { path: '/wt', branch: 'feature', isMain: false, head: 'def' },
        progress: { 'sprint-id': 'sprint2', status: 'completed' as const },
        isCurrent: false,
      },
    ],
    currentWorktree: { isWorktree: false, path: '/test', id: 'abc', mainWorktreePath: '/test' },
    worktreesChecked: 2,
    worktreeErrors: [],
  };

  const output = formatCrossWorktreeStatus(result, false);

  assertContains(output, 'Total: 2 sprint(s)', 'Should show total count');
  assertContains(output, '1 active', 'Should show active count');
});

test('formatCrossWorktreeStatus shows worktree errors', () => {
  const result = {
    sprints: [],
    currentWorktree: { isWorktree: false, path: '/test', id: 'abc', mainWorktreePath: '/test' },
    worktreesChecked: 2,
    worktreeErrors: [
      { path: '/missing', error: 'Worktree path does not exist' },
    ],
  };

  const output = formatCrossWorktreeStatus(result, false);

  assertContains(output, 'Some worktrees had errors', 'Should mention errors');
  assertContains(output, '/missing', 'Should show error path');
});

// ============================================================================
// formatCurrentWorktreeStatus Tests
// ============================================================================

test('formatCurrentWorktreeStatus shows hint about other worktrees', () => {
  const result = {
    sprints: [
      {
        sprintDir: '/test/.claude/sprints/sprint1/',
        worktree: { path: '/test', branch: 'main', isMain: true, head: 'abc' },
        progress: { 'sprint-id': 'sprint1', status: 'in-progress' as const },
        isCurrent: true,
      },
      {
        sprintDir: '/wt/.claude/sprints/sprint2/',
        worktree: { path: '/wt', branch: 'feature', isMain: false, head: 'def' },
        progress: { 'sprint-id': 'sprint2', status: 'in-progress' as const },
        isCurrent: false,
      },
    ],
    currentWorktree: { isWorktree: false, path: '/test', id: 'abc', mainWorktreePath: '/test' },
    worktreesChecked: 2,
    worktreeErrors: [],
  };

  const output = formatCurrentWorktreeStatus(result, false);

  assertContains(output, '1 sprint(s) in other worktrees', 'Should mention other sprints');
  assertContains(output, '--all-worktrees', 'Should suggest flag');
});

test('formatCurrentWorktreeStatus shows no sprint message when none found', () => {
  const result = {
    sprints: [],
    currentWorktree: { isWorktree: false, path: '/test', id: 'abc', mainWorktreePath: '/test' },
    worktreesChecked: 1,
    worktreeErrors: [],
  };

  const output = formatCurrentWorktreeStatus(result, false);

  assertContains(output, 'No active sprint', 'Should show no sprint message');
  assertContains(output, '/start-sprint', 'Should suggest starting sprint');
});

// ============================================================================
// getStatusColor Tests
// ============================================================================

test('getStatusColor returns correct colors', () => {
  assertEqual(getStatusColor('in-progress'), '\x1b[33m', 'in-progress should be yellow');
  assertEqual(getStatusColor('completed'), '\x1b[32m', 'completed should be green');
  assertEqual(getStatusColor('blocked'), '\x1b[31m', 'blocked should be red');
  assertEqual(getStatusColor('paused'), '\x1b[36m', 'paused should be cyan');
  assertEqual(getStatusColor('pending'), '\x1b[37m', 'pending should be white');
});

console.log('\nRunning cross-worktree status tests...\n');
