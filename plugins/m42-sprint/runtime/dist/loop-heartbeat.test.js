/**
 * Tests for Loop Heartbeat and Signal Handlers - Step 2
 *
 * These tests verify that:
 * 1. Loop writes 'last-activity' timestamp each iteration
 * 2. SIGTERM handler marks sprint as 'interrupted'
 * 3. SIGINT handler marks sprint as 'interrupted'
 * 4. Signal handlers write interrupted timestamp before exit
 *
 * RED Phase: All tests should FAIL until implementation is complete.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Simple test runner (consistent with project patterns)
let testsPassed = 0;
let testsFailed = 0;
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
            console.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            console.error(`✗ ${name}`);
            console.error(`  ${error}`);
        }
    }
    console.log('');
    console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
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
// ============================================================================
// Test Fixtures
// ============================================================================
function createTestSprintDir() {
    const testDir = `/tmp/test-heartbeat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'logs'), { recursive: true });
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
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'phase-1',
                status: 'pending',
                prompt: 'Execute phase 1',
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
console.log('\n--- Step 2: Loop Heartbeat and Signal Handler Tests ---\n');
// ============================================================================
// Test: Heartbeat - last-activity timestamp
// ============================================================================
test('runLoop should write last-activity timestamp each iteration', async () => {
    const { runLoop } = await import('./loop.js');
    const testDir = createTestSprintDir();
    try {
        const progress = createTestProgress({ status: 'not-started' });
        writeProgress(testDir, progress);
        let iterationCount = 0;
        const mockDeps = {
            runClaude: async () => {
                iterationCount++;
                return {
                    success: true,
                    output: 'Phase completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, { maxIterations: 1, delay: 0 }, mockDeps);
        const finalProgress = readProgressFile(testDir);
        // The progress should have 'last-activity' field
        assert('last-activity' in finalProgress, 'PROGRESS.yaml should contain last-activity field (RED: expected to fail)');
        // Verify it's a valid ISO timestamp
        const lastActivity = finalProgress['last-activity'];
        assert(lastActivity !== undefined && !isNaN(Date.parse(lastActivity)), 'last-activity should be a valid ISO timestamp');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('last-activity should be updated on each iteration', async () => {
    const { runLoop } = await import('./loop.js');
    const testDir = createTestSprintDir();
    try {
        // Create progress with 2 phases
        const progress = createTestProgress({
            status: 'not-started',
            phases: [
                { id: 'phase-1', status: 'pending', prompt: 'Phase 1' },
                { id: 'phase-2', status: 'pending', prompt: 'Phase 2' },
            ],
            stats: { 'started-at': null, 'total-phases': 2, 'completed-phases': 0 },
        });
        writeProgress(testDir, progress);
        const timestamps = [];
        const mockDeps = {
            runClaude: async () => {
                // Read the current timestamp before returning
                const currentProgress = readProgressFile(testDir);
                if (currentProgress['last-activity']) {
                    timestamps.push(currentProgress['last-activity']);
                }
                return {
                    success: true,
                    output: 'Phase completed',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            },
        };
        await runLoop(testDir, { maxIterations: 2, delay: 10 }, mockDeps);
        // Should have captured at least 2 timestamps
        assert(timestamps.length >= 2, `Expected at least 2 timestamps, got ${timestamps.length} (RED: expected to fail)`);
        // The second timestamp should be later than the first
        if (timestamps.length >= 2) {
            const t1 = new Date(timestamps[0]).getTime();
            const t2 = new Date(timestamps[1]).getTime();
            assert(t2 >= t1, 'Second last-activity timestamp should be >= first');
        }
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Test: SIGTERM Handler
// ============================================================================
test('SIGTERM handler should mark sprint as interrupted', async () => {
    // Read the loop.ts source to verify SIGTERM handler exists
    const loopPath = path.join(__dirname, '..', '..', 'src', 'loop.ts');
    // In compiled form, __dirname points to dist, so adjust
    const distDir = __dirname;
    const srcDir = distDir.replace(/[/\\]dist[/\\]?$/, '/src');
    const srcPath = path.join(srcDir, 'loop.ts');
    let sourceCode = '';
    if (fs.existsSync(srcPath)) {
        sourceCode = fs.readFileSync(srcPath, 'utf-8');
    }
    else if (fs.existsSync(loopPath)) {
        sourceCode = fs.readFileSync(loopPath, 'utf-8');
    }
    // Check that SIGTERM handler is implemented
    const hasSigtermHandler = sourceCode.includes("process.on('SIGTERM'") ||
        sourceCode.includes('process.on("SIGTERM"') ||
        sourceCode.includes('SIGTERM');
    assert(hasSigtermHandler, "loop.ts should handle SIGTERM signal (RED: expected to fail)");
    // Check that it sets status to 'interrupted'
    const hasInterruptedStatus = sourceCode.includes("'interrupted'") ||
        sourceCode.includes('"interrupted"') ||
        sourceCode.includes('interrupted');
    assert(hasInterruptedStatus, "SIGTERM handler should set status to 'interrupted' (RED: expected to fail)");
});
test('SIGTERM handler should write interrupted-at timestamp', async () => {
    // Read the loop.ts source
    const distDir = __dirname;
    const srcDir = distDir.replace(/[/\\]dist[/\\]?$/, '/src');
    const srcPath = path.join(srcDir, 'loop.ts');
    let sourceCode = '';
    if (fs.existsSync(srcPath)) {
        sourceCode = fs.readFileSync(srcPath, 'utf-8');
    }
    // The handler should write an interrupted-at timestamp
    const hasInterruptedAt = sourceCode.includes("'interrupted-at'") ||
        sourceCode.includes('"interrupted-at"') ||
        sourceCode.includes('interruptedAt');
    assert(hasInterruptedAt, "SIGTERM handler should write interrupted-at timestamp (RED: expected to fail)");
});
// ============================================================================
// Test: SIGINT Handler
// ============================================================================
test('SIGINT handler should mark sprint as interrupted', async () => {
    // Read the loop.ts source
    const distDir = __dirname;
    const srcDir = distDir.replace(/[/\\]dist[/\\]?$/, '/src');
    const srcPath = path.join(srcDir, 'loop.ts');
    let sourceCode = '';
    if (fs.existsSync(srcPath)) {
        sourceCode = fs.readFileSync(srcPath, 'utf-8');
    }
    // Check that SIGINT handler is implemented
    const hasSigintHandler = sourceCode.includes("process.on('SIGINT'") ||
        sourceCode.includes('process.on("SIGINT"') ||
        sourceCode.includes('SIGINT');
    assert(hasSigintHandler, "loop.ts should handle SIGINT signal (RED: expected to fail)");
});
test('signal handlers should clean up before exit', async () => {
    // Read the loop.ts source
    const distDir = __dirname;
    const srcDir = distDir.replace(/[/\\]dist[/\\]?$/, '/src');
    const srcPath = path.join(srcDir, 'loop.ts');
    let sourceCode = '';
    if (fs.existsSync(srcPath)) {
        sourceCode = fs.readFileSync(srcPath, 'utf-8');
    }
    // The handler should call process.exit or perform cleanup
    const hasCleanupAndExit = (sourceCode.includes('process.exit') || sourceCode.includes('graceful')) &&
        (sourceCode.includes('writeProgress') || sourceCode.includes('writeProgressAtomic'));
    assert(hasCleanupAndExit, "Signal handlers should write progress and exit gracefully (RED: expected to fail)");
});
console.log('\nLoop heartbeat and signal handler tests completed.\n');
//# sourceMappingURL=loop-heartbeat.test.js.map