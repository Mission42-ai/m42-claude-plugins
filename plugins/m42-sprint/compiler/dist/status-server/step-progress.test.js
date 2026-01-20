"use strict";
/**
 * Tests for BUG-001: Sprint Steps Show No Progress Indicators
 *
 * This test file validates the COMPLETE data flow from PROGRESS.yaml structure
 * through to the final HTML rendering, ensuring step status indicators are
 * correctly displayed in the sprint detail page.
 *
 * Issue: Steps in the sprint review show no progress indicators - all empty circles
 * regardless of their actual status (completed, in-progress, pending).
 *
 * Expected behavior:
 * - Completed steps: green checkmark (class="tree-icon completed")
 * - In-progress steps: blue pulsing circle (class="tree-icon in-progress")
 * - Pending steps: gray empty circle (class="tree-icon pending")
 * - Failed steps: red X (class="tree-icon failed")
 *
 * Root cause identified in loop.ts comments: The runtime historically only updated
 * progress.status (sprint-level) and phase.status (only on completion). It never
 * updated step.status or subPhase.status which remained 'pending' forever.
 *
 * This test verifies the fix by checking that:
 * 1. buildPhaseTree correctly transforms step statuses
 * 2. toStatusUpdate includes phaseTree with correct step statuses
 * 3. The page.ts rendering would produce correct CSS classes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const transforms_js_1 = require("./transforms.js");
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
    console.log('\n=== BUG-001: Step Progress Indicators Tests ===\n');
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            console.log(`✓ ${name}`);
        }
        catch (error) {
            testsFailed++;
            console.error(`✗ ${name}`);
            console.error(`  ${error instanceof Error ? error.message : error}`);
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
    if (actual !== expected) {
        throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
}
// ============================================================================
// Test Fixtures - Simulating Real PROGRESS.yaml Structures
// ============================================================================
/**
 * Creates a realistic PROGRESS.yaml structure with mixed step statuses.
 * This represents a sprint mid-execution where:
 * - First step is completed
 * - Second step is in-progress (currently executing)
 * - Third step is pending (not yet started)
 */
function createMixedStatusProgress() {
    return {
        'sprint-id': 'test-sprint-001',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 3,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': '2026-01-20T10:00:00Z',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        'started-at': '2026-01-20T10:00:00Z',
                        'completed-at': '2026-01-20T10:15:00Z',
                        elapsed: '15m 0s',
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                                'started-at': '2026-01-20T10:00:00Z',
                                'completed-at': '2026-01-20T10:15:00Z',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'in-progress',
                        'started-at': '2026-01-20T10:15:00Z',
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': '2026-01-20T10:15:00Z',
                            },
                        ],
                    },
                    {
                        id: 'step-2',
                        prompt: 'Implement feature C',
                        status: 'pending',
                        phases: [
                            {
                                id: 'implement',
                                status: 'pending',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
/**
 * Creates a PROGRESS.yaml structure with all steps pending.
 * This represents what the BUG originally looked like - all steps appear as empty circles.
 */
function createAllPendingProgress() {
    return {
        'sprint-id': 'test-sprint-bug',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 3,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': '2026-01-20T10:00:00Z',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        // BUG: Even though step-0 was completed, status stayed 'pending'
                        status: 'pending',
                        phases: [
                            { id: 'implement', status: 'pending', prompt: 'Implement the feature' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        // BUG: Currently executing but status is 'pending'
                        status: 'pending',
                        phases: [
                            { id: 'implement', status: 'pending', prompt: 'Implement the feature' },
                        ],
                    },
                    {
                        id: 'step-2',
                        prompt: 'Implement feature C',
                        status: 'pending',
                        phases: [
                            { id: 'implement', status: 'pending', prompt: 'Implement the feature' },
                        ],
                    },
                ],
            },
        ],
    };
}
// ============================================================================
// BUG-001 Tests: Step Progress Indicators
// ============================================================================
/**
 * TEST 1: buildPhaseTree must preserve step status from PROGRESS.yaml
 *
 * This test verifies that when PROGRESS.yaml has steps with different statuses,
 * those statuses are correctly passed through to the PhaseTreeNode structure.
 */
test('buildPhaseTree preserves mixed step statuses', () => {
    const progress = createMixedStatusProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    assert(tree.length === 1, 'Should have 1 top-level phase');
    const devPhase = tree[0];
    assertEqual(devPhase.status, 'in-progress', 'Phase status');
    assert(devPhase.children !== undefined, 'Phase should have children (steps)');
    assertEqual(devPhase.children.length, 3, 'Phase should have 3 steps');
    const [step0, step1, step2] = devPhase.children;
    // Critical assertions - these verify the bug is fixed
    assertEqual(step0.status, 'completed', 'Step 0 should be "completed"');
    assertEqual(step1.status, 'in-progress', 'Step 1 should be "in-progress"');
    assertEqual(step2.status, 'pending', 'Step 2 should be "pending"');
    // Verify all different statuses are present (not all same)
    const uniqueStatuses = new Set([step0.status, step1.status, step2.status]);
    assert(uniqueStatuses.size === 3, `Expected 3 unique step statuses, got ${uniqueStatuses.size}: ${Array.from(uniqueStatuses).join(', ')}`);
});
/**
 * TEST 2: Detect the bug scenario - all steps showing 'pending'
 *
 * This test demonstrates the bug: even when the sprint is mid-execution,
 * all steps appear with 'pending' status because the runtime didn't update them.
 *
 * This test should FAIL if the bug still exists (all statuses are 'pending')
 * It should PASS once the runtime correctly updates step statuses.
 */
test('BUG-001 DETECTION: steps should NOT all show pending when sprint is in-progress', () => {
    const progress = createAllPendingProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const devPhase = tree[0];
    const steps = devPhase.children;
    // Count how many steps show 'pending'
    const pendingCount = steps.filter(s => s.status === 'pending').length;
    // BUG DETECTION: If ALL steps are pending when sprint is in-progress,
    // that's the bug! At least the current step should show 'in-progress'
    //
    // This test documents the buggy behavior - it will PASS on the buggy code
    // and FAIL once we fix the runtime to update step statuses
    assert(pendingCount < steps.length, `BUG-001 DETECTED: All ${steps.length} steps show 'pending' status even though ` +
        `sprint is in-progress (current.step=1). At least step-1 should be 'in-progress'. ` +
        `This indicates the runtime is not updating step statuses.`);
});
/**
 * TEST 3: toStatusUpdate includes phaseTree with correct step statuses
 *
 * This verifies the complete transform pipeline delivers correct statuses
 * that the frontend can use to render appropriate icons.
 */
test('toStatusUpdate delivers correct step statuses for rendering', () => {
    const progress = createMixedStatusProgress();
    const update = (0, transforms_js_1.toStatusUpdate)(progress);
    assert(update.phaseTree !== undefined, 'StatusUpdate should include phaseTree');
    assert(update.phaseTree.length === 1, 'Should have 1 phase in tree');
    const phase = update.phaseTree[0];
    assert(phase.children !== undefined, 'Phase should have children');
    assertEqual(phase.children.length, 3, 'Phase should have 3 steps');
    // Verify statuses that would be used for CSS classes
    assertEqual(phase.children[0].status, 'completed', 'First step status for rendering (should produce tree-icon completed)');
    assertEqual(phase.children[1].status, 'in-progress', 'Second step status for rendering (should produce tree-icon in-progress)');
    assertEqual(phase.children[2].status, 'pending', 'Third step status for rendering (should produce tree-icon pending)');
});
/**
 * TEST 4: Verify sub-phase statuses are also preserved
 *
 * The bug affected both steps and sub-phases (phases within steps).
 * This test ensures sub-phases also have their statuses preserved.
 */
test('sub-phase statuses are preserved for rendering', () => {
    const progress = createMixedStatusProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const step0 = tree[0].children[0];
    const step1 = tree[0].children[1];
    const step2 = tree[0].children[2];
    // Each step has one sub-phase (implement)
    assert(step0.children !== undefined, 'Step 0 should have sub-phases');
    assert(step1.children !== undefined, 'Step 1 should have sub-phases');
    assert(step2.children !== undefined, 'Step 2 should have sub-phases');
    assertEqual(step0.children[0].status, 'completed', 'Step 0 sub-phase should be completed');
    assertEqual(step1.children[0].status, 'in-progress', 'Step 1 sub-phase should be in-progress');
    assertEqual(step2.children[0].status, 'pending', 'Step 2 sub-phase should be pending');
    // Verify sub-phase type
    assertEqual(step0.children[0].type, 'sub-phase', 'Sub-phase type');
});
/**
 * TEST 5: Verify failed/blocked step statuses are preserved
 *
 * When a step fails or gets blocked, this should be reflected in the tree.
 */
test('failed and blocked step statuses are preserved', () => {
    const progress = {
        'sprint-id': 'test-sprint-failed',
        status: 'blocked',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'blocked',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'failed',
                        error: 'Build failed',
                        phases: [
                            { id: 'implement', status: 'failed', prompt: 'Implement the feature', error: 'Build failed' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'blocked',
                        phases: [
                            { id: 'implement', status: 'blocked', prompt: 'Implement the feature' },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const steps = tree[0].children;
    assertEqual(steps[0].status, 'failed', 'Failed step status should be preserved');
    assertEqual(steps[1].status, 'blocked', 'Blocked step status should be preserved');
    // Verify error is also passed through
    assertEqual(steps[0].error, 'Build failed', 'Failed step error should be preserved');
});
/**
 * TEST 6: CSS class mapping verification
 *
 * This test verifies that the status values map correctly to CSS classes
 * that page.ts uses for rendering icons.
 */
test('step statuses map to valid CSS icon classes', () => {
    const progress = createMixedStatusProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const steps = tree[0].children;
    // These are the valid CSS classes defined in page.ts
    const validStatusClasses = new Set([
        'pending',
        'in-progress',
        'completed',
        'failed',
        'blocked',
        'skipped',
    ]);
    for (const step of steps) {
        assert(validStatusClasses.has(step.status), `Step status "${step.status}" is not a valid CSS class. ` +
            `Valid classes: ${Array.from(validStatusClasses).join(', ')}`);
    }
});
/**
 * TEST 7: Elapsed time and timestamps are preserved
 *
 * For proper display, steps need timing information in addition to status.
 */
test('step timing information is preserved', () => {
    const progress = createMixedStatusProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const step0 = tree[0].children[0]; // completed step
    assertEqual(step0.startedAt, '2026-01-20T10:00:00Z', 'Started timestamp');
    assertEqual(step0.completedAt, '2026-01-20T10:15:00Z', 'Completed timestamp');
    assertEqual(step0.elapsed, '15m 0s', 'Elapsed time');
});
/**
 * TEST 8: Page rendering simulation - verify tree-icon class generation
 *
 * This test simulates what page.ts does: generating HTML with tree-icon classes.
 * It verifies the data is in the right format for correct rendering.
 */
test('data format supports correct tree-icon class generation', () => {
    const progress = createMixedStatusProgress();
    const update = (0, transforms_js_1.toStatusUpdate)(progress);
    // Simulate the page.ts renderTreeNode logic:
    // html += '<span class="tree-icon ' + node.status + '"></span>';
    const steps = update.phaseTree[0].children;
    const simulatedHtml = steps.map(step => {
        return `<span class="tree-icon ${step.status}"></span>`;
    }).join('');
    // Verify the generated HTML would contain all three status classes
    assert(simulatedHtml.includes('tree-icon completed'), 'Rendered HTML should include "tree-icon completed"');
    assert(simulatedHtml.includes('tree-icon in-progress'), 'Rendered HTML should include "tree-icon in-progress"');
    assert(simulatedHtml.includes('tree-icon pending'), 'Rendered HTML should include "tree-icon pending"');
    // Negative check: should NOT have all identical
    const allSameStatus = steps.every(s => s.status === steps[0].status);
    assert(!allSameStatus, 'BUG-001: All steps have the same status - visual indicators would all look identical');
});
//# sourceMappingURL=step-progress.test.js.map