/**
 * Tests for Per-Iteration Hook Execution
 *
 * Tests for executePerIterationHooks() and related functions that implement
 * per-iteration hooks in the sprint execution loop.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
// Import from loop module
import { runLoop, replaceHookTemplateVars, } from './loop.js';
// ============================================================================
// Test Infrastructure
// ============================================================================
let testsPassed = 0;
let testsFailed = 0;
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
};
const capturedLogs = [];
// Queue tests for sequential execution
const testQueue = [];
let testsStarted = false;
function test(name, fn) {
    testQueue.push({ name, fn });
    if (!testsStarted) {
        testsStarted = true;
        setImmediate(runTests);
    }
}
async function runTests() {
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            originalConsole.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            originalConsole.error(`✗ ${name}`);
            originalConsole.error(`  ${error}`);
        }
    }
    originalConsole.log('');
    originalConsole.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0) {
        process.exitCode = 1;
    }
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected)
        throw new Error(msg);
}
function mockConsole() {
    capturedLogs.length = 0;
    console.log = (msg) => capturedLogs.push({ level: 'info', message: String(msg) });
    console.warn = (msg) => capturedLogs.push({ level: 'warn', message: String(msg) });
    console.error = (msg) => capturedLogs.push({ level: 'error', message: String(msg) });
}
function restoreConsole() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createTestSprintDir() {
    const testDir = `/tmp/test-hooks-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'transcriptions'), { recursive: true });
    return testDir;
}
function cleanupTestDir(testDir) {
    try {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
function createTestProgress(overrides = {}) {
    return {
        'sprint-id': 'test-sprint',
        status: 'not-started',
        current: {
            phase: 0,
            step: null,
            'sub-phase': null,
        },
        stats: {
            'started-at': null,
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'phase-1',
                status: 'pending',
                prompt: 'Execute phase 1',
            },
            {
                id: 'phase-2',
                status: 'pending',
                prompt: 'Execute phase 2',
            },
        ],
        ...overrides,
    };
}
function writeProgress(sprintDir, progress) {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const content = yaml.dump(progress);
    fs.writeFileSync(progressPath, content, 'utf8');
}
function readProgressFile(sprintDir) {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const content = fs.readFileSync(progressPath, 'utf8');
    return yaml.load(content);
}
// ============================================================================
// Template Variable Replacement Tests
// ============================================================================
test('replaceHookTemplateVars should replace $ITERATION_TRANSCRIPT', () => {
    const prompt = 'Process transcript at $ITERATION_TRANSCRIPT';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'sprint-1',
        ITERATION: 3,
        PHASE_ID: 'phase-1',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'Process transcript at /path/to/transcript.log');
});
test('replaceHookTemplateVars should replace $SPRINT_ID', () => {
    const prompt = 'Sprint: $SPRINT_ID is running';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'my-sprint-2024',
        ITERATION: 1,
        PHASE_ID: 'phase-1',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'Sprint: my-sprint-2024 is running');
});
test('replaceHookTemplateVars should replace $ITERATION', () => {
    const prompt = 'Processing iteration $ITERATION';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'sprint-1',
        ITERATION: 42,
        PHASE_ID: 'phase-1',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'Processing iteration 42');
});
test('replaceHookTemplateVars should replace $PHASE_ID', () => {
    const prompt = 'Completed phase: $PHASE_ID';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'sprint-1',
        ITERATION: 1,
        PHASE_ID: 'development',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'Completed phase: development');
});
test('replaceHookTemplateVars should replace multiple variables', () => {
    const prompt = '/m42-signs:extract $ITERATION_TRANSCRIPT --sprint $SPRINT_ID --iteration $ITERATION --phase $PHASE_ID';
    const vars = {
        ITERATION_TRANSCRIPT: '/sprints/test/transcriptions/phase-0.log',
        SPRINT_ID: 'test-sprint',
        ITERATION: 5,
        PHASE_ID: 'qa',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, '/m42-signs:extract /sprints/test/transcriptions/phase-0.log --sprint test-sprint --iteration 5 --phase qa');
});
test('replaceHookTemplateVars should handle multiple occurrences of same variable', () => {
    const prompt = '$SPRINT_ID: $SPRINT_ID';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'test',
        ITERATION: 1,
        PHASE_ID: 'phase-1',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'test: test');
});
test('replaceHookTemplateVars should not affect text without variables', () => {
    const prompt = 'This is a plain prompt without variables';
    const vars = {
        ITERATION_TRANSCRIPT: '/path/to/transcript.log',
        SPRINT_ID: 'sprint-1',
        ITERATION: 1,
        PHASE_ID: 'phase-1',
    };
    const result = replaceHookTemplateVars(prompt, vars);
    assertEqual(result, 'This is a plain prompt without variables');
});
// ============================================================================
// Hook Execution via runLoop Tests
// ============================================================================
test('runLoop should execute enabled hook after iteration', async () => {
    const testDir = createTestSprintDir();
    let hookCalled = false;
    let hookPrompt = '';
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'learning',
                    prompt: 'Extract learnings from $ITERATION_TRANSCRIPT',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        let callCount = 0;
        const mockDeps = {
            runClaude: async (opts) => {
                callCount++;
                if (callCount === 1) {
                    // First call is the main phase
                    return {
                        success: true,
                        output: 'Phase completed',
                        exitCode: 0,
                        jsonResult: { status: 'completed', summary: 'Done' },
                    };
                }
                else {
                    // Second call should be the hook
                    hookCalled = true;
                    hookPrompt = opts.prompt;
                    return {
                        success: true,
                        output: 'Hook completed',
                        exitCode: 0,
                        jsonResult: { status: 'completed', summary: 'Hook done' },
                    };
                }
            },
        };
        await runLoop(testDir, options, mockDeps);
        assert(hookCalled, 'Hook should have been executed after iteration');
        assert(hookPrompt.includes('Extract learnings from'), `Hook prompt should contain expected text. Got: ${hookPrompt}`);
        // Verify template variable was replaced (should not contain $ITERATION_TRANSCRIPT)
        assert(!hookPrompt.includes('$ITERATION_TRANSCRIPT'), 'Template variable $ITERATION_TRANSCRIPT should be replaced');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should skip disabled hook', async () => {
    const testDir = createTestSprintDir();
    let hookCallCount = 0;
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'learning',
                    prompt: 'Extract learnings',
                    parallel: false,
                    enabled: false, // Disabled!
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        const mockDeps = {
            runClaude: async () => {
                hookCallCount++;
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        // Only the main phase should be called, not the hook
        assertEqual(hookCallCount, 1, 'Only main phase should be executed, hook should be skipped');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should track hook task in progress', async () => {
    const testDir = createTestSprintDir();
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'learning',
                    prompt: 'Extract learnings',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        let callCount = 0;
        const mockDeps = {
            runClaude: async () => {
                callCount++;
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        const finalProgress = readProgressFile(testDir);
        assert(finalProgress['hook-tasks'] !== undefined, 'hook-tasks should be created in progress');
        assert(finalProgress['hook-tasks'].length > 0, 'hook-tasks should have entries');
        const hookTask = finalProgress['hook-tasks'][0];
        assertEqual(hookTask['hook-id'], 'learning', 'Hook task should reference the hook id');
        assertEqual(hookTask.iteration, 1, 'Hook task should track iteration number');
        assertEqual(hookTask.status, 'completed', 'Hook task should be completed');
        assert(hookTask['spawned-at'] !== undefined, 'Hook task should have spawned-at timestamp');
        assert(hookTask['completed-at'] !== undefined, 'Hook task should have completed-at timestamp');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should handle parallel hook (non-blocking)', async () => {
    const testDir = createTestSprintDir();
    const callOrder = [];
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [
                { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
                { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
            ],
            'per-iteration-hooks': [
                {
                    id: 'parallel-hook',
                    prompt: 'Long running hook',
                    parallel: true, // Non-blocking
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 10, delay: 0, verbose: false };
        let phaseCallCount = 0;
        const mockDeps = {
            runClaude: async (opts) => {
                if (opts.prompt.includes('Execute phase')) {
                    phaseCallCount++;
                    callOrder.push(`phase-${phaseCallCount}`);
                }
                else if (opts.prompt.includes('Long running hook')) {
                    // Simulate a slow hook
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    callOrder.push('hook');
                }
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        // For parallel hooks, phase-2 should start before hook completes
        // The exact order depends on timing, but we should see both phases called
        assert(phaseCallCount === 2, 'Both phases should be executed');
        const finalProgress = readProgressFile(testDir);
        const hookTasks = finalProgress['hook-tasks'];
        assert(hookTasks !== undefined && hookTasks.length > 0, 'Hook tasks should be tracked');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should handle sequential hook (blocking)', async () => {
    const testDir = createTestSprintDir();
    const callOrder = [];
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [
                { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
                { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
            ],
            'per-iteration-hooks': [
                {
                    id: 'sequential-hook',
                    prompt: 'Sequential hook',
                    parallel: false, // Blocking
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const mockDeps = {
            runClaude: async (opts) => {
                if (opts.prompt.includes('Execute phase 1')) {
                    callOrder.push('phase-1');
                }
                else if (opts.prompt.includes('Sequential hook')) {
                    callOrder.push('hook');
                }
                else if (opts.prompt.includes('Execute phase 2')) {
                    callOrder.push('phase-2');
                }
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        // For sequential hooks, hook should complete before phase-2 starts
        // First iteration: phase-1 -> hook -> phase-2
        const phase1Index = callOrder.indexOf('phase-1');
        const hookIndex = callOrder.indexOf('hook');
        const phase2Index = callOrder.indexOf('phase-2');
        assert(phase1Index < hookIndex, 'Hook should execute after phase-1');
        assert(hookIndex < phase2Index, 'Sequential hook should complete before phase-2');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should handle hook failure without crashing sprint', async () => {
    const testDir = createTestSprintDir();
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [
                { id: 'phase-1', status: 'pending', prompt: 'Execute phase' },
            ],
            'per-iteration-hooks': [
                {
                    id: 'failing-hook',
                    prompt: 'This hook will fail',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        let callCount = 0;
        const mockDeps = {
            runClaude: async () => {
                callCount++;
                if (callCount === 1) {
                    // Main phase succeeds
                    return {
                        success: true,
                        output: 'Phase completed',
                        exitCode: 0,
                        jsonResult: { status: 'completed', summary: 'Done' },
                    };
                }
                else {
                    // Hook fails
                    return {
                        success: false,
                        output: 'Hook failed',
                        exitCode: 1,
                        error: 'Hook execution error',
                    };
                }
            },
        };
        // Should not throw
        const result = await runLoop(testDir, options, mockDeps);
        // Sprint should still complete (hook failure shouldn't crash sprint)
        assertEqual(result.finalState.status, 'completed', 'Sprint should complete despite hook failure');
        // Hook task should be tracked as failed
        const finalProgress = readProgressFile(testDir);
        const hookTask = finalProgress['hook-tasks']?.[0];
        assertEqual(hookTask?.status, 'failed', 'Failed hook should be tracked as failed');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should replace template variables in hook prompt', async () => {
    const testDir = createTestSprintDir();
    let capturedPrompt = '';
    try {
        const progress = createTestProgress({
            status: 'not-started',
            'sprint-id': 'my-test-sprint',
            phases: [{ id: 'test-phase', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'learning',
                    prompt: '/m42-signs:extract $ITERATION_TRANSCRIPT --auto-apply-high --sprint $SPRINT_ID --phase $PHASE_ID',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        let callCount = 0;
        const mockDeps = {
            runClaude: async (opts) => {
                callCount++;
                if (callCount === 2) {
                    // Second call is the hook
                    capturedPrompt = opts.prompt;
                }
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        // Verify template variables were replaced
        assert(!capturedPrompt.includes('$ITERATION_TRANSCRIPT'), '$ITERATION_TRANSCRIPT should be replaced');
        assert(!capturedPrompt.includes('$SPRINT_ID'), '$SPRINT_ID should be replaced');
        assert(!capturedPrompt.includes('$PHASE_ID'), '$PHASE_ID should be replaced');
        // Verify values were substituted correctly
        assert(capturedPrompt.includes('my-test-sprint'), 'Sprint ID should be substituted');
        assert(capturedPrompt.includes('test-phase'), 'Phase ID should be substituted');
        assert(capturedPrompt.includes('.log'), 'Transcript path should be substituted');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should handle sprint with no hooks gracefully', async () => {
    const testDir = createTestSprintDir();
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            // No per-iteration-hooks defined
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        const mockDeps = {
            runClaude: async () => ({
                success: true,
                output: 'Completed',
                exitCode: 0,
                jsonResult: { status: 'completed', summary: 'Done' },
            }),
        };
        // Should not throw
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Sprint should complete without hooks');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should handle empty hooks array gracefully', async () => {
    const testDir = createTestSprintDir();
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [], // Empty array
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        const mockDeps = {
            runClaude: async () => ({
                success: true,
                output: 'Completed',
                exitCode: 0,
                jsonResult: { status: 'completed', summary: 'Done' },
            }),
        };
        // Should not throw
        const result = await runLoop(testDir, options, mockDeps);
        assertEqual(result.finalState.status, 'completed', 'Sprint should complete with empty hooks');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should execute hook for each iteration', async () => {
    const testDir = createTestSprintDir();
    let hookCallCount = 0;
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [
                { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
                { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
            ],
            'per-iteration-hooks': [
                {
                    id: 'counter-hook',
                    prompt: 'Count iteration',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 10, delay: 0, verbose: false };
        const mockDeps = {
            runClaude: async (opts) => {
                if (opts.prompt.includes('Count iteration')) {
                    hookCallCount++;
                }
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        // Hook should be called once per phase (2 phases = 2 hook calls)
        assertEqual(hookCallCount, 2, 'Hook should be called for each iteration');
        // Verify hook tasks were tracked
        const finalProgress = readProgressFile(testDir);
        assertEqual(finalProgress['hook-tasks']?.length, 2, 'Hook tasks should be tracked for each iteration');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('runLoop should log hook execution when verbose', async () => {
    const testDir = createTestSprintDir();
    mockConsole();
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'learning',
                    prompt: 'Extract learnings',
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: true };
        const mockDeps = {
            runClaude: async () => ({
                success: true,
                output: 'Completed',
                exitCode: 0,
                jsonResult: { status: 'completed', summary: 'Done' },
            }),
        };
        await runLoop(testDir, options, mockDeps);
        // Check for hook execution logs
        const hasHookLog = capturedLogs.some((log) => log.message.includes('hook') || log.message.includes('Hook'));
        assert(hasHookLog, 'Should log hook execution info when verbose');
    }
    finally {
        restoreConsole();
        cleanupTestDir(testDir);
    }
});
test('runLoop should skip hook without prompt or workflow', async () => {
    const testDir = createTestSprintDir();
    let hookCalled = false;
    try {
        const progress = createTestProgress({
            status: 'not-started',
            phases: [{ id: 'phase-1', status: 'pending', prompt: 'Execute phase' }],
            'per-iteration-hooks': [
                {
                    id: 'empty-hook',
                    // No prompt or workflow defined
                    parallel: false,
                    enabled: true,
                },
            ],
        });
        writeProgress(testDir, progress);
        const options = { maxIterations: 1, delay: 0, verbose: false };
        let callCount = 0;
        const mockDeps = {
            runClaude: async () => {
                callCount++;
                if (callCount > 1) {
                    hookCalled = true;
                }
                return {
                    success: true,
                    output: 'Completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, options, mockDeps);
        assert(!hookCalled, 'Hook without prompt should not be executed');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Run Tests Summary
// ============================================================================
// Tests run sequentially via runTests() triggered by setImmediate
//# sourceMappingURL=hooks.test.js.map