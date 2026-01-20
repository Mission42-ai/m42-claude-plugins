"use strict";
/**
 * Tests for Elapsed Time Display and Progress Indicators - Step 1
 *
 * This test file covers:
 * 1. Elapsed time calculation in buildSubPhaseNode(), buildStepNode(), buildTopPhaseNode()
 * 2. Step counting for progress display
 * 3. SprintHeader totalSteps and currentStep fields
 * 4. Page sprint-timer element rendering
 *
 * RED PHASE: These tests should FAIL until the implementation is complete.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const transforms_js_1 = require("./transforms.js");
const page_js_1 = require("./page.js");
// ============================================================================
// Test Framework (consistent with project patterns)
// ============================================================================
function test(name, fn) {
    try {
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
            console.log(`✓ ${name}`);
        }
    }
    catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
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
function assertDefined(value, message) {
    if (value === undefined || value === null) {
        throw new Error(`${message}: value is ${value}`);
    }
}
console.log('\n--- Step 1: Elapsed Time & Progress Display Tests (RED PHASE) ---\n');
// ============================================================================
// Scenario 1: In-progress step calculates elapsed time from started-at
// ============================================================================
test('Scenario 1: in-progress step calculates elapsed from started-at', () => {
    // Create a progress with an in-progress step that has started-at but no elapsed
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': fiveMinutesAgo,
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': fiveMinutesAgo,
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        'started-at': fiveMinutesAgo,
                        // No 'elapsed' field - should be calculated
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': fiveMinutesAgo,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const step = tree[0].children[0];
    // RED: This should FAIL - current implementation may not calculate elapsed dynamically
    assertDefined(step.elapsed, 'In-progress step should have elapsed calculated');
    // Verify the elapsed time is roughly 5 minutes (allow some variance for test execution)
    const elapsedMatch = step.elapsed.match(/(\d+)m/);
    assert(elapsedMatch !== null, `Elapsed should contain minutes, got: ${step.elapsed}`);
    const minutes = parseInt(elapsedMatch[1], 10);
    assert(minutes >= 4 && minutes <= 6, `Elapsed minutes should be ~5, got: ${minutes}`);
});
// ============================================================================
// Scenario 2: Completed step preserves existing elapsed time
// ============================================================================
test('Scenario 2: completed step preserves existing elapsed time', () => {
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'completed',
        current: { phase: 0, step: null, 'sub-phase': null },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'completed-at': '2026-01-20T11:00:00Z',
            elapsed: '1h 0m',
            'total-phases': 1,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'completed',
                'started-at': '2026-01-20T10:00:00Z',
                'completed-at': '2026-01-20T10:30:00Z',
                elapsed: '30m 0s',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        'started-at': '2026-01-20T10:00:00Z',
                        'completed-at': '2026-01-20T10:30:00Z',
                        elapsed: '30m 0s', // Pre-existing elapsed
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                                'started-at': '2026-01-20T10:00:00Z',
                                'completed-at': '2026-01-20T10:30:00Z',
                                elapsed: '30m 0s',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const step = tree[0].children[0];
    // Should preserve the existing elapsed value, not recalculate
    assertEqual(step.elapsed, '30m 0s', 'Completed step should preserve existing elapsed');
});
// ============================================================================
// Scenario 3: Sub-phase calculates elapsed time from started-at
// ============================================================================
test('Scenario 3: sub-phase calculates elapsed from started-at', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': threeMinutesAgo,
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': threeMinutesAgo,
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        'started-at': threeMinutesAgo,
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': threeMinutesAgo,
                                // No 'elapsed' field - should be calculated
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const subPhase = tree[0].children[0].children[0];
    // RED: This should FAIL if sub-phase elapsed isn't calculated
    assertDefined(subPhase.elapsed, 'In-progress sub-phase should have elapsed calculated');
    // Verify the elapsed time is roughly 3 minutes
    const elapsedMatch = subPhase.elapsed.match(/(\d+)m/);
    assert(elapsedMatch !== null, `Elapsed should contain minutes, got: ${subPhase.elapsed}`);
    const minutes = parseInt(elapsedMatch[1], 10);
    assert(minutes >= 2 && minutes <= 4, `Elapsed minutes should be ~3, got: ${minutes}`);
});
// ============================================================================
// Scenario 4: Top-level phase calculates elapsed time
// ============================================================================
test('Scenario 4: top-level phase calculates elapsed from started-at', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': tenMinutesAgo,
            'total-phases': 1,
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': tenMinutesAgo,
                // No 'elapsed' field - should be calculated
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'in-progress',
                        'started-at': tenMinutesAgo,
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': tenMinutesAgo,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const topPhase = tree[0];
    // RED: This should FAIL if top-level phase elapsed isn't calculated
    assertDefined(topPhase.elapsed, 'In-progress top-level phase should have elapsed calculated');
    // Verify the elapsed time is roughly 10 minutes
    const elapsedMatch = topPhase.elapsed.match(/(\d+)m/);
    assert(elapsedMatch !== null, `Elapsed should contain minutes, got: ${topPhase.elapsed}`);
    const minutes = parseInt(elapsedMatch[1], 10);
    assert(minutes >= 9 && minutes <= 11, `Elapsed minutes should be ~10, got: ${minutes}`);
});
// ============================================================================
// Scenario 5: Step counting returns correct totals
// ============================================================================
test('Scenario 5: countTotalSteps returns correct total', () => {
    // Check if countTotalSteps exists by trying to access it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transforms = require('./transforms.js');
    if (!transforms.countTotalSteps) {
        throw new Error('RED: countTotalSteps function does not exist in transforms.ts. ' +
            'Implement and export countTotalSteps(progress: CompiledProgress): number');
    }
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 6, // 3 steps * 2 sub-phases each
            'completed-phases': 0,
        },
        phases: [
            {
                id: 'phase-1',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Step 0',
                        status: 'in-progress',
                        phases: [
                            { id: 'red', status: 'completed', prompt: 'RED' },
                            { id: 'green', status: 'in-progress', prompt: 'GREEN' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Step 1',
                        status: 'pending',
                        phases: [
                            { id: 'red', status: 'pending', prompt: 'RED' },
                            { id: 'green', status: 'pending', prompt: 'GREEN' },
                        ],
                    },
                    {
                        id: 'step-2',
                        prompt: 'Step 2',
                        status: 'pending',
                        phases: [
                            { id: 'red', status: 'pending', prompt: 'RED' },
                            { id: 'green', status: 'pending', prompt: 'GREEN' },
                        ],
                    },
                ],
            },
        ],
    };
    const total = transforms.countTotalSteps(progress);
    // RED: This should FAIL - countTotalSteps doesn't exist yet
    // Total should count all leaf-level phases (sub-phases): 3 steps * 2 = 6
    assertEqual(total, 6, 'countTotalSteps should return total leaf phases');
});
// ============================================================================
// Scenario 6: SprintHeader includes totalSteps
// ============================================================================
test('Scenario 6: SprintHeader includes totalSteps', () => {
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 4,
            'completed-phases': 2,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Step 0',
                        status: 'completed',
                        phases: [
                            { id: 'impl', status: 'completed', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Step 1',
                        status: 'completed',
                        phases: [
                            { id: 'impl', status: 'completed', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-2',
                        prompt: 'Step 2',
                        status: 'in-progress',
                        phases: [
                            { id: 'impl', status: 'in-progress', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-3',
                        prompt: 'Step 3',
                        status: 'pending',
                        phases: [
                            { id: 'impl', status: 'pending', prompt: 'Implement' },
                        ],
                    },
                ],
            },
        ],
    };
    const update = (0, transforms_js_1.toStatusUpdate)(progress);
    // RED: This should FAIL - totalSteps field doesn't exist on SprintHeader yet
    const header = update.header;
    assertDefined(header.totalSteps, 'SprintHeader should include totalSteps field');
    assertEqual(header.totalSteps, 4, 'totalSteps should equal total leaf phases');
});
// ============================================================================
// Scenario 7: SprintHeader includes currentStep
// ============================================================================
test('Scenario 7: SprintHeader includes currentStep', () => {
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 2, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
            'total-phases': 5,
            'completed-phases': 2,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Step 0',
                        status: 'completed',
                        phases: [
                            { id: 'impl', status: 'completed', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Step 1',
                        status: 'completed',
                        phases: [
                            { id: 'impl', status: 'completed', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-2',
                        prompt: 'Step 2',
                        status: 'in-progress',
                        phases: [
                            { id: 'impl', status: 'in-progress', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-3',
                        prompt: 'Step 3',
                        status: 'pending',
                        phases: [
                            { id: 'impl', status: 'pending', prompt: 'Implement' },
                        ],
                    },
                    {
                        id: 'step-4',
                        prompt: 'Step 4',
                        status: 'pending',
                        phases: [
                            { id: 'impl', status: 'pending', prompt: 'Implement' },
                        ],
                    },
                ],
            },
        ],
    };
    const update = (0, transforms_js_1.toStatusUpdate)(progress);
    // RED: This should FAIL - currentStep field doesn't exist on SprintHeader yet
    const header = update.header;
    assertDefined(header.currentStep, 'SprintHeader should include currentStep field');
    // currentStep should be 3 (1-indexed for display: "Step 3 of 5")
    // Or it could be the count of completed steps + 1
    // We're on step-2 which is the 3rd step (index 2 + 1)
    assertEqual(header.currentStep, 3, 'currentStep should indicate position (1-indexed)');
});
// ============================================================================
// Scenario 8: Page renders sprint timer with HH:MM:SS format
// ============================================================================
test('Scenario 8: page contains sprint-timer element', () => {
    const html = (0, page_js_1.getPageHtml)();
    // RED: This should FAIL - sprint-timer element doesn't exist in page.ts yet
    assert(html.includes('sprint-timer') || html.includes('id="sprint-timer"'), 'Page HTML should contain sprint-timer element. ' +
        'Add a div with id="sprint-timer" in the header section.');
    // Check for timer icon (clock/stopwatch emoji or icon)
    assert(html.includes('timer') || html.includes('clock') || html.includes('stopwatch'), 'Page should include timer-related styling or icon class');
    // Check for JavaScript that updates timer every second
    assert(html.includes('setInterval') && (html.includes('1000') || html.includes('timer')), 'Page should include JavaScript setInterval for timer updates');
    // Check for HH:MM:SS formatting function or pattern
    assert(html.includes('formatTime') ||
        html.includes('HH:MM:SS') ||
        html.includes('toHHMMSS') ||
        (html.includes('hours') && html.includes('minutes') && html.includes('seconds')), 'Page should include HH:MM:SS time formatting logic');
});
// ============================================================================
// Additional Test: Page renders "Step X of Y" display
// ============================================================================
test('Scenario 8b: page contains step progress counter element', () => {
    const html = (0, page_js_1.getPageHtml)();
    // RED: This should FAIL - step counter element doesn't exist yet
    assert(html.includes('step-counter') ||
        html.includes('step-progress') ||
        html.includes('id="current-step"') ||
        (html.includes('Step') && html.includes('of')), 'Page HTML should contain step progress counter element (e.g., "Step X of Y")');
});
// ============================================================================
// Edge Cases
// ============================================================================
test('Edge case: pending steps without started-at have no elapsed', () => {
    const progress = {
        'sprint-id': 'test-sprint',
        status: 'in-progress',
        current: { phase: 0, step: 0, 'sub-phase': 0 },
        stats: {
            'started-at': '2026-01-20T10:00:00Z',
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
                        prompt: 'Step 0',
                        status: 'in-progress',
                        'started-at': '2026-01-20T10:00:00Z',
                        phases: [
                            { id: 'impl', status: 'in-progress', prompt: 'Implement', 'started-at': '2026-01-20T10:00:00Z' },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Step 1',
                        status: 'pending',
                        // No started-at - should not have elapsed
                        phases: [
                            { id: 'impl', status: 'pending', prompt: 'Implement' },
                        ],
                    },
                ],
            },
        ],
    };
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const pendingStep = tree[0].children[1];
    // Pending steps without started-at should have undefined elapsed
    assertEqual(pendingStep.elapsed, undefined, 'Pending step without started-at should have no elapsed');
});
test('Edge case: calculateElapsed handles various time ranges', () => {
    const now = new Date();
    // 45 seconds ago
    const sec45Ago = new Date(now.getTime() - 45 * 1000).toISOString();
    const sec45Elapsed = (0, transforms_js_1.calculateElapsed)(sec45Ago);
    assert(sec45Elapsed.includes('45s') || sec45Elapsed.includes('44s') || sec45Elapsed.includes('46s'), `45 seconds should format as ~45s, got: ${sec45Elapsed}`);
    // 90 minutes ago
    const min90Ago = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
    const min90Elapsed = (0, transforms_js_1.calculateElapsed)(min90Ago);
    assert(min90Elapsed.includes('1h 30m') || min90Elapsed.includes('1h 29m') || min90Elapsed.includes('1h 31m'), `90 minutes should format as ~1h 30m, got: ${min90Elapsed}`);
});
console.log('\n--- End of Step 1: Elapsed Time & Progress Display Tests ---\n');
//# sourceMappingURL=elapsed-step.test.js.map