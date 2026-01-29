"use strict";
/**
 * Tests for workflow reference expansion (single-phase, no for-each)
 *
 * Feature: Enable referencing another workflow for a single phase
 * This allows workflow composition where a phase can expand an entire
 * workflow's phases inline, prefixed with the parent phase ID.
 *
 * Test Scenarios:
 * 1. Expand workflow reference inline
 * 2. Phase ID prefixing for collision avoidance
 * 3. Mutual exclusivity of prompt and workflow
 * 4. Direct cycle detection (self-reference)
 * 5. Indirect cycle detection (A → B → A)
 * 6. Max depth limit enforcement
 * 7. Mixed phases (inline prompts + workflow references)
 * 8. Nested workflow expansion (within depth limit)
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
const os = __importStar(require("os"));
const yaml = __importStar(require("js-yaml"));
const compile_js_1 = require("./compile.js");
const resolve_workflows_js_1 = require("./resolve-workflows.js");
const validate_js_1 = require("./validate.js");
// =============================================================================
// Test Utilities (following project patterns from validate.test.ts)
// =============================================================================
function test(name, fn) {
    Promise.resolve()
        .then(() => fn())
        .then(() => console.log(`✓ ${name}`)) // intentional
        .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
    });
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertArrayEqual(actual, expected, message) {
    if (actual.length !== expected.length) {
        throw new Error(message ??
            `Array length mismatch: expected ${expected.length}, got ${actual.length}. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    }
    for (let i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new Error(message ??
                `Array mismatch at index ${i}: expected ${JSON.stringify(expected[i])}, got ${JSON.stringify(actual[i])}`);
        }
    }
}
function assertHasError(errors, code, message) {
    const found = errors.find((e) => e.code === code);
    if (!found) {
        throw new Error(message ?? `Expected error with code '${code}', but found: ${errors.map((e) => e.code).join(', ') || 'none'}`);
    }
}
function createTestContext() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-ref-test-'));
    const workflowsDir = path.join(tempDir, '.claude', 'workflows');
    const sprintDir = path.join(tempDir, 'test-sprint');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.mkdirSync(sprintDir, { recursive: true });
    return { tempDir, workflowsDir, sprintDir };
}
function cleanupTestContext(ctx) {
    (0, resolve_workflows_js_1.clearWorkflowCache)();
    try {
        fs.rmSync(ctx.tempDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
function writeWorkflow(ctx, name, workflow) {
    const workflowPath = path.join(ctx.workflowsDir, `${name}.yaml`);
    fs.writeFileSync(workflowPath, yaml.dump(workflow));
}
function writeSprint(ctx, workflow, items) {
    const sprintPath = path.join(ctx.sprintDir, 'SPRINT.yaml');
    fs.writeFileSync(sprintPath, yaml.dump({
        'sprint-id': 'test-sprint',
        name: 'Test Sprint',
        workflow,
        collections: {
            step: items ?? [{ id: 'step-1', prompt: 'Test step' }]
        }
    }));
}
// =============================================================================
// Scenario 1: Expand workflow reference without for-each
// =============================================================================
test('Scenario 1: Workflow reference expands inline phases', async () => {
    const ctx = createTestContext();
    try {
        // Create documentation-workflow with 3 phases
        writeWorkflow(ctx, 'documentation-workflow', {
            name: 'Documentation Workflow',
            phases: [
                { id: 'analyze', prompt: 'Analyze documentation needs' },
                { id: 'user-guide', prompt: 'Update user guide' },
                { id: 'reference', prompt: 'Update reference docs' }
            ]
        });
        // Create test-workflow that references documentation-workflow (NO for-each)
        writeWorkflow(ctx, 'test-workflow', {
            name: 'Test Workflow',
            phases: [
                {
                    id: 'docs',
                    workflow: 'documentation-workflow'
                    // No 'for-each' - this is the new feature!
                }
            ]
        });
        // Create sprint
        writeSprint(ctx, 'test-workflow', [{ prompt: 'Some step' }]);
        // Compile
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        // Assertions
        assert(result.success, `Compilation should succeed, but got errors: ${result.errors.map((e) => e.message).join(', ')}`);
        assert(result.progress !== undefined, 'Progress should be defined');
        assert(result.progress.phases !== undefined, 'Phases should be defined');
        // Get the phase IDs
        const phaseIds = result.progress.phases.map((p) => p.id);
        // Should have expanded phases with prefixed IDs
        assert(phaseIds.includes('docs-analyze'), `Expected 'docs-analyze' phase, got: ${phaseIds.join(', ')}`);
        assert(phaseIds.includes('docs-user-guide'), `Expected 'docs-user-guide' phase, got: ${phaseIds.join(', ')}`);
        assert(phaseIds.includes('docs-reference'), `Expected 'docs-reference' phase, got: ${phaseIds.join(', ')}`);
        // Should NOT have a simple 'docs' phase
        assert(!phaseIds.includes('docs'), `Should not have simple 'docs' phase, got: ${phaseIds.join(', ')}`);
        // Each expanded phase should have a prompt
        const docsAnalyze = result.progress.phases.find((p) => p.id === 'docs-analyze');
        assert(docsAnalyze !== undefined, 'docs-analyze phase should exist');
        assert(docsAnalyze.prompt !== undefined, 'docs-analyze should have a prompt');
        assert(docsAnalyze.prompt.includes('Analyze'), `docs-analyze prompt should contain 'Analyze', got: ${docsAnalyze.prompt}`);
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 2: Phase ID prefixing avoids collisions
// =============================================================================
test('Scenario 2: Phase IDs are prefixed with parent phase ID', async () => {
    const ctx = createTestContext();
    try {
        // Create common-setup workflow
        writeWorkflow(ctx, 'common-setup', {
            name: 'Common Setup',
            phases: [
                { id: 'init', prompt: 'Initialize' },
                { id: 'validate', prompt: 'Validate inputs' },
                { id: 'ready', prompt: 'Ready to proceed' }
            ]
        });
        // Create main workflow with 'setup' phase referencing common-setup
        writeWorkflow(ctx, 'main-workflow', {
            name: 'Main Workflow',
            phases: [
                { id: 'setup', workflow: 'common-setup' }
            ]
        });
        writeSprint(ctx, 'main-workflow', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(result.success, `Compilation should succeed: ${result.errors.map((e) => e.message).join(', ')}`);
        const phaseIds = result.progress.phases.map((p) => p.id);
        // Verify prefixed IDs
        assertArrayEqual(phaseIds, ['setup-init', 'setup-validate', 'setup-ready'], `Expected prefixed phase IDs`);
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 3: Error when both prompt and workflow specified
// =============================================================================
test('Scenario 3: Error when both prompt and workflow specified', () => {
    const workflow = {
        name: 'Invalid Workflow',
        phases: [
            {
                id: 'invalid-phase',
                prompt: 'This is a prompt',
                workflow: 'some-workflow'
                // Both prompt AND workflow - should be invalid!
            }
        ]
    };
    const errors = (0, validate_js_1.validateWorkflowDefinition)(workflow, 'test-workflow');
    assertHasError(errors, 'PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE', 'Should have PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE error');
    // Check error message mentions mutual exclusivity
    const error = errors.find((e) => e.code === 'PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE');
    assert(error.message.toLowerCase().includes('mutual') ||
        error.message.toLowerCase().includes('both') ||
        error.message.toLowerCase().includes('cannot'), `Error message should indicate mutual exclusivity: ${error.message}`);
});
// =============================================================================
// Scenario 4: Direct cycle detection (self-reference)
// =============================================================================
test('Scenario 4: Detect direct workflow self-reference', async () => {
    const ctx = createTestContext();
    try {
        // Create workflow that references itself
        writeWorkflow(ctx, 'workflow-a', {
            name: 'Workflow A',
            phases: [
                { id: 'self-ref', workflow: 'workflow-a' }
            ]
        });
        writeSprint(ctx, 'workflow-a', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(!result.success, 'Compilation should fail due to cycle');
        assertHasError(result.errors, 'CYCLE_DETECTED', 'Should detect cycle');
        const cycleError = result.errors.find((e) => e.code === 'CYCLE_DETECTED');
        assert(cycleError.message.includes('workflow-a'), `Cycle error should mention workflow-a: ${cycleError.message}`);
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 5: Indirect cycle detection (A → B → A)
// =============================================================================
test('Scenario 5: Detect indirect workflow cycle (A → B → A)', async () => {
    const ctx = createTestContext();
    try {
        // Create workflow-a that references workflow-b
        writeWorkflow(ctx, 'workflow-a', {
            name: 'Workflow A',
            phases: [
                { id: 'ref-b', workflow: 'workflow-b' }
            ]
        });
        // Create workflow-b that references workflow-a (creating cycle)
        writeWorkflow(ctx, 'workflow-b', {
            name: 'Workflow B',
            phases: [
                { id: 'ref-a', workflow: 'workflow-a' }
            ]
        });
        writeSprint(ctx, 'workflow-a', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(!result.success, 'Compilation should fail due to cycle');
        assertHasError(result.errors, 'CYCLE_DETECTED', 'Should detect indirect cycle');
        const cycleError = result.errors.find((e) => e.code === 'CYCLE_DETECTED');
        // The cycle path should include both workflows
        const mentionsBoth = cycleError.message.includes('workflow-a') && cycleError.message.includes('workflow-b');
        assert(mentionsBoth, `Cycle error should mention both workflows: ${cycleError.message}`);
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 6: Max depth limit enforcement
// =============================================================================
test('Scenario 6: Enforce maximum workflow nesting depth', async () => {
    const ctx = createTestContext();
    try {
        // Create a chain: a → b → c → d → e → f (depth 6, should exceed limit of 5)
        const workflowNames = ['workflow-a', 'workflow-b', 'workflow-c', 'workflow-d', 'workflow-e', 'workflow-f'];
        for (let i = 0; i < workflowNames.length; i++) {
            const name = workflowNames[i];
            const nextWorkflow = i < workflowNames.length - 1 ? workflowNames[i + 1] : undefined;
            const phases = nextWorkflow
                ? [{ id: `step-${i}`, workflow: nextWorkflow }]
                : [{ id: 'final', prompt: 'Final step' }];
            writeWorkflow(ctx, name, {
                name: `Workflow ${name.toUpperCase()}`,
                phases
            });
        }
        writeSprint(ctx, 'workflow-a', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(!result.success, 'Compilation should fail due to max depth exceeded');
        assertHasError(result.errors, 'MAX_DEPTH_EXCEEDED', 'Should enforce max depth');
        const depthError = result.errors.find((e) => e.code === 'MAX_DEPTH_EXCEEDED');
        assert(depthError.message.includes('5') || depthError.message.toLowerCase().includes('depth'), `Error should mention depth limit: ${depthError.message}`);
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 7: Mixed phases (inline prompts + workflow references)
// =============================================================================
test('Scenario 7: Mixed inline and workflow-reference phases', async () => {
    const ctx = createTestContext();
    try {
        // Create documentation-workflow
        writeWorkflow(ctx, 'documentation-workflow', {
            name: 'Documentation Workflow',
            phases: [
                { id: 'analyze', prompt: 'Analyze docs' },
                { id: 'reference', prompt: 'Update reference' }
            ]
        });
        // Create main workflow with mixed phases
        writeWorkflow(ctx, 'mixed-workflow', {
            name: 'Mixed Workflow',
            phases: [
                { id: 'setup', prompt: 'Setup phase' },
                { id: 'docs', workflow: 'documentation-workflow' },
                { id: 'cleanup', prompt: 'Cleanup phase' }
            ]
        });
        writeSprint(ctx, 'mixed-workflow', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(result.success, `Compilation should succeed: ${result.errors.map((e) => e.message).join(', ')}`);
        const phaseIds = result.progress.phases.map((p) => p.id);
        // Verify order: setup, docs-analyze, docs-reference, cleanup
        assertArrayEqual(phaseIds, ['setup', 'docs-analyze', 'docs-reference', 'cleanup'], 'Phases should be in correct order');
        // Verify inline phases have prompts
        const setupPhase = result.progress.phases.find((p) => p.id === 'setup');
        assert(setupPhase !== undefined, 'Setup phase should exist');
        assert(setupPhase.prompt !== undefined && setupPhase.prompt.includes('Setup'), 'Setup should have inline prompt');
        const cleanupPhase = result.progress.phases.find((p) => p.id === 'cleanup');
        assert(cleanupPhase !== undefined, 'Cleanup phase should exist');
        assert(cleanupPhase.prompt !== undefined && cleanupPhase.prompt.includes('Cleanup'), 'Cleanup should have inline prompt');
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Scenario 8: Nested workflow expansion (workflow within workflow)
// =============================================================================
test('Scenario 8: Nested workflow references within depth limit', async () => {
    const ctx = createTestContext();
    try {
        // Create child-workflow (deepest level)
        writeWorkflow(ctx, 'child-workflow', {
            name: 'Child Workflow',
            phases: [
                { id: 'step1', prompt: 'Child step 1' },
                { id: 'step2', prompt: 'Child step 2' }
            ]
        });
        // Create parent-workflow that references child-workflow
        writeWorkflow(ctx, 'parent-workflow', {
            name: 'Parent Workflow',
            phases: [
                { id: 'prep', prompt: 'Prepare' },
                { id: 'child-ref', workflow: 'child-workflow' }
            ]
        });
        // Create main-workflow that references parent-workflow
        writeWorkflow(ctx, 'main-workflow', {
            name: 'Main Workflow',
            phases: [
                { id: 'parent', workflow: 'parent-workflow' }
            ]
        });
        writeSprint(ctx, 'main-workflow', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(result.success, `Compilation should succeed: ${result.errors.map((e) => e.message).join(', ')}`);
        const phaseIds = result.progress.phases.map((p) => p.id);
        // Should have nested prefixed IDs
        // parent → prep, child-ref
        // child-ref → step1, step2
        // So: parent-prep, parent-child-ref-step1, parent-child-ref-step2
        assertArrayEqual(phaseIds, ['parent-prep', 'parent-child-ref-step1', 'parent-child-ref-step2'], 'Nested phases should have cumulative prefixes');
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Additional Edge Case Tests
// =============================================================================
test('Edge case: Empty workflow reference should error', async () => {
    const ctx = createTestContext();
    try {
        // Create empty workflow
        writeWorkflow(ctx, 'empty-workflow', {
            name: 'Empty Workflow',
            phases: []
        });
        writeWorkflow(ctx, 'main-workflow', {
            name: 'Main',
            phases: [{ id: 'ref', workflow: 'empty-workflow' }]
        });
        writeSprint(ctx, 'main-workflow', [{ prompt: 'Test' }]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        // Should either fail or handle gracefully
        // Empty workflow is already validated separately, but expanding it should handle edge case
        assert(!result.success || (result.progress?.phases?.length ?? 0) === 0, 'Should handle empty workflow reference');
    }
    finally {
        cleanupTestContext(ctx);
    }
});
test('Edge case: Workflow reference with for-each should still work (existing behavior)', async () => {
    const ctx = createTestContext();
    try {
        // This tests that existing for-each + workflow behavior is preserved
        writeWorkflow(ctx, 'step-workflow', {
            name: 'Step Workflow',
            phases: [
                { id: 'red', prompt: 'Write tests for {{step.prompt}}' },
                { id: 'green', prompt: 'Implement {{step.prompt}}' }
            ]
        });
        writeWorkflow(ctx, 'main-workflow', {
            name: 'Main',
            phases: [
                {
                    id: 'development',
                    'for-each': 'step',
                    workflow: 'step-workflow'
                }
            ]
        });
        writeSprint(ctx, 'main-workflow', [
            { id: 'feat-1', prompt: 'Feature 1' },
            { id: 'feat-2', prompt: 'Feature 2' }
        ]);
        const result = await (0, compile_js_1.compile)({
            sprintDir: ctx.sprintDir,
            workflowsDir: ctx.workflowsDir
        });
        assert(result.success, `Compilation should succeed: ${result.errors.map((e) => e.message).join(', ')}`);
        // Should have steps with sub-phases (existing for-each behavior)
        assert(result.progress?.phases?.[0]?.steps !== undefined, 'Should have steps for for-each');
        assertEqual(result.progress.phases[0].steps.length, 2, 'Should have 2 steps');
    }
    finally {
        cleanupTestContext(ctx);
    }
});
// =============================================================================
// Run Tests
// =============================================================================
console.log('='.repeat(60)); // intentional
console.log('Testing workflow reference expansion (single-phase, no for-each)'); // intentional
console.log('='.repeat(60)); // intentional
console.log(''); // intentional
console.log('These tests define expected behavior for the new feature.'); // intentional
console.log('Expected: Tests should FAIL until implementation is complete.'); // intentional
console.log(''); // intentional
//# sourceMappingURL=workflow-reference.test.js.map