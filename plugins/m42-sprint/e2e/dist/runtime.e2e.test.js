/**
 * Runtime E2E Tests
 *
 * Tests the sprint runtime loop with mock Claude responses.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
// Import test helpers
import { test, assert, assertEqual, createTestDir, cleanupTestDir, copyFixture, compileSprint, readProgress, writeProgress, createPauseFile, createSuccessMock, createFailOnIterationMock, createNeedsHumanMock, } from './test-helpers.js';
// Dynamic import for runtime (resolved at runtime)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimePath = path.resolve(__dirname, '..', '..', 'runtime', 'dist', 'loop.js');
const runtimeModule = await import(runtimePath);
const runLoop = runtimeModule.runLoop;
const isTerminalState = runtimeModule.isTerminalState;
// ============================================================================
// Test 3.1: Single Phase Completion
// ============================================================================
test('3.1: Single phase should complete with mock Claude', async () => {
    const testDir = createTestDir('runtime-3.1');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const mockDeps = createSuccessMock();
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Should complete');
        assert(result.iterations >= 1, 'Should have run at least one iteration');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.2: Multi-Phase Sequential
// ============================================================================
test('3.2: Multi-phase workflow should advance through all phases', async () => {
    const testDir = createTestDir('runtime-3.2');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        // Track which phases were executed
        const executedPhases = [];
        const mockDeps = {
            runClaude: async (opts) => {
                executedPhases.push(opts.prompt);
                return {
                    success: true,
                    output: '',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Should complete');
        // Minimal sprint has 1 step with 3 sub-phases (red, green, refactor)
        assertEqual(executedPhases.length, 3, 'Should execute 3 sub-phases');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.3: Step with Sub-Phases (3-level hierarchy)
// ============================================================================
test('3.3: Bugfix workflow with sub-phases should navigate 3-level hierarchy', async () => {
    const testDir = createTestDir('runtime-3.3');
    try {
        copyFixture('bugfix-sprint', testDir);
        compileSprint(testDir);
        const executedPrompts = [];
        const mockDeps = {
            runClaude: async (opts) => {
                executedPrompts.push(opts.prompt);
                return {
                    success: true,
                    output: '',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        const options = { maxIterations: 20, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Should complete');
        // 2 steps * 3 sub-phases (red, green, refactor) = 6 executions
        assertEqual(executedPrompts.length, 6, 'Should execute 6 sub-phases (2 steps * 3 phases)');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.4: Max Iterations Enforcement
// ============================================================================
test('3.4: Max iterations should stop execution and block', async () => {
    const testDir = createTestDir('runtime-3.4');
    try {
        copyFixture('bugfix-sprint', testDir);
        compileSprint(testDir);
        const mockDeps = createSuccessMock();
        const options = { maxIterations: 2, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'blocked', 'Should be blocked at max iterations');
        assertEqual(result.iterations, 2, 'Should have run exactly 2 iterations');
        const progress = readProgress(testDir);
        assertEqual(progress.status, 'blocked', 'PROGRESS.yaml should show blocked');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.5: PAUSE File Detection
// ============================================================================
test('3.5: PAUSE file should pause execution', async () => {
    const testDir = createTestDir('runtime-3.5');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        // Create PAUSE file before running
        createPauseFile(testDir, 'E2E test pause');
        const mockDeps = createSuccessMock();
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'paused', 'Should be paused');
        const progress = readProgress(testDir);
        assertEqual(progress.status, 'paused', 'PROGRESS.yaml should show paused');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.6: Phase Failure to Blocked
// ============================================================================
test('3.6: Phase failure should transition to blocked', async () => {
    const testDir = createTestDir('runtime-3.6');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        // Fail on first iteration
        const mockDeps = createFailOnIterationMock(1, 'Simulated phase failure');
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'blocked', 'Should be blocked after failure');
        if (result.finalState.status === 'blocked') {
            assert(result.finalState.error.includes('Simulated') || result.finalState.error.length > 0, 'Should have error message');
        }
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test 3.7: Recovery from Interrupted Transaction
// ============================================================================
test('3.7: Should recover from interrupted transaction using backup', async () => {
    const testDir = createTestDir('runtime-3.7');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        const progressPath = path.join(testDir, 'PROGRESS.yaml');
        const backupPath = path.join(testDir, 'PROGRESS.yaml.backup');
        const checksumBackupPath = path.join(testDir, 'PROGRESS.yaml.checksum.backup');
        // Create a "valid" backup file with proper checksum backup
        const validProgress = readProgress(testDir);
        validProgress.status = 'in-progress';
        const backupContent = yaml.dump(validProgress);
        fs.writeFileSync(backupPath, backupContent, 'utf8');
        // Create matching checksum backup for the valid backup
        const crypto = await import('crypto');
        const backupChecksum = crypto.createHash('sha256').update(backupContent, 'utf8').digest('hex');
        fs.writeFileSync(checksumBackupPath, backupChecksum, 'utf8');
        // Corrupt the main file
        fs.writeFileSync(progressPath, 'invalid: yaml {{ broken', 'utf8');
        // Also create a fake checksum that won't match (simulating interrupted write)
        fs.writeFileSync(progressPath + '.checksum', 'fake-checksum', 'utf8');
        const mockDeps = createSuccessMock();
        const options = { maxIterations: 10, delay: 0, verbose: false };
        // Should recover from backup and continue
        const result = await runLoop(testDir, options, mockDeps);
        // Recovery should happen and sprint should eventually complete
        assertEqual(result.finalState.status, 'completed', 'Should complete after recovery');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test: Human Needed Detection
// ============================================================================
test('Runtime should detect needs-human and stop', async () => {
    const testDir = createTestDir('runtime-needs-human');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        const mockDeps = createNeedsHumanMock('Cannot proceed without clarification', 'The spec is ambiguous');
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'needs-human', 'Should be needs-human');
        if (result.finalState.status === 'needs-human') {
            assertEqual(result.finalState.reason, 'Cannot proceed without clarification', 'Reason should match');
        }
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test: Empty Phases Array
// ============================================================================
test('Runtime should handle empty phases array', async () => {
    const testDir = createTestDir('runtime-empty');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        // Manually create PROGRESS.yaml with empty phases
        const progress = readProgress(testDir);
        progress.phases = [];
        writeProgress(testDir, progress);
        const mockDeps = createSuccessMock();
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Empty sprint should complete immediately');
        assertEqual(result.iterations, 0, 'Should not run any iterations');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test: Resume from Paused State
// ============================================================================
test('Runtime should resume from paused state', async () => {
    const testDir = createTestDir('runtime-resume');
    try {
        copyFixture('minimal-sprint', testDir);
        compileSprint(testDir);
        // First run - pause after first iteration
        createPauseFile(testDir);
        const mockDeps1 = createSuccessMock();
        const result1 = await runLoop(testDir, { maxIterations: 10, delay: 0 }, mockDeps1);
        assertEqual(result1.finalState.status, 'paused', 'Should be paused');
        // Remove PAUSE file
        fs.unlinkSync(path.join(testDir, 'PAUSE'));
        // Update progress status to in-progress (simulating manual resume)
        const progress = readProgress(testDir);
        progress.status = 'in-progress';
        writeProgress(testDir, progress);
        // Second run - should continue
        const mockDeps2 = createSuccessMock();
        const result2 = await runLoop(testDir, { maxIterations: 10, delay: 0 }, mockDeps2);
        assertEqual(result2.finalState.status, 'completed', 'Should complete after resume');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test: isTerminalState helper
// ============================================================================
test('isTerminalState should correctly identify terminal states', () => {
    // Terminal states
    assert(isTerminalState({ status: 'completed', completedAt: '', elapsed: '' }), 'completed');
    assert(isTerminalState({ status: 'blocked', error: '', failedPhase: '', blockedAt: '' }), 'blocked');
    assert(isTerminalState({ status: 'paused', pausedAt: { phase: 0, step: null, 'sub-phase': null }, pauseReason: '' }), 'paused');
    assert(isTerminalState({ status: 'needs-human', reason: '' }), 'needs-human');
    // Non-terminal
    assert(!isTerminalState({ status: 'not-started' }), 'not-started is not terminal');
    assert(!isTerminalState({
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: ''
    }), 'in-progress is not terminal');
});
