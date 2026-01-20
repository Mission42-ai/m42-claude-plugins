/**
 * E2E Test Helpers for Sprint Plugin
 *
 * Provides utilities for creating test sprints, mock Claude runners,
 * and cleanup functions.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ============================================================================
// Constants
// ============================================================================
// When running from dist/, __dirname is e2e/dist, so go up one level to e2e/
export const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');
export const WORKFLOWS_DIR = path.join(FIXTURES_DIR, 'workflows');
// ============================================================================
// Test Directory Management
// ============================================================================
/**
 * Create a temporary test directory
 */
export function createTestDir(prefix = 'test-e2e') {
    const testDir = `/tmp/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(testDir, { recursive: true });
    return testDir;
}
/**
 * Clean up a test directory
 */
export function cleanupTestDir(testDir) {
    try {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
/**
 * Copy a fixture sprint to a test directory
 */
export function copyFixture(fixtureName, destDir) {
    const srcDir = path.join(FIXTURES_DIR, fixtureName);
    if (!fs.existsSync(srcDir)) {
        throw new Error(`Fixture not found: ${fixtureName}`);
    }
    // Copy all files from fixture
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        if (fs.statSync(srcPath).isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            const subFiles = fs.readdirSync(srcPath);
            for (const subFile of subFiles) {
                fs.copyFileSync(path.join(srcPath, subFile), path.join(destPath, subFile));
            }
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    // Copy workflows to .claude/workflows
    const workflowsDestDir = path.join(destDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDestDir, { recursive: true });
    const workflowFiles = fs.readdirSync(WORKFLOWS_DIR);
    for (const file of workflowFiles) {
        fs.copyFileSync(path.join(WORKFLOWS_DIR, file), path.join(workflowsDestDir, file));
    }
}
// ============================================================================
// Mock Claude Runner Factory
// ============================================================================
/**
 * Create a mock Claude runner that returns predefined responses
 *
 * @param responses - Array of responses to return in sequence
 * @returns Mock deps object compatible with runLoop
 */
export function createMockClaudeRunner(responses) {
    let callIndex = 0;
    return {
        runClaude: async () => {
            if (callIndex >= responses.length) {
                // Default: return success after exhausting predefined responses
                return {
                    success: true,
                    output: '',
                    exitCode: 0,
                    jsonResult: { status: 'completed', summary: 'Done' },
                };
            }
            const response = responses[callIndex++];
            return {
                success: response.success,
                output: response.output,
                exitCode: response.exitCode,
                error: response.error,
                jsonResult: response.jsonResult,
            };
        },
    };
}
/**
 * Create a mock that always succeeds
 */
export function createSuccessMock() {
    return {
        runClaude: async () => ({
            success: true,
            output: 'Task completed successfully',
            exitCode: 0,
            jsonResult: { status: 'completed', summary: 'Phase completed successfully' },
        }),
    };
}
/**
 * Create a mock that fails on specific iteration
 */
export function createFailOnIterationMock(failIteration, error = 'Test failure') {
    let callCount = 0;
    return {
        runClaude: async () => {
            callCount++;
            if (callCount === failIteration) {
                return {
                    success: false,
                    output: '',
                    exitCode: 1,
                    error,
                };
            }
            return {
                success: true,
                output: '',
                exitCode: 0,
                jsonResult: { status: 'completed', summary: 'Done' },
            };
        },
    };
}
/**
 * Create a mock that returns needs-human status
 */
export function createNeedsHumanMock(reason, details) {
    return {
        runClaude: async () => ({
            success: true,
            output: '',
            exitCode: 0,
            jsonResult: {
                status: 'needs-human',
                summary: 'Human intervention required',
                humanNeeded: { reason, details },
            },
        }),
    };
}
// ============================================================================
// Compiler Helper
// ============================================================================
/**
 * Run the compiler on a sprint directory
 */
export function compileSprint(sprintDir, workflowsDir) {
    // When running from dist/, __dirname is e2e/dist, so go up two levels
    const compilerPath = path.resolve(__dirname, '..', '..', 'compiler', 'dist', 'index.js');
    const wDir = workflowsDir || path.join(sprintDir, '.claude', 'workflows');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${wDir}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
    });
}
// ============================================================================
// Progress File Helpers
// ============================================================================
/**
 * Read PROGRESS.yaml from a sprint directory
 */
export function readProgress(sprintDir) {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const content = fs.readFileSync(progressPath, 'utf8');
    return yaml.load(content);
}
/**
 * Write PROGRESS.yaml to a sprint directory (for test setup)
 * Also updates the checksum file to avoid mismatch errors
 */
export function writeProgress(sprintDir, progress) {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');
    const content = yaml.dump(progress, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
    });
    fs.writeFileSync(progressPath, content, 'utf8');
    // Calculate and write checksum to avoid mismatch errors
    const checksum = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    fs.writeFileSync(checksumPath, checksum, 'utf8');
}
/**
 * Create a PAUSE file in the sprint directory
 */
export function createPauseFile(sprintDir, reason = 'Test pause') {
    const pausePath = path.join(sprintDir, 'PAUSE');
    fs.writeFileSync(pausePath, reason, 'utf8');
}
/**
 * Remove the PAUSE file from the sprint directory
 */
export function removePauseFile(sprintDir) {
    const pausePath = path.join(sprintDir, 'PAUSE');
    if (fs.existsSync(pausePath)) {
        fs.unlinkSync(pausePath);
    }
}
let testResults = [];
let testQueue = [];
let testsStarted = false;
/**
 * Reset test state (call before each test file)
 */
export function resetTests() {
    testResults = [];
    testQueue = [];
    testsStarted = false;
}
/**
 * Register a test
 */
export function test(name, fn) {
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
            testResults.push({ name, passed: true });
            console.log(`✓ ${name}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            testResults.push({ name, passed: false, error: errorMsg });
            console.error(`✗ ${name}`);
            console.error(`  ${errorMsg}`);
        }
    }
    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;
    console.log('');
    console.log(`Tests completed: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}
/**
 * Assertion helpers
 */
export function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
export function assertEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected)
        throw new Error(msg);
}
export function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    const msg = message || `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`;
    if (actualStr !== expectedStr)
        throw new Error(msg);
}
