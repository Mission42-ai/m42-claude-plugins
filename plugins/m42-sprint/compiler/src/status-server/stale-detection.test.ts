/**
 * Tests for Stale Sprint Detection - Step 2
 *
 * These tests verify that:
 * 1. Sprint is marked stale if in-progress and last-activity > 15 minutes
 * 2. Active sprints (last-activity < 15 minutes) are NOT stale
 * 3. StatusUpdate includes isStale flag
 * 4. UI shows "Stale" badge and "Resume Sprint" button
 *
 * RED Phase: All tests should FAIL until implementation is complete.
 */

import * as path from 'path';
import * as fs from 'fs';

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

console.log('\n--- Step 2: Stale Sprint Detection Tests ---\n');

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a timestamp that is X minutes in the past
 */
function minutesAgo(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

/**
 * Create a mock CompiledProgress for testing staleness
 */
function createMockProgress(overrides: Record<string, unknown> = {}): unknown {
  return {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    current: { phase: 0, step: 0, 'sub-phase': 0 },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      'total-phases': 3,
      'completed-phases': 1,
    },
    phases: [
      {
        id: 'phase-1',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'Test step',
            status: 'in-progress',
            phases: [{ id: 'sub-1', status: 'in-progress', prompt: 'Sub phase' }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Test: Stale detection - isStale flag in transforms
// ============================================================================

test('toStatusUpdate should include isStale flag', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create progress with recent activity (not stale)
  const progress = createMockProgress({
    'last-activity': minutesAgo(5), // 5 minutes ago - not stale
  });

  const update = toStatusUpdate(progress as any);

  // The header should have an isStale field
  assert(
    'isStale' in update.header,
    'StatusUpdate header should have isStale field (RED: expected to fail)'
  );
});

test('sprint with last-activity > 15 minutes should be marked stale', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create progress with old activity (stale)
  const progress = createMockProgress({
    status: 'in-progress',
    'last-activity': minutesAgo(20), // 20 minutes ago - should be stale
  });

  const update = toStatusUpdate(progress as any);

  // Should be marked as stale
  assertEqual(
    (update.header as any).isStale,
    true,
    'Sprint with last-activity > 15 min should be stale (RED: expected to fail)'
  );
});

test('sprint with last-activity < 15 minutes should NOT be marked stale', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create progress with recent activity (not stale)
  const progress = createMockProgress({
    status: 'in-progress',
    'last-activity': minutesAgo(5), // 5 minutes ago - not stale
  });

  const update = toStatusUpdate(progress as any);

  // Should NOT be marked as stale
  assertEqual(
    (update.header as any).isStale,
    false,
    'Sprint with last-activity < 15 min should NOT be stale (RED: expected to fail)'
  );
});

test('completed sprint should NOT be marked stale regardless of last-activity', async () => {
  const { toStatusUpdate } = await import('./transforms.js');

  // Create completed progress with old activity
  const progress = createMockProgress({
    status: 'completed',
    'last-activity': minutesAgo(60), // 1 hour ago
  });

  const update = toStatusUpdate(progress as any);

  // Completed sprints should never be stale
  assertEqual(
    (update.header as any).isStale,
    false,
    'Completed sprint should NOT be stale (RED: expected to fail)'
  );
});

// ============================================================================
// Test: Stale indicator in page.ts
// ============================================================================

test('page.ts should have stale badge styling', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // Check for stale-related CSS
  const hasStaleBadgeCSS =
    html.includes('.stale') ||
    html.includes('status-badge.stale') ||
    html.includes('stale-badge');

  assert(
    hasStaleBadgeCSS,
    'Page CSS should include stale badge styling (RED: expected to fail)'
  );
});

test('page.ts should render Stale badge for stale sprints', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // The JavaScript should handle rendering a "Stale" badge
  // when isStale is true
  const hasStaleRendering =
    html.includes('Stale') ||
    html.includes('stale') ||
    html.includes('isStale');

  assert(
    hasStaleRendering,
    'Page JavaScript should render Stale badge (RED: expected to fail)'
  );
});

test('page.ts should have Resume Sprint button', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // Check for resume button
  const hasResumeButton =
    html.includes('Resume Sprint') ||
    html.includes('resume-sprint') ||
    html.includes('resumeSprint') ||
    html.includes('resume-btn');

  assert(
    hasResumeButton,
    'Page should have Resume Sprint button (RED: expected to fail)'
  );
});

test('Resume button should call resume API endpoint', async () => {
  const { getPageHtml } = await import('./page.js');

  const html = getPageHtml();

  // The resume button should call the /api/sprint/:id/resume endpoint
  const callsResumeApi =
    html.includes('/api/sprint') && html.includes('resume') ||
    html.includes("api/resume") ||
    html.includes("'/resume'");

  assert(
    callsResumeApi,
    'Resume button should call resume API endpoint (RED: expected to fail)'
  );
});

console.log('\nStale detection tests completed.\n');
