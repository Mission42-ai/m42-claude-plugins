/**
 * Tests for Lock File Management Module
 *
 * Tests conflict detection and lock mechanisms for parallel sprint execution.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { LOCK_DIR_NAME, DEFAULT_STALE_LOCK_AGE_MS, getLockDir, ensureLockDir, generateLockFileName, parseLockFile, createLockFile, releaseLock, acquireLock, isProcessAlive, isLockStale, cleanupStaleLocks, listActiveLocks, checkBranchConflict, checkSprintConflicts, suggestAlternativeBranch, formatConflictWarning, formatConflictSuggestions, formatFullConflictMessage, } from './locks.js';
import { getWorktreeInfo } from './worktree.js';
// ============================================================================
// Test Utilities
// ============================================================================
function test(name, fn) {
    Promise.resolve()
        .then(() => fn())
        .then(() => {
        console.log(`\u2713 ${name}`);
    })
        .catch((error) => {
        console.error(`\u2717 ${name}`);
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
function assertContains(actual, substring, message) {
    if (!actual.includes(substring)) {
        throw new Error(message ?? `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substring)}`);
    }
}
function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        throw new Error(message ?? 'Expected non-null value');
    }
}
function createGitTestDir() {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locks-test-'));
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
    process.chdir(ctx.originalCwd);
    // Remove worktrees first (they lock the main repo)
    try {
        const worktreeOutput = execSync('git worktree list --porcelain', {
            cwd: ctx.testDir,
            stdio: 'pipe',
            encoding: 'utf-8',
        });
        const worktreePaths = [];
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
                    stdio: 'pipe',
                });
            }
            catch {
                // Force remove the directory
                fs.rmSync(wtPath, { recursive: true, force: true });
            }
        }
    }
    catch {
        // Ignore errors
    }
    // Now remove the test directory
    fs.rmSync(ctx.testDir, { recursive: true, force: true });
}
/**
 * Simple string hash function (djb2) - mirrors the one in locks.ts
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
function createTestLockFile(lockDir, lockInfo) {
    const fullInfo = {
        operation: 'sprint-run',
        worktreeId: 'test123456',
        worktreePath: '/test/path',
        pid: process.pid,
        createdAt: new Date().toISOString(),
        ...lockInfo,
    };
    // Use operation + branch hash for file name (mirrors createLockFile logic)
    const suffix = fullInfo.branch
        ? hashString(fullInfo.branch).slice(0, 8)
        : undefined;
    const fileName = suffix
        ? `${fullInfo.operation}-${suffix}.lock`
        : `${fullInfo.operation}.lock`;
    const lockPath = path.join(lockDir, fileName);
    fs.writeFileSync(lockPath, JSON.stringify(fullInfo, null, 2));
    return lockPath;
}
// ============================================================================
// Constants Tests
// ============================================================================
console.log('\n=== Constants Tests ===\n');
test('LOCK_DIR_NAME is correct', () => {
    assertEqual(LOCK_DIR_NAME, '.sprint-locks');
});
test('DEFAULT_STALE_LOCK_AGE_MS is 1 hour', () => {
    assertEqual(DEFAULT_STALE_LOCK_AGE_MS, 60 * 60 * 1000);
});
// ============================================================================
// Lock Directory Tests
// ============================================================================
console.log('\n=== Lock Directory Tests ===\n');
test('getLockDir returns path at main worktree root', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = getLockDir(ctx.testDir);
        assertNotNull(lockDir);
        // Normalize paths for comparison
        const expectedPath = path.join(fs.realpathSync(ctx.testDir), LOCK_DIR_NAME);
        const actualPath = fs.realpathSync(path.dirname(lockDir)) + path.sep + path.basename(lockDir);
        assertContains(actualPath, LOCK_DIR_NAME);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('getLockDir returns same path for linked worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree
        const worktreePath = path.join(path.dirname(ctx.testDir), 'test-worktree-lock');
        execSync(`git worktree add "${worktreePath}" -b test-lock-branch`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        const mainLockDir = getLockDir(ctx.testDir);
        const wtLockDir = getLockDir(worktreePath);
        assertNotNull(mainLockDir);
        assertNotNull(wtLockDir);
        // Both should point to the same lock directory (at main repo)
        assertEqual(mainLockDir, wtLockDir, 'Lock directories should be the same');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('ensureLockDir creates directory and .gitignore', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        assertNotNull(lockDir);
        assert(fs.existsSync(lockDir), 'Lock directory should exist');
        const gitignorePath = path.join(lockDir, '.gitignore');
        assert(fs.existsSync(gitignorePath), '.gitignore should exist');
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        assertContains(gitignoreContent, '*');
        assertContains(gitignoreContent, '!.gitignore');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('ensureLockDir is idempotent', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir1 = ensureLockDir(ctx.testDir);
        const lockDir2 = ensureLockDir(ctx.testDir);
        assertEqual(lockDir1, lockDir2, 'Multiple calls should return same path');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Lock File Name Generation Tests
// ============================================================================
console.log('\n=== Lock File Name Tests ===\n');
test('generateLockFileName creates correct format without suffix', () => {
    const fileName = generateLockFileName('sprint-run', 'abc123def456');
    assertEqual(fileName, 'sprint-run-abc123def456.lock');
});
test('generateLockFileName creates correct format with suffix', () => {
    const fileName = generateLockFileName('branch-create', 'abc123', 'feature');
    assertEqual(fileName, 'branch-create-abc123-feature.lock');
});
test('generateLockFileName handles all operation types', () => {
    const operations = [
        'branch-create',
        'branch-checkout',
        'worktree-create',
        'sprint-run',
        'git-commit',
        'git-push',
    ];
    for (const op of operations) {
        const fileName = generateLockFileName(op, 'test123');
        assertContains(fileName, op);
        assertContains(fileName, '.lock');
    }
});
// ============================================================================
// Lock File Parsing Tests
// ============================================================================
console.log('\n=== Lock File Parsing Tests ===\n');
test('parseLockFile parses valid lock file', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const lockPath = createTestLockFile(lockDir, {
            operation: 'sprint-run',
            worktreeId: 'test123',
            branch: 'feature/test',
            sprintId: '2026-01-20_test',
        });
        const parsed = parseLockFile(lockPath);
        assertNotNull(parsed);
        assertEqual(parsed.operation, 'sprint-run');
        assertEqual(parsed.worktreeId, 'test123');
        assertEqual(parsed.branch, 'feature/test');
        assertEqual(parsed.sprintId, '2026-01-20_test');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('parseLockFile returns null for non-existent file', () => {
    const result = parseLockFile('/non/existent/path.lock');
    assertEqual(result, null);
});
test('parseLockFile returns null for invalid JSON', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const invalidPath = path.join(lockDir, 'invalid.lock');
        fs.writeFileSync(invalidPath, 'not valid json {{{');
        const result = parseLockFile(invalidPath);
        assertEqual(result, null);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('parseLockFile returns null for missing required fields', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const incompletePath = path.join(lockDir, 'incomplete.lock');
        fs.writeFileSync(incompletePath, JSON.stringify({ operation: 'test' }));
        const result = parseLockFile(incompletePath);
        assertEqual(result, null);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Lock Creation and Release Tests
// ============================================================================
console.log('\n=== Lock Creation and Release Tests ===\n');
test('createLockFile creates lock successfully', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const info = getWorktreeInfo(ctx.testDir);
        const lockInfo = {
            operation: 'sprint-run',
            worktreeId: info.id,
            worktreePath: info.path,
            pid: process.pid,
            createdAt: new Date().toISOString(),
        };
        const result = createLockFile(lockDir, lockInfo);
        assertEqual(result.success, true, 'Should succeed');
        assertNotNull(result.lockPath);
        assert(fs.existsSync(result.lockPath), 'Lock file should exist');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('createLockFile overwrites own lock', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const info = getWorktreeInfo(ctx.testDir);
        const lockInfo = {
            operation: 'sprint-run',
            worktreeId: info.id,
            worktreePath: info.path,
            pid: process.pid,
            createdAt: new Date().toISOString(),
        };
        // Create first lock
        const result1 = createLockFile(lockDir, lockInfo);
        assertEqual(result1.success, true);
        // Create second lock with same worktree - should succeed
        const result2 = createLockFile(lockDir, { ...lockInfo, sprintId: 'new-sprint' });
        assertEqual(result2.success, true, 'Should overwrite own lock');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('createLockFile fails for lock from another worktree', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Create lock from "another worktree"
        const existingLock = {
            operation: 'sprint-run',
            worktreeId: 'other-worktree-id',
            worktreePath: '/other/worktree',
            pid: process.pid, // Same process, different worktree ID
            createdAt: new Date().toISOString(),
        };
        createTestLockFile(lockDir, existingLock);
        // Try to create lock from current worktree
        const info = getWorktreeInfo(ctx.testDir);
        const newLock = {
            operation: 'sprint-run',
            worktreeId: info.id,
            worktreePath: info.path,
            pid: process.pid,
            createdAt: new Date().toISOString(),
        };
        const result = createLockFile(lockDir, newLock);
        assertEqual(result.success, false, 'Should fail due to existing lock');
        assertNotNull(result.existingLock);
        assertEqual(result.existingLock.worktreeId, 'other-worktree-id');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('releaseLock removes own lock', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const info = getWorktreeInfo(ctx.testDir);
        const lockInfo = {
            operation: 'sprint-run',
            worktreeId: info.id,
            worktreePath: info.path,
            pid: process.pid,
            createdAt: new Date().toISOString(),
        };
        const createResult = createLockFile(lockDir, lockInfo);
        assertEqual(createResult.success, true);
        assertNotNull(createResult.lockPath);
        const released = releaseLock(createResult.lockPath, info.id);
        assertEqual(released, true, 'Should release successfully');
        assert(!fs.existsSync(createResult.lockPath), 'Lock file should be removed');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('releaseLock fails for lock from another worktree', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        const lockPath = createTestLockFile(lockDir, {
            worktreeId: 'other-worktree',
        });
        const info = getWorktreeInfo(ctx.testDir);
        const released = releaseLock(lockPath, info.id);
        assertEqual(released, false, 'Should fail to release other worktree lock');
        assert(fs.existsSync(lockPath), 'Lock file should still exist');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// acquireLock Tests
// ============================================================================
console.log('\n=== acquireLock Tests ===\n');
test('acquireLock creates lock with all options', () => {
    const ctx = createGitTestDir();
    try {
        const result = acquireLock(ctx.testDir, 'branch-create', {
            branch: 'sprint/test',
            sprintId: '2026-01-20_test',
            description: 'Test lock',
        });
        assertEqual(result.success, true);
        assertNotNull(result.lockPath);
        const parsed = parseLockFile(result.lockPath);
        assertNotNull(parsed);
        assertEqual(parsed.operation, 'branch-create');
        assertEqual(parsed.branch, 'sprint/test');
        assertEqual(parsed.sprintId, '2026-01-20_test');
        assertEqual(parsed.description, 'Test lock');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Process Detection Tests
// ============================================================================
console.log('\n=== Process Detection Tests ===\n');
test('isProcessAlive returns true for current process', () => {
    const alive = isProcessAlive(process.pid);
    assertEqual(alive, true);
});
test('isProcessAlive returns false for invalid PID', () => {
    // Use a very high PID that's unlikely to exist
    const alive = isProcessAlive(999999999);
    assertEqual(alive, false);
});
// ============================================================================
// Stale Lock Tests
// ============================================================================
console.log('\n=== Stale Lock Tests ===\n');
test('isLockStale returns false for fresh lock from live process', () => {
    const lockInfo = {
        operation: 'sprint-run',
        worktreeId: 'test123',
        worktreePath: '/test',
        pid: process.pid,
        createdAt: new Date().toISOString(),
    };
    const stale = isLockStale(lockInfo);
    assertEqual(stale, false);
});
test('isLockStale returns true for old lock', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const lockInfo = {
        operation: 'sprint-run',
        worktreeId: 'test123',
        worktreePath: '/test',
        pid: process.pid,
        createdAt: twoHoursAgo.toISOString(),
    };
    const stale = isLockStale(lockInfo);
    assertEqual(stale, true);
});
test('isLockStale returns true for lock from dead process', () => {
    const lockInfo = {
        operation: 'sprint-run',
        worktreeId: 'test123',
        worktreePath: '/test',
        pid: 999999999, // Invalid PID
        createdAt: new Date().toISOString(),
    };
    const stale = isLockStale(lockInfo);
    assertEqual(stale, true);
});
test('isLockStale respects custom maxAge', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const lockInfo = {
        operation: 'sprint-run',
        worktreeId: 'test123',
        worktreePath: '/test',
        pid: process.pid,
        createdAt: fiveMinutesAgo.toISOString(),
    };
    // With default max age (1 hour), should not be stale
    assertEqual(isLockStale(lockInfo), false);
    // With 1 minute max age, should be stale
    assertEqual(isLockStale(lockInfo, 60 * 1000), true);
});
test('cleanupStaleLocks removes old locks', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Create a stale lock (from dead process) with unique branch
        createTestLockFile(lockDir, {
            worktreeId: 'stale-lock',
            branch: 'branch/stale',
            pid: 999999999, // Dead process
        });
        // Create a fresh lock with different branch
        createTestLockFile(lockDir, {
            worktreeId: 'fresh-lock',
            branch: 'branch/fresh',
            pid: process.pid,
        });
        const removed = cleanupStaleLocks(ctx.testDir);
        assertEqual(removed, 1, 'Should remove one stale lock');
        const remaining = listActiveLocks(ctx.testDir);
        assertEqual(remaining.length, 1, 'Should have one active lock');
        assertEqual(remaining[0].worktreeId, 'fresh-lock');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('cleanupStaleLocks handles empty lock directory', () => {
    const ctx = createGitTestDir();
    try {
        ensureLockDir(ctx.testDir);
        const removed = cleanupStaleLocks(ctx.testDir);
        assertEqual(removed, 0);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// List Active Locks Tests
// ============================================================================
console.log('\n=== List Active Locks Tests ===\n');
test('listActiveLocks returns empty array for no locks', () => {
    const ctx = createGitTestDir();
    try {
        ensureLockDir(ctx.testDir);
        const locks = listActiveLocks(ctx.testDir);
        assertEqual(locks.length, 0);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('listActiveLocks returns only active locks', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Create active lock with unique branch
        createTestLockFile(lockDir, {
            worktreeId: 'active-lock',
            branch: 'branch/active',
            pid: process.pid,
        });
        // Create stale lock with different branch
        createTestLockFile(lockDir, {
            worktreeId: 'stale-lock',
            branch: 'branch/stale',
            pid: 999999999,
        });
        const locks = listActiveLocks(ctx.testDir);
        assertEqual(locks.length, 1);
        assertEqual(locks[0].worktreeId, 'active-lock');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Branch Conflict Tests
// ============================================================================
console.log('\n=== Branch Conflict Tests ===\n');
test('checkBranchConflict detects branch with existing worktree', () => {
    const ctx = createGitTestDir();
    try {
        // Create a branch and worktree
        execSync('git branch feature-conflict', { cwd: ctx.testDir, stdio: 'pipe' });
        const worktreePath = path.join(path.dirname(ctx.testDir), 'conflict-wt');
        execSync(`git worktree add "${worktreePath}" feature-conflict`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        const result = checkBranchConflict({
            branchName: 'feature-conflict',
            repoRoot: ctx.testDir,
            sprintId: 'test-sprint',
        });
        assertEqual(result.hasConflict, true);
        assertEqual(result.conflictType, 'branch-in-use');
        assertNotNull(result.message);
        assertContains(result.message, 'feature-conflict');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkBranchConflict returns no conflict for available branch', () => {
    const ctx = createGitTestDir();
    try {
        const result = checkBranchConflict({
            branchName: 'sprint/new-feature',
            repoRoot: ctx.testDir,
        });
        assertEqual(result.hasConflict, false);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkBranchConflict provides suggestions', () => {
    const ctx = createGitTestDir();
    try {
        // Create conflict
        execSync('git branch suggest-test', { cwd: ctx.testDir, stdio: 'pipe' });
        const worktreePath = path.join(path.dirname(ctx.testDir), 'suggest-wt');
        execSync(`git worktree add "${worktreePath}" suggest-test`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        const result = checkBranchConflict({
            branchName: 'suggest-test',
            repoRoot: ctx.testDir,
            sprintId: 'my-sprint',
        });
        assertEqual(result.hasConflict, true);
        assertNotNull(result.suggestions);
        assert(result.suggestions.length > 0, 'Should have suggestions');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Sprint Conflict Tests
// ============================================================================
console.log('\n=== Sprint Conflict Tests ===\n');
test('checkSprintConflicts cleans stale locks first', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Create a stale lock
        createTestLockFile(lockDir, {
            worktreeId: 'stale',
            branch: 'sprint/test',
            pid: 999999999,
        });
        // Check should not find conflict (stale lock cleaned)
        const result = checkSprintConflicts(ctx.testDir, 'sprint/test', 'test-sprint');
        // The stale lock should have been cleaned
        const locks = listActiveLocks(ctx.testDir);
        assertEqual(locks.length, 0, 'Stale lock should be cleaned');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('checkSprintConflicts detects active lock conflict', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Create an active lock from "another worktree"
        createTestLockFile(lockDir, {
            worktreeId: 'other-worktree',
            worktreePath: '/other/path',
            branch: 'sprint/conflict-branch',
            operation: 'sprint-run',
            pid: process.pid,
        });
        const result = checkSprintConflicts(ctx.testDir, 'sprint/conflict-branch', 'test-sprint');
        assertEqual(result.hasConflict, true);
        assertEqual(result.conflictType, 'operation-locked');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Alternative Branch Suggestion Tests
// ============================================================================
console.log('\n=== Alternative Branch Suggestion Tests ===\n');
test('suggestAlternativeBranch appends worktree suffix', () => {
    const ctx = createGitTestDir();
    try {
        const suggestion = suggestAlternativeBranch('sprint/feature', ctx.testDir);
        assertContains(suggestion, 'sprint/feature-');
        // Should have 6-char suffix
        const parts = suggestion.split('-');
        const suffix = parts[parts.length - 1];
        assertEqual(suffix.length, 6, 'Suffix should be 6 characters');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('suggestAlternativeBranch is consistent for same worktree', () => {
    const ctx = createGitTestDir();
    try {
        const suggestion1 = suggestAlternativeBranch('sprint/test', ctx.testDir);
        const suggestion2 = suggestAlternativeBranch('sprint/test', ctx.testDir);
        assertEqual(suggestion1, suggestion2, 'Should be consistent');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
// ============================================================================
// Conflict Message Formatting Tests
// ============================================================================
console.log('\n=== Conflict Message Formatting Tests ===\n');
test('formatConflictWarning includes all details', () => {
    const warning = formatConflictWarning({
        sprintId: '2026-01-20_feature-auth',
        worktreePath: '/home/user/project-main',
        branch: 'sprint/feature-auth',
        status: 'in-progress',
    });
    assertContains(warning, '2026-01-20_feature-auth');
    assertContains(warning, '/home/user/project-main');
    assertContains(warning, 'sprint/feature-auth');
    assertContains(warning, 'in-progress');
    assertContains(warning, 'Warning:');
});
test('formatConflictSuggestions provides actionable steps', () => {
    const suggestions = formatConflictSuggestions('my-sprint', '/path/to/worktree');
    assertContains(suggestions, 'Suggestions:');
    assertContains(suggestions, 'my-sprint-v2');
    assertContains(suggestions, '/path/to/worktree');
    assertContains(suggestions, '/stop-sprint');
    assertContains(suggestions, '--force');
});
test('formatFullConflictMessage combines warning and suggestions', () => {
    const message = formatFullConflictMessage({
        sprintId: 'test-sprint',
        worktreePath: '/test/path',
        branch: 'sprint/test',
        status: 'in-progress',
    });
    assertContains(message, 'Warning:');
    assertContains(message, 'Suggestions:');
    assertContains(message, 'test-sprint');
    assertContains(message, '/test/path');
});
// ============================================================================
// Integration Tests: Cross-Worktree Conflict Detection
// ============================================================================
console.log('\n=== Integration Tests ===\n');
test('Integration: detect branch conflict across worktrees', () => {
    const ctx = createGitTestDir();
    try {
        // Create a worktree with a sprint branch
        const worktreePath = path.join(path.dirname(ctx.testDir), 'sprint-wt');
        execSync('git branch sprint/feature-auth', { cwd: ctx.testDir, stdio: 'pipe' });
        execSync(`git worktree add "${worktreePath}" sprint/feature-auth`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        // From main repo, try to use the same branch
        const conflict = checkBranchConflict({
            branchName: 'sprint/feature-auth',
            repoRoot: ctx.testDir,
            sprintId: 'feature-auth',
        });
        assertEqual(conflict.hasConflict, true);
        assertEqual(conflict.conflictType, 'branch-in-use');
        assertNotNull(conflict.details);
        assertContains(conflict.details.worktreePath, 'sprint-wt');
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('Integration: lock acquisition and release across worktrees', () => {
    const ctx = createGitTestDir();
    try {
        // Create two worktrees
        const wt1Path = path.join(path.dirname(ctx.testDir), 'lock-wt1');
        const wt2Path = path.join(path.dirname(ctx.testDir), 'lock-wt2');
        execSync(`git worktree add "${wt1Path}" -b lock-branch-1`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        execSync(`git worktree add "${wt2Path}" -b lock-branch-2`, {
            cwd: ctx.testDir,
            stdio: 'pipe',
        });
        // Acquire lock from wt1
        const lock1 = acquireLock(wt1Path, 'sprint-run', {
            branch: 'sprint/shared',
            sprintId: 'sprint-1',
        });
        assertEqual(lock1.success, true);
        // Verify lock is visible from wt2
        const locksFromWt2 = listActiveLocks(wt2Path);
        assertEqual(locksFromWt2.length, 1);
        assertEqual(locksFromWt2[0].sprintId, 'sprint-1');
        // Release lock from wt1
        const wt1Info = getWorktreeInfo(wt1Path);
        const released = releaseLock(lock1.lockPath, wt1Info.id);
        assertEqual(released, true);
        // Verify no locks remain
        const remainingLocks = listActiveLocks(wt2Path);
        assertEqual(remainingLocks.length, 0);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
test('Integration: stale lock cleanup recovers from crashed process', () => {
    const ctx = createGitTestDir();
    try {
        const lockDir = ensureLockDir(ctx.testDir);
        // Simulate a crashed process by creating lock with invalid PID
        const staleLockPath = createTestLockFile(lockDir, {
            worktreeId: 'crashed-wt',
            worktreePath: '/crashed/path',
            branch: 'sprint/crashed',
            pid: 999999999, // Invalid PID simulates crash
        });
        // Verify lock exists
        assert(fs.existsSync(staleLockPath), 'Stale lock should exist before cleanup');
        // Run cleanup
        const removed = cleanupStaleLocks(ctx.testDir);
        assertEqual(removed, 1);
        // Verify lock is gone
        assert(!fs.existsSync(staleLockPath), 'Stale lock should be removed');
        // Should now be able to use the branch
        const conflict = checkSprintConflicts(ctx.testDir, 'sprint/crashed', 'new-sprint');
        assertEqual(conflict.hasConflict, false);
    }
    finally {
        cleanupGitTestDir(ctx);
    }
});
console.log('\n=== All Lock Tests Complete ===\n');
//# sourceMappingURL=locks.test.js.map