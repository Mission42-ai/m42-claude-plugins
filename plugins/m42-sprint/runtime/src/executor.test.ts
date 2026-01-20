/**
 * Tests for Executor Module - Action Execution
 *
 * Tests executeAction() and executeActions() functions that map
 * SprintAction discriminated unions to side effect implementations.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  executeAction,
  executeActions,
  ExecutorContext,
  SprintAction,
  SprintEvent,
  StepQueueItem,
  CompiledProgress,
} from './executor.js';

// ============================================================================
// Test Infrastructure
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};
const capturedLogs: { level: string; message: string }[] = [];

// Queue tests for sequential execution to avoid console mock race conditions
const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
let testsStarted = false;

function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });

  // Start running tests after all are queued (on next tick)
  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

async function runTests(): Promise<void> {
  for (const { name, fn } of testQueue) {
    try {
      await fn();
      testsPassed++;
      originalConsole.log(`✓ ${name}`);
    } catch (error) {
      testsFailed++;
      originalConsole.error(`✗ ${name}`);
      originalConsole.error(`  ${error}`);
    }
  }

  originalConsole.log('');
  originalConsole.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) {
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  if (actual !== expected) throw new Error(msg);
}

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  const msg = message || `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`;
  if (actualStr !== expectedStr) throw new Error(msg);
}

function mockConsole(): void {
  capturedLogs.length = 0;
  console.log = (msg: string) => capturedLogs.push({ level: 'info', message: String(msg) });
  console.warn = (msg: string) => capturedLogs.push({ level: 'warn', message: String(msg) });
  console.error = (msg: string) => capturedLogs.push({ level: 'error', message: String(msg) });
}

function restoreConsole(): void {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProgress(): CompiledProgress {
  return {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    current: {
      phase: 0,
      step: 0,
      'sub-phase': 0,
    },
    stats: {
      'started-at': '2026-01-20T10:00:00Z',
      'total-phases': 3,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'development',
        status: 'in-progress',
        steps: [
          {
            id: 'step-1',
            prompt: 'Implement feature',
            status: 'in-progress',
            phases: [
              {
                id: 'red',
                status: 'in-progress',
                prompt: 'Write failing tests',
              },
              {
                id: 'green',
                status: 'pending',
                prompt: 'Implement to pass tests',
              },
            ],
          },
        ],
      },
    ],
  };
}

function createTestContext(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    sprintDir: '/tmp/test-sprint',
    progress: createTestProgress(),
    verbose: false,
    ...overrides,
  };
}

// ============================================================================
// Scenario 1: LOG action with info level
// ============================================================================

test('LOG action with info level should call console.log', async () => {
  mockConsole();
  try {
    const action: SprintAction = {
      type: 'LOG',
      level: 'info',
      message: 'Test info message',
    };
    const context = createTestContext();

    const result = await executeAction(action, context);

    // LOG actions return null (no resulting event)
    assertEqual(result, null, 'LOG action should return null');
    assert(capturedLogs.length === 1, 'Should have captured one log');
    assertEqual(capturedLogs[0].level, 'info', 'Should log at info level');
    assert(capturedLogs[0].message.includes('Test info message'), 'Should include message');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Scenario 2: LOG action with warn level
// ============================================================================

test('LOG action with warn level should call console.warn', async () => {
  mockConsole();
  try {
    const action: SprintAction = {
      type: 'LOG',
      level: 'warn',
      message: 'Test warning message',
    };
    const context = createTestContext();

    const result = await executeAction(action, context);

    assertEqual(result, null, 'LOG action should return null');
    assert(capturedLogs.length === 1, 'Should have captured one log');
    assertEqual(capturedLogs[0].level, 'warn', 'Should log at warn level');
    assert(capturedLogs[0].message.includes('Test warning message'), 'Should include message');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Scenario 3: LOG action with error level
// ============================================================================

test('LOG action with error level should call console.error', async () => {
  mockConsole();
  try {
    const action: SprintAction = {
      type: 'LOG',
      level: 'error',
      message: 'Test error message',
    };
    const context = createTestContext();

    const result = await executeAction(action, context);

    assertEqual(result, null, 'LOG action should return null');
    assert(capturedLogs.length === 1, 'Should have captured one log');
    assertEqual(capturedLogs[0].level, 'error', 'Should log at error level');
    assert(capturedLogs[0].message.includes('Test error message'), 'Should include message');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Scenario 4: SPAWN_CLAUDE action returns PHASE_COMPLETE on success
// ============================================================================

test('SPAWN_CLAUDE action should return PHASE_COMPLETE on successful Claude run', async () => {
  const action: SprintAction = {
    type: 'SPAWN_CLAUDE',
    prompt: 'Test prompt',
    phaseId: 'test-phase',
    onComplete: 'PHASE_COMPLETE',
  };
  const context = createTestContext();

  // Mock dependencies with successful Claude response
  const mockDeps = {
    runClaude: async () => ({
      success: true,
      output: '{"status": "completed", "summary": "Test completed successfully"}',
      exitCode: 0,
      jsonResult: { status: 'completed', summary: 'Test completed successfully' },
    }),
  };

  const result = await executeAction(action, context, mockDeps);

  assert(result !== null, 'SPAWN_CLAUDE should return an event');
  assertEqual(result?.type, 'PHASE_COMPLETE', 'Should return PHASE_COMPLETE on success');
});

// ============================================================================
// Scenario 5: SPAWN_CLAUDE action returns PHASE_FAILED on failure
// ============================================================================

test('SPAWN_CLAUDE action should return PHASE_FAILED on Claude failure', async () => {
  const action: SprintAction = {
    type: 'SPAWN_CLAUDE',
    prompt: 'Test prompt that will fail',
    phaseId: 'test-phase',
    onComplete: 'PHASE_COMPLETE',
  };
  const context = createTestContext();

  // Mock dependencies with failed Claude response
  const mockDeps = {
    runClaude: async () => ({
      success: false,
      output: '',
      exitCode: 1,
      error: 'Claude execution failed: timeout',
    }),
  };

  const result = await executeAction(action, context, mockDeps);

  assert(result !== null, 'SPAWN_CLAUDE should return an event on failure too');
  assertEqual(result?.type, 'PHASE_FAILED', 'Should return PHASE_FAILED on failure');
});

// ============================================================================
// Scenario 6: WRITE_PROGRESS action calls yaml-ops
// ============================================================================

test('WRITE_PROGRESS action should call writeProgressAtomic', async () => {
  const action: SprintAction = {
    type: 'WRITE_PROGRESS',
  };
  const testDir = '/tmp/test-write-progress-' + Date.now();
  fs.mkdirSync(testDir, { recursive: true });
  const context = createTestContext({ sprintDir: testDir });

  try {
    // Should call yaml-ops.writeProgressAtomic and return null
    const result = await executeAction(action, context);

    assertEqual(result, null, 'WRITE_PROGRESS should return null');

    // Verify file was created
    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    assert(fs.existsSync(progressPath), 'PROGRESS.yaml should exist after WRITE_PROGRESS');
  } finally {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Scenario 7: UPDATE_STATS action modifies in-memory context
// ============================================================================

test('UPDATE_STATS action should update progress.stats in context', async () => {
  const action: SprintAction = {
    type: 'UPDATE_STATS',
    updates: {
      'completed-phases': 1,
      'completed-at': '2026-01-20T11:00:00Z',
    },
  };
  const context = createTestContext();

  const result = await executeAction(action, context);

  assertEqual(result, null, 'UPDATE_STATS should return null');
  assertEqual(context.progress.stats['completed-phases'], 1, 'Should update completed-phases');
  assertEqual(context.progress.stats['completed-at'], '2026-01-20T11:00:00Z', 'Should update completed-at');
});

// ============================================================================
// Scenario 8: UPDATE_STATS preserves existing stats
// ============================================================================

test('UPDATE_STATS action should preserve existing stats not in updates', async () => {
  const action: SprintAction = {
    type: 'UPDATE_STATS',
    updates: {
      'completed-phases': 2,
    },
  };
  const context = createTestContext();
  const originalStartedAt = context.progress.stats['started-at'];
  const originalTotalPhases = context.progress.stats['total-phases'];

  await executeAction(action, context);

  assertEqual(context.progress.stats['started-at'], originalStartedAt, 'Should preserve started-at');
  assertEqual(context.progress.stats['total-phases'], originalTotalPhases, 'Should preserve total-phases');
  assertEqual(context.progress.stats['completed-phases'], 2, 'Should update completed-phases');
});

// ============================================================================
// Scenario 9: EMIT_ACTIVITY action appends to activity file
// ============================================================================

test('EMIT_ACTIVITY action should append to .sprint-activity.jsonl', async () => {
  const action: SprintAction = {
    type: 'EMIT_ACTIVITY',
    activity: 'phase-started',
    data: { phaseId: 'development', timestamp: '2026-01-20T10:00:00Z' },
  };
  const testDir = '/tmp/test-emit-activity-' + Date.now();
  fs.mkdirSync(testDir, { recursive: true });
  const context = createTestContext({ sprintDir: testDir });

  try {
    const result = await executeAction(action, context);

    assertEqual(result, null, 'EMIT_ACTIVITY should return null');

    // Verify file was created with JSONL content
    const activityPath = path.join(testDir, '.sprint-activity.jsonl');
    assert(fs.existsSync(activityPath), 'Activity file should exist');

    const content = fs.readFileSync(activityPath, 'utf8');
    const lines = content.trim().split('\n');
    assert(lines.length >= 1, 'Should have at least one activity entry');

    const entry = JSON.parse(lines[lines.length - 1]);
    assertEqual(entry.activity, 'phase-started', 'Activity should match');
  } finally {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Scenario 10: EMIT_ACTIVITY appends (doesn't overwrite)
// ============================================================================

test('EMIT_ACTIVITY action should append to existing file', async () => {
  const testDir = '/tmp/test-emit-activity-append-' + Date.now();
  fs.mkdirSync(testDir, { recursive: true });
  const activityPath = path.join(testDir, '.sprint-activity.jsonl');

  // Pre-populate with existing entry
  fs.writeFileSync(activityPath, '{"activity":"existing","data":{}}\n');

  const action: SprintAction = {
    type: 'EMIT_ACTIVITY',
    activity: 'new-activity',
    data: { test: true },
  };
  const context = createTestContext({ sprintDir: testDir });

  try {
    await executeAction(action, context);

    const content = fs.readFileSync(activityPath, 'utf8');
    const lines = content.trim().split('\n');
    assertEqual(lines.length, 2, 'Should have two entries now');

    const existing = JSON.parse(lines[0]);
    assertEqual(existing.activity, 'existing', 'First entry should be preserved');

    const newEntry = JSON.parse(lines[1]);
    assertEqual(newEntry.activity, 'new-activity', 'Second entry should be new');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Scenario 11: SCHEDULE_RETRY action sleeps and returns retry event
// ============================================================================

test('SCHEDULE_RETRY action should sleep for delayMs', async () => {
  const action: SprintAction = {
    type: 'SCHEDULE_RETRY',
    phaseId: 'test-phase',
    delayMs: 50, // Short delay for testing
  };
  const context = createTestContext();

  const startTime = Date.now();
  const result = await executeAction(action, context);
  const elapsed = Date.now() - startTime;

  // Should have waited at least 50ms
  assert(elapsed >= 45, `Should have waited at least 50ms, waited ${elapsed}ms`);

  // Should return an event to trigger retry
  assert(result !== null, 'SCHEDULE_RETRY should return an event');
});

// ============================================================================
// Scenario 12: INSERT_STEP action updates progress.phases
// ============================================================================

test('INSERT_STEP action should add step to progress after current position', async () => {
  const newStep: StepQueueItem = {
    id: 'new-step-1',
    prompt: 'New dynamic step',
    proposedBy: 'orchestration',
    proposedAt: '2026-01-20T10:30:00Z',
    priority: 'high',
  };

  const action: SprintAction = {
    type: 'INSERT_STEP',
    step: newStep,
    position: 'after-current',
  };

  const context = createTestContext();
  const originalStepCount = context.progress.phases?.[0]?.steps?.length ?? 0;

  const result = await executeAction(action, context);

  assertEqual(result, null, 'INSERT_STEP should return null');

  const newStepCount = context.progress.phases?.[0]?.steps?.length ?? 0;
  assertEqual(newStepCount, originalStepCount + 1, 'Should have one more step');

  // New step should be inserted after current
  const currentStepIdx = context.progress.current.step ?? 0;
  const insertedStep = context.progress.phases?.[0]?.steps?.[currentStepIdx + 1];
  assertEqual(insertedStep?.id, 'new-step-1', 'New step should be at correct position');
});

// ============================================================================
// Scenario 13: INSERT_STEP with end-of-phase position
// ============================================================================

test('INSERT_STEP action with end-of-phase should add step at end', async () => {
  const newStep: StepQueueItem = {
    id: 'end-step',
    prompt: 'Step at end',
    proposedBy: 'orchestration',
    proposedAt: '2026-01-20T10:30:00Z',
    priority: 'medium',
  };

  const action: SprintAction = {
    type: 'INSERT_STEP',
    step: newStep,
    position: 'end-of-phase',
  };

  const context = createTestContext();
  const originalStepCount = context.progress.phases?.[0]?.steps?.length ?? 0;

  await executeAction(action, context);

  const steps = context.progress.phases?.[0]?.steps ?? [];
  const lastStep = steps[steps.length - 1];
  assertEqual(lastStep?.id, 'end-step', 'New step should be at end');
});

// ============================================================================
// Scenario 14: executeActions runs actions in sequence
// ============================================================================

test('executeActions should run actions in sequence', async () => {
  mockConsole();
  try {
    const actions: SprintAction[] = [
      { type: 'LOG', level: 'info', message: 'First' },
      { type: 'LOG', level: 'info', message: 'Second' },
      { type: 'LOG', level: 'info', message: 'Third' },
    ];
    const context = createTestContext();

    const events = await executeActions(actions, context);

    // All LOG actions return null, so events array should be empty
    assertEqual(events.length, 0, 'LOG actions return null, so no events');

    // But all logs should have been captured in order
    assertEqual(capturedLogs.length, 3, 'Should have three logs');
    assert(capturedLogs[0].message.includes('First'), 'First log should be first');
    assert(capturedLogs[1].message.includes('Second'), 'Second log should be second');
    assert(capturedLogs[2].message.includes('Third'), 'Third log should be third');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Scenario 15: executeActions collects non-null events
// ============================================================================

test('executeActions should collect non-null events from actions', async () => {
  // With SCHEDULE_RETRY actions that return events
  const actions: SprintAction[] = [
    { type: 'SCHEDULE_RETRY', phaseId: 'phase-1', delayMs: 10 },
    { type: 'LOG', level: 'info', message: 'Log between retries' },
    { type: 'SCHEDULE_RETRY', phaseId: 'phase-2', delayMs: 10 },
  ];
  const context = createTestContext();

  mockConsole();
  try {
    const events = await executeActions(actions, context);

    // Should have 2 events from SCHEDULE_RETRY, LOG returns null
    assertEqual(events.length, 2, 'Should have two events from SCHEDULE_RETRY actions');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Scenario 16: Exhaustive switch coverage (type safety)
// ============================================================================

test('executeAction should handle all action types (exhaustive)', async () => {
  // This test verifies that all SprintAction types are handled
  // The implementation must use exhaustive switch with `never` check

  const actionTypes: SprintAction['type'][] = [
    'LOG',
    'SPAWN_CLAUDE',
    'WRITE_PROGRESS',
    'UPDATE_STATS',
    'EMIT_ACTIVITY',
    'SCHEDULE_RETRY',
    'INSERT_STEP',
  ];

  // Create a minimal action for each type and verify no error is thrown
  for (const actionType of actionTypes) {
    let action: SprintAction;

    switch (actionType) {
      case 'LOG':
        action = { type: 'LOG', level: 'info', message: 'test' };
        break;
      case 'SPAWN_CLAUDE':
        action = { type: 'SPAWN_CLAUDE', prompt: 'test', phaseId: 'test', onComplete: 'PHASE_COMPLETE' };
        break;
      case 'WRITE_PROGRESS':
        action = { type: 'WRITE_PROGRESS' };
        break;
      case 'UPDATE_STATS':
        action = { type: 'UPDATE_STATS', updates: {} };
        break;
      case 'EMIT_ACTIVITY':
        action = { type: 'EMIT_ACTIVITY', activity: 'test', data: {} };
        break;
      case 'SCHEDULE_RETRY':
        action = { type: 'SCHEDULE_RETRY', phaseId: 'test', delayMs: 1 };
        break;
      case 'INSERT_STEP':
        action = {
          type: 'INSERT_STEP',
          step: { id: 'test', prompt: 'test', proposedBy: 'test', proposedAt: '', priority: 'medium' },
          position: 'after-current',
        };
        break;
      default:
        // This should never happen - TypeScript will error if we miss a type
        const _exhaustive: never = actionType;
        throw new Error(`Unhandled action type: ${_exhaustive}`);
    }

    const context = createTestContext({
      sprintDir: '/tmp/exhaustive-test-' + Date.now(),
    });
    fs.mkdirSync(context.sprintDir, { recursive: true });

    try {
      // Should not throw - all types are handled
      mockConsole();
      await executeAction(action, context);
      restoreConsole();
    } catch (error) {
      restoreConsole();
      throw new Error(`Action type ${actionType} threw unexpected error: ${error}`);
    } finally {
      fs.rmSync(context.sprintDir, { recursive: true, force: true });
    }
  }
});

// ============================================================================
// Scenario 17: ExecutorContext interface validation
// ============================================================================

test('ExecutorContext should have required properties', () => {
  // This test validates the ExecutorContext interface
  const context: ExecutorContext = {
    sprintDir: '/path/to/sprint',
    progress: createTestProgress(),
    verbose: true,
  };

  assert(typeof context.sprintDir === 'string', 'sprintDir should be string');
  assert(context.progress !== undefined, 'progress should be defined');
  assert(typeof context.verbose === 'boolean', 'verbose should be boolean');
});

// ============================================================================
// Scenario 18: Verbose mode affects LOG output
// ============================================================================

test('LOG action in verbose mode should include prefix', async () => {
  mockConsole();
  try {
    const action: SprintAction = {
      type: 'LOG',
      level: 'info',
      message: 'Verbose test',
    };
    const context = createTestContext({ verbose: true });

    await executeAction(action, context);

    assert(capturedLogs.length >= 1, 'Should have at least one log');
    // Verbose mode might add timestamp or prefix
    assert(capturedLogs[0].message.includes('Verbose test'), 'Should include message');
  } finally {
    restoreConsole();
  }
});

// ============================================================================
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
