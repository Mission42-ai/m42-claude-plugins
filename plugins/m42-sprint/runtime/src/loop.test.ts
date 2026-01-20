/**
 * Tests for Main Loop Module
 *
 * Tests for runLoop() and related functions that implement
 * the main sprint execution loop, replacing sprint-loop.sh.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Import types from transition module (these exist)
import type {
  SprintState,
  SprintEvent,
  CompiledProgress,
  CurrentPointer,
} from './transition.js';

// Import from loop module (WILL FAIL - module doesn't exist yet)
import {
  runLoop,
  recoverFromInterrupt,
  isTerminalState,
  LoopOptions,
  LoopResult,
} from './loop.js';

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

// Queue tests for sequential execution
const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
let testsStarted = false;

function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });

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

function createTestSprintDir(): string {
  const testDir = `/tmp/test-loop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(path.join(testDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'transcripts'), { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createTestProgress(overrides: Partial<CompiledProgress> = {}): CompiledProgress {
  return {
    'sprint-id': 'test-sprint',
    status: 'not-started',
    current: {
      phase: 0,
      step: null,
      'sub-phase': null,
    },
    stats: {
      'started-at': null,
      'total-phases': 2,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'phase-1',
        status: 'pending',
        prompt: 'Execute phase 1',
      },
      {
        id: 'phase-2',
        status: 'pending',
        prompt: 'Execute phase 2',
      },
    ],
    ...overrides,
  } as CompiledProgress;
}

function writeProgress(sprintDir: string, progress: CompiledProgress): void {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = yaml.dump(progress);
  fs.writeFileSync(progressPath, content, 'utf8');
}

function readProgressFile(sprintDir: string): CompiledProgress {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = fs.readFileSync(progressPath, 'utf8');
  return yaml.load(content) as CompiledProgress;
}

// ============================================================================
// Scenario 1: Basic Loop Execution to Completion
// ============================================================================

test('runLoop should run phases to completion with mock Claude', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = {
      maxIterations: 10,
      delay: 0, // No delay for tests
      verbose: false,
    };

    // Mock Claude runner that always succeeds
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assertEqual(result.finalState.status, 'completed', 'Final state should be completed');

    const finalProgress = readProgressFile(testDir);
    assertEqual(finalProgress.status, 'completed', 'PROGRESS.yaml status should be completed');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should mark all phases as completed', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = {
      maxIterations: 10,
      delay: 0,
      verbose: false,
    };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    await runLoop(testDir, options, mockDeps);

    const finalProgress = readProgressFile(testDir);
    const allCompleted = (finalProgress.phases as { status: string }[]).every(
      (p) => p.status === 'completed'
    );
    assert(allCompleted, 'All phases should be completed');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 2: Max Iterations Enforced
// ============================================================================

test('runLoop should stop after max iterations reached', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create progress with many phases
    const manyPhases = Array.from({ length: 10 }, (_, i) => ({
      id: `phase-${i}`,
      status: 'pending' as const,
      prompt: `Phase ${i}`,
    }));

    const progress = createTestProgress({
      status: 'not-started',
      phases: manyPhases,
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = {
      maxIterations: 3,
      delay: 0,
      verbose: false,
    };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assertEqual(result.finalState.status, 'blocked', 'Should be blocked after max iterations');
    assert(
      result.finalState.status === 'blocked' &&
        result.finalState.error.includes('iteration'),
      'Error should mention iteration limit'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop with maxIterations=0 should run unlimited', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = {
      maxIterations: 0, // Unlimited
      delay: 0,
      verbose: false,
    };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    // Should complete normally without hitting iteration limit
    assertEqual(result.finalState.status, 'completed', 'Should complete with unlimited iterations');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 3: Pause Signal Detection
// ============================================================================

test('runLoop should detect PAUSE file and pause execution', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'in-progress' });
    (progress as CompiledProgress & { current: CurrentPointer }).current = {
      phase: 0,
      step: null,
      'sub-phase': null,
    };
    writeProgress(testDir, progress);

    // Create PAUSE file
    const pauseFile = path.join(testDir, 'PAUSE');
    fs.writeFileSync(pauseFile, 'User requested pause', 'utf8');

    const options: LoopOptions = {
      maxIterations: 10,
      delay: 0,
      verbose: false,
    };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assertEqual(result.finalState.status, 'paused', 'Should be paused');

    const finalProgress = readProgressFile(testDir);
    assertEqual(finalProgress.status, 'paused', 'PROGRESS.yaml should show paused');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should include pause reason in state', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'in-progress' });
    writeProgress(testDir, progress);

    // Create PAUSE file with reason
    const pauseFile = path.join(testDir, 'PAUSE');
    fs.writeFileSync(pauseFile, 'Manual pause for review', 'utf8');

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assert(
      result.finalState.status === 'paused' &&
        result.finalState.pauseReason.includes('PAUSE'),
      'Pause reason should mention PAUSE file'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 4: Crash Recovery from Backup
// ============================================================================

test('recoverFromInterrupt should restore from backup when checksum mismatch', async () => {
  const testDir = createTestSprintDir();
  try {
    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const backupPath = path.join(testDir, 'PROGRESS.yaml.backup');
    const checksumPath = path.join(testDir, 'PROGRESS.yaml.checksum');

    // Create valid backup
    const validProgress = createTestProgress({ status: 'in-progress' });
    const validContent = yaml.dump(validProgress);
    fs.writeFileSync(backupPath, validContent, 'utf8');

    // Create corrupted main file
    fs.writeFileSync(progressPath, 'corrupted: invalid yaml {{ broken', 'utf8');

    // Create checksum that won't match corrupted file
    fs.writeFileSync(checksumPath, 'expected-checksum-from-valid-file', 'utf8');

    // Run recovery
    await recoverFromInterrupt(progressPath);

    // Verify main file is restored
    const restoredContent = fs.readFileSync(progressPath, 'utf8');
    const restoredProgress = yaml.load(restoredContent) as CompiledProgress;
    assertEqual(restoredProgress.status, 'in-progress', 'Status should be restored from backup');

    // Verify backup is cleaned up
    assert(!fs.existsSync(backupPath), 'Backup file should be removed after recovery');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('recoverFromInterrupt should do nothing if no backup exists', async () => {
  const testDir = createTestSprintDir();
  try {
    const progressPath = path.join(testDir, 'PROGRESS.yaml');

    const progress = createTestProgress({ status: 'in-progress' });
    const content = yaml.dump(progress);
    fs.writeFileSync(progressPath, content, 'utf8');

    // No backup file exists

    // Should not throw
    await recoverFromInterrupt(progressPath);

    // File should be unchanged
    const afterContent = fs.readFileSync(progressPath, 'utf8');
    assertEqual(afterContent, content, 'File should be unchanged');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 5: Transaction Safety During Phase Execution
// ============================================================================

test('runLoop should backup progress before Claude execution', async () => {
  const testDir = createTestSprintDir();
  let backupCreated = false;

  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 1, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => {
        // Check if backup exists during Claude execution
        const backupPath = path.join(testDir, 'PROGRESS.yaml.backup');
        backupCreated = fs.existsSync(backupPath);
        return {
          success: true,
          output: '',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    assert(backupCreated, 'Backup should exist during Claude execution');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should cleanup backup after successful iteration', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    await runLoop(testDir, options, mockDeps);

    const backupPath = path.join(testDir, 'PROGRESS.yaml.backup');
    assert(!fs.existsSync(backupPath), 'No backup should remain after successful completion');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 6: Human Intervention Required
// ============================================================================

test('runLoop should stop with needs-human when Claude returns needs-human', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'in-progress' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: {
          status: 'needs-human',
          summary: 'Cannot proceed',
          humanNeeded: {
            reason: 'Need clarification on requirements',
            details: 'The spec is ambiguous about error handling',
          },
        },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assertEqual(result.finalState.status, 'needs-human', 'Should be needs-human');

    const finalProgress = readProgressFile(testDir);
    assertEqual(finalProgress.status, 'needs-human', 'PROGRESS.yaml should show needs-human');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should populate human-needed reason', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'in-progress' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: {
          status: 'needs-human',
          summary: 'Blocked',
          humanNeeded: {
            reason: 'Missing API key',
            details: 'OPENAI_API_KEY environment variable not set',
          },
        },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assert(
      result.finalState.status === 'needs-human' &&
        result.finalState.reason === 'Missing API key',
      'Reason should be populated from Claude result'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 7: Event Processing and State Transitions
// ============================================================================

test('isTerminalState should identify terminal states correctly', () => {
  // Terminal states
  assert(isTerminalState({ status: 'completed', completedAt: '', elapsed: '' }), 'completed is terminal');
  assert(isTerminalState({ status: 'blocked', error: '', failedPhase: '', blockedAt: '' }), 'blocked is terminal');
  assert(isTerminalState({ status: 'paused', pausedAt: { phase: 0, step: null, 'sub-phase': null }, pauseReason: '' }), 'paused is terminal');
  assert(isTerminalState({ status: 'needs-human', reason: '' }), 'needs-human is terminal');

  // Non-terminal states
  assert(!isTerminalState({ status: 'not-started' }), 'not-started is not terminal');
  assert(
    !isTerminalState({
      status: 'in-progress',
      current: { phase: 0, step: null, 'sub-phase': null },
      iteration: 1,
      startedAt: '',
    }),
    'in-progress is not terminal'
  );
});

test('runLoop should transition from not-started to in-progress on START', async () => {
  const testDir = createTestSprintDir();
  let capturedStates: string[] = [];

  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 1, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => {
        // Capture state during execution
        const currentProgress = readProgressFile(testDir);
        capturedStates.push(currentProgress.status);
        return {
          success: true,
          output: '',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    // During execution, status should have been in-progress
    assert(capturedStates.includes('in-progress'), 'Should transition to in-progress');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 8: Delay Between Iterations
// ============================================================================

test('runLoop should respect delay option between iterations', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const delayMs = 100;
    const options: LoopOptions = { maxIterations: 10, delay: delayMs, verbose: false };

    const iterationTimes: number[] = [];
    const mockDeps = {
      runClaude: async () => {
        iterationTimes.push(Date.now());
        return {
          success: true,
          output: '',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    // If we have 2+ iterations, check the delay
    if (iterationTimes.length >= 2) {
      const elapsed = iterationTimes[1] - iterationTimes[0];
      assert(
        elapsed >= delayMs * 0.9, // Allow 10% tolerance
        `Delay should be at least ${delayMs}ms, was ${elapsed}ms`
      );
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop with delay=0 should run without waiting', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const startTime = Date.now();
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    await runLoop(testDir, options, mockDeps);

    const elapsed = Date.now() - startTime;
    // Should complete very quickly with no delay
    assert(elapsed < 1000, `Should complete quickly with delay=0, took ${elapsed}ms`);
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

test('runLoop should handle empty phases array', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started', phases: [] });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    // With no phases, should complete immediately
    assertEqual(result.finalState.status, 'completed', 'Empty sprint should complete');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should handle already completed sprint', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'completed' as any });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    // Should not run any iterations
    assertEqual(result.finalState.status, 'completed', 'Already completed should stay completed');
    assertEqual(result.iterations, 0, 'Should not run any iterations');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should handle missing PROGRESS.yaml', async () => {
  const testDir = createTestSprintDir();
  try {
    // Don't create PROGRESS.yaml

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    let threw = false;
    try {
      await runLoop(testDir, options, mockDeps);
    } catch {
      threw = true;
    }

    assert(threw, 'Should throw when PROGRESS.yaml is missing');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('LoopOptions defaults should be applied', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    // Call with empty options - defaults should apply
    const options: LoopOptions = {};
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    // Should not throw with empty options
    const result = await runLoop(testDir, options, mockDeps);

    // Should complete normally
    assert(result.finalState.status === 'completed', 'Should complete with default options');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop should log iteration start and end when verbose', async () => {
  const testDir = createTestSprintDir();
  mockConsole();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: true };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    await runLoop(testDir, options, mockDeps);

    // Check for iteration logs
    const hasIterationLog = capturedLogs.some(
      (log) => log.message.includes('iteration') || log.message.includes('Iteration')
    );
    assert(hasIterationLog, 'Should log iteration info when verbose');
  } finally {
    restoreConsole();
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// LoopResult Interface Tests
// ============================================================================

test('LoopResult should include iterations count', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assert(typeof result.iterations === 'number', 'iterations should be a number');
    assert(result.iterations > 0, 'Should have run at least one iteration');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('LoopResult should include elapsed time', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    assert(typeof result.elapsedMs === 'number', 'elapsedMs should be a number');
    assert(result.elapsedMs >= 0, 'elapsedMs should be non-negative');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Bug 7: runLoop Without Deps Should Use Default Dependencies
// ============================================================================

test('runLoop without deps parameter should use default runClaude (Bug 7)', async () => {
  // This test verifies Bug 7 fix: runLoop should work when deps is NOT provided
  // by using default dependencies internally.
  //
  // BEFORE FIX: deps?.runClaude returns undefined, causing 'Unknown error'
  // AFTER FIX: Default deps are used when deps is not provided
  //
  // NOTE: This test will invoke the real claude-runner if run without mocking,
  // so we create a minimal sprint that tests the code path exists.
  // The actual Claude execution would fail in a test env, but what matters
  // is that the code path attempts to call runClaude, not that it receives undefined.

  const testDir = createTestSprintDir();
  try {
    // Create a completed sprint so we don't actually run Claude
    const progress = createTestProgress({ status: 'completed' });
    writeProgress(testDir, progress);

    // Call runLoop WITHOUT deps parameter - should not throw
    // (completed sprint returns immediately without calling runClaude)
    const result = await runLoop(testDir, { maxIterations: 0, delay: 0 });

    assertEqual(result.finalState.status, 'completed', 'Should complete without error');
    assertEqual(result.iterations, 0, 'Should not run iterations for completed sprint');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('runLoop without deps should import runClaude internally (Bug 7 execution path)', async () => {
  // This test verifies the critical code path for Bug 7:
  // When runLoop is called WITHOUT deps, the internal spawnResult should
  // NOT be undefined because default deps are applied.
  //
  // We test this by running a sprint that would execute Claude, but catching
  // the error (since we can't actually run Claude in tests).
  // The key assertion is that we get a real error (like ENOENT for claude)
  // NOT "Unknown error" which indicates spawnResult was undefined.

  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [{ id: 'test', status: 'pending', prompt: 'test' }],
    });
    writeProgress(testDir, progress);

    // Call runLoop WITHOUT deps - this should attempt to run real Claude
    // which will fail (Claude not available in test), but NOT with "Unknown error"
    const result = await runLoop(testDir, { maxIterations: 1, delay: 0 });

    // After Bug 7 fix: Should get a real error category (network, timeout, etc)
    // or the sprint should be blocked with a meaningful error, NOT "Unknown error"
    if (result.finalState.status === 'blocked') {
      const blockedState = result.finalState as { status: 'blocked'; error: string };
      // Bug 7 causes: error === "Unknown error" because spawnResult is undefined
      // Fixed version: error contains actual error from claude-runner
      assert(
        blockedState.error !== 'Unknown error',
        `Bug 7: runLoop without deps returned "Unknown error" which means deps.runClaude was undefined. Error was: ${blockedState.error}`
      );
    }
    // If it somehow succeeded or paused, that's also fine (means deps worked)
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// BUG-018: Runtime Loop Must Create Per-Phase Log Files
// ============================================================================

test('BUG-018: runLoop should pass outputFile to runClaude for phase logs', async () => {
  // This test verifies BUG-018:
  // The status server expects log files at `{sprintDir}/transcriptions/{phaseId}.log`
  // but the runtime loop NEVER creates them because it doesn't pass
  // outputFile to runClaude.
  //
  // CURRENT IMPLEMENTATION: loop.ts passes outputFile to runClaude pointing to
  // the transcriptions directory for NDJSON stream logs.
  //
  // This test captures the outputFile passed to runClaude and verifies
  // it points to a log file in the transcriptions directory.

  const testDir = createTestSprintDir();
  let capturedOutputFile: string | undefined;

  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 1, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async (opts: { prompt: string; cwd?: string; outputFile?: string }) => {
        // Capture the outputFile parameter
        capturedOutputFile = opts.outputFile;
        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    // Verify outputFile was passed to runClaude
    assert(
      capturedOutputFile !== undefined,
      'BUG-018: runClaude should receive outputFile parameter for phase logs'
    );

    // Verify outputFile points to transcriptions directory (NDJSON stream logs)
    const transcriptionsDir = path.join(testDir, 'transcriptions');
    assert(
      capturedOutputFile!.startsWith(transcriptionsDir),
      `BUG-018: outputFile should be in transcriptions directory. Got: ${capturedOutputFile}`
    );

    // Verify outputFile includes phase ID
    assert(
      capturedOutputFile!.includes('phase-1') || capturedOutputFile!.includes('phase_1'),
      `BUG-018: outputFile should include phase ID. Got: ${capturedOutputFile}`
    );

    // Verify outputFile ends with .log
    assert(
      capturedOutputFile!.endsWith('.log'),
      `BUG-018: outputFile should end with .log. Got: ${capturedOutputFile}`
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('BUG-018: runLoop should create transcriptions directory if it does not exist', async () => {
  // This test verifies that the transcriptions directory is created before calling runClaude.
  // Without this, outputFile would fail to write.

  const testDir = createTestSprintDir();
  // Remove the transcriptions directory that createTestSprintDir might create
  const transcriptionsDir = path.join(testDir, 'transcriptions');
  if (fs.existsSync(transcriptionsDir)) {
    fs.rmSync(transcriptionsDir, { recursive: true });
  }

  let transcriptionsExistedDuringCall = false;

  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 1, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async (opts: { prompt: string; cwd?: string; outputFile?: string }) => {
        // Check if transcriptions directory exists when runClaude is called
        transcriptionsExistedDuringCall = fs.existsSync(transcriptionsDir);
        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    // Verify transcriptions directory was created before runClaude was called
    assert(
      transcriptionsExistedDuringCall,
      'BUG-018: transcriptions directory should be created before calling runClaude'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('BUG-018: runLoop should generate unique log file per phase/step/sub-phase', async () => {
  // This test verifies that each phase execution gets a unique log file.
  // The status page needs separate log files for each phase to display correctly.

  const testDir = createTestSprintDir();
  const capturedOutputFiles: (string | undefined)[] = [];

  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
        { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async (opts: { prompt: string; cwd?: string; outputFile?: string }) => {
        capturedOutputFiles.push(opts.outputFile);
        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    await runLoop(testDir, options, mockDeps);

    // Should have 2 log files (one per phase)
    assertEqual(
      capturedOutputFiles.length,
      2,
      'Should have called runClaude twice (once per phase)'
    );

    // Both should have outputFile set
    assert(
      capturedOutputFiles[0] !== undefined && capturedOutputFiles[1] !== undefined,
      'BUG-018: Both phases should have outputFile set'
    );

    // Files should be different
    assert(
      capturedOutputFiles[0] !== capturedOutputFiles[1],
      `BUG-018: Each phase should have unique log file. Got same file for both: ${capturedOutputFiles[0]}`
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// BUG-002: Race Condition on PROGRESS.yaml
// ============================================================================

test('BUG-002: External writes during Claude execution are lost (race condition)', async () => {
  // This test reproduces the race condition described in BUG-002:
  //
  // The bug: loop.ts performs backup → Claude execution → write cycle
  // WITHOUT holding a lock on PROGRESS.yaml. If an external process
  // (like status server's /api/skip or /api/retry) modifies the file
  // during Claude execution, those changes are lost when the loop
  // writes its version.
  //
  // Repro Steps:
  // 1. Start a sprint with long-running Claude task
  // 2. While Claude is executing, simulate /api/skip via external file modification
  // 3. Status server writes skip action to PROGRESS.yaml
  // 4. Claude completes and loop writes its PROGRESS.yaml
  // 5. Skip action is lost
  //
  // EXPECTED after fix: Skip action persists after Claude completes
  // ACTUAL (bug): Skip action overwritten by loop's write
  //
  // The fix should use one of:
  // - File locking
  // - Compare-and-swap with checksum verification
  // - Event-based IPC instead of file modification

  const testDir = createTestSprintDir();
  let externalWritePerformed = false;

  try {
    // Create progress with 3 phases - we'll skip the second one during execution
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
        { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
        { id: 'phase-3', status: 'pending', prompt: 'Execute phase 3' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    let claudeCallCount = 0;

    const mockDeps = {
      runClaude: async () => {
        claudeCallCount++;

        // During the first phase execution, simulate an external process
        // (like status server's /api/skip) modifying PROGRESS.yaml
        if (claudeCallCount === 1) {
          // Simulate the delay of a real Claude execution
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Read current progress, mark phase-2 as skipped, write back
          // This mimics what the status server's handleSkipRequest does
          const currentProgress = readProgressFile(testDir);
          const phase2 = (currentProgress.phases as { id: string; status: string }[]).find(
            (p) => p.id === 'phase-2'
          );
          if (phase2) {
            phase2.status = 'skipped';
            externalWritePerformed = true;

            // Write the modified progress (simulating status server)
            const progressPath = path.join(testDir, 'PROGRESS.yaml');
            const content = yaml.dump(currentProgress);
            fs.writeFileSync(progressPath, content, 'utf8');
          }
        }

        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    // Run the loop
    await runLoop(testDir, options, mockDeps);

    // Verify the external write was performed
    assert(externalWritePerformed, 'Test setup: external write should have been performed');

    // Read final progress
    const finalProgress = readProgressFile(testDir);

    // The bug: phase-2's 'skipped' status gets overwritten by the loop
    // because the loop reads progress BEFORE Claude execution (via backup),
    // then writes its own version AFTER Claude execution, ignoring any
    // changes made during execution.
    //
    // After fix: phase-2 should remain 'skipped' because the loop should
    // detect the external modification and merge it (or prevent it from being lost)
    const phase2Final = (finalProgress.phases as { id: string; status: string }[]).find(
      (p) => p.id === 'phase-2'
    );

    assertEqual(
      phase2Final?.status,
      'skipped',
      `BUG-002: External skip was lost! phase-2 status is "${phase2Final?.status}" but should be "skipped". ` +
        'The loop overwrote external modifications made during Claude execution.'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('BUG-002: Skip actions from status server are preserved (compare-and-swap)', async () => {
  // This test verifies the fix for BUG-002 using the recommended approach:
  // Compare-and-swap with checksum verification.
  //
  // The fix should:
  // 1. Store file hash before Claude execution
  // 2. Before writing, check if hash changed
  // 3. If changed, read current file, merge changes, write
  //
  // This test simulates the scenario where:
  // - Phase 1 is executing
  // - User skips Phase 2 via /api/skip
  // - Phase 1 completes
  // - Loop should preserve Phase 2's skipped status

  const testDir = createTestSprintDir();

  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
        { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 2, delay: 0, verbose: false };

    let phase1Called = false;

    const mockDeps = {
      runClaude: async () => {
        if (!phase1Called) {
          phase1Called = true;

          // During phase-1 execution, mark phase-2 as skipped externally
          const currentProgress = readProgressFile(testDir);
          const phase2 = (currentProgress.phases as { id: string; status: string }[]).find(
            (p) => p.id === 'phase-2'
          );
          if (phase2) {
            phase2.status = 'skipped';
            const progressPath = path.join(testDir, 'PROGRESS.yaml');
            fs.writeFileSync(progressPath, yaml.dump(currentProgress), 'utf8');
          }

          return {
            success: true,
            output: 'Phase 1 completed',
            exitCode: 0,
            jsonResult: { status: 'completed', summary: 'Done' },
          };
        }

        // If we get here, the bug exists - phase 2 shouldn't be called if skipped
        throw new Error(
          'BUG-002: Phase 2 was executed even though it was skipped! ' +
            'The loop failed to detect external modifications.'
        );
      },
    };

    // Run the loop - should complete after phase-1 since phase-2 is skipped
    const result = await runLoop(testDir, options, mockDeps);

    // Verify phase-2 remained skipped and wasn't executed
    const finalProgress = readProgressFile(testDir);
    const phase2Status = (finalProgress.phases as { id: string; status: string }[]).find(
      (p) => p.id === 'phase-2'
    )?.status;

    assertEqual(
      phase2Status,
      'skipped',
      `BUG-002: Phase 2 status should be 'skipped' but is '${phase2Status}'`
    );

    // Sprint should complete successfully
    assertEqual(
      result.finalState.status,
      'completed',
      'Sprint should complete after phase-1 since phase-2 was skipped'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('BUG-002: Retry actions from status server are preserved', async () => {
  // This test verifies that retry-count modifications made during Claude execution
  // are not lost when the loop writes its progress update.
  //
  // Scenario:
  // - Phase 1 is executing
  // - DURING execution, external process sets retry-count on phase-1
  // - Phase 1 completes (or fails)
  // - The retry-count should be preserved in the final progress

  const testDir = createTestSprintDir();
  let retryCountInjected = false;

  try {
    const progress = createTestProgress({
      status: 'not-started',
      phases: [
        { id: 'phase-1', status: 'pending', prompt: 'Execute phase 1' },
        { id: 'phase-2', status: 'pending', prompt: 'Execute phase 2' },
      ],
    });
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 5, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => {
        // During the FIRST phase execution, simulate external process
        // setting retry-count (e.g., from /api/retry on a previous failure)
        if (!retryCountInjected) {
          retryCountInjected = true;

          // Simulate delay
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Read current progress, add retry-count to phase-1
          const currentProgress = readProgressFile(testDir);
          const phase1 = (currentProgress.phases as { id: string; status: string; 'retry-count'?: number }[]).find(
            (p) => p.id === 'phase-1'
          );
          if (phase1) {
            phase1['retry-count'] = 1;
            const progressPath = path.join(testDir, 'PROGRESS.yaml');
            fs.writeFileSync(progressPath, yaml.dump(currentProgress), 'utf8');
          }
        }

        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    const result = await runLoop(testDir, options, mockDeps);

    // Verify the injected retry-count was preserved
    assert(retryCountInjected, 'Test setup: retry-count should have been injected');

    const finalProgress = readProgressFile(testDir);
    const phase1 = (finalProgress.phases as { id: string; status: string; 'retry-count'?: number }[]).find(
      (p) => p.id === 'phase-1'
    );

    // The retry-count should be preserved (merged from external modification)
    assertEqual(
      phase1?.['retry-count'],
      1,
      `BUG-002: retry-count was lost! Expected 1, got ${phase1?.['retry-count']}`
    );

    // Sprint should still complete
    assertEqual(result.finalState.status, 'completed', 'Sprint should complete normally');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// BUG-001: Step Progress Indicators Tests
// ============================================================================

test('BUG-001: Step status should be updated to in-progress when executing', async () => {
  // This test verifies that step statuses are updated during execution.
  //
  // BUG: Currently the runtime only updates:
  //   - progress.status (sprint-level)
  //   - phase.status (only when sprint completes)
  // It NEVER updates step.status or subPhase.status, which means the
  // dashboard shows all steps as "pending" (empty circles) regardless
  // of actual execution state.
  //
  // Expected: When a step's sub-phase is being executed, both the step
  // and its current sub-phase should have status 'in-progress'.
  //
  // This test SHOULD FAIL with current code (demonstrating the bug exists)
  // and PASS once the bug is fixed.

  const testDir = createTestSprintDir();

  try {
    // Create progress with a for-each phase containing steps
    // Use type assertion to create the nested structure
    const progressData = {
      'sprint-id': 'test-sprint',
      status: 'not-started' as const,
      current: { phase: 0, step: 0, 'sub-phase': 0 },
      stats: {
        'started-at': null,
        'total-phases': 4,
        'completed-phases': 0,
      },
      phases: [
        {
          id: 'development',
          status: 'pending' as const,
          steps: [
            {
              id: 'step-0',
              prompt: 'Implement feature A',
              status: 'pending' as const,
              phases: [
                { id: 'context', status: 'pending' as const, prompt: 'Gather context' },
                { id: 'implement', status: 'pending' as const, prompt: 'Implement feature' },
              ],
            },
            {
              id: 'step-1',
              prompt: 'Implement feature B',
              status: 'pending' as const,
              phases: [
                { id: 'context', status: 'pending' as const, prompt: 'Gather context' },
                { id: 'implement', status: 'pending' as const, prompt: 'Implement feature' },
              ],
            },
          ],
        },
      ],
    };
    const progress = progressData as unknown as CompiledProgress;
    writeProgress(testDir, progress);

    // Track what statuses we see during execution
    const stepStatusesDuringExecution: string[] = [];
    const subPhaseStatusesDuringExecution: string[] = [];
    let executionCount = 0;

    const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => {
        executionCount++;

        // Read progress file to check step/sub-phase statuses during execution
        const currentProgress = readProgressFile(testDir);
        const devPhase = currentProgress.phases?.[0] as {
          steps?: Array<{
            id: string;
            status: string;
            phases?: Array<{ id: string; status: string }>;
          }>;
        };

        if (devPhase?.steps) {
          for (const step of devPhase.steps) {
            stepStatusesDuringExecution.push(`${step.id}:${step.status}`);
            if (step.phases) {
              for (const subPhase of step.phases) {
                subPhaseStatusesDuringExecution.push(`${step.id}/${subPhase.id}:${subPhase.status}`);
              }
            }
          }
        }

        return {
          success: true,
          output: 'Phase completed',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      },
    };

    const result = await runLoop(testDir, options, mockDeps);

    // Verify test ran
    assert(executionCount > 0, 'Test should have executed at least one phase');

    // BUG-001: Check that step statuses were EVER updated to 'in-progress'
    // With the current bug, all step statuses remain 'pending' throughout execution
    const hadInProgressStep = stepStatusesDuringExecution.some((s) => s.includes(':in-progress'));
    const hadInProgressSubPhase = subPhaseStatusesDuringExecution.some((s) => s.includes(':in-progress'));

    // This assertion should FAIL with current code
    assert(
      hadInProgressStep,
      `BUG-001: Step status was NEVER set to 'in-progress' during execution!\n` +
        `Observed step statuses: ${JSON.stringify([...new Set(stepStatusesDuringExecution)])}\n` +
        `Expected at least one 'in-progress' status for the current step.`
    );

    assert(
      hadInProgressSubPhase,
      `BUG-001: Sub-phase status was NEVER set to 'in-progress' during execution!\n` +
        `Observed sub-phase statuses: ${JSON.stringify([...new Set(subPhaseStatusesDuringExecution)])}\n` +
        `Expected at least one 'in-progress' status for the current sub-phase.`
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('BUG-001: Completed step status should be preserved in PROGRESS.yaml', async () => {
  // This test verifies that when a step is completed, its status is
  // updated to 'completed' in PROGRESS.yaml.
  //
  // BUG: Currently when the sprint completes, only phase.status is set
  // to 'completed' (line 228 in loop.ts), but step.status and
  // subPhase.status are never updated.
  //
  // Expected: After a step's last sub-phase completes, the step status
  // should be 'completed'. After sprint completion, PROGRESS.yaml
  // should show all executed steps and sub-phases as 'completed'.

  const testDir = createTestSprintDir();

  try {
    // Create progress with steps
    // Use type assertion to create the nested structure
    const progressData = {
      'sprint-id': 'test-sprint',
      status: 'not-started' as const,
      current: { phase: 0, step: 0, 'sub-phase': 0 },
      stats: {
        'started-at': null,
        'total-phases': 1,
        'completed-phases': 0,
      },
      phases: [
        {
          id: 'development',
          status: 'pending' as const,
          steps: [
            {
              id: 'step-0',
              prompt: 'Implement feature A',
              status: 'pending' as const,
              phases: [
                { id: 'implement', status: 'pending' as const, prompt: 'Implement feature' },
              ],
            },
          ],
        },
      ],
    };
    const progress = progressData as unknown as CompiledProgress;
    writeProgress(testDir, progress);

    const options: LoopOptions = { maxIterations: 5, delay: 0, verbose: false };

    const mockDeps = {
      runClaude: async () => ({
        success: true,
        output: 'Phase completed',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      }),
    };

    const result = await runLoop(testDir, options, mockDeps);

    // Sprint should complete
    assertEqual(result.finalState.status, 'completed', 'Sprint should complete');

    // Now check the final PROGRESS.yaml
    const finalProgress = readProgressFile(testDir);
    const devPhase = finalProgress.phases?.[0] as {
      status: string;
      steps?: Array<{
        id: string;
        status: string;
        phases?: Array<{ id: string; status: string }>;
      }>;
    };

    // BUG-001: Verify step status was updated
    const step = devPhase?.steps?.[0];

    assert(
      step?.status === 'completed',
      `BUG-001: Step status should be 'completed' after execution!\n` +
        `Actual step status: '${step?.status}'\n` +
        `The runtime only updates phase.status, not step.status.`
    );

    // BUG-001: Verify sub-phase status was updated
    const subPhase = step?.phases?.[0];

    assert(
      subPhase?.status === 'completed',
      `BUG-001: Sub-phase status should be 'completed' after execution!\n` +
        `Actual sub-phase status: '${subPhase?.status}'\n` +
        `The runtime only updates phase.status, not subPhase.status.`
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
