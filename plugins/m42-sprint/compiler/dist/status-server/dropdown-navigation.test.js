"use strict";
/**
 * Tests for Dropdown Navigation - Step 2: Sprint Dropdown Switching
 *
 * These tests verify that:
 * 1. Dropdown triggers full page navigation to /sprint/{id}
 * 2. Existing SSE connection is closed before navigation
 * 3. Loading indicator is shown during navigation
 *
 * RED Phase: All tests should FAIL until implementation is complete.
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
console.log('\n--- Step 2: Dropdown Navigation Tests ---\n');
// ============================================================================
// Test: Navigation bar generates correct HTML with dropdown
// ============================================================================
test('generateNavigationBar should include sprint dropdown with onchange handler', async () => {
    // Import the page module
    const { getPageHtml } = await import('./page.js');
    const navigation = {
        currentSprintId: 'sprint-2026-01-20',
        availableSprints: [
            { sprintId: 'sprint-2026-01-20', status: 'in-progress' },
            { sprintId: 'sprint-2026-01-19', status: 'completed' },
            { sprintId: 'sprint-2026-01-18', status: 'completed' },
        ],
    };
    const html = getPageHtml(navigation);
    // The dropdown should include an onchange handler that navigates
    assert(html.includes('sprint-select'), 'HTML should contain sprint-select element');
    assert(html.includes('onchange'), 'Dropdown should have onchange handler');
});
test('dropdown onchange should navigate to /sprint/{id}', async () => {
    const { getPageHtml } = await import('./page.js');
    const navigation = {
        currentSprintId: 'sprint-A',
        availableSprints: [
            { sprintId: 'sprint-A', status: 'in-progress' },
            { sprintId: 'sprint-B', status: 'completed' },
        ],
    };
    const html = getPageHtml(navigation);
    // The onchange should update window.location.href to /sprint/{selected}
    assert(html.includes("window.location.href") || html.includes("location.href"), 'Dropdown onchange should set window.location.href');
    assert(html.includes("/sprint/"), 'Navigation should go to /sprint/ path');
});
// ============================================================================
// Test: SSE connection closing before navigation
// ============================================================================
test('dropdown change should close existing SSE connection', async () => {
    const { getPageHtml } = await import('./page.js');
    const navigation = {
        currentSprintId: 'sprint-A',
        availableSprints: [
            { sprintId: 'sprint-A', status: 'in-progress' },
            { sprintId: 'sprint-B', status: 'completed' },
        ],
    };
    const html = getPageHtml(navigation);
    // The JavaScript should handle SSE cleanup before navigation
    // Look for either:
    // 1. closeEventSource() call
    // 2. eventSource.close() call
    // 3. A handler that closes SSE before navigation
    const hasSSECloseLogic = html.includes('closeEventSource') ||
        html.includes('eventSource.close()') ||
        html.includes('closeSSE') ||
        (html.includes('EventSource') && html.includes('.close()'));
    assert(hasSSECloseLogic, 'JavaScript should close SSE connection before navigation (RED: expected to fail)');
});
// ============================================================================
// Test: Loading indicator during navigation
// ============================================================================
test('dropdown change should show loading indicator', async () => {
    const { getPageHtml } = await import('./page.js');
    const navigation = {
        currentSprintId: 'sprint-A',
        availableSprints: [
            { sprintId: 'sprint-A', status: 'in-progress' },
        ],
    };
    const html = getPageHtml(navigation);
    // The page should have:
    // 1. A loading indicator element (hidden by default)
    // 2. JavaScript that shows it during navigation
    const hasLoadingElement = html.includes('sprint-loading') ||
        html.includes('loading-indicator') ||
        html.includes('loading-overlay') ||
        html.includes('nav-loading');
    assert(hasLoadingElement, 'Page should have a loading indicator element (RED: expected to fail)');
});
test('loading indicator should be shown when dropdown changes', async () => {
    const { getPageHtml } = await import('./page.js');
    const navigation = {
        currentSprintId: 'sprint-A',
        availableSprints: [
            { sprintId: 'sprint-A', status: 'in-progress' },
            { sprintId: 'sprint-B', status: 'completed' },
        ],
    };
    const html = getPageHtml(navigation);
    // The onchange handler should show the loading indicator
    // This could be:
    // 1. showLoading() function call
    // 2. Setting display: block on loading element
    // 3. Adding a CSS class like 'loading'
    const showsLoadingOnChange = html.includes('showLoading') ||
        html.includes('showSprintLoading') ||
        (html.includes('loading') && html.includes('style.display')) ||
        html.includes("classList.add('loading')") ||
        html.includes('addClass.*loading');
    assert(showsLoadingOnChange, 'Dropdown change should show loading indicator (RED: expected to fail)');
});
console.log('\nDropdown navigation tests completed.\n');
//# sourceMappingURL=dropdown-navigation.test.js.map