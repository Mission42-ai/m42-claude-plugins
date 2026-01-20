/**
 * Tests for BUG-006: Total Sprint Duration Not Displayed
 *
 * Issue: The sprint detail page does not prominently display the total
 * sprint duration. For completed sprints, users cannot see how long the
 * sprint took in total.
 *
 * Expected behavior:
 * - For completed sprints: show final total elapsed time (e.g., "2h 34m 12s")
 * - For running sprints: show current elapsed time (updating)
 * - Format should be human-readable
 *
 * Location: Status server sprint detail page (page.ts)
 */

// Simple test runner (consistent with project patterns)
function test(name: string, fn: () => void | Promise<void>): void {
  const result = fn();
  if (result instanceof Promise) {
    result
      .then(() => console.log(`✓ ${name}`))
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
      });
  } else {
    try {
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

console.log('\n--- BUG-006: Total Sprint Duration Not Displayed Tests ---\n');

// ============================================================================
// Test: SprintHeader should include elapsed time for completed sprints
// ============================================================================

test('BUG-006: toStatusUpdate should include elapsed time in header for completed sprints', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create a completed sprint with elapsed time in stats
  const progress = {
    'sprint-id': 'test-sprint-completed',
    status: 'completed' as const,
    current: { phase: 0, step: null, 'sub-phase': null },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      'completed-at': '2025-01-20T12:34:12Z',
      elapsed: '2h 34m',  // This should be passed through to the header
      'total-phases': 5,
      'completed-phases': 5,
    },
    phases: [
      {
        id: 'phase-1',
        status: 'completed' as const,
        prompt: 'First phase',
      },
    ],
  };

  const update = toStatusUpdate(progress as any);

  // BUG-006: The header should include elapsed time from stats
  assert(update.header.elapsed !== undefined, 'Header should have elapsed time');
  assertEqual(update.header.elapsed, '2h 34m', 'Header elapsed should match stats.elapsed');
});

test('BUG-006: toStatusUpdate should include elapsed time in header for in-progress sprints', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create an in-progress sprint with elapsed time
  const progress = {
    'sprint-id': 'test-sprint-running',
    status: 'in-progress' as const,
    current: { phase: 0, step: 0, 'sub-phase': 0 },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      elapsed: '45m 30s',  // Current elapsed time
      'total-phases': 5,
      'completed-phases': 2,
    },
    phases: [
      {
        id: 'phase-1',
        status: 'in-progress' as const,
        prompt: 'First phase',
      },
    ],
  };

  const update = toStatusUpdate(progress as any);

  // The header should include elapsed time
  assert(update.header.elapsed !== undefined, 'Header should have elapsed time for running sprint');
  assertEqual(update.header.elapsed, '45m 30s', 'Header elapsed should match stats.elapsed');
});

// ============================================================================
// Test: Page HTML should have prominent total duration display
// ============================================================================

test('BUG-006: Page HTML should include a dedicated total duration element', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // BUG-006: The page should have a clearly labeled "Total Duration" element
  // The current implementation has an "elapsed" element in the footer,
  // but it's not prominently labeled and may not work correctly for completed sprints

  // Check for a dedicated total duration display element
  const hasTotalDurationLabel = html.includes('Total Duration') ||
                                 html.includes('total-duration') ||
                                 html.includes('Total:');

  // Check for the elapsed element (current implementation)
  const hasElapsedElement = html.includes('id="elapsed"');

  assert(hasElapsedElement, 'Page should have an elapsed element');

  // BUG-006: The key issue - there should be a PROMINENT total duration display
  // The current "elapsed" element in the footer is not prominent enough
  // and the label "Total:" is only added by JavaScript, not visible in initial HTML

  // Check if the elapsed element has a visible label in the HTML (not just JS)
  const elapsedSection = html.match(/<div[^>]*class="[^"]*elapsed[^"]*"[^>]*>[\s\S]*?<\/div>/);

  // This test should FAIL because:
  // 1. The elapsed element has no visible label in the HTML structure
  // 2. It's in the footer which is not prominent
  // 3. The "Total:" prefix is only added dynamically by JavaScript

  // For this bug to be fixed, we need either:
  // - A visible "Total Duration:" label in the HTML
  // - Or a more prominent placement in the header area

  // Check for a header-level duration display (which doesn't exist currently)
  const hasHeaderDuration = html.includes('sprint-duration') ||
                            html.includes('header-elapsed') ||
                            (html.includes('header') && html.includes('Duration'));

  // This assertion should FAIL with current code - no prominent duration in header
  assert(
    hasHeaderDuration,
    'BUG-006: Page should have a prominent total duration display in the header area. ' +
    'Currently the elapsed time is only shown in a small footer element without a visible label.'
  );
});

test('BUG-006: Page CSS should style total duration prominently', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // Extract CSS from the page
  const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  assert(cssMatch !== null, 'Page should have embedded CSS');

  const css = cssMatch![1];

  // BUG-006: Check if there's styling for a prominent duration display
  // The current .elapsed class is styled minimally

  // Check for a visible, prominent duration style
  const hasProminentDurationStyle =
    css.includes('.sprint-duration') ||
    css.includes('.total-duration') ||
    css.includes('.header-elapsed');

  // This should FAIL - no prominent duration styling exists
  assert(
    hasProminentDurationStyle,
    'BUG-006: CSS should include prominent styling for total duration display. ' +
    'Currently .elapsed is styled as muted text in the footer.'
  );
});

// ============================================================================
// Test: JavaScript should correctly display duration for completed sprints
// ============================================================================

test('BUG-006: Page JavaScript should set elapsed for completed sprints without relying on timer', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // Extract JavaScript from the page
  const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert(jsMatch !== null, 'Page should have embedded JavaScript');

  const js = jsMatch![1];

  // BUG-006: The key bug is in the updateHeader function.
  // It only sets: elements.elapsed.dataset.startedAt = header.startedAt
  // It NEVER sets: elements.elapsed.textContent = header.elapsed
  //
  // The timer function (updateElapsedTimes) would set the textContent,
  // BUT for completed sprints it returns early without setting anything!
  //
  // The fix requires: when header.status is 'completed', directly set
  // elements.elapsed.textContent from header.elapsed

  // Check for the specific pattern: in updateHeader, when status is completed,
  // set elapsed textContent from header.elapsed
  const updateHeaderSection = js.match(/function updateHeader[\s\S]*?function \w+/);

  // Look for the pattern where header.elapsed is used to set textContent
  // in the context of completed sprints
  const setsElapsedForCompletedInHeader =
    js.includes("elements.elapsed.textContent = 'Total: ' + header.elapsed") ||
    js.includes('elements.elapsed.textContent = header.elapsed') ||
    js.includes("header.elapsed") && js.includes("elements.elapsed.textContent") &&
    (js.includes("completed") || js.includes("status"));

  // More specific check: updateHeader should handle elapsed for completed sprints
  // by checking header.elapsed and setting it directly, not relying on timer
  const updateHeaderHandlesElapsed = updateHeaderSection !== null &&
    updateHeaderSection[0].includes('header.elapsed') &&
    updateHeaderSection[0].includes('elements.elapsed.textContent');

  // This should FAIL - the current updateHeader function never sets elapsed textContent
  // It only sets dataset.startedAt, and relies on timer which skips completed sprints
  assert(
    updateHeaderHandlesElapsed,
    'BUG-006: updateHeader function should directly set elements.elapsed.textContent ' +
    'from header.elapsed for completed/terminal sprints. Currently updateHeader only sets ' +
    'dataset.startedAt, and the timer (updateElapsedTimes) skips completed sprints, ' +
    'so the elapsed time is NEVER displayed for completed sprints.'
  );
});

// ============================================================================
// Test: Header should have startedAt for duration calculation
// ============================================================================

test('BUG-006: toStatusUpdate header should include startedAt for duration calculation', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  const progress = {
    'sprint-id': 'test-sprint',
    status: 'completed' as const,
    current: { phase: 0, step: null, 'sub-phase': null },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      'completed-at': '2025-01-20T12:00:00Z',
      elapsed: '2h 0m',
      'total-phases': 1,
      'completed-phases': 1,
    },
    phases: [],
  };

  const update = toStatusUpdate(progress as any);

  // Header should have startedAt
  assert(update.header.startedAt !== undefined, 'Header should have startedAt');
  assertEqual(update.header.startedAt, '2025-01-20T10:00:00Z', 'startedAt should match stats');
});

console.log('\nBUG-006 tests completed.\n');
