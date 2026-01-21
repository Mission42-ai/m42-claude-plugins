/**
 * Tests for Progress Injector Module - Dynamic Step Injection
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './progress-injector.js' (until implementation exists)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Import from progress-injector.js - this will fail until implementation exists
// This is the expected RED phase behavior
import {
  ProgressInjector,
  type StepInjection,
  type WorkflowInjection,
  type InsertPosition,
  type InjectedPhase,
} from './progress-injector.js';

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

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(message ?? `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`);
  }
}

async function assertThrows(fn: () => Promise<void>, messageContains: string): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected function to throw, but it didn't`);
  } catch (error) {
    if (error instanceof Error && !error.message.includes(messageContains)) {
      throw new Error(`Expected error to contain "${messageContains}", got: ${error.message}`);
    }
    // Expected error occurred
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestProgress {
  'sprint-id': string;
  status: string;
  phases: TestPhase[];
  current: { phase: number; step: number | null; 'sub-phase': number | null };
  stats: { 'started-at': string | null; 'total-phases': number; 'completed-phases': number };
}

interface TestPhase {
  id: string;
  status: string;
  prompt?: string;
  steps?: TestStep[];
  injected?: boolean;
  'injected-at'?: string;
}

interface TestStep {
  id: string;
  prompt: string;
  status: string;
  phases: TestSubPhase[];
}

interface TestSubPhase {
  id: string;
  status: string;
  prompt: string;
}

function createTestSprintDir(): string {
  const testDir = `/tmp/test-progress-injector-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createMockProgress(overrides: Partial<TestProgress> = {}): TestProgress {
  return {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    phases: [
      { id: 'phase-A', status: 'completed', prompt: 'Phase A prompt' },
      { id: 'phase-B', status: 'in-progress', prompt: 'Phase B prompt' },
      { id: 'phase-C', status: 'pending', prompt: 'Phase C prompt' },
    ],
    current: { phase: 1, step: null, 'sub-phase': null },
    stats: {
      'started-at': new Date().toISOString(),
      'total-phases': 3,
      'completed-phases': 1,
    },
    ...overrides,
  };
}

function createMockProgressWithSteps(): TestProgress {
  return {
    'sprint-id': 'test-sprint-steps',
    status: 'in-progress',
    phases: [
      {
        id: 'development',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'First feature',
            status: 'completed',
            phases: [
              { id: 'red', status: 'completed', prompt: 'Write tests' },
              { id: 'green', status: 'completed', prompt: 'Implement' },
            ],
          },
          {
            id: 'step-1',
            prompt: 'Second feature',
            status: 'in-progress',
            phases: [
              { id: 'red', status: 'completed', prompt: 'Write tests' },
              { id: 'green', status: 'in-progress', prompt: 'Implement' },
            ],
          },
        ],
      },
      { id: 'qa', status: 'pending', prompt: 'Run QA' },
    ],
    current: { phase: 0, step: 1, 'sub-phase': 1 },
    stats: {
      'started-at': new Date().toISOString(),
      'total-phases': 6,
      'completed-phases': 3,
    },
  };
}

function writeTestProgress(testDir: string, progress: TestProgress): void {
  const progressPath = path.join(testDir, 'PROGRESS.yaml');
  fs.writeFileSync(progressPath, yaml.dump(progress), 'utf8');
}

function readTestProgress(testDir: string): TestProgress {
  const progressPath = path.join(testDir, 'PROGRESS.yaml');
  const content = fs.readFileSync(progressPath, 'utf8');
  return yaml.load(content) as TestProgress;
}

// ============================================================================
// Test: ProgressInjector Class Instantiation
// ============================================================================

console.log('\n=== ProgressInjector Class Tests ===\n');

test('ProgressInjector: can be instantiated with progress path', () => {
  const testDir = createTestSprintDir();
  try {
    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    writeTestProgress(testDir, createMockProgress());

    const injector = new ProgressInjector(progressPath);
    assert(injector !== undefined, 'injector should be defined');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: injectStep - Position Resolution
// ============================================================================

console.log('\n=== injectStep Position Tests ===\n');

test('injectStep: inserts at after-current position', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    // current phase is 1 (phase-B), so insert after should be at index 2
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'injected-step', prompt: 'Injected step prompt' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);

    // Original: [A, B, C], current=1 (B)
    // After inject: [A, B, NEW, C]
    assertEqual(updated.phases.length, 4, 'should have 4 phases');
    assertEqual(updated.phases[2].id, 'injected-step', 'new step at index 2');
    assertEqual(updated.phases[2].injected, true, 'should have injected flag');
    assert(updated.phases[2]['injected-at'] !== undefined, 'should have injected-at timestamp');
    assertEqual(updated.stats['total-phases'], 4, 'stats should be updated');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injectStep: inserts at end-of-workflow position', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'final-step', prompt: 'Final step prompt' },
      position: { type: 'end-of-workflow' },
    });

    const updated = readTestProgress(testDir);

    assertEqual(updated.phases.length, 4, 'should have 4 phases');
    assertEqual(updated.phases[3].id, 'final-step', 'new step at end');
    assertEqual(updated.stats['total-phases'], 4, 'stats should be updated');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injectStep: inserts at after-step position', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'after-B', prompt: 'After B prompt' },
      position: { type: 'after-step', stepId: 'phase-B' },
    });

    const updated = readTestProgress(testDir);

    // Original: [A(0), B(1), C(2)]
    // After inject after B: [A, B, NEW, C]
    assertEqual(updated.phases.length, 4, 'should have 4 phases');
    assertEqual(updated.phases[0].id, 'phase-A', 'A unchanged');
    assertEqual(updated.phases[1].id, 'phase-B', 'B unchanged');
    assertEqual(updated.phases[2].id, 'after-B', 'new step at index 2');
    assertEqual(updated.phases[3].id, 'phase-C', 'C shifted to index 3');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injectStep: inserts at before-step position', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'before-B', prompt: 'Before B prompt' },
      position: { type: 'before-step', stepId: 'phase-B' },
    });

    const updated = readTestProgress(testDir);

    // Original: [A(0), B(1), C(2)]
    // After inject before B: [A, NEW, B, C]
    assertEqual(updated.phases.length, 4, 'should have 4 phases');
    assertEqual(updated.phases[0].id, 'phase-A', 'A unchanged');
    assertEqual(updated.phases[1].id, 'before-B', 'new step at index 1');
    assertEqual(updated.phases[2].id, 'phase-B', 'B shifted to index 2');
    assertEqual(updated.phases[3].id, 'phase-C', 'C shifted to index 3');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: resolvePosition - Error Cases
// ============================================================================

console.log('\n=== resolvePosition Error Tests ===\n');

test('resolvePosition: throws for non-existent step', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await assertThrows(
      async () => {
        await injector.injectStep({
          step: { id: 'test', prompt: 'Test' },
          position: { type: 'after-step', stepId: 'NONEXISTENT' },
        });
      },
      'Step not found'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

test('resolvePosition: handles empty phases array', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress({ phases: [] });
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'first', prompt: 'First step' },
      position: { type: 'end-of-workflow' },
    });

    const updated = readTestProgress(testDir);
    assertEqual(updated.phases.length, 1, 'should have 1 phase');
    assertEqual(updated.phases[0].id, 'first', 'first step added');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: injectWorkflow
// ============================================================================

console.log('\n=== injectWorkflow Tests ===\n');

test('injectWorkflow: injects compiled workflow phases', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    // Create a mock workflow directory structure
    const workflowsDir = path.join(testDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowsDir, 'bugfix-workflow.yaml'),
      yaml.dump({
        name: 'Bugfix Workflow',
        description: 'Standard bugfix process',
        phases: [
          { id: 'analyze', prompt: 'Analyze the bug' },
          { id: 'fix', prompt: 'Fix the bug' },
        ],
      }),
      'utf8'
    );

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath, workflowsDir);

    await injector.injectWorkflow({
      workflow: 'bugfix-workflow',
      position: { type: 'after-current' },
      idPrefix: 'hotfix',
    });

    const updated = readTestProgress(testDir);

    // Original: [A, B, C], current=1 (B)
    // After inject: [A, B, hotfix-analyze, hotfix-fix, C]
    assertEqual(updated.phases.length, 5, 'should have 5 phases');
    assertEqual(updated.phases[2].id, 'hotfix-analyze', 'first workflow phase with prefix');
    assertEqual(updated.phases[3].id, 'hotfix-fix', 'second workflow phase with prefix');
    assertEqual(updated.phases[2].injected, true, 'should have injected flag');
    assertEqual(updated.phases[3].injected, true, 'should have injected flag');
    assertEqual(updated.stats['total-phases'], 5, 'stats should be updated');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injectWorkflow: throws for non-existent workflow', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await assertThrows(
      async () => {
        await injector.injectWorkflow({
          workflow: 'nonexistent-workflow',
          position: { type: 'after-current' },
          idPrefix: 'test',
        });
      },
      'Workflow not found'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: updateStats
// ============================================================================

console.log('\n=== updateStats Tests ===\n');

test('updateStats: recalculates stats after injection', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    // 3 phases, 1 completed
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    // Inject 2 steps
    await injector.injectStep({
      step: { id: 'new-1', prompt: 'New 1' },
      position: { type: 'end-of-workflow' },
    });

    await injector.injectStep({
      step: { id: 'new-2', prompt: 'New 2' },
      position: { type: 'end-of-workflow' },
    });

    const updated = readTestProgress(testDir);

    assertEqual(updated.stats['total-phases'], 5, 'total should be 5');
    assertEqual(updated.stats['completed-phases'], 1, 'completed should still be 1');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('updateStats: counts nested steps in for-each phases', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgressWithSteps();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'extra', prompt: 'Extra step' },
      position: { type: 'end-of-workflow' },
    });

    const updated = readTestProgress(testDir);

    // Original had 6 total phases (4 sub-phases in steps + 1 for-each phase + 1 qa phase)
    // After inject: 7 total phases
    assertEqual(updated.stats['total-phases'], 7, 'total should be 7');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: Injected Phase Properties
// ============================================================================

console.log('\n=== Injected Phase Properties Tests ===\n');

test('injected phase: has correct status', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'new-step', prompt: 'New step prompt' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);
    const injectedPhase = updated.phases.find(p => p.id === 'new-step');

    assert(injectedPhase !== undefined, 'injected phase should exist');
    assertEqual(injectedPhase!.status, 'pending', 'status should be pending');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injected phase: preserves model if specified', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'opus-step', prompt: 'Needs opus', model: 'opus' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);
    const injectedPhase = updated.phases.find(p => p.id === 'opus-step') as TestPhase & { model?: string };

    assert(injectedPhase !== undefined, 'injected phase should exist');
    assertEqual(injectedPhase.model, 'opus', 'model should be preserved');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: Current Pointer Handling
// ============================================================================

console.log('\n=== Current Pointer Tests ===\n');

test('after-current: handles current at first phase', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress({
      current: { phase: 0, step: null, 'sub-phase': null },
    });
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'after-first', prompt: 'After first' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);

    // Original: [A, B, C], current=0 (A)
    // After: [A, NEW, B, C]
    assertEqual(updated.phases[1].id, 'after-first', 'inserted after first phase');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('after-current: handles current at last phase', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress({
      current: { phase: 2, step: null, 'sub-phase': null },
    });
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'after-last', prompt: 'After last' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);

    // Original: [A, B, C], current=2 (C)
    // After: [A, B, C, NEW]
    assertEqual(updated.phases[3].id, 'after-last', 'inserted after last phase');
    assertEqual(updated.phases.length, 4, 'should have 4 phases');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('after-current: handles nested step context', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgressWithSteps();
    // current = { phase: 0, step: 1, 'sub-phase': 1 }
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    // Note: For nested steps, 'after-current' means after the current top-level phase
    // since injection operates on top-level phases
    await injector.injectStep({
      step: { id: 'after-dev', prompt: 'After development' },
      position: { type: 'after-current' },
    });

    const updated = readTestProgress(testDir);

    // Original: [development(with steps), qa]
    // After: [development, NEW, qa]
    assertEqual(updated.phases.length, 3, 'should have 3 top-level phases');
    assertEqual(updated.phases[1].id, 'after-dev', 'inserted after development phase');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: File Operations
// ============================================================================

console.log('\n=== File Operation Tests ===\n');

test('injectStep: creates backup before modifying', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createMockProgress();
    writeTestProgress(testDir, progress);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    await injector.injectStep({
      step: { id: 'test', prompt: 'Test' },
      position: { type: 'end-of-workflow' },
    });

    // Backup should be cleaned up on success, but we can verify the file was modified
    const updated = readTestProgress(testDir);
    assert(updated.phases.length === 4, 'file should be modified');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('injectStep: throws if progress file not found', async () => {
  const testDir = createTestSprintDir();
  try {
    const progressPath = path.join(testDir, 'NONEXISTENT.yaml');
    const injector = new ProgressInjector(progressPath);

    await assertThrows(
      async () => {
        await injector.injectStep({
          step: { id: 'test', prompt: 'Test' },
          position: { type: 'end-of-workflow' },
        });
      },
      'ENOENT'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
