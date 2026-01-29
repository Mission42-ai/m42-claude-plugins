/**
 * Tests for Worktree Cleanup Module
 *
 * Tests cleanup logic for sprint worktree lifecycle management.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

import {
  isTerminalState,
  performSafetyChecks,
  shouldAutoCleanup,
  formatCleanupResult,
  formatCleanupPrompt,
  TERMINAL_STATES,
  type CleanupContext,
  type CleanupResult,
  type CleanupOptions,
} from './cleanup.js';

// ============================================================================
// Test Utilities
// ============================================================================

function test(name: string, fn: () => void | Promise<void>): void {
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(actual: string, substring: string, message?: string): void {
  if (!actual.includes(substring)) {
    throw new Error(message ?? `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substring)}`);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockContext(overrides: Partial<CleanupContext> = {}): CleanupContext {
  return {
    sprintId: '2026-01-20_test-sprint',
    sprintDir: '/repo/.claude/sprints/2026-01-20_test-sprint',
    status: 'completed',
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/2026-01-20_test-sprint',
      path: '/repo-test-worktree',
      cleanup: 'on-complete',
    },
    worktreePath: '/repo-test-worktree',
    branch: 'sprint/2026-01-20_test-sprint',
    hasUncommittedChanges: false,
    hasUnpushedCommits: false,
    isMergedToMain: true,
    repoRoot: '/repo',
    ...overrides,
  };
}

// ============================================================================
// Tests: Terminal State Detection
// ============================================================================

console.log('\n--- Terminal State Detection ---\n');

test('isTerminalState: completed is terminal', () => {
  assertEqual(isTerminalState('completed'), true);
});

test('isTerminalState: blocked is terminal', () => {
  assertEqual(isTerminalState('blocked'), true);
});

test('isTerminalState: paused is terminal', () => {
  assertEqual(isTerminalState('paused'), true);
});

test('isTerminalState: in-progress is not terminal', () => {
  assertEqual(isTerminalState('in-progress'), false);
});

test('isTerminalState: pending is not terminal', () => {
  assertEqual(isTerminalState('pending'), false);
});

test('TERMINAL_STATES includes expected states', () => {
  assert(TERMINAL_STATES.includes('completed'), 'Should include completed');
  assert(TERMINAL_STATES.includes('blocked'), 'Should include blocked');
  assert(TERMINAL_STATES.includes('paused'), 'Should include paused');
  assert(!TERMINAL_STATES.includes('in-progress'), 'Should not include in-progress');
});

// ============================================================================
// Tests: Safety Checks
// ============================================================================

console.log('\n--- Safety Checks ---\n');

test('performSafetyChecks: allows completed sprint without issues', () => {
  const context = createMockContext();
  const result = performSafetyChecks(context);
  assertEqual(result.safe, true);
});

test('performSafetyChecks: blocks in-progress sprints', () => {
  const context = createMockContext({ status: 'in-progress' });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, false);
  assertContains(result.reason || '', 'in-progress');
  assertEqual(result.forceOverridable, false);
});

test('performSafetyChecks: blocks uncommitted changes without force', () => {
  const context = createMockContext({ hasUncommittedChanges: true });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, false);
  assertContains(result.reason || '', 'uncommitted');
  assertEqual(result.forceOverridable, true);
});

test('performSafetyChecks: allows uncommitted changes with force', () => {
  const context = createMockContext({ hasUncommittedChanges: true });
  const result = performSafetyChecks(context, { force: true });
  assertEqual(result.safe, true);
});

test('performSafetyChecks: blocks unpushed commits without force', () => {
  const context = createMockContext({ hasUnpushedCommits: true });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, false);
  assertContains(result.reason || '', 'unpushed');
  assertEqual(result.forceOverridable, true);
});

test('performSafetyChecks: allows unpushed commits with force', () => {
  const context = createMockContext({ hasUnpushedCommits: true });
  const result = performSafetyChecks(context, { force: true });
  assertEqual(result.safe, true);
});

test('performSafetyChecks: allows pending sprints', () => {
  const context = createMockContext({ status: 'pending' });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, true);
});

test('performSafetyChecks: allows blocked sprints', () => {
  const context = createMockContext({ status: 'blocked' });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, true);
});

test('performSafetyChecks: allows paused sprints', () => {
  const context = createMockContext({ status: 'paused' });
  const result = performSafetyChecks(context);
  assertEqual(result.safe, true);
});

// ============================================================================
// Tests: Auto Cleanup Decision
// ============================================================================

console.log('\n--- Auto Cleanup Decision ---\n');

test('shouldAutoCleanup: returns true for completed sprint with on-complete mode', () => {
  const context = createMockContext({
    status: 'completed',
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/test',
      path: '/worktree',
      cleanup: 'on-complete',
    },
  });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, true);
  assertContains(result.reason, 'on-complete');
});

test('shouldAutoCleanup: returns false for blocked sprint with on-complete mode', () => {
  const context = createMockContext({
    status: 'blocked',
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/test',
      path: '/worktree',
      cleanup: 'on-complete',
    },
  });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, false);
});

test('shouldAutoCleanup: returns true for merged branch with on-merge mode', () => {
  const context = createMockContext({
    isMergedToMain: true,
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/test',
      path: '/worktree',
      cleanup: 'on-merge',
    },
  });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, true);
  assertContains(result.reason, 'merged');
});

test('shouldAutoCleanup: returns false for unmerged branch with on-merge mode', () => {
  const context = createMockContext({
    isMergedToMain: false,
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/test',
      path: '/worktree',
      cleanup: 'on-merge',
    },
  });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, false);
});

test('shouldAutoCleanup: returns false for never mode', () => {
  const context = createMockContext({
    status: 'completed',
    worktreeConfig: {
      enabled: true,
      branch: 'sprint/test',
      path: '/worktree',
      cleanup: 'never',
    },
  });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, false);
  assertContains(result.reason, 'never');
});

test('shouldAutoCleanup: returns false when no worktree config', () => {
  const context = createMockContext({ worktreeConfig: null });
  const result = shouldAutoCleanup(context);
  assertEqual(result.shouldCleanup, false);
});

// ============================================================================
// Tests: Output Formatting
// ============================================================================

console.log('\n--- Output Formatting ---\n');

test('formatCleanupResult: formats successful cleanup', () => {
  const context = createMockContext();
  const result: CleanupResult = {
    success: true,
    sprintId: context.sprintId,
    actions: [
      { type: 'worktree-remove', description: 'Removed worktree', success: true },
      { type: 'branch-delete', description: 'Deleted branch', success: true },
    ],
    summary: 'Cleanup complete',
    warnings: [],
  };

  const output = formatCleanupResult(result, context);
  assertContains(output, 'cleanup complete');
  assertContains(output, '[x]');
  assertContains(output, 'Worktree removed');
  assertContains(output, 'Branch deleted');
});

test('formatCleanupResult: formats failed cleanup', () => {
  const context = createMockContext();
  const result: CleanupResult = {
    success: false,
    sprintId: context.sprintId,
    actions: [],
    summary: '',
    warnings: [],
    error: 'Uncommitted changes',
  };

  const output = formatCleanupResult(result, context);
  assertContains(output, 'failed');
  assertContains(output, 'Uncommitted changes');
});

test('formatCleanupResult: includes warnings when present', () => {
  const context = createMockContext();
  const result: CleanupResult = {
    success: true,
    sprintId: context.sprintId,
    actions: [
      { type: 'worktree-remove', description: 'Removed worktree', success: true },
    ],
    summary: 'Cleanup complete',
    warnings: ['Could not delete branch: already deleted'],
  };

  const output = formatCleanupResult(result, context);
  assertContains(output, 'Warning');
  assertContains(output, 'already deleted');
});

test('formatCleanupPrompt: includes sprint details', () => {
  const context = createMockContext();
  const output = formatCleanupPrompt(context);

  assertContains(output, context.sprintId);
  assertContains(output, context.worktreePath!);
  assertContains(output, context.branch!);
  assertContains(output, 'Cleanup will');
});

test('formatCleanupPrompt: shows warning for uncommitted changes', () => {
  const context = createMockContext({ hasUncommittedChanges: true });
  const output = formatCleanupPrompt(context);

  assertContains(output, 'WARNING');
  assertContains(output, 'uncommitted');
});

test('formatCleanupPrompt: shows warning for unpushed commits', () => {
  const context = createMockContext({ hasUnpushedCommits: true });
  const output = formatCleanupPrompt(context);

  assertContains(output, 'WARNING');
  assertContains(output, 'unpushed');
});

test('formatCleanupPrompt: notes when branch is merged', () => {
  const context = createMockContext({ isMergedToMain: true });
  const output = formatCleanupPrompt(context);

  assertContains(output, 'merged to main');
});

console.log('\n--- All Cleanup Tests Complete ---\n');
