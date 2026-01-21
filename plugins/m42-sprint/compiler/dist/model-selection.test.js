"use strict";
/**
 * Tests for Model Selection Feature
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the model selection feature is implemented.
 *
 * Model selection allows setting the Claude model (sonnet, opus, haiku) at different levels:
 * - workflow (default for all phases)
 * - sprint (overrides workflow)
 * - phase (overrides sprint)
 * - step (overrides phase) - highest priority
 *
 * Override priority: step > phase > sprint > workflow
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
function createTestEnv() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-selection-test-'));
    const workflowsDir = path.join(tempDir, '.claude', 'workflows');
    const sprintDir = path.join(tempDir, 'test-sprint');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.mkdirSync(sprintDir, { recursive: true });
    return {
        tempDir,
        workflowsDir,
        sprintDir,
        cleanup: () => {
            (0, resolve_workflows_js_1.clearWorkflowCache)();
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch {
                // Ignore cleanup errors
            }
        }
    };
}
function writeWorkflow(workflowsDir, name, content) {
    const workflowPath = path.join(workflowsDir, `${name}.yaml`);
    fs.writeFileSync(workflowPath, yaml.dump(content));
}
function writeSprint(sprintDir, content) {
    const sprintPath = path.join(sprintDir, 'SPRINT.yaml');
    fs.writeFileSync(sprintPath, yaml.dump(content));
}
// ============================================================================
// Test: Workflow-Level Model
// ============================================================================
console.log('\n=== Workflow-Level Model Tests ===\n');
test('compile: workflow-level model is applied to all phases', async () => {
    const env = createTestEnv();
    try {
        // Create workflow with model: sonnet
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            model: 'sonnet',
            phases: [
                { id: 'phase1', prompt: 'Phase 1 prompt' },
                { id: 'phase2', prompt: 'Phase 2 prompt' }
            ]
        });
        // Create sprint referencing the workflow
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            steps: [{ id: 'step-1', prompt: 'Test step' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, `Compilation failed: ${result.errors.map(e => e.message).join(', ')}`);
        assert(result.progress !== undefined, 'Progress should be defined');
        const progress = result.progress;
        assert(progress.phases !== undefined, 'Phases should be defined');
        // All phases should have model: sonnet from workflow
        for (const phase of progress.phases ?? []) {
            // Type assertion for model field (not yet in types)
            const phaseWithModel = phase;
            assertEqual(phaseWithModel.model, 'sonnet', `Phase ${phase.id} should have model: sonnet`);
        }
    }
    finally {
        env.cleanup();
    }
});
test('compile: phases without explicit model inherit workflow model', async () => {
    const env = createTestEnv();
    try {
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            model: 'haiku',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' },
                { id: 'phase2', prompt: 'Phase 2' }
            ]
        });
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        for (const phase of progress.phases ?? []) {
            const phaseWithModel = phase;
            assertEqual(phaseWithModel.model, 'haiku', `Phase ${phase.id} should inherit haiku`);
        }
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: Sprint-Level Model Override
// ============================================================================
console.log('\n=== Sprint-Level Model Override Tests ===\n');
test('compile: sprint-level model overrides workflow-level model', async () => {
    const env = createTestEnv();
    try {
        // Workflow has model: haiku
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            model: 'haiku',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' },
                { id: 'phase2', prompt: 'Phase 2' }
            ]
        });
        // Sprint has model: sonnet (should override)
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            model: 'sonnet',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        for (const phase of progress.phases ?? []) {
            const phaseWithModel = phase;
            assertEqual(phaseWithModel.model, 'sonnet', `Phase ${phase.id} should have sprint model: sonnet`);
        }
    }
    finally {
        env.cleanup();
    }
});
test('compile: sprint model applies when workflow has no model', async () => {
    const env = createTestEnv();
    try {
        // Workflow without model
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' }
            ]
        });
        // Sprint has model: opus
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            model: 'opus',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        for (const phase of progress.phases ?? []) {
            const phaseWithModel = phase;
            assertEqual(phaseWithModel.model, 'opus', `Phase ${phase.id} should have sprint model: opus`);
        }
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: Phase-Level Model Override
// ============================================================================
console.log('\n=== Phase-Level Model Override Tests ===\n');
test('compile: phase-level model overrides sprint-level model', async () => {
    const env = createTestEnv();
    try {
        // Workflow with one phase having explicit model
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            phases: [
                { id: 'standard-phase', prompt: 'Standard phase' },
                { id: 'explicit-phase', prompt: 'Explicit phase', model: 'opus' }
            ]
        });
        // Sprint has model: sonnet
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            model: 'sonnet',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        const standardPhase = progress.phases?.find(p => p.id === 'standard-phase');
        const explicitPhase = progress.phases?.find(p => p.id === 'explicit-phase');
        assertEqual(standardPhase?.model, 'sonnet', 'Standard phase should inherit sprint model');
        assertEqual(explicitPhase?.model, 'opus', 'Explicit phase should use its own model');
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: Step-Level Model Override (Highest Priority)
// ============================================================================
console.log('\n=== Step-Level Model Override Tests ===\n');
test('compile: step-level model has highest priority', async () => {
    const env = createTestEnv();
    try {
        // Workflow for step expansion
        writeWorkflow(env.workflowsDir, 'step-workflow', {
            name: 'step-workflow',
            model: 'haiku',
            phases: [
                { id: 'sub-phase-1', prompt: 'Sub-phase 1' },
                { id: 'sub-phase-2', prompt: 'Sub-phase 2' }
            ]
        });
        // Main workflow with for-each step
        writeWorkflow(env.workflowsDir, 'main-workflow', {
            name: 'main-workflow',
            model: 'sonnet',
            phases: [
                { id: 'develop', 'for-each': 'step', workflow: 'step-workflow' }
            ]
        });
        // Sprint with step that has model: opus
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'main-workflow',
            steps: [
                { id: 'step-1', prompt: 'Step without model' },
                { id: 'step-2', prompt: 'Step with model', model: 'opus' }
            ]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        // Find the for-each phase with steps
        const developPhase = progress.phases?.find(p => p.id === 'develop');
        assert(developPhase !== undefined, 'Develop phase should exist');
        assert(developPhase?.steps !== undefined, 'Develop phase should have steps');
        const step1 = developPhase?.steps?.[0];
        const step2 = developPhase?.steps?.[1];
        // Step 1 should inherit from workflow/sprint (sonnet)
        for (const subPhase of step1.phases) {
            assertEqual(subPhase.model, 'sonnet', `Step 1 sub-phases should have model: sonnet`);
        }
        // Step 2 should use its own model (opus - highest priority)
        for (const subPhase of step2.phases) {
            assertEqual(subPhase.model, 'opus', `Step 2 sub-phases should have model: opus`);
        }
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: No Model Specified
// ============================================================================
console.log('\n=== No Model Specified Tests ===\n');
test('compile: phases without model have undefined model', async () => {
    const env = createTestEnv();
    try {
        // Workflow without model
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' },
                { id: 'phase2', prompt: 'Phase 2' }
            ]
        });
        // Sprint without model
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        for (const phase of progress.phases ?? []) {
            const phaseWithModel = phase;
            assertEqual(phaseWithModel.model, undefined, `Phase ${phase.id} should have undefined model`);
        }
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: Model Resolution Function
// ============================================================================
console.log('\n=== Model Resolution Function Tests ===\n');
// Note: This test requires the resolveModel function to be exported from compile.ts
// For now, we test the expected behavior through integration tests
test('compile: resolves model with correct priority order', async () => {
    const env = createTestEnv();
    try {
        // Complex scenario: all levels have different models
        writeWorkflow(env.workflowsDir, 'step-workflow', {
            name: 'step-workflow',
            model: 'haiku', // Level 4 (lowest)
            phases: [
                { id: 'sub-phase-1', prompt: 'Sub-phase 1', model: 'opus' }, // Level 2
                { id: 'sub-phase-2', prompt: 'Sub-phase 2' } // Inherits
            ]
        });
        writeWorkflow(env.workflowsDir, 'main-workflow', {
            name: 'main-workflow',
            phases: [
                { id: 'develop', 'for-each': 'step', workflow: 'step-workflow' }
            ]
        });
        // Sprint has model: sonnet (Level 3)
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'main-workflow',
            model: 'sonnet',
            steps: [
                { id: 'step-1', prompt: 'Test' }
            ]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        // Resolution priority: step > phase > sprint > workflow
        const developPhase = progress.phases?.find(p => p.id === 'develop');
        assert(developPhase?.steps !== undefined, 'Should have steps');
        const step = developPhase?.steps?.[0];
        // sub-phase-1 has explicit phase model: opus
        const subPhase1 = step.phases.find(p => p.id.includes('sub-phase-1'));
        assertEqual(subPhase1.model, 'opus', 'Sub-phase with explicit model should use opus');
        // sub-phase-2 inherits from sprint (since workflow step-workflow has model but sprint overrides)
        const subPhase2 = step.phases.find(p => p.id.includes('sub-phase-2'));
        assertEqual(subPhase2.model, 'sonnet', 'Sub-phase without model should inherit sonnet');
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test: Model Validation
// ============================================================================
console.log('\n=== Model Validation Tests ===\n');
test('compile: rejects invalid model values in SPRINT.yaml', async () => {
    const env = createTestEnv();
    try {
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' }
            ]
        });
        // Sprint with invalid model
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            model: 'invalid-model', // Invalid!
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        // Should fail validation
        assertEqual(result.success, false, 'Compilation should fail with invalid model');
        assert(result.errors.length > 0, 'Should have validation errors');
        const hasModelError = result.errors.some(e => e.message.toLowerCase().includes('model') ||
            e.code === 'INVALID_MODEL');
        assert(hasModelError, 'Should have error about invalid model');
    }
    finally {
        env.cleanup();
    }
});
test('compile: rejects invalid model values in workflow', async () => {
    const env = createTestEnv();
    try {
        // Workflow with invalid model
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            model: 'not-a-model', // Invalid!
            phases: [
                { id: 'phase1', prompt: 'Phase 1' }
            ]
        });
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assertEqual(result.success, false, 'Compilation should fail with invalid model');
    }
    finally {
        env.cleanup();
    }
});
test('compile: accepts all valid model values', async () => {
    const validModels = ['sonnet', 'opus', 'haiku'];
    for (const model of validModels) {
        const env = createTestEnv();
        try {
            writeWorkflow(env.workflowsDir, 'test-workflow', {
                name: 'test-workflow',
                model: model,
                phases: [
                    { id: 'phase1', prompt: 'Phase 1' }
                ]
            });
            writeSprint(env.sprintDir, {
                'sprint-id': 'test-sprint',
                workflow: 'test-workflow',
                steps: [{ id: 'step-1', prompt: 'Test' }]
            });
            const result = await (0, compile_js_1.compile)({
                sprintDir: env.sprintDir,
                workflowsDir: env.workflowsDir
            });
            assert(result.success, `Compilation should succeed with valid model: ${model}`);
        }
        finally {
            env.cleanup();
        }
    }
});
// ============================================================================
// Test: Model in PROGRESS.yaml Output
// ============================================================================
console.log('\n=== PROGRESS.yaml Model Output Tests ===\n');
test('compile: model field is included in PROGRESS.yaml phases', async () => {
    const env = createTestEnv();
    try {
        writeWorkflow(env.workflowsDir, 'test-workflow', {
            name: 'test-workflow',
            model: 'sonnet',
            phases: [
                { id: 'phase1', prompt: 'Phase 1' }
            ]
        });
        writeSprint(env.sprintDir, {
            'sprint-id': 'test-sprint',
            workflow: 'test-workflow',
            steps: [{ id: 'step-1', prompt: 'Test' }]
        });
        const result = await (0, compile_js_1.compile)({
            sprintDir: env.sprintDir,
            workflowsDir: env.workflowsDir
        });
        assert(result.success, 'Compilation should succeed');
        const progress = result.progress;
        // Serialize to YAML and check model field is present
        const yamlStr = yaml.dump(progress);
        assert(yamlStr.includes('model:'), 'PROGRESS.yaml should include model field');
        assert(yamlStr.includes('sonnet'), 'PROGRESS.yaml should include model value');
    }
    finally {
        env.cleanup();
    }
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Model Selection Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=model-selection.test.js.map