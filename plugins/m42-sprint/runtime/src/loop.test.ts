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
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
