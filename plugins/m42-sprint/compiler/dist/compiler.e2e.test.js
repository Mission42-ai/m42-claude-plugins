"use strict";
/**
 * E2E Tests for Sprint Compiler
 *
 * Tests compiler behavior including Bug 5 (checksum file handling)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const yaml = __importStar(require("js-yaml"));
const child_process_1 = require("child_process");
// ============================================================================
// Test Infrastructure
// ============================================================================
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
function createTestDir() {
    const testDir = `/tmp/test-compiler-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(testDir, { recursive: true });
    return testDir;
}
function createTestWorkflowsDir(baseDir) {
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    // Create a minimal workflow
    const workflowContent = yaml.dump({
        name: 'minimal-workflow',
        description: 'Minimal workflow for testing',
        phases: [
            { id: 'phase-1', prompt: 'Execute phase 1' },
            { id: 'phase-2', prompt: 'Execute phase 2' }
        ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'minimal-workflow.yaml'), workflowContent, 'utf8');
    return workflowsDir;
}
function createTestSprintDir(baseDir, workflowName = 'minimal-workflow') {
    const sprintDir = path.join(baseDir, 'test-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });
    // Create minimal SPRINT.yaml
    const sprintContent = yaml.dump({
        'sprint-id': 'test-sprint-id',
        name: 'Test Sprint',
        workflow: workflowName,
        steps: [
            { id: 'step-1', prompt: 'Test step 1' }
        ]
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');
    return sprintDir;
}
function cleanupTestDir(testDir) {
    try {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
function calculateChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
// ============================================================================
// Bug 5: Compiler Should Handle Stale Checksum Files
// ============================================================================
test('Bug 5: compiler should remove stale checksum file after writing PROGRESS.yaml', async () => {
    // Bug 5: When the compiler rewrites PROGRESS.yaml, any existing .checksum
    // file from a previous runtime session becomes stale and causes checksum
    // mismatch errors when the runtime tries to read the newly compiled file.
    //
    // BEFORE FIX: Stale .checksum file remains, causing runtime read failure
    // AFTER FIX: Compiler removes or updates .checksum file after writing
    const baseDir = createTestDir();
    try {
        const workflowsDir = createTestWorkflowsDir(baseDir);
        const sprintDir = createTestSprintDir(baseDir);
        const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
        const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');
        // Create a "stale" checksum file (simulating a previous runtime session)
        const staleChecksum = 'a7c63f7579afc797844188d00f7c5100b5775d97c96e6da2eaed44865c8bd927';
        fs.writeFileSync(checksumPath, staleChecksum, 'utf8');
        // Run the compiler
        const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
        try {
            (0, child_process_1.execSync)(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
                cwd: baseDir,
                encoding: 'utf8',
                stdio: 'pipe'
            });
        }
        catch (e) {
            const err = e;
            console.error('Compiler stdout:', err.stdout);
            console.error('Compiler stderr:', err.stderr);
            throw e;
        }
        // Verify PROGRESS.yaml was created
        assert(fs.existsSync(progressPath), 'PROGRESS.yaml should exist after compilation');
        // Bug 5 check: After compilation, either:
        // 1. The checksum file should be deleted, OR
        // 2. The checksum file should be updated to match the new content
        //
        // If the checksum file still has the stale value, the test fails
        if (fs.existsSync(checksumPath)) {
            // If checksum file exists, it should match the compiled content
            const progressContent = fs.readFileSync(progressPath, 'utf8');
            const expectedChecksum = calculateChecksum(progressContent);
            const actualChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
            assertEqual(actualChecksum, expectedChecksum, `Bug 5: Checksum file has stale value. Expected: ${expectedChecksum}, Got: ${actualChecksum}`);
        }
        // If checksum file doesn't exist, that's also acceptable (compiler deleted it)
    }
    finally {
        cleanupTestDir(baseDir);
    }
});
test('Bug 5: runtime should be able to read compiler-generated PROGRESS.yaml without checksum errors', async () => {
    // This tests the full flow: compile, then read with runtime yaml-ops
    const baseDir = createTestDir();
    try {
        const workflowsDir = createTestWorkflowsDir(baseDir);
        const sprintDir = createTestSprintDir(baseDir);
        const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
        const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');
        // Create stale checksum
        fs.writeFileSync(checksumPath, 'stale-checksum-value-12345', 'utf8');
        // Run compiler
        const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
        (0, child_process_1.execSync)(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
            cwd: baseDir,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        // Now try to read using the runtime's readProgress logic
        // (simulated here since we can't easily import from runtime)
        const content = fs.readFileSync(progressPath, 'utf8');
        if (fs.existsSync(checksumPath)) {
            const storedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
            const actualChecksum = calculateChecksum(content);
            if (storedChecksum !== actualChecksum) {
                throw new Error(`Bug 5: Runtime would fail with checksum mismatch. ` +
                    `Stored: ${storedChecksum}, Actual: ${actualChecksum}`);
            }
        }
        // Verify we can parse the YAML
        const progress = yaml.load(content);
        assert(progress['sprint-id'] !== undefined, 'Should have sprint-id');
    }
    finally {
        cleanupTestDir(baseDir);
    }
});
// ============================================================================
// Basic Compiler E2E Tests
// ============================================================================
test('compiler should generate valid PROGRESS.yaml from minimal sprint', async () => {
    const baseDir = createTestDir();
    try {
        const workflowsDir = createTestWorkflowsDir(baseDir);
        const sprintDir = createTestSprintDir(baseDir);
        const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
        // Run compiler
        const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
        (0, child_process_1.execSync)(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
            cwd: baseDir,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        // Verify output
        assert(fs.existsSync(progressPath), 'PROGRESS.yaml should be created');
        const content = fs.readFileSync(progressPath, 'utf8');
        const progress = yaml.load(content);
        assertEqual(progress['sprint-id'], 'test-sprint-id', 'Sprint ID should match');
        assertEqual(progress.status, 'not-started', 'Initial status should be not-started');
        assert(Array.isArray(progress.phases), 'Should have phases array');
    }
    finally {
        cleanupTestDir(baseDir);
    }
});
test('compiler should fail gracefully on missing SPRINT.yaml', async () => {
    const baseDir = createTestDir();
    try {
        const workflowsDir = createTestWorkflowsDir(baseDir);
        const sprintDir = path.join(baseDir, 'empty-sprint');
        fs.mkdirSync(sprintDir, { recursive: true });
        // Don't create SPRINT.yaml
        const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
        let threwError = false;
        try {
            (0, child_process_1.execSync)(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
                cwd: baseDir,
                encoding: 'utf8',
                stdio: 'pipe'
            });
        }
        catch {
            threwError = true;
        }
        assert(threwError, 'Should throw error when SPRINT.yaml is missing');
    }
    finally {
        cleanupTestDir(baseDir);
    }
});
test('compiler should fail gracefully on invalid workflow reference', async () => {
    const baseDir = createTestDir();
    try {
        const workflowsDir = createTestWorkflowsDir(baseDir);
        const sprintDir = path.join(baseDir, 'invalid-sprint');
        fs.mkdirSync(sprintDir, { recursive: true });
        // Create SPRINT.yaml with invalid workflow reference
        const sprintContent = yaml.dump({
            'sprint-id': 'test',
            name: 'Test',
            workflow: 'nonexistent-workflow',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');
        const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
        let threwError = false;
        try {
            (0, child_process_1.execSync)(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
                cwd: baseDir,
                encoding: 'utf8',
                stdio: 'pipe'
            });
        }
        catch {
            threwError = true;
        }
        assert(threwError, 'Should throw error when workflow is not found');
    }
    finally {
        cleanupTestDir(baseDir);
    }
});
// ============================================================================
// Run Tests
// ============================================================================
// Tests run via setImmediate callback
//# sourceMappingURL=compiler.e2e.test.js.map