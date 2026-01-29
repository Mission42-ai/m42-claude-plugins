/**
 * Tests for transition function - Sprint state machine
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 */

// Re-export types from compiler (these will be re-exported from transition.ts)
// For now, define inline until transition.ts exists
import type {
  SprintState,
  SprintEvent,
  SprintAction,
  TransitionResult,
  CompiledProgress,
  CurrentPointer,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
} from './transition.js';

// These will be implemented in transition.ts
import {
  transition,
  advancePointer,
  calculateBackoff,
  getCurrentPhase,
  getCurrentStep,
  getCurrentSubPhase,
} from './transition.js';

// ============================================================================
// Test Utilities
// ============================================================================

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(message ?? `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`);
  }
}

function assertContainsAction(actions: SprintAction[], type: SprintAction['type']): void {
  const found = actions.some((a: SprintAction) => a.type === type);
  if (!found) {
    throw new Error(`Expected actions to contain ${type}, got: ${JSON.stringify(actions.map((a: SprintAction) => a.type))}`);
  }
}

function assertNoActions(result: TransitionResult): void {
  if (result.actions.length > 0) {
    throw new Error(`Expected no actions, got: ${JSON.stringify(result.actions.map((a: SprintAction) => a.type))}`);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createMinimalContext(): CompiledProgress {
  return {
    'sprint-id': 'test-sprint',
    status: 'not-started',
    current: { phase: 0, step: null, 'sub-phase': null },
    stats: {
      'started-at': null,
      'total-phases': 2,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'phase-0',
        status: 'pending',
        prompt: 'First phase prompt',
      },
      {
        id: 'phase-1',
        status: 'pending',
        prompt: 'Second phase prompt',
      },
    ],
  };
}

function createContextWithSteps(): CompiledProgress {
  return {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    current: { phase: 0, step: 0, 'sub-phase': 0 },
    stats: {
      'started-at': '2026-01-20T10:00:00Z',
      'total-phases': 1,
      'completed-phases': 0,
      'total-steps': 2,
      'completed-steps': 0,
    },
    phases: [
      {
        id: 'development',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'First step',
            status: 'in-progress',
            phases: [
              { id: 'red', status: 'in-progress', prompt: 'Write tests' },
              { id: 'green', status: 'pending', prompt: 'Implement' },
              { id: 'refactor', status: 'pending', prompt: 'Refactor' },
            ],
          },
          {
            id: 'step-1',
            prompt: 'Second step',
            status: 'pending',
            phases: [
              { id: 'red', status: 'pending', prompt: 'Write tests' },
              { id: 'green', status: 'pending', prompt: 'Implement' },
            ],
          },
        ],
      },
    ],
  };
}

function createContextWithRetry(): CompiledProgress {
  const ctx = createMinimalContext();
  ctx.retry = {
    maxAttempts: 3,
    backoffMs: [1000, 2000, 4000],
    retryOn: ['network', 'rate-limit', 'timeout'],
  };
  return ctx;
}

function createContextWithOrchestration(autoApprove: boolean): CompiledProgress {
  const ctx = createMinimalContext();
  ctx.orchestration = {
    enabled: true,
    autoApprove,
    insertStrategy: 'after-current',
  };
  return ctx;
}

// ============================================================================
// Test: START Event
// ============================================================================

console.log('\n=== START Event Tests ===\n');

test('START: transitions not-started → in-progress', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should transition to in-progress');
});

test('START: returns SPAWN_CLAUDE action', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'SPAWN_CLAUDE');
});

test('START: sets startedAt timestamp', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'in-progress', 'Must be in-progress');
  if (result.nextState.status === 'in-progress') {
    assert('startedAt' in result.nextState, 'Must have startedAt');
    assert(typeof result.nextState.startedAt === 'string', 'startedAt must be string');
  }
});

test('START: initializes iteration to 1', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'in-progress', 'Must be in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.iteration, 1, 'Iteration should start at 1');
  }
});

test('START: no-op if already in-progress', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 5,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  assert(result.nextState.status === 'in-progress' && result.nextState.iteration === 5, 'Iteration unchanged');
  assertNoActions(result);
});

// ============================================================================
// Test: PHASE_COMPLETE Event
// ============================================================================

console.log('\n=== PHASE_COMPLETE Event Tests ===\n');

test('PHASE_COMPLETE: advances to next phase when more phases exist', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Phase 0 done', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.current.phase, 1, 'Should advance to phase 1');
  }
});

test('PHASE_COMPLETE: transitions to completed when no more phases', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 1, step: null, 'sub-phase': null },
    iteration: 2,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'All done', phaseId: 'phase-1' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'completed', 'Should transition to completed');
});

test('PHASE_COMPLETE: returns WRITE_PROGRESS action', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Done', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'WRITE_PROGRESS');
});

test('PHASE_COMPLETE: advances sub-phase when more sub-phases exist', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: 0, 'sub-phase': 0 },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Red done', phaseId: 'red' };
  const context = createContextWithSteps();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.current['sub-phase'], 1, 'Should advance to sub-phase 1');
  }
});

test('PHASE_COMPLETE: advances step when no more sub-phases', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: 0, 'sub-phase': 2 }, // Last sub-phase
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Refactor done', phaseId: 'refactor' };
  const context = createContextWithSteps();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.current.step, 1, 'Should advance to step 1');
    assertEqual(result.nextState.current['sub-phase'], 0, 'Should reset sub-phase to 0');
  }
});

test('PHASE_COMPLETE: returns SPAWN_CLAUDE when advancing', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Done', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'SPAWN_CLAUDE');
});

test('PHASE_COMPLETE: increments iteration', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 3,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Done', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'in-progress', 'Must be in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.iteration, 4, 'Iteration should increment');
  }
});

// ============================================================================
// Test: PHASE_FAILED Event
// ============================================================================

console.log('\n=== PHASE_FAILED Event Tests ===\n');

test('PHASE_FAILED: retryable error schedules retry', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_FAILED', error: 'Network error', category: 'network', phaseId: 'phase-0' };
  const context = createContextWithRetry();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress for retry');
  assertContainsAction(result.actions, 'SCHEDULE_RETRY');
});

test('PHASE_FAILED: non-retryable error transitions to blocked', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_FAILED', error: 'Logic error', category: 'logic', phaseId: 'phase-0' };
  const context = createContextWithRetry();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'blocked', 'Should transition to blocked');
});

test('PHASE_FAILED: blocked state includes error details', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_FAILED', error: 'Something broke', category: 'logic', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'blocked', 'Should be blocked');
  if (result.nextState.status === 'blocked') {
    assertEqual(result.nextState.error, 'Something broke', 'Should include error message');
    assertEqual(result.nextState.failedPhase, 'phase-0', 'Should include failed phase');
  }
});

test('PHASE_FAILED: blocked state returns WRITE_PROGRESS', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_FAILED', error: 'Error', category: 'validation', phaseId: 'phase-0' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'WRITE_PROGRESS');
});

test('PHASE_FAILED: no retry config transitions to blocked immediately', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_FAILED', error: 'Network error', category: 'network', phaseId: 'phase-0' };
  const context = createMinimalContext(); // No retry config

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'blocked', 'Should block without retry config');
});

// ============================================================================
// Test: PAUSE Event
// ============================================================================

console.log('\n=== PAUSE Event Tests ===\n');

test('PAUSE: transitions in-progress → paused', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 1, step: null, 'sub-phase': null },
    iteration: 5,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PAUSE', reason: 'User requested' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'paused', 'Should transition to paused');
});

test('PAUSE: preserves current pointer in pausedAt', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 1, step: 2, 'sub-phase': 3 },
    iteration: 5,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PAUSE', reason: 'Break time' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'paused', 'Must be paused');
  if (result.nextState.status === 'paused') {
    assertDeepEqual(result.nextState.pausedAt, { phase: 1, step: 2, 'sub-phase': 3 }, 'Should preserve pointer');
  }
});

test('PAUSE: stores pause reason', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PAUSE', reason: 'Meeting time' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'paused', 'Must be paused');
  if (result.nextState.status === 'paused') {
    assertEqual(result.nextState.pauseReason, 'Meeting time', 'Should store reason');
  }
});

test('PAUSE: returns WRITE_PROGRESS action', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PAUSE', reason: 'Test' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'WRITE_PROGRESS');
});

// ============================================================================
// Test: RESUME Event
// ============================================================================

console.log('\n=== RESUME Event Tests ===\n');

test('RESUME: transitions paused → in-progress', () => {
  const state: SprintState = {
    status: 'paused',
    pausedAt: { phase: 1, step: null, 'sub-phase': null },
    pauseReason: 'User pause',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should transition to in-progress');
});

test('RESUME: restores current pointer from pausedAt', () => {
  const state: SprintState = {
    status: 'paused',
    pausedAt: { phase: 2, step: 3, 'sub-phase': 1 },
    pauseReason: 'Break',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'in-progress', 'Must be in-progress');
  if (result.nextState.status === 'in-progress') {
    assertDeepEqual(result.nextState.current, { phase: 2, step: 3, 'sub-phase': 1 }, 'Should restore pointer');
  }
});

test('RESUME: returns SPAWN_CLAUDE action', () => {
  const state: SprintState = {
    status: 'paused',
    pausedAt: { phase: 0, step: null, 'sub-phase': null },
    pauseReason: 'Test',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'SPAWN_CLAUDE');
});

test('RESUME: no-op if not paused', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  assertNoActions(result);
});

// ============================================================================
// Test: PROPOSE_STEPS Event
// ============================================================================

console.log('\n=== PROPOSE_STEPS Event Tests ===\n');

test('PROPOSE_STEPS: with autoApprove returns INSERT_STEP actions', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = {
    type: 'PROPOSE_STEPS',
    steps: [
      { prompt: 'New step 1', reasoning: 'Because reasons' },
      { prompt: 'New step 2', priority: 'high' },
    ],
    proposedBy: 'phase-0',
  };
  const context = createContextWithOrchestration(true); // autoApprove enabled

  const result = transition(state, event, context);

  const insertActions = result.actions.filter((a: SprintAction) => a.type === 'INSERT_STEP');
  assertEqual(insertActions.length, 2, 'Should have 2 INSERT_STEP actions');
});

test('PROPOSE_STEPS: without autoApprove updates step-queue context', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = {
    type: 'PROPOSE_STEPS',
    steps: [{ prompt: 'Queued step' }],
    proposedBy: 'phase-0',
  };
  const context = createContextWithOrchestration(false); // autoApprove disabled

  const result = transition(state, event, context);

  assert(result.context['step-queue'] !== undefined, 'Should update step-queue');
  assertEqual(result.context['step-queue']?.length, 1, 'Should have 1 queued step');
});

test('PROPOSE_STEPS: no-op if orchestration disabled', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = {
    type: 'PROPOSE_STEPS',
    steps: [{ prompt: 'Should be ignored' }],
    proposedBy: 'phase-0',
  };
  const context = createMinimalContext(); // No orchestration config

  const result = transition(state, event, context);

  assertNoActions(result);
  assertEqual(result.context['step-queue'], undefined, 'Should not add to queue');
});

test('PROPOSE_STEPS: generates unique IDs for queued steps', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = {
    type: 'PROPOSE_STEPS',
    steps: [{ prompt: 'Step A' }, { prompt: 'Step B' }],
    proposedBy: 'phase-0',
  };
  const context = createContextWithOrchestration(false);

  const result = transition(state, event, context);

  const queue = result.context['step-queue'];
  assert(queue !== undefined, 'Should have step-queue');
  if (queue) {
    assert(queue.length === 2, 'Should have 2 items');
    assert(queue[0].id !== queue[1].id, 'IDs should be unique');
  }
});

// ============================================================================
// Test: MAX_ITERATIONS_REACHED Event
// ============================================================================

console.log('\n=== MAX_ITERATIONS_REACHED Event Tests ===\n');

test('MAX_ITERATIONS_REACHED: transitions to blocked', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 100,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'MAX_ITERATIONS_REACHED' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'blocked', 'Should transition to blocked');
});

test('MAX_ITERATIONS_REACHED: includes appropriate error message', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 50,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'MAX_ITERATIONS_REACHED' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'blocked', 'Must be blocked');
  if (result.nextState.status === 'blocked') {
    assert(result.nextState.error.includes('iteration'), 'Error should mention iterations');
  }
});

// ============================================================================
// Test: HUMAN_NEEDED Event
// ============================================================================

console.log('\n=== HUMAN_NEEDED Event Tests ===\n');

test('HUMAN_NEEDED: transitions to needs-human', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'HUMAN_NEEDED', reason: 'Decision required', details: 'Which approach?' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'needs-human', 'Should transition to needs-human');
});

test('HUMAN_NEEDED: stores reason and details', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'HUMAN_NEEDED', reason: 'Clarification', details: 'Please advise on X' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'needs-human', 'Must be needs-human');
  if (result.nextState.status === 'needs-human') {
    assertEqual(result.nextState.reason, 'Clarification', 'Should store reason');
    assertEqual(result.nextState.details, 'Please advise on X', 'Should store details');
  }
});

// ============================================================================
// Test: Invalid Transitions
// ============================================================================

console.log('\n=== Invalid Transition Tests ===\n');

test('Invalid: PHASE_COMPLETE on not-started returns unchanged', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Done', phaseId: 'x' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'not-started', 'Should remain not-started');
  assertNoActions(result);
});

test('Invalid: PAUSE on completed returns unchanged', () => {
  const state: SprintState = {
    status: 'completed',
    summary: 'All done',
    completedAt: '2026-01-20T12:00:00Z',
    elapsed: '2h',
  };
  const event: SprintEvent = { type: 'PAUSE', reason: 'Try to pause' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'completed', 'Should remain completed');
  assertNoActions(result);
});

test('Invalid: START on blocked returns unchanged', () => {
  const state: SprintState = {
    status: 'blocked',
    error: 'Something broke',
    failedPhase: 'phase-0',
    blockedAt: '2026-01-20T11:00:00Z',
  };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'blocked', 'Should remain blocked');
  assertNoActions(result);
});

test('Invalid: TICK event does nothing', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'TICK' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should remain in-progress');
  assertNoActions(result);
});

// ============================================================================
// Test: Helper Functions
// ============================================================================

console.log('\n=== Helper Function Tests ===\n');

test('advancePointer: advances phase when no steps', () => {
  const current: CurrentPointer = { phase: 0, step: null, 'sub-phase': null };
  const context = createMinimalContext();

  const result = advancePointer(current, context);

  assertEqual(result.nextPointer.phase, 1, 'Should advance phase');
  assertEqual(result.hasMore, true, 'Should have more phases');
});

test('advancePointer: returns hasMore=false on last phase', () => {
  const current: CurrentPointer = { phase: 1, step: null, 'sub-phase': null };
  const context = createMinimalContext(); // Has 2 phases (0, 1)

  const result = advancePointer(current, context);

  assertEqual(result.hasMore, false, 'Should have no more phases');
});

test('advancePointer: advances sub-phase within step', () => {
  const current: CurrentPointer = { phase: 0, step: 0, 'sub-phase': 0 };
  const context = createContextWithSteps();

  const result = advancePointer(current, context);

  assertEqual(result.nextPointer['sub-phase'], 1, 'Should advance sub-phase');
  assertEqual(result.nextPointer.step, 0, 'Step should remain');
});

test('advancePointer: advances step when sub-phases exhausted', () => {
  const current: CurrentPointer = { phase: 0, step: 0, 'sub-phase': 2 }; // Last sub-phase
  const context = createContextWithSteps();

  const result = advancePointer(current, context);

  assertEqual(result.nextPointer.step, 1, 'Should advance step');
  assertEqual(result.nextPointer['sub-phase'], 0, 'Should reset sub-phase');
});

test('calculateBackoff: returns first delay initially', () => {
  const context = createContextWithRetry();
  context.phases![0]['retry-count'] = 0;

  const delay = calculateBackoff(context);

  assertEqual(delay, 1000, 'Should return first backoff delay');
});

test('calculateBackoff: returns increasing delays', () => {
  const context = createContextWithRetry();
  context.phases![0]['retry-count'] = 1;

  const delay = calculateBackoff(context);

  assertEqual(delay, 2000, 'Should return second backoff delay');
});

test('calculateBackoff: caps at max delay', () => {
  const context = createContextWithRetry();
  context.phases![0]['retry-count'] = 10; // Beyond array length

  const delay = calculateBackoff(context);

  assertEqual(delay, 4000, 'Should return last backoff delay');
});

test('getCurrentPhase: returns current phase', () => {
  const context = createMinimalContext();
  context.current.phase = 1;

  const phase = getCurrentPhase(context);

  assertEqual(phase?.id, 'phase-1', 'Should return phase-1');
});

test('getCurrentPhase: returns undefined for invalid index', () => {
  const context = createMinimalContext();
  context.current.phase = 99;

  const phase = getCurrentPhase(context);

  assertEqual(phase, undefined, 'Should return undefined');
});

test('getCurrentStep: returns current step', () => {
  const context = createContextWithSteps();

  const step = getCurrentStep(context);

  assertEqual(step?.id, 'step-0', 'Should return step-0');
});

test('getCurrentStep: returns undefined when no steps', () => {
  const context = createMinimalContext();

  const step = getCurrentStep(context);

  assertEqual(step, undefined, 'Should return undefined');
});

test('getCurrentSubPhase: returns current sub-phase', () => {
  const context = createContextWithSteps();

  const subPhase = getCurrentSubPhase(context);

  assertEqual(subPhase?.id, 'red', 'Should return red sub-phase');
});

// ============================================================================
// Test: Pure Function Property
// ============================================================================

console.log('\n=== Pure Function Tests ===\n');

test('transition: is pure - same inputs produce same outputs', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();

  const result1 = transition(state, event, context);
  const result2 = transition(state, event, context);

  assertEqual(result1.nextState.status, result2.nextState.status, 'Should produce same status');
  assertEqual(result1.actions.length, result2.actions.length, 'Should produce same actions');
});

test('transition: does not mutate input state', () => {
  const state: SprintState = { status: 'not-started' };
  const event: SprintEvent = { type: 'START' };
  const context = createMinimalContext();
  const originalStatus = state.status;

  transition(state, event, context);

  assertEqual(state.status, originalStatus, 'Input state should not be mutated');
});

test('transition: does not mutate input context', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'PHASE_COMPLETE', summary: 'Done', phaseId: 'phase-0' };
  const context = createMinimalContext();
  const originalPhase = context.current.phase;

  transition(state, event, context);

  assertEqual(context.current.phase, originalPhase, 'Input context should not be mutated');
});

// ============================================================================
// Test: BREAKPOINT_REACHED Event
// ============================================================================

console.log('\n=== BREAKPOINT_REACHED Event Tests ===\n');

test('BREAKPOINT_REACHED: transitions in-progress → paused-at-breakpoint', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 1, step: null, 'sub-phase': null },
    iteration: 5,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'BREAKPOINT_REACHED', phaseId: 'review-checkpoint' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'paused-at-breakpoint', 'Should transition to paused-at-breakpoint');
});

test('BREAKPOINT_REACHED: preserves current pointer in pausedAt', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 1, step: 2, 'sub-phase': 3 },
    iteration: 5,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'BREAKPOINT_REACHED', phaseId: 'phase-1' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'paused-at-breakpoint', 'Must be paused-at-breakpoint');
  if (result.nextState.status === 'paused-at-breakpoint') {
    assertDeepEqual(result.nextState.pausedAt, { phase: 1, step: 2, 'sub-phase': 3 }, 'Should preserve pointer');
  }
});

test('BREAKPOINT_REACHED: stores breakpoint phase ID', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'BREAKPOINT_REACHED', phaseId: 'review-plans' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'paused-at-breakpoint', 'Must be paused-at-breakpoint');
  if (result.nextState.status === 'paused-at-breakpoint') {
    assertEqual(result.nextState.breakpointPhaseId, 'review-plans', 'Should store breakpoint phase ID');
  }
});

test('BREAKPOINT_REACHED: returns WRITE_PROGRESS action', () => {
  const state: SprintState = {
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    iteration: 1,
    startedAt: '2026-01-20T10:00:00Z',
  };
  const event: SprintEvent = { type: 'BREAKPOINT_REACHED', phaseId: 'test' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'WRITE_PROGRESS');
});

test('BREAKPOINT_REACHED: no-op if not in-progress', () => {
  const state: SprintState = {
    status: 'paused',
    pausedAt: { phase: 0, step: null, 'sub-phase': null },
    pauseReason: 'User pause',
  };
  const event: SprintEvent = { type: 'BREAKPOINT_REACHED', phaseId: 'test' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'paused', 'Should remain paused');
  assertNoActions(result);
});

// ============================================================================
// Test: RESUME from paused-at-breakpoint
// ============================================================================

console.log('\n=== RESUME from Breakpoint Tests ===\n');

test('RESUME: transitions paused-at-breakpoint → in-progress', () => {
  const state: SprintState = {
    status: 'paused-at-breakpoint',
    pausedAt: { phase: 0, step: null, 'sub-phase': null },
    breakpointPhaseId: 'review-checkpoint',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'in-progress', 'Should transition to in-progress');
});

test('RESUME: advances pointer to next phase after breakpoint', () => {
  const state: SprintState = {
    status: 'paused-at-breakpoint',
    pausedAt: { phase: 0, step: null, 'sub-phase': null },
    breakpointPhaseId: 'phase-0',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assert(result.nextState.status === 'in-progress', 'Must be in-progress');
  if (result.nextState.status === 'in-progress') {
    assertEqual(result.nextState.current.phase, 1, 'Should advance to next phase');
  }
});

test('RESUME: breakpoint on last phase completes sprint', () => {
  const state: SprintState = {
    status: 'paused-at-breakpoint',
    pausedAt: { phase: 1, step: null, 'sub-phase': null },
    breakpointPhaseId: 'phase-1',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertEqual(result.nextState.status, 'completed', 'Should complete when breakpoint is on last phase');
});

test('RESUME: breakpoint returns SPAWN_CLAUDE for next phase', () => {
  const state: SprintState = {
    status: 'paused-at-breakpoint',
    pausedAt: { phase: 0, step: null, 'sub-phase': null },
    breakpointPhaseId: 'phase-0',
  };
  const event: SprintEvent = { type: 'RESUME' };
  const context = createMinimalContext();

  const result = transition(state, event, context);

  assertContainsAction(result.actions, 'SPAWN_CLAUDE');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
