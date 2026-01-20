"use strict";
/**
 * Tests for BUG-007: Steps/Substeps Missing Duration and Clickable Logs
 *
 * Issue: Steps in the sprint detail view should show:
 * 1. Duration for each step/substep (elapsed time or running time)
 * 2. Clickable step rows to view logs (not just "View Log" button on leaf nodes)
 *
 * Expected behavior:
 * - In-progress steps show live duration (computed from startedAt to now)
 * - Completed steps show total duration (elapsed field)
 * - Step rows should be clickable to open log viewer
 * - Visual indication of clickability (hover cursor, etc.)
 *
 * Root cause analysis:
 * - transforms.ts only copies elapsed field from PROGRESS.yaml
 * - In-progress steps don't have elapsed computed server-side
 * - page.ts only renders elapsed if it exists in the node data
 * - Step rows are not clickable; only the "View Log" button is
 */
Object.defineProperty(exports, "__esModule", { value: true });
const transforms_js_1 = require("./transforms.js");
const page_js_1 = require("./page.js");
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
    console.log('\n=== BUG-007: Step Duration and Clickable Logs Tests ===\n');
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
function assertNotEqual(actual, unexpected, message) {
    if (actual === unexpected) {
        throw new Error(`${message}: expected NOT "${unexpected}", but got that value`);
    }
}
// ============================================================================
// Test Fixtures
// ============================================================================
/**
 * Creates a PROGRESS.yaml structure with an in-progress step
 * that has startedAt but no elapsed field (realistic scenario)
 */
function createInProgressStepProgress() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    return {
        'sprint-id': 'test-sprint-duration',
        status: 'in-progress',
        current: { phase: 0, step: 1, 'sub-phase': 0 },
        stats: {
            'started-at': tenMinutesAgo.toISOString(),
            'total-phases': 2,
            'completed-phases': 1,
        },
        phases: [
            {
                id: 'development',
                status: 'in-progress',
                'started-at': tenMinutesAgo.toISOString(),
                steps: [
                    {
                        id: 'step-0',
                        prompt: 'Implement feature A',
                        status: 'completed',
                        'started-at': tenMinutesAgo.toISOString(),
                        'completed-at': fiveMinutesAgo.toISOString(),
                        elapsed: '5m 0s', // Completed step has elapsed
                        phases: [
                            {
                                id: 'implement',
                                status: 'completed',
                                prompt: 'Implement the feature',
                                'started-at': tenMinutesAgo.toISOString(),
                                'completed-at': fiveMinutesAgo.toISOString(),
                                elapsed: '5m 0s',
                            },
                        ],
                    },
                    {
                        id: 'step-1',
                        prompt: 'Implement feature B',
                        status: 'in-progress',
                        'started-at': fiveMinutesAgo.toISOString(),
                        // NOTE: No elapsed field - this is the BUG!
                        // In-progress steps don't have elapsed computed
                        phases: [
                            {
                                id: 'implement',
                                status: 'in-progress',
                                prompt: 'Implement the feature',
                                'started-at': fiveMinutesAgo.toISOString(),
                                // NOTE: No elapsed field
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
// ============================================================================
// BUG-007 Tests: Step Duration Display
// ============================================================================
/**
 * TEST 1: In-progress steps should have duration computed
 *
 * BUG: Currently, in-progress steps have no elapsed field because
 * the server only copies the elapsed from PROGRESS.yaml, and
 * in-progress phases don't have elapsed computed by the runtime.
 *
 * EXPECTED: transforms.ts should compute elapsed for in-progress nodes
 * based on their startedAt timestamp.
 */
test('BUG-007 DETECTION: in-progress steps should have duration available', () => {
    const progress = createInProgressStepProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const devPhase = tree[0];
    assert(devPhase.children !== undefined, 'Phase should have children');
    const inProgressStep = devPhase.children[1]; // step-1 is in-progress
    assertEqual(inProgressStep.status, 'in-progress', 'Step should be in-progress');
    // BUG DETECTION: In-progress step should have elapsed computed
    // Currently this will be undefined because transforms.ts only copies from PROGRESS.yaml
    assert(inProgressStep.elapsed !== undefined, `BUG-007 DETECTED: In-progress step has no duration. ` +
        `The step started at ${inProgressStep.startedAt} but elapsed is undefined. ` +
        `Users can't see how long the step has been running.`);
});
/**
 * TEST 2: In-progress sub-phases should have duration computed
 *
 * Same issue at the sub-phase level
 */
test('BUG-007 DETECTION: in-progress sub-phases should have duration available', () => {
    const progress = createInProgressStepProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const inProgressStep = tree[0].children[1];
    assert(inProgressStep.children !== undefined, 'Step should have children');
    const inProgressSubPhase = inProgressStep.children[0];
    assertEqual(inProgressSubPhase.status, 'in-progress', 'Sub-phase should be in-progress');
    assert(inProgressSubPhase.elapsed !== undefined, `BUG-007 DETECTED: In-progress sub-phase has no duration. ` +
        `The sub-phase started at ${inProgressSubPhase.startedAt} but elapsed is undefined.`);
});
/**
 * TEST 3: toStatusUpdate should provide duration for all in-progress nodes
 *
 * The complete status update sent to the UI should have duration data
 * for all nodes that have a startedAt timestamp.
 */
test('BUG-007 DETECTION: toStatusUpdate provides duration for in-progress nodes', () => {
    const progress = createInProgressStepProgress();
    const update = (0, transforms_js_1.toStatusUpdate)(progress);
    const phase = update.phaseTree[0];
    const step = phase.children[1];
    // Verify the step is in-progress
    assertEqual(step.status, 'in-progress', 'Step should be in-progress');
    // BUG: This should have a computed duration
    assert(step.elapsed !== undefined && step.elapsed.length > 0, `BUG-007: StatusUpdate missing duration for in-progress step. ` +
        `Step ID: ${step.id}, startedAt: ${step.startedAt}, elapsed: ${step.elapsed}`);
});
/**
 * TEST 4: calculateElapsed helper should work for in-progress calculation
 *
 * Verify the calculateElapsed function works when endIso is not provided
 * (meaning "calculate from start to now")
 */
test('calculateElapsed works for in-progress (no end time)', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const elapsed = (0, transforms_js_1.calculateElapsed)(fiveMinutesAgo.toISOString());
    // Should be approximately "5m 0s" (allow some tolerance)
    assert(elapsed.includes('5m') || elapsed.includes('4m'), `calculateElapsed should compute ~5m for a start time 5 minutes ago, got: ${elapsed}`);
});
// ============================================================================
// BUG-007 Tests: Clickable Step Rows
// ============================================================================
/**
 * TEST 5: Step rows should be clickable to view logs
 *
 * BUG: Currently only the "View Log" button is clickable.
 * Users expect to click anywhere on the step row to view logs.
 *
 * The rendered HTML should have:
 * - Step rows with cursor: pointer style
 * - Click handler on the row (not just the button)
 * - data-phase-id attribute on the row for log lookup
 */
test('BUG-007 DETECTION: step rows should be clickable', () => {
    const html = (0, page_js_1.getPageHtml)();
    // Check for CSS that makes step rows clickable
    const hasClickableCursor = html.includes('.tree-node-content') &&
        (html.includes('cursor: pointer') || html.includes('cursor:pointer'));
    assert(hasClickableCursor, `BUG-007 DETECTED: Step rows (.tree-node-content) should have cursor: pointer style ` +
        `to indicate clickability. Users should be able to click the row to view logs.`);
});
/**
 * TEST 6: Step rows should have click handlers attached
 *
 * The JavaScript should attach click handlers to step rows,
 * not just to the "View Log" button.
 */
test('BUG-007 DETECTION: step rows should have click handlers for log viewing', () => {
    const html = (0, page_js_1.getPageHtml)();
    // Look for event listener on tree-node-content that opens log viewer
    // Currently only .log-viewer-toggle has click handlers (lines 4359-4361)
    const hasRowClickHandler = html.includes("querySelectorAll('.tree-node-content')") &&
        html.includes('handleViewLogClick');
    assert(hasRowClickHandler, `BUG-007 DETECTED: No click handler found for step rows (.tree-node-content). ` +
        `Currently only the 'View Log' button is clickable. ` +
        `Users should be able to click the entire row to view logs.`);
});
/**
 * TEST 7: Steps with logs available should show visual clickable indication
 *
 * Steps that have log files should visually indicate they are clickable
 * (e.g., hover state change, subtle icon, etc.)
 */
test('BUG-007 DETECTION: clickable steps should have hover indication', () => {
    const html = (0, page_js_1.getPageHtml)();
    // Check for hover styles on tree-node-content
    const hasHoverStyles = html.includes('.tree-node-content:hover') &&
        (html.includes('background') || html.includes('text-decoration'));
    assert(hasHoverStyles, `BUG-007 DETECTED: Step rows should have :hover styles to indicate clickability. ` +
        `Users need visual feedback that steps are interactive.`);
});
// ============================================================================
// Regression Tests: Ensure existing functionality still works
// ============================================================================
/**
 * TEST 8: Completed steps should still show elapsed time
 *
 * Ensure the fix doesn't break existing elapsed display for completed steps
 */
test('completed steps still show elapsed time', () => {
    const progress = createInProgressStepProgress();
    const tree = (0, transforms_js_1.buildPhaseTree)(progress);
    const completedStep = tree[0].children[0]; // step-0 is completed
    assertEqual(completedStep.status, 'completed', 'Step should be completed');
    assertEqual(completedStep.elapsed, '5m 0s', 'Completed step should have elapsed time');
});
/**
 * TEST 9: View Log button should still work for leaf nodes
 *
 * The existing View Log button functionality should not be affected
 */
test('View Log button is still rendered for leaf nodes', () => {
    const html = (0, page_js_1.getPageHtml)();
    // The renderTreeNode function should still create View Log buttons
    assert(html.includes('log-viewer-toggle') && html.includes('View Log'), 'View Log button should still be present in the HTML template');
});
//# sourceMappingURL=step-duration-clickable.test.js.map