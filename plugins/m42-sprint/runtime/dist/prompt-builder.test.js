/**
 * Tests for prompt-builder module - Prompt generation for sprint execution
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './prompt-builder.js' (until implementation exists)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// Import from prompt-builder.js - this will fail until implementation exists
// This is the expected RED phase behavior
import { buildPrompt, buildParallelPrompt, substituteVariables, loadContextFiles, DEFAULT_PROMPTS, } from './prompt-builder.js';
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
function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(message ?? `Expected text to contain "${substring}", but it did not`);
    }
}
function assertNotContains(text, substring, message) {
    if (text.includes(substring)) {
        throw new Error(message ?? `Expected text NOT to contain "${substring}", but it did`);
    }
}
function assertMatches(text, pattern, message) {
    if (!pattern.test(text)) {
        throw new Error(message ?? `Expected text to match ${pattern}, but it did not`);
    }
}
function createTestDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-builder-test-'));
    const sprintDir = tempDir;
    return {
        tempDir,
        sprintDir,
        progressFile: path.join(sprintDir, 'PROGRESS.yaml'),
        contextDir: path.join(sprintDir, 'context'),
    };
}
function cleanupTestDir(ctx) {
    try {
        fs.rmSync(ctx.tempDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
// Note: Types are defined locally above instead of importing from yaml-ops.js
// This provides the full type definitions needed for testing
/**
 * Create a minimal progress object for simple phase testing
 */
function createSimplePhaseProgress() {
    return {
        'sprint-id': 'test-sprint-2026',
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 0,
            'current-iteration': 1,
        },
        phases: [
            {
                id: 'prepare',
                status: 'in-progress',
                prompt: 'Prepare the environment for development',
            },
            {
                id: 'cleanup',
                status: 'pending',
                prompt: 'Clean up resources',
            },
        ],
    };
}
/**
 * Create a progress object with for-each phase and sub-phases
 */
function createForEachProgress() {
    return {
        'sprint-id': 'tdd-sprint-2026',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 1,
            'completed-phases': 0,
            'current-iteration': 3,
            'total-steps': 3,
            'completed-steps': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'feature-a',
                        prompt: 'Implement feature A - user authentication',
                        status: 'completed',
                        phases: [
                            { id: 'red', prompt: 'Write failing tests', status: 'completed' },
                            { id: 'green', prompt: 'Implement to pass tests', status: 'completed' },
                            { id: 'refactor', prompt: 'Refactor code', status: 'completed' },
                        ],
                    },
                    {
                        id: 'feature-b',
                        prompt: 'Implement feature B - data validation',
                        status: 'in-progress',
                        phases: [
                            { id: 'red', prompt: 'Write failing tests for validation', status: 'in-progress' },
                            { id: 'green', prompt: 'Implement validation logic', status: 'pending' },
                            { id: 'refactor', prompt: 'Clean up validation code', status: 'pending' },
                        ],
                    },
                    {
                        id: 'feature-c',
                        prompt: 'Implement feature C - API endpoints',
                        status: 'pending',
                        phases: [
                            { id: 'red', prompt: 'Write failing API tests', status: 'pending' },
                            { id: 'green', prompt: 'Implement API handlers', status: 'pending' },
                            { id: 'refactor', prompt: 'Optimize API code', status: 'pending' },
                        ],
                    },
                ],
            },
        ],
    };
}
/**
 * Create a progress object with retry information
 */
function createRetryProgress() {
    const progress = createForEachProgress();
    const step = progress.phases[0].steps[1];
    const subPhase = step.phases[0];
    subPhase['retry-count'] = 2;
    subPhase.error = 'Test failed: assertion error in validateEmail()';
    return progress;
}
// ============================================================================
// Test: substituteVariables
// ============================================================================
console.log('\n=== substituteVariables Tests ===\n');
test('substituteVariables: replaces sprint-id variable', () => {
    const context = {
        sprintId: 'my-sprint-2026',
        iteration: 5,
        phase: { id: 'build', index: 0, total: 3 },
        step: null,
        subPhase: null,
        retryCount: 0,
        error: null,
    };
    const template = 'Sprint: {{sprint-id}}';
    const result = substituteVariables(template, context);
    assertContains(result, 'my-sprint-2026');
});
test('substituteVariables: replaces iteration variable', () => {
    const context = {
        sprintId: 'test',
        iteration: 42,
        phase: { id: 'build', index: 0, total: 1 },
        step: null,
        subPhase: null,
        retryCount: 0,
        error: null,
    };
    const template = 'Iteration: {{iteration}}';
    const result = substituteVariables(template, context);
    assertContains(result, '42');
});
test('substituteVariables: replaces phase variables', () => {
    const context = {
        sprintId: 'test',
        iteration: 1,
        phase: { id: 'development', index: 1, total: 5 },
        step: null,
        subPhase: null,
        retryCount: 0,
        error: null,
    };
    const template = 'Phase: {{phase.id}} ({{phase.index}}/{{phase.total}})';
    const result = substituteVariables(template, context);
    assertContains(result, 'development');
    assertContains(result, '2/5'); // index is 0-based, display is 1-based
});
test('substituteVariables: replaces step variables when present', () => {
    const context = {
        sprintId: 'test',
        iteration: 1,
        phase: { id: 'dev', index: 0, total: 1 },
        step: { id: 'feature-x', prompt: 'Build feature X', index: 2, total: 10 },
        subPhase: null,
        retryCount: 0,
        error: null,
    };
    const template = 'Step: {{step.id}} ({{step.index}}/{{step.total}})';
    const result = substituteVariables(template, context);
    assertContains(result, 'feature-x');
    assertContains(result, '3/10'); // 0-based to 1-based
});
test('substituteVariables: replaces sub-phase variables when present', () => {
    const context = {
        sprintId: 'test',
        iteration: 1,
        phase: { id: 'dev', index: 0, total: 1 },
        step: { id: 'step', prompt: 'Step prompt', index: 0, total: 1 },
        subPhase: { id: 'red', index: 0, total: 3 },
        retryCount: 0,
        error: null,
    };
    const template = 'Sub-phase: {{sub-phase.id}} ({{sub-phase.index}}/{{sub-phase.total}})';
    const result = substituteVariables(template, context);
    assertContains(result, 'red');
    assertContains(result, '1/3');
});
test('substituteVariables: replaces retry-count variable', () => {
    const context = {
        sprintId: 'test',
        iteration: 1,
        phase: { id: 'test', index: 0, total: 1 },
        step: null,
        subPhase: null,
        retryCount: 3,
        error: 'Previous error message',
    };
    const template = 'Retry: {{retry-count}}';
    const result = substituteVariables(template, context);
    assertContains(result, '3');
});
test('substituteVariables: replaces error variable', () => {
    const context = {
        sprintId: 'test',
        iteration: 1,
        phase: { id: 'test', index: 0, total: 1 },
        step: null,
        subPhase: null,
        retryCount: 1,
        error: 'Connection timeout after 30s',
    };
    const template = 'Error: {{error}}';
    const result = substituteVariables(template, context);
    assertContains(result, 'Connection timeout after 30s');
});
test('substituteVariables: no unsubstituted patterns remain', () => {
    const context = {
        sprintId: 'complete-sprint',
        iteration: 7,
        phase: { id: 'phase-1', index: 2, total: 5 },
        step: { id: 'step-a', prompt: 'Do stuff', index: 3, total: 8 },
        subPhase: { id: 'sub-1', index: 1, total: 4 },
        retryCount: 2,
        error: 'Some error',
    };
    const template = `
    Sprint: {{sprint-id}}
    Iteration: {{iteration}}
    Phase: {{phase.id}} ({{phase.index}}/{{phase.total}})
    Step: {{step.id}} ({{step.index}}/{{step.total}})
    Sub: {{sub-phase.id}} ({{sub-phase.index}}/{{sub-phase.total}})
    Retry: {{retry-count}}
    Error: {{error}}
  `;
    const result = substituteVariables(template, context);
    assertNotContains(result, '{{', 'No unsubstituted patterns should remain');
});
// ============================================================================
// Test: buildPrompt - Simple Phase
// ============================================================================
console.log('\n=== buildPrompt Simple Phase Tests ===\n');
test('buildPrompt: simple phase generates correct structure', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        fs.writeFileSync(ctx.progressFile, ''); // Create empty file
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '# Sprint', 'Should have header');
        assertContains(result, '## Current Position', 'Should have position section');
        assertContains(result, '## Your Task', 'Should have task section');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: simple phase includes sprint ID in header', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, 'test-sprint-2026', 'Should include sprint ID');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: simple phase includes Your Task section', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Your Task', 'Should have Your Task section');
        assertContains(result, 'Prepare the environment', 'Should include phase prompt');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: simple phase does NOT include step indicators', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertNotContains(result, '- Step:', 'Should not have step indicator');
        assertNotContains(result, '## Step Context', 'Should not have step context');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildPrompt - For-Each Phase with Sub-Phases
// ============================================================================
console.log('\n=== buildPrompt For-Each Phase Tests ===\n');
test('buildPrompt: for-each phase includes Step Context', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Step Context', 'Should have Step Context section');
        assertContains(result, 'Implement feature B', 'Should include step prompt');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: for-each phase shows sub-phase task', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Your Task: red', 'Should show sub-phase ID in task header');
        assertContains(result, 'Write failing tests', 'Should include sub-phase prompt');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: for-each phase shows position hierarchy', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '**development**', 'Should show phase ID');
        assertContains(result, '**feature-b**', 'Should show step ID');
        assertContains(result, '**red**', 'Should show sub-phase ID');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: for-each phase includes iteration count', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, 'Iteration: 3', 'Should show iteration number');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildPrompt - Custom Prompts
// ============================================================================
console.log('\n=== buildPrompt Custom Prompts Tests ===\n');
test('buildPrompt: custom prompts override header', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const customPrompts = {
            header: '# My Custom Sprint Header\nCustom description here.',
        };
        const result = buildPrompt(progress, ctx.sprintDir, customPrompts);
        assertContains(result, '# My Custom Sprint Header', 'Should use custom header');
        assertContains(result, 'Custom description here', 'Should include custom content');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: custom prompts override instructions', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const customPrompts = {
            instructions: '## Custom Instructions\n1. Do step one\n2. Do step two',
        };
        const result = buildPrompt(progress, ctx.sprintDir, customPrompts);
        assertContains(result, '## Custom Instructions', 'Should use custom instructions');
        assertContains(result, 'Do step one', 'Should include custom instruction content');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: custom prompts override result-reporting', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const customPrompts = {
            'result-reporting': '## Custom Result Format\nUse XML instead.',
        };
        const result = buildPrompt(progress, ctx.sprintDir, customPrompts);
        assertContains(result, '## Custom Result Format', 'Should use custom result reporting');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: falls back to defaults when custom prompts partial', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const customPrompts = {
            header: '# Custom Header Only',
            // instructions not specified - should use default
        };
        const result = buildPrompt(progress, ctx.sprintDir, customPrompts);
        assertContains(result, '# Custom Header Only', 'Should use custom header');
        assertContains(result, '## Instructions', 'Should fall back to default instructions');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildPrompt - Retry Warning
// ============================================================================
console.log('\n=== buildPrompt Retry Warning Tests ===\n');
test('buildPrompt: includes retry warning when retry-count > 0', () => {
    const ctx = createTestDir();
    try {
        const progress = createRetryProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Warning: RETRY ATTEMPT', 'Should have retry warning');
        assertContains(result, '2', 'Should show retry count');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: retry warning includes error message', () => {
    const ctx = createTestDir();
    try {
        const progress = createRetryProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, 'assertion error', 'Should include error message');
        assertContains(result, 'validateEmail', 'Should include error details');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: no retry warning when retry-count is 0', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress(); // No retry info
        const result = buildPrompt(progress, ctx.sprintDir);
        assertNotContains(result, 'RETRY ATTEMPT', 'Should not have retry warning');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildPrompt - Context Files
// ============================================================================
console.log('\n=== buildPrompt Context Files Tests ===\n');
test('buildPrompt: loads context files from sprint directory', () => {
    const ctx = createTestDir();
    try {
        // Create context directory and file
        fs.mkdirSync(ctx.contextDir, { recursive: true });
        fs.writeFileSync(path.join(ctx.contextDir, '_shared.md'), '## Shared Context\n\nProject uses TypeScript and follows TDD.');
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Shared Context', 'Should include context content');
        assertContains(result, 'TypeScript', 'Should include context details');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: handles missing context directory gracefully', () => {
    const ctx = createTestDir();
    try {
        // No context directory
        const progress = createSimplePhaseProgress();
        // Should not throw
        const result = buildPrompt(progress, ctx.sprintDir);
        assert(result.length > 0, 'Should generate prompt without context');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('loadContextFiles: returns empty string for missing directory', () => {
    const result = loadContextFiles('/nonexistent/path/context');
    assertEqual(result, '', 'Should return empty string');
});
test('loadContextFiles: loads _shared.md file', () => {
    const ctx = createTestDir();
    try {
        fs.mkdirSync(ctx.contextDir, { recursive: true });
        fs.writeFileSync(path.join(ctx.contextDir, '_shared.md'), '# Shared\nContent here');
        const result = loadContextFiles(ctx.contextDir);
        assertContains(result, '# Shared', 'Should load _shared.md content');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildParallelPrompt
// ============================================================================
console.log('\n=== buildParallelPrompt Tests ===\n');
test('buildParallelPrompt: generates parallel task header', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'task-001');
        assertContains(result, '# Parallel Task Execution', 'Should have parallel header');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildParallelPrompt: includes task ID', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'parallel-abc-123');
        assertContains(result, 'Task ID: parallel-abc-123', 'Should include task ID');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildParallelPrompt: includes step context', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'task-001');
        assertContains(result, 'Implement feature B', 'Should include step prompt');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildParallelPrompt: includes sub-phase prompt', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'task-001');
        assertContains(result, 'Write failing tests', 'Should include sub-phase prompt');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildParallelPrompt: includes simplified result reporting', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'task-001');
        assertContains(result, '## Result Reporting', 'Should have result section');
        assertContains(result, 'Do NOT modify PROGRESS.yaml', 'Should warn about not modifying');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildParallelPrompt: does NOT include progress file modification instructions', () => {
    const ctx = createTestDir();
    try {
        const progress = createForEachProgress();
        const result = buildParallelPrompt(progress, ctx.sprintDir, 0, 1, 0, 'task-001');
        assertNotContains(result, 'main workflow continues', 'Should mention background execution');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: buildPrompt - Result Reporting Section
// ============================================================================
console.log('\n=== buildPrompt Result Reporting Tests ===\n');
test('buildPrompt: includes result reporting section', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '## Result Reporting', 'Should have result reporting section');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: result reporting includes JSON examples', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '```json', 'Should have JSON code blocks');
        assertContains(result, '"status":', 'Should have status field example');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: result reporting includes all status options', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, '"completed"', 'Should mention completed status');
        assertContains(result, '"failed"', 'Should mention failed status');
        assertContains(result, '"needs-human"', 'Should mention needs-human status');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: result reporting warns against PROGRESS.yaml modification', () => {
    const ctx = createTestDir();
    try {
        const progress = createSimplePhaseProgress();
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, 'Do NOT modify PROGRESS.yaml', 'Should warn about not modifying');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: DEFAULT_PROMPTS
// ============================================================================
console.log('\n=== DEFAULT_PROMPTS Tests ===\n');
test('DEFAULT_PROMPTS: has header template', () => {
    assert(typeof DEFAULT_PROMPTS.header === 'string', 'Should have header');
    assertContains(DEFAULT_PROMPTS.header, 'Sprint', 'Header should mention Sprint');
});
test('DEFAULT_PROMPTS: has position template', () => {
    assert(typeof DEFAULT_PROMPTS.position === 'string', 'Should have position');
    assertContains(DEFAULT_PROMPTS.position, 'Phase', 'Position should mention Phase');
});
test('DEFAULT_PROMPTS: has instructions template', () => {
    assert(typeof DEFAULT_PROMPTS.instructions === 'string', 'Should have instructions');
});
test('DEFAULT_PROMPTS: has result-reporting template', () => {
    assert(typeof DEFAULT_PROMPTS['result-reporting'] === 'string', 'Should have result-reporting');
    assertContains(DEFAULT_PROMPTS['result-reporting'], 'JSON', 'Should mention JSON');
});
test('DEFAULT_PROMPTS: has retry-warning template', () => {
    assert(typeof DEFAULT_PROMPTS['retry-warning'] === 'string', 'Should have retry-warning');
    assertContains(DEFAULT_PROMPTS['retry-warning'], 'RETRY', 'Should mention RETRY');
});
// ============================================================================
// Test: Edge Cases
// ============================================================================
console.log('\n=== Edge Cases Tests ===\n');
test('buildPrompt: handles empty phases array', () => {
    const ctx = createTestDir();
    try {
        const progress = {
            'sprint-id': 'empty-sprint',
            status: 'not-started',
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: { 'started-at': null, 'total-phases': 0, 'completed-phases': 0 },
            phases: [],
        };
        // Should return empty or throw meaningful error
        let result;
        try {
            result = buildPrompt(progress, ctx.sprintDir);
            assertEqual(result, '', 'Empty phases should return empty prompt');
        }
        catch (error) {
            // Also acceptable: throw meaningful error
            assert(error instanceof Error, 'Should throw Error');
        }
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: handles missing optional fields', () => {
    const ctx = createTestDir();
    try {
        const progress = {
            'sprint-id': 'minimal',
            status: 'in-progress',
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 },
            phases: [
                {
                    id: 'test',
                    status: 'pending',
                    prompt: 'Do something',
                    // No retry-count, no error
                },
            ],
        };
        // Should not throw
        const result = buildPrompt(progress, ctx.sprintDir);
        assert(result.length > 0, 'Should generate prompt');
        assertNotContains(result, 'RETRY', 'Should not have retry section');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: handles special characters in prompts', () => {
    const ctx = createTestDir();
    try {
        const progress = {
            'sprint-id': 'special-chars',
            status: 'in-progress',
            current: { phase: 0, step: null, 'sub-phase': null },
            stats: { 'started-at': null, 'total-phases': 1, 'completed-phases': 0 },
            phases: [
                {
                    id: 'test',
                    status: 'pending',
                    prompt: 'Handle $special {{vars}} & <tags> "quotes"',
                },
            ],
        };
        const result = buildPrompt(progress, ctx.sprintDir);
        // Should preserve special characters in prompt
        assertContains(result, '$special', 'Should preserve $');
        assertContains(result, '& <tags>', 'Should preserve & and <');
        assertContains(result, '"quotes"', 'Should preserve quotes');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('buildPrompt: phase index at end of phases', () => {
    const ctx = createTestDir();
    try {
        const progress = {
            'sprint-id': 'last-phase',
            status: 'in-progress',
            current: { phase: 2, step: null, 'sub-phase': null },
            stats: { 'started-at': null, 'total-phases': 3, 'completed-phases': 2 },
            phases: [
                { id: 'p0', status: 'completed', prompt: 'Phase 0' },
                { id: 'p1', status: 'completed', prompt: 'Phase 1' },
                { id: 'p2', status: 'in-progress', prompt: 'Phase 2 - Last one' },
            ],
        };
        const result = buildPrompt(progress, ctx.sprintDir);
        assertContains(result, 'Phase 2 - Last one', 'Should get correct phase prompt');
        assertContains(result, '3/3', 'Should show correct position (3/3)');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=prompt-builder.test.js.map