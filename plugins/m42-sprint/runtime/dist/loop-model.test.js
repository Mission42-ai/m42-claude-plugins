/**
 * Tests for Model Selection in Runtime Loop
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the model selection feature is implemented.
 *
 * The runtime loop should:
 * 1. Read the `model` field from the current phase in PROGRESS.yaml
 * 2. Pass the model to claude-runner when invoking Claude CLI
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { runLoop } from './loop.js';
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
function createMockClaudeRunner() {
    const calls = [];
    return {
        calls,
        runClaude: async (options) => {
            calls.push(options);
            return {
                success: true,
                output: '{"status": "completed", "summary": "Phase completed"}',
                exitCode: 0,
                jsonResult: { status: 'completed', summary: 'Phase completed' }
            };
        }
    };
}
function createTestEnv() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-model-test-'));
    const progressPath = path.join(tempDir, 'PROGRESS.yaml');
    return {
        sprintDir: tempDir,
        progressPath,
        cleanup: () => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch {
                // Ignore cleanup errors
            }
        }
    };
}
function writeProgress(progressPath, progress) {
    const content = yaml.dump(progress, { lineWidth: -1, noRefs: true });
    fs.writeFileSync(progressPath, content);
    // Write checksum file (sha256 to match yaml-ops)
    const checksum = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    fs.writeFileSync(`${progressPath}.checksum`, checksum);
}
// ============================================================================
// Test: Loop Passes Model to Claude Runner
// ============================================================================
console.log('\n=== Loop Model Passing Tests ===\n');
test('loop: passes model from phase to claude-runner', async () => {
    const env = createTestEnv();
    const mockRunner = createMockClaudeRunner();
    try {
        // Create PROGRESS.yaml with a phase that has model: opus
        const progress = {
            'sprint-id': 'test-sprint',
            status: 'not-started',
            phases: [
                {
                    id: 'phase-1',
                    status: 'pending',
                    prompt: 'Test phase prompt',
                    model: 'opus' // Model specified on phase
                }
            ],
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: {
                'started-at': null,
                'total-phases': 1,
                'completed-phases': 0
            }
        };
        writeProgress(env.progressPath, progress);
        // Run the loop with mock runner
        await runLoop(env.sprintDir, { maxIterations: 1 }, { runClaude: mockRunner.runClaude });
        // Verify claude-runner was called with model option
        assert(mockRunner.calls.length >= 1, 'runClaude should have been called');
        const firstCall = mockRunner.calls[0];
        assertEqual(firstCall.model, 'opus', 'Should pass model: opus to claude-runner');
    }
    finally {
        env.cleanup();
    }
});
test('loop: passes different models for different phases', async () => {
    const env = createTestEnv();
    const mockRunner = createMockClaudeRunner();
    try {
        // Create PROGRESS.yaml with phases having different models
        const progress = {
            'sprint-id': 'test-sprint',
            status: 'not-started',
            phases: [
                {
                    id: 'phase-1',
                    status: 'pending',
                    prompt: 'Phase 1 prompt',
                    model: 'sonnet'
                },
                {
                    id: 'phase-2',
                    status: 'pending',
                    prompt: 'Phase 2 prompt',
                    model: 'opus'
                }
            ],
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: {
                'started-at': null,
                'total-phases': 2,
                'completed-phases': 0
            }
        };
        writeProgress(env.progressPath, progress);
        // Run the loop for 2 iterations
        await runLoop(env.sprintDir, { maxIterations: 2 }, { runClaude: mockRunner.runClaude });
        // Verify both calls had correct models
        assert(mockRunner.calls.length >= 2, 'runClaude should have been called at least twice');
        assertEqual(mockRunner.calls[0].model, 'sonnet', 'First call should use sonnet');
        assertEqual(mockRunner.calls[1].model, 'opus', 'Second call should use opus');
    }
    finally {
        env.cleanup();
    }
});
test('loop: does not pass model when phase has no model', async () => {
    const env = createTestEnv();
    const mockRunner = createMockClaudeRunner();
    try {
        // Create PROGRESS.yaml with phase without model
        const progress = {
            'sprint-id': 'test-sprint',
            status: 'not-started',
            phases: [
                {
                    id: 'phase-1',
                    status: 'pending',
                    prompt: 'Phase without model'
                    // No model field
                }
            ],
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: {
                'started-at': null,
                'total-phases': 1,
                'completed-phases': 0
            }
        };
        writeProgress(env.progressPath, progress);
        // Run the loop
        await runLoop(env.sprintDir, { maxIterations: 1 }, { runClaude: mockRunner.runClaude });
        // Verify claude-runner was called without model
        assert(mockRunner.calls.length >= 1, 'runClaude should have been called');
        const firstCall = mockRunner.calls[0];
        assertEqual(firstCall.model, undefined, 'Should not pass model when phase has no model');
    }
    finally {
        env.cleanup();
    }
});
test('loop: passes model from sub-phase in for-each step', async () => {
    const env = createTestEnv();
    const mockRunner = createMockClaudeRunner();
    try {
        // Create PROGRESS.yaml with steps containing sub-phases with models
        const progress = {
            'sprint-id': 'test-sprint',
            status: 'not-started',
            phases: [
                {
                    id: 'develop',
                    status: 'pending',
                    steps: [
                        {
                            id: 'step-1',
                            prompt: 'Step 1 prompt',
                            status: 'pending',
                            phases: [
                                {
                                    id: 'step-1-sub-1',
                                    status: 'pending',
                                    prompt: 'Sub-phase prompt',
                                    model: 'haiku' // Model on sub-phase
                                }
                            ]
                        }
                    ]
                }
            ],
            current: { phase: 0, step: 0, 'sub-phase': 0 },
            stats: {
                'started-at': null,
                'total-phases': 1,
                'completed-phases': 0
            }
        };
        writeProgress(env.progressPath, progress);
        // Run the loop
        await runLoop(env.sprintDir, { maxIterations: 1 }, { runClaude: mockRunner.runClaude });
        // Verify claude-runner was called with model from sub-phase
        assert(mockRunner.calls.length >= 1, 'runClaude should have been called');
        const firstCall = mockRunner.calls[0];
        assertEqual(firstCall.model, 'haiku', 'Should pass model from sub-phase');
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Loop Model Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=loop-model.test.js.map