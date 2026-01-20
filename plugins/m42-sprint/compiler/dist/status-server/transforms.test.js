"use strict";
/**
 * Tests for transforms.ts - Data transformation for status server
 * BUG-001: Sprint Steps Show No Progress Indicators
 *
 * Issue: Steps in the sprint review show no progress indicators - all empty circles
 * regardless of their actual status (completed, in-progress, pending).
 *
 * Expected: Steps should show visual indicators based on status:
 * - Completed steps: filled/checked circle (✓)
 * - In-progress steps: animated/partial circle (● with pulse)
 * - Pending steps: empty circle (○)
 *
 * ROOT CAUSE ANALYSIS:
 * The transforms correctly pass through step.status values. However, the runtime
 * (loop.ts) only updates:
 * 1. progress.status (sprint-level)
 * 2. phase.status (only when sprint completes at line 228)
 *
 * It NEVER updates:
 * - step.status (remains 'pending' forever)
 * - subPhase.status (remains 'pending' forever)
 *
 * This test verifies the transforms work correctly (they do), but the real bug
 * is in the runtime which should update step statuses as phases progress.
 *
 * These tests verify that:
 * 1. Step status is correctly passed through buildStepNode
 * 2. Phase tree nodes have correct status values
 * 3. Different step statuses are properly represented
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Simple test runner (consistent with project patterns)
function test(name, fn) {
    const result = fn();
    if (result instanceof Promise) {
        result
            .then(() => console.log(`✓ ${name}`))
            .catch((error) => {
            console.error(`✗ ${name}`);
            console.error(`  ${error}`);
            process.exitCode = 1;
        });
    }
    else {
        try {
            console.log(`✓ ${name}`);
        }
        catch (error) {
            console.error(`✗ ${name}`);
            console.error(`  ${error}`);
            process.exitCode = 1;
        }
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
}
console.log('\n--- BUG-001: Sprint Steps Progress Indicators Tests ---\n');
// ============================================================================
// Test: buildStepNode preserves step status
// ============================================================================
test('BUG-001: buildStepNode should preserve step status for completed steps', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    // Create a CompiledProgress with a completed step
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'completed',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'completed-at': '2025-01-20T11:00:00Z',
            'total-phases': 1,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'completed',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        'started-at': '2025-01-20T10:00:00Z',
                        'completed-at': '2025-01-20T10:30:00Z',
                        elapsed: '30m 0s',
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                                'started-at': '2025-01-20T10:00:00Z',
                                'completed-at': '2025-01-20T10:30:00Z',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = buildPhaseTree(progress);
    // The tree should have the development phase
    assert(tree.length === 1, `Expected 1 phase, got ${tree.length}`);
    const devPhase = tree[0];
    assertEqual(devPhase.status, 'completed', 'Top phase status');
    // The phase should have children (steps)
    assert(devPhase.children !== undefined, 'Phase should have children (steps)');
    assert(devPhase.children.length === 1, `Expected 1 step, got ${devPhase.children.length}`);
    const step = devPhase.children[0];
    // BUG-001: This is the critical assertion that should FAIL if the bug exists
    // The step status should be 'completed', not 'pending' or undefined
    assertEqual(step.status, 'completed', 'Step status should be "completed"');
    assertEqual(step.type, 'step', 'Node type should be "step"');
});
test('BUG-001: buildStepNode should preserve step status for in-progress steps', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    // Create a CompiledProgress with an in-progress step
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        'started-at': '2025-01-20T10:00:00Z',
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': '2025-01-20T10:00:00Z',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = buildPhaseTree(progress);
    const devPhase = tree[0];
    const step = devPhase.children[0];
    // BUG-001: Step status should be 'in-progress'
    assertEqual(step.status, 'in-progress', 'Step status should be "in-progress"');
});
test('BUG-001: buildStepNode should preserve step status for pending steps', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    // Create a CompiledProgress with pending steps
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        'started-at': '2025-01-20T10:00:00Z',
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
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
    const tree = buildPhaseTree(progress);
    const devPhase = tree[0];
    // First step is in-progress
    const step0 = devPhase.children[0];
    assertEqual(step0.status, 'in-progress', 'First step status should be "in-progress"');
    // Second step is pending
    const step1 = devPhase.children[1];
    assertEqual(step1.status, 'pending', 'Second step status should be "pending"');
});
// ============================================================================
// Test: Mixed status scenario (completed, in-progress, pending)
// ============================================================================
test('BUG-001: buildPhaseTree should correctly represent mixed step statuses', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    // Create a CompiledProgress with mixed statuses
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'total-phases': 3,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        'started-at': '2025-01-20T10:00:00Z',
                        'completed-at': '2025-01-20T10:15:00Z',
                        elapsed: '15m 0s',
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'in-progress',
                        'started-at': '2025-01-20T10:15:00Z',
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
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
    const tree = buildPhaseTree(progress);
    const devPhase = tree[0];
    // Verify we have 3 steps
    assert(devPhase.children.length === 3, `Expected 3 steps, got ${devPhase.children.length}`);
    // Verify each step has the correct status
    const statuses = devPhase.children.map((step) => step.status);
    // BUG-001: This assertion verifies the bug
    // If bug exists, all statuses would be 'pending' or undefined
    assertEqual(statuses[0], 'completed', 'Step 0 should be "completed"');
    assertEqual(statuses[1], 'in-progress', 'Step 1 should be "in-progress"');
    assertEqual(statuses[2], 'pending', 'Step 2 should be "pending"');
    // Also verify that all different statuses are present (not all the same)
    const uniqueStatuses = new Set(statuses);
    assert(uniqueStatuses.size === 3, `Expected 3 unique statuses, but got ${uniqueStatuses.size}: ${Array.from(uniqueStatuses).join(', ')}`);
});
// ============================================================================
// Test: toStatusUpdate includes correct phase tree with step statuses
// ============================================================================
test('BUG-001: toStatusUpdate should include phaseTree with correct step statuses', async () => {
    const { toStatusUpdate } = await import('./transforms.js');
    // Create a CompiledProgress
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'total-phases': 2,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'in-progress',
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const update = toStatusUpdate(progress);
    // Verify the phaseTree is included
    assert(update.phaseTree !== undefined, 'StatusUpdate should include phaseTree');
    assert(update.phaseTree.length === 1, `Expected 1 phase, got ${update.phaseTree.length}`);
    const phase = update.phaseTree[0];
    assert(phase.children !== undefined, 'Phase should have children');
    // BUG-001: Verify steps have correct statuses in the final StatusUpdate
    assertEqual(phase.children[0].status, 'completed', 'First step in StatusUpdate should be "completed"');
    assertEqual(phase.children[1].status, 'in-progress', 'Second step in StatusUpdate should be "in-progress"');
});
// ============================================================================
// Test: Failed step status is preserved
// ============================================================================
test('BUG-001: buildStepNode should preserve failed and blocked step statuses', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'blocked',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
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
                            {
                                id: 'implement',
                                status: 'failed',
                                prompt: 'Implement the feature',
                                error: 'Build failed',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'blocked',
                        phases: [
                            {
                                id: 'implement',
                                status: 'blocked',
                                prompt: 'Implement the feature',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = buildPhaseTree(progress);
    const devPhase = tree[0];
    // BUG-001: Verify failed and blocked statuses are preserved
    assertEqual(devPhase.children[0].status, 'failed', 'First step should be "failed"');
    assertEqual(devPhase.children[1].status, 'blocked', 'Second step should be "blocked"');
});
// ============================================================================
// Test: Sub-phase statuses are also preserved
// ============================================================================
test('BUG-001: sub-phase statuses should also be correctly preserved', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 1 },
        stats: {
            'started-at': '2025-01-20T10:00:00Z',
            'total-phases': 3,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        phases: [
                            {
                                id: 'context',
                                status: 'completed',
                                prompt: 'Gather context',
                            },
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                            },
                            {
                                id: 'verify',
                                status: 'pending',
                                prompt: 'Verify implementation',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = buildPhaseTree(progress);
    const step = tree[0].children[0];
    // Verify step has children (sub-phases)
    assert(step.children !== undefined, 'Step should have children (sub-phases)');
    assert(step.children.length === 3, `Expected 3 sub-phases, got ${step.children.length}`);
    // BUG-001: Verify sub-phase statuses
    assertEqual(step.children[0].status, 'completed', 'First sub-phase should be "completed"');
    assertEqual(step.children[1].status, 'in-progress', 'Second sub-phase should be "in-progress"');
    assertEqual(step.children[2].status, 'pending', 'Third sub-phase should be "pending"');
    // Verify types
    assertEqual(step.children[0].type, 'sub-phase', 'Node type should be "sub-phase"');
});
console.log('\nBUG-001 tests completed.\n');
//# sourceMappingURL=transforms.test.js.map