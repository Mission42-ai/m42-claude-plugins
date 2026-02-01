/**
 * Tests for Worktree Creation Module
 *
 * Tests worktree branch/path creation for isolated sprint development.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { substituteWorktreeVars, extractSprintName, extractDate, createWorktree, buildWorktreeProgressSection, formatWorktreeSuccessMessage, formatWorktreeErrorMessage, checkBranchExists, getRepoRoot, getCurrentBranch, getProjectRoot, getWorktreeInfo, validateWorktreeIsolation, buildWorktreeMetadata, } from './worktree.js';
// ============================================================================
// Test Utilities
// ============================================================================
function test(name, fn) {
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
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertMatch(actual, pattern, message) {
    if (!pattern.test(actual)) {
        throw new Error(message ?? `Expected ${JSON.stringify(actual)} to match ${pattern}`);
    }
}
function assertContains(actual, substring, message) {
    if (!actual.includes(substring)) {
        throw new Error(message ?? `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substring)}`);
    }
}
function assertNotContains(actual, substring, message) {
    if (actual.includes(substring)) {
        throw new Error(message ?? `Expected ${JSON.stringify(actual)} to NOT contain ${JSON.stringify(substring)}`);
    }
}
function createGitTestDir() {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-test-'));
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
function cleanupGitTestDir(ctx) {
    try {
        process.chdir(ctx.originalCwd);
        fs.rmSync(ctx.testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
// ============================================================================
// Variable Substitution Tests
// ============================================================================
console.log('\n=== Variable Substitution Tests ===\n');
const testVars = {
    'sprint-id': '2026-01-20_feature-auth',
    'sprint-name': 'feature-auth',
    date: '2026-01-20',
    workflow: 'plugin-development',
};
test('substituteWorktreeVars: should substitute {sprint-id}', () => {
    const result = substituteWorktreeVars('sprint/{sprint-id}', testVars);
    assertEqual(result, 'sprint/2026-01-20_feature-auth');
});
test('substituteWorktreeVars: should substitute {sprint-name}', () => {
    const result = substituteWorktreeVars('feature/{sprint-name}', testVars);
    assertEqual(result, 'feature/feature-auth');
});
test('substituteWorktreeVars: should substitute {date}', () => {
    const result = substituteWorktreeVars('sprints/{date}', testVars);
    assertEqual(result, 'sprints/2026-01-20');
});
test('substituteWorktreeVars: should substitute {workflow}', () => {
    const result = substituteWorktreeVars('{workflow}-sprints', testVars);
    assertEqual(result, 'plugin-development-sprints');
});
test('substituteWorktreeVars: should substitute multiple variables', () => {
    const result = substituteWorktreeVars('../worktrees/{date}_{sprint-name}', testVars);
    assertEqual(result, '../worktrees/2026-01-20_feature-auth');
});
test('substituteWorktreeVars: should handle template with no variables', () => {
    const result = substituteWorktreeVars('static/path', testVars);
    assertEqual(result, 'static/path');
});
test('substituteWorktreeVars: should handle repeated variables', () => {
    const result = substituteWorktreeVars('{sprint-id}/{sprint-id}', testVars);
    assertEqual(result, '2026-01-20_feature-auth/2026-01-20_feature-auth');
});
// ============================================================================
// Extract Functions Tests
// ============================================================================
console.log('\n=== Extract Functions Tests ===\n');
test('extractSprintName: should extract name from standard sprint ID', () => {
    assertEqual(extractSprintName('2026-01-20_feature-auth'), 'feature-auth');
});
test('extractSprintName: should handle sprint name with underscores', () => {
    assertEqual(extractSprintName('2026-01-20_my_complex_feature'), 'my_complex_feature');
});
test('extractSprintName: should return input if no underscore', () => {
    assertEqual(extractSprintName('feature-auth'), 'feature-auth');
});
test('extractSprintName: should handle empty string', () => {
    assertEqual(extractSprintName(''), '');
});
test('extractDate: should extract date from standard sprint ID', () => {
    assertEqual(extractDate('2026-01-20_feature-auth'), '2026-01-20');
});
test('extractDate: should extract date from sprint ID without name', () => {
    assertEqual(extractDate('2026-01-20'), '2026-01-20');
});
test('extractDate: should return valid date format for invalid input', () => {
    const result = extractDate('invalid-format');
    assertMatch(result, /^\d{4}-\d{2}-\d{2}$/);
});
// ============================================================================
// buildWorktreeProgressSection Tests
// ============================================================================
console.log('\n=== buildWorktreeProgressSection Tests ===\n');
test('buildWorktreeProgressSection: should build correct progress section', () => {
    const result = {
        success: true,
        branch: 'sprint/2026-01-20_test',
        worktreePath: '/home/user/test-worktree',
        sprintDir: '/home/user/test-worktree/.claude/sprints/2026-01-20_test',
        branchCreated: true,
    };
    const config = {
        enabled: true,
        cleanup: 'on-merge',
    };
    const section = buildWorktreeProgressSection(result, config);
    assertEqual(section.enabled, true);
    assertEqual(section.branch, 'sprint/2026-01-20_test');
    assertEqual(section.path, '/home/user/test-worktree');
    assertEqual(section['working-dir'], '/home/user/test-worktree');
    assertEqual(section.cleanup, 'on-merge');
    assertMatch(section['created-at'], /^\d{4}-\d{2}-\d{2}T/);
});
test('buildWorktreeProgressSection: should use default cleanup when not specified', () => {
    const result = {
        success: true,
        branch: 'sprint/test',
        worktreePath: '/path/to/worktree',
        sprintDir: '/path/to/worktree/.claude/sprints/test',
        branchCreated: true,
    };
    const config = {
        enabled: true,
    };
    const section = buildWorktreeProgressSection(result, config);
    assertEqual(section.cleanup, 'on-complete');
});
// ============================================================================
// Message Formatting Tests
// ============================================================================
console.log('\n=== Message Formatting Tests ===\n');
test('formatWorktreeSuccessMessage: should format success message for new branch', () => {
    const result = {
        success: true,
        branch: 'sprint/2026-01-20_feature',
        worktreePath: '/home/user/project-feature',
        sprintDir: '/home/user/project-feature/.claude/sprints/2026-01-20_feature',
        branchCreated: true,
    };
    const message = formatWorktreeSuccessMessage(result, 'main');
    assertContains(message, 'sprint/2026-01-20_feature');
    assertContains(message, 'created from');
    assertContains(message, 'main');
    assertContains(message, '/home/user/project-feature');
    assertContains(message, 'cd /home/user/project-feature');
});
test('formatWorktreeSuccessMessage: should format success message for reused branch', () => {
    const result = {
        success: true,
        branch: 'sprint/existing',
        worktreePath: '/path/to/worktree',
        sprintDir: '/path/to/worktree/.claude/sprints/existing',
        branchCreated: false,
    };
    const message = formatWorktreeSuccessMessage(result, 'develop');
    assertContains(message, 'reused');
    assertContains(message, 'develop');
});
test('formatWorktreeErrorMessage: should format error message with suggestion', () => {
    const result = {
        success: false,
        branch: 'sprint/test',
        worktreePath: '/path/exists',
        sprintDir: '',
        branchCreated: false,
        error: 'Directory already exists',
        suggestion: 'Choose a different path',
    };
    const message = formatWorktreeErrorMessage(result);
    assertContains(message, 'Directory already exists');
    assertContains(message, 'Suggestion:');
    assertContains(message, 'Choose a different path');
});
test('formatWorktreeErrorMessage: should format error message without suggestion', () => {
    const result = {
        success: false,
        branch: 'sprint/test',
        worktreePath: '/path',
        sprintDir: '',
        branchCreated: false,
        error: 'Unknown error',
    };
    const message = formatWorktreeErrorMessage(result);
    assertContains(message, 'Unknown error');
    assertNotContains(message, 'Suggestion:');
});
// ============================================================================
// Git Operations Tests
// ============================================================================
console.log('\n=== Git Operations Tests ===\n');
test('getRepoRoot: should return repo root', () => {
    const ctx = createGitTestDir();
    try {
        const root = getRepoRoot(ctx.testDir);
        // On macOS, /var is a symlink to /private/var, so normalize both paths
        const normalizedRoot = fs.realpathSync(root);
        const normalizedTestDir = fs.realpathSync(ctx.testDir);
        assertEqual(normalizedRoot, normalizedTestDir);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getRepoRoot: should return null for non-git directory', () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    try {
        const root = getRepoRoot(nonGitDir);
        assertEqual(root, null);
    }
    finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
});
test('getCurrentBranch: should return current branch name', () => {
    const ctx = createGitTestDir();
    try {
        const branch = getCurrentBranch(ctx.testDir);
        assert(branch === 'main' || branch === 'master', `Expected main or master, got ${branch}`);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkBranchExists: should return false for non-existent branch', () => {
    const ctx = createGitTestDir();
    try {
        const result = checkBranchExists('non-existent-branch', ctx.testDir);
        assertEqual(result.exists, false);
        assertEqual(result.hasWorktree, false);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkBranchExists: should return true for existing branch', () => {
    const ctx = createGitTestDir();
    try {
        execSync('git branch test-branch', { cwd: ctx.testDir, stdio: 'pipe' });
        const result = checkBranchExists('test-branch', ctx.testDir);
        assertEqual(result.exists, true);
        assertEqual(result.isCurrentBranch, false);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkBranchExists: should identify current branch', () => {
    const ctx = createGitTestDir();
    try {
        const currentBranch = getCurrentBranch(ctx.testDir);
        const result = checkBranchExists(currentBranch, ctx.testDir);
        assertEqual(result.exists, true);
        assertEqual(result.isCurrentBranch, true);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// createWorktree Integration Tests
// ============================================================================
console.log('\n=== createWorktree Integration Tests ===\n');
test('createWorktree: should create worktree successfully', () => {
    const ctx = createGitTestDir();
    try {
        const config = {
            enabled: true,
            branch: 'sprint/{sprint-id}',
            path: '../{sprint-id}-worktree',
        };
        const result = createWorktree(config, '2026-01-20_test-feature', 'plugin-development', ctx.testDir);
        assertEqual(result.success, true);
        assertEqual(result.branch, 'sprint/2026-01-20_test-feature');
        assertEqual(result.branchCreated, true);
        assert(fs.existsSync(result.worktreePath), 'Worktree path should exist');
        assert(fs.existsSync(result.sprintDir), 'Sprint dir should exist');
        assert(fs.existsSync(path.join(result.sprintDir, 'context')), 'context/ should exist');
        assert(fs.existsSync(path.join(result.sprintDir, 'artifacts')), 'artifacts/ should exist');
        // Clean up worktree
        execSync(`git worktree remove "${result.worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('createWorktree: should fail if branch already exists without reuse flag', () => {
    const ctx = createGitTestDir();
    try {
        // Create the branch first
        execSync('git branch sprint/existing-branch', { cwd: ctx.testDir, stdio: 'pipe' });
        const config = {
            enabled: true,
            branch: 'sprint/existing-branch',
        };
        const result = createWorktree(config, 'existing-branch', 'plugin-development', ctx.testDir);
        assertEqual(result.success, false);
        assertContains(result.error, 'already exists');
        assertContains(result.suggestion, '--reuse-branch');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('createWorktree: should succeed with existing branch when reuse flag is set', () => {
    const ctx = createGitTestDir();
    try {
        // Create the branch first
        execSync('git branch sprint/reuse-test', { cwd: ctx.testDir, stdio: 'pipe' });
        const config = {
            enabled: true,
            branch: 'sprint/reuse-test',
            path: '../reuse-worktree',
        };
        const result = createWorktree(config, 'reuse-test', 'plugin-development', ctx.testDir, { reuseExistingBranch: true });
        assertEqual(result.success, true);
        assertEqual(result.branchCreated, false);
        // Clean up
        execSync(`git worktree remove "${result.worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('createWorktree: should fail if worktree path already exists', () => {
    const ctx = createGitTestDir();
    const worktreePath = path.join(path.dirname(ctx.testDir), 'existing-dir');
    fs.mkdirSync(worktreePath);
    try {
        const config = {
            enabled: true,
            path: '../existing-dir',
        };
        const result = createWorktree(config, 'test', 'plugin-development', ctx.testDir);
        assertEqual(result.success, false);
        assertContains(result.error, 'already exists');
    }
    finally {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        cleanupGitTestDir(ctx);
    }
});
test('createWorktree: should use default branch and path when not specified', () => {
    const ctx = createGitTestDir();
    try {
        const config = {
            enabled: true,
        };
        const result = createWorktree(config, '2026-01-20_defaults', 'plugin-development', ctx.testDir);
        assertEqual(result.success, true);
        assertEqual(result.branch, 'sprint/2026-01-20_defaults');
        assertContains(result.worktreePath, '2026-01-20_defaults-worktree');
        // Clean up
        execSync(`git worktree remove "${result.worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// getProjectRoot Tests
// ============================================================================
console.log('\n=== getProjectRoot Tests ===\n');
test('getProjectRoot: should return git root for git directory', () => {
    const ctx = createGitTestDir();
    try {
        // Create .claude/sprints/test-sprint structure
        const sprintDir = path.join(ctx.testDir, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const projectRoot = getProjectRoot(sprintDir);
        // Normalize paths for comparison (macOS /var -> /private/var)
        const normalizedProjectRoot = fs.realpathSync(projectRoot);
        const normalizedTestDir = fs.realpathSync(ctx.testDir);
        assertEqual(normalizedProjectRoot, normalizedTestDir);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getProjectRoot: should find project root via .claude directory for non-git directory', () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-project-'));
    try {
        // Create .claude/sprints/test-sprint structure without git
        const sprintDir = path.join(testDir, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const projectRoot = getProjectRoot(sprintDir);
        // Normalize paths for comparison
        const normalizedProjectRoot = fs.realpathSync(projectRoot);
        const normalizedTestDir = fs.realpathSync(testDir);
        assertEqual(normalizedProjectRoot, normalizedTestDir);
    }
    finally {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
});
test('getProjectRoot: should use fallback for directory without git or .claude', () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-markers-'));
    try {
        // Create a simple directory structure that mimics sprint dir location
        const sprintDir = path.join(testDir, 'fake-sprints', 'test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const projectRoot = getProjectRoot(sprintDir);
        // Should return something valid (at least the sprint dir or calculated fallback)
        assert(fs.existsSync(projectRoot), 'Should return an existing path');
    }
    finally {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
});
test('getProjectRoot: should handle worktree git repository', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-worktree');
        execSync(`git worktree add "${worktreePath}" -b test-worktree-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        // Create sprint dir in worktree
        const sprintDir = path.join(worktreePath, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const projectRoot = getProjectRoot(sprintDir);
        // Should return worktree root, not main repo root
        const normalizedProjectRoot = fs.realpathSync(projectRoot);
        const normalizedWorktreePath = fs.realpathSync(worktreePath);
        assertEqual(normalizedProjectRoot, normalizedWorktreePath);
        // Clean up worktree
        execSync(`git worktree remove "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// getWorktreeInfo Tests
// ============================================================================
console.log('\n=== getWorktreeInfo Tests ===\n');
test('getWorktreeInfo: should detect non-worktree git repository', () => {
    const ctx = createGitTestDir();
    try {
        const info = getWorktreeInfo(ctx.testDir);
        assertEqual(info.isWorktree, false, 'Should not be detected as worktree');
        // Normalize paths for comparison
        const normalizedPath = fs.realpathSync(info.path);
        const normalizedTestDir = fs.realpathSync(ctx.testDir);
        assertEqual(normalizedPath, normalizedTestDir, 'Path should be test dir');
        assertEqual(normalizedPath, fs.realpathSync(info.mainWorktreePath), 'Main worktree path should equal path');
        assert(info.id.length === 12, 'ID should be 12 characters');
        assertMatch(info.id, /^[0-9a-f]{12}$/, 'ID should be hexadecimal');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getWorktreeInfo: should detect linked worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-worktree-detect');
        execSync(`git worktree add "${worktreePath}" -b test-worktree-detect-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        const info = getWorktreeInfo(worktreePath);
        assertEqual(info.isWorktree, true, 'Should be detected as worktree');
        // Normalize paths for comparison
        const normalizedPath = fs.realpathSync(info.path);
        const normalizedWorktreePath = fs.realpathSync(worktreePath);
        assertEqual(normalizedPath, normalizedWorktreePath, 'Path should be worktree path');
        const normalizedMainPath = fs.realpathSync(info.mainWorktreePath);
        const normalizedTestDir = fs.realpathSync(ctx.testDir);
        assertEqual(normalizedMainPath, normalizedTestDir, 'Main worktree path should be original repo');
        assert(info.id.length === 12, 'ID should be 12 characters');
        assertMatch(info.id, /^[0-9a-f]{12}$/, 'ID should be hexadecimal');
        // Clean up worktree
        execSync(`git worktree remove "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getWorktreeInfo: should generate different IDs for different paths', () => {
    const ctx = createGitTestDir();
    try {
        // Create two worktrees
        const worktreePath1 = path.join(path.dirname(ctx.testDir), 'test-wt-id-1');
        const worktreePath2 = path.join(path.dirname(ctx.testDir), 'test-wt-id-2');
        execSync(`git worktree add "${worktreePath1}" -b test-id-branch-1`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        execSync(`git worktree add "${worktreePath2}" -b test-id-branch-2`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        const info1 = getWorktreeInfo(worktreePath1);
        const info2 = getWorktreeInfo(worktreePath2);
        const mainInfo = getWorktreeInfo(ctx.testDir);
        // All IDs should be different
        assert(info1.id !== info2.id, 'Different worktrees should have different IDs');
        assert(info1.id !== mainInfo.id, 'Worktree should have different ID from main');
        assert(info2.id !== mainInfo.id, 'Worktree should have different ID from main');
        // Clean up worktrees
        execSync(`git worktree remove "${worktreePath1}"`, { cwd: ctx.testDir, stdio: 'pipe' });
        execSync(`git worktree remove "${worktreePath2}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getWorktreeInfo: should handle non-git directory', () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-wt-'));
    try {
        const info = getWorktreeInfo(nonGitDir);
        assertEqual(info.isWorktree, false, 'Non-git should not be worktree');
        // Normalize paths for comparison
        const normalizedPath = fs.realpathSync(info.path);
        const normalizedNonGitDir = fs.realpathSync(nonGitDir);
        assertEqual(normalizedPath, normalizedNonGitDir, 'Path should be the directory itself');
        assert(info.id.length === 12, 'ID should be 12 characters');
    }
    finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
});
// ============================================================================
// validateWorktreeIsolation Tests
// ============================================================================
console.log('\n=== validateWorktreeIsolation Tests ===\n');
test('validateWorktreeIsolation: should pass for sprint dir within worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create sprint directory structure
        const sprintDir = path.join(ctx.testDir, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const isValid = validateWorktreeIsolation(sprintDir, ctx.testDir);
        assertEqual(isValid, true, 'Sprint dir within repo should be valid');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('validateWorktreeIsolation: should pass for sprint in linked worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-wt-isolation');
        execSync(`git worktree add "${worktreePath}" -b test-isolation-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        // Create sprint dir in the worktree
        const sprintDir = path.join(worktreePath, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        const isValid = validateWorktreeIsolation(sprintDir, worktreePath);
        assertEqual(isValid, true, 'Sprint dir within worktree should be valid');
        // Clean up worktree
        execSync(`git worktree remove "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('validateWorktreeIsolation: should fail for sprint dir outside worktree', () => {
    const ctx = createGitTestDir();
    const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'external-sprint-'));
    try {
        // Create sprint dir outside the repo
        const sprintDir = path.join(externalDir, '.claude', 'sprints', '2026-01-20_test');
        fs.mkdirSync(sprintDir, { recursive: true });
        // Validate from the git repo context - sprint is outside
        const isValid = validateWorktreeIsolation(sprintDir, ctx.testDir);
        assertEqual(isValid, false, 'Sprint dir outside repo should be invalid');
    }
    finally {
        fs.rmSync(externalDir, { recursive: true, force: true });
        cleanupGitTestDir(ctx);
    }
});
test('validateWorktreeIsolation: should fail when using main worktree sprint from linked worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-wt-cross');
        execSync(`git worktree add "${worktreePath}" -b test-cross-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        // Create sprint dir in the MAIN repo
        const mainSprintDir = path.join(ctx.testDir, '.claude', 'sprints', '2026-01-20_main-sprint');
        fs.mkdirSync(mainSprintDir, { recursive: true });
        // Try to validate from the worktree context - should fail because sprint is in main
        const isValid = validateWorktreeIsolation(mainSprintDir, worktreePath);
        assertEqual(isValid, false, 'Using main worktree sprint from linked worktree should be invalid');
        // Clean up worktree
        execSync(`git worktree remove "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// buildWorktreeMetadata Tests
// ============================================================================
console.log('\n=== buildWorktreeMetadata Tests ===\n');
test('buildWorktreeMetadata: should return correct structure for main repo', () => {
    const ctx = createGitTestDir();
    try {
        const meta = buildWorktreeMetadata(ctx.testDir);
        assert('worktree-id' in meta, 'Should have worktree-id');
        assert('worktree-path' in meta, 'Should have worktree-path');
        assert('is-worktree' in meta, 'Should have is-worktree');
        assertEqual(meta['is-worktree'], false, 'Main repo should not be worktree');
        assert(meta['worktree-id'].length === 12, 'ID should be 12 characters');
        assert(meta['worktree-path'].length > 0, 'Path should not be empty');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('buildWorktreeMetadata: should return correct structure for linked worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-wt-meta');
        execSync(`git worktree add "${worktreePath}" -b test-meta-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        const meta = buildWorktreeMetadata(worktreePath);
        assertEqual(meta['is-worktree'], true, 'Linked worktree should be detected as worktree');
        assert(meta['worktree-id'].length === 12, 'ID should be 12 characters');
        // Normalize for comparison
        const normalizedMetaPath = fs.realpathSync(meta['worktree-path']);
        const normalizedWorktreePath = fs.realpathSync(worktreePath);
        assertEqual(normalizedMetaPath, normalizedWorktreePath, 'Path should be worktree path');
        // Clean up worktree
        execSync(`git worktree remove "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Integration Tests: Two Worktrees, Same Sprint Name, Separate Execution
// ============================================================================
console.log('\n=== Worktree Isolation Integration Tests ===\n');
test('Integration: two worktrees with same sprint name should have separate isolation metadata', () => {
    const ctx = createGitTestDir();
    try {
        // Create two worktrees
        const worktreePath1 = path.join(path.dirname(ctx.testDir), 'parallel-sprint-wt1');
        const worktreePath2 = path.join(path.dirname(ctx.testDir), 'parallel-sprint-wt2');
        execSync(`git worktree add "${worktreePath1}" -b parallel-sprint-branch-1`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        execSync(`git worktree add "${worktreePath2}" -b parallel-sprint-branch-2`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        // Create same sprint name in both worktrees
        const sprintName = '2026-01-20_feature-auth';
        const sprintDir1 = path.join(worktreePath1, '.claude', 'sprints', sprintName);
        const sprintDir2 = path.join(worktreePath2, '.claude', 'sprints', sprintName);
        fs.mkdirSync(sprintDir1, { recursive: true });
        fs.mkdirSync(sprintDir2, { recursive: true });
        // Get metadata for each
        const meta1 = buildWorktreeMetadata(worktreePath1);
        const meta2 = buildWorktreeMetadata(worktreePath2);
        // Worktree IDs should be different
        assert(meta1['worktree-id'] !== meta2['worktree-id'], 'Same sprint name in different worktrees should have different worktree IDs');
        // Both should be marked as worktrees
        assertEqual(meta1['is-worktree'], true, 'WT1 should be detected as worktree');
        assertEqual(meta2['is-worktree'], true, 'WT2 should be detected as worktree');
        // Paths should be different
        assert(meta1['worktree-path'] !== meta2['worktree-path'], 'Worktree paths should be different');
        // Validate isolation for each sprint
        assertEqual(validateWorktreeIsolation(sprintDir1, worktreePath1), true, 'Sprint 1 should be valid in worktree 1');
        assertEqual(validateWorktreeIsolation(sprintDir2, worktreePath2), true, 'Sprint 2 should be valid in worktree 2');
        // Cross-worktree validation should fail
        assertEqual(validateWorktreeIsolation(sprintDir1, worktreePath2), false, 'Sprint 1 should NOT be valid in worktree 2');
        assertEqual(validateWorktreeIsolation(sprintDir2, worktreePath1), false, 'Sprint 2 should NOT be valid in worktree 1');
        // Clean up worktrees
        execSync(`git worktree remove "${worktreePath1}"`, { cwd: ctx.testDir, stdio: 'pipe' });
        execSync(`git worktree remove "${worktreePath2}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('Integration: .claude/sprints/ is local to each worktree', () => {
    const ctx = createGitTestDir();
    const worktreePath = path.join(path.dirname(ctx.testDir), 'test-wt-local');
    try {
        // Create .claude/sprints in main repo
        const mainSprintDir = path.join(ctx.testDir, '.claude', 'sprints');
        fs.mkdirSync(mainSprintDir, { recursive: true });
        fs.writeFileSync(path.join(mainSprintDir, 'main-marker.txt'), 'main');
        // Create a worktree
        execSync(`git worktree add "${worktreePath}" -b test-local-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe'
        });
        // Create .claude/sprints in the worktree
        const wtSprintDir = path.join(worktreePath, '.claude', 'sprints');
        fs.mkdirSync(wtSprintDir, { recursive: true });
        fs.writeFileSync(path.join(wtSprintDir, 'wt-marker.txt'), 'worktree');
        // Verify files are in separate directories
        assert(fs.existsSync(path.join(mainSprintDir, 'main-marker.txt')), 'Main sprint dir should have its marker');
        assert(!fs.existsSync(path.join(mainSprintDir, 'wt-marker.txt')), 'Main sprint dir should NOT have worktree marker');
        assert(fs.existsSync(path.join(wtSprintDir, 'wt-marker.txt')), 'Worktree sprint dir should have its marker');
        assert(!fs.existsSync(path.join(wtSprintDir, 'main-marker.txt')), 'Worktree sprint dir should NOT have main marker');
        // Verify getWorktreeInfo returns correct worktree root for each
        const mainInfo = getWorktreeInfo(ctx.testDir);
        const wtInfo = getWorktreeInfo(worktreePath);
        const normalizedMainPath = fs.realpathSync(mainInfo.path);
        const normalizedWtPath = fs.realpathSync(wtInfo.path);
        assert(normalizedMainPath !== normalizedWtPath, 'Worktree paths should be different');
        // Clean up worktree (use --force because of untracked files)
        execSync(`git worktree remove --force "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
    }
    catch (e) {
        // Clean up worktree on error too
        try {
            execSync(`git worktree remove --force "${worktreePath}"`, { cwd: ctx.testDir, stdio: 'pipe' });
        }
        catch {
            // Ignore cleanup errors
        }
        throw e;
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
console.log('\n=== All Tests Complete ===\n');
//# sourceMappingURL=worktree.test.js.map