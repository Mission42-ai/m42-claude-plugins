"use strict";
/**
 * Tests for BUG-001: Sprint Steps Show No Progress Indicators
 *
 * This test verifies that step status indicators are correctly rendered
 * in the sprint detail page. The bug was that all steps showed as empty
 * circles (pending) regardless of their actual status.
 *
 * The test flow:
 * 1. Create a PROGRESS.yaml-like structure with mixed step statuses
 * 2. Transform it via buildPhaseTree/toStatusUpdate
 * 3. Simulate the client-side renderTreeNode logic
 * 4. Verify the HTML contains correct CSS classes for each status
 *
 * This test targets the rendering layer to ensure status CSS classes
 * are correctly applied to step icons.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Simple test infrastructure
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
    console.log('\n=== BUG-001: Step Progress Indicators Rendering Tests ===\n');
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
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Simulates the client-side renderTreeNode function from page.ts
 * This is the exact logic that generates the tree icon HTML
 */
function renderTreeNode(node, parentPath = '') {
    const nodePath = parentPath ? parentPath + '/' + node.id : node.id;
    const hasChildren = node.children && node.children.length > 0;
    const depth = node.depth || 0;
    const indent = depth * 16;
    let html = `<div class="tree-node" style="padding-left: ${indent}px">`;
    html += '<div class="tree-node-content">';
    if (hasChildren) {
        html += `<span class="tree-toggle collapsed" data-node-id="${nodePath}"></span>`;
    }
    else {
        html += '<span class="tree-toggle leaf"></span>';
    }
    // THIS IS THE CRITICAL LINE - status becomes a CSS class
    html += `<span class="tree-icon ${node.status}"></span>`;
    html += `<span class="tree-label" title="${escapeHtml(node.label)}">${escapeHtml(node.label)}</span>`;
    if (node.elapsed) {
        html += `<span class="tree-elapsed">${node.elapsed}</span>`;
    }
    html += '</div>';
    if (hasChildren && node.children) {
        html += '<div class="tree-children collapsed">';
        html += node.children.map((child) => renderTreeNode(child, nodePath)).join('');
        html += '</div>';
    }
    html += '</div>';
    return html;
}
// ============================================================================
// Test: Step status should create correct CSS class
// ============================================================================
test('BUG-001: Completed step should render with "completed" CSS class', async () => {
    const node = {
        id: 'step-0',
        label: 'Implement feature A',
        status: 'completed',
        type: 'step',
        depth: 1,
        elapsed: '15m 0s',
        children: [],
    };
    const html = renderTreeNode(node);
    // The tree-icon should have the 'completed' class
    assert(html.includes('class="tree-icon completed"'), `Expected HTML to contain 'class="tree-icon completed"', but got: ${html}`);
    // Should NOT have pending class
    assert(!html.includes('class="tree-icon pending"'), 'Completed step should not have pending class');
});
test('BUG-001: In-progress step should render with "in-progress" CSS class', async () => {
    const node = {
        id: 'step-1',
        label: 'Implement feature B',
        status: 'in-progress',
        type: 'step',
        depth: 1,
        children: [],
    };
    const html = renderTreeNode(node);
    assert(html.includes('class="tree-icon in-progress"'), `Expected HTML to contain 'class="tree-icon in-progress"', but got: ${html}`);
});
test('BUG-001: Pending step should render with "pending" CSS class', async () => {
    const node = {
        id: 'step-2',
        label: 'Implement feature C',
        status: 'pending',
        type: 'step',
        depth: 1,
        children: [],
    };
    const html = renderTreeNode(node);
    assert(html.includes('class="tree-icon pending"'), `Expected HTML to contain 'class="tree-icon pending"', but got: ${html}`);
});
test('BUG-001: Failed step should render with "failed" CSS class', async () => {
    const node = {
        id: 'step-3',
        label: 'Failing step',
        status: 'failed',
        type: 'step',
        depth: 1,
        error: 'Build failed',
        children: [],
    };
    const html = renderTreeNode(node);
    assert(html.includes('class="tree-icon failed"'), `Expected HTML to contain 'class="tree-icon failed"', but got: ${html}`);
});
// ============================================================================
// Test: Mixed status tree should render all indicators correctly
// ============================================================================
test('BUG-001: Mixed status tree should show different indicators for each step', async () => {
    // This simulates a typical in-progress sprint where:
    // - First step is completed
    // - Second step is in-progress
    // - Third step is pending
    const phaseNode = {
        id: 'development',
        label: 'Development Phase',
        status: 'in-progress',
        type: 'phase',
        depth: 0,
        children: [
            {
                id: 'step-0',
                label: 'Implement feature A',
                status: 'completed',
                type: 'step',
                depth: 1,
                elapsed: '15m 0s',
            },
            {
                id: 'step-1',
                label: 'Implement feature B',
                status: 'in-progress',
                type: 'step',
                depth: 1,
            },
            {
                id: 'step-2',
                label: 'Implement feature C',
                status: 'pending',
                type: 'step',
                depth: 1,
            },
        ],
    };
    const html = renderTreeNode(phaseNode);
    // Count occurrences of each status class
    const completedMatches = html.match(/class="tree-icon completed"/g) || [];
    const inProgressMatches = html.match(/class="tree-icon in-progress"/g) || [];
    const pendingMatches = html.match(/class="tree-icon pending"/g) || [];
    // BUG-001: This is the critical assertion
    // If the bug exists, all steps would have 'pending' status
    // Expected: 1 completed, 2 in-progress (phase + step), 1 pending
    assert(completedMatches.length === 1, `Expected 1 completed indicator, got ${completedMatches.length}`);
    assert(inProgressMatches.length === 2, `Expected 2 in-progress indicators (phase + step), got ${inProgressMatches.length}`);
    assert(pendingMatches.length === 1, `Expected 1 pending indicator, got ${pendingMatches.length}`);
});
// ============================================================================
// Test: Verify CSS classes are valid (match page.ts CSS definitions)
// ============================================================================
test('BUG-001: All status values should produce valid CSS class names', async () => {
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'blocked', 'skipped'];
    for (const status of validStatuses) {
        const node = {
            id: `test-${status}`,
            label: `Test ${status}`,
            status,
            type: 'step',
            depth: 0,
        };
        const html = renderTreeNode(node);
        // Each status should produce a valid CSS class (no undefined, no empty)
        assert(html.includes(`class="tree-icon ${status}"`), `Status "${status}" should produce 'class="tree-icon ${status}"', but got: ${html}`);
        // Ensure no "undefined" in the class
        assert(!html.includes('undefined'), `Status "${status}" should not produce "undefined" in HTML`);
    }
});
// ============================================================================
// Test: End-to-end with buildPhaseTree from transforms
// ============================================================================
test('BUG-001: E2E - buildPhaseTree output renders with correct status classes', async () => {
    const { buildPhaseTree } = await import('./transforms.js');
    // Create a progress structure similar to what runtime would produce
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
    // Build the phase tree using the actual transforms
    const tree = buildPhaseTree(progress);
    // Render the tree to HTML
    let html = '';
    for (const node of tree) {
        html += renderTreeNode(node);
    }
    // BUG-001: Verify the rendered HTML has correct status classes
    // If the bug exists (steps stuck at pending), we'd see 0 completed and 0 in-progress
    assert(html.includes('class="tree-icon completed"'), 'Rendered HTML should include completed status class for completed step');
    assert(html.includes('class="tree-icon in-progress"'), 'Rendered HTML should include in-progress status class for in-progress step');
    assert(html.includes('class="tree-icon pending"'), 'Rendered HTML should include pending status class for pending step');
});
console.log('\nBUG-001 Step Indicators Rendering Tests loaded.\n');
//# sourceMappingURL=step-indicators.test.js.map