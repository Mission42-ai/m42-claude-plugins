/**
 * Tests for CLI Entry Point Module
 *
 * Tests for the CLI that provides commands matching the current bash interface.
 * Tests cover: command parsing, options handling, exit codes, and exports.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { execSync, spawn, ChildProcess } from 'child_process';

// Import from CLI module (WILL FAIL - module doesn't exist yet)
import {
  parseArgs,
  runCommand,
  CLI_VERSION,
} from './cli.js';

// Import from index module for export tests (WILL FAIL - module doesn't exist yet)
import {
  runLoop,
  LoopOptions,
  LoopResult,
} from './index.js';

// ============================================================================
// Test Infrastructure
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

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
      console.log(`✓ ${name}`);
    } catch (error) {
      testsFailed++;
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
    }
  }

  console.log('');
  console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
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

function assertIncludes(haystack: string, needle: string, message?: string): void {
  const msg = message || `Expected "${haystack}" to include "${needle}"`;
  if (!haystack.includes(needle)) throw new Error(msg);
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface CompiledProgress {
  'sprint-id': string;
  status: string;
  current: { phase: number; step: number | null; 'sub-phase': number | null };
  stats: {
    'started-at': string | null;
    'total-phases': number;
    'completed-phases': number;
  };
  phases: Array<{
    id: string;
    status: string;
    prompt: string;
  }>;
}

function createTestSprintDir(): string {
  const testDir = `/tmp/test-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      'total-phases': 1,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'phase-1',
        status: 'pending',
        prompt: 'Execute test phase',
      },
    ],
    ...overrides,
  };
}

function writeProgress(sprintDir: string, progress: CompiledProgress): void {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = yaml.dump(progress);
  fs.writeFileSync(progressPath, content, 'utf8');
}

// ============================================================================
// Scenario 1: CLI Parses Run Command with Directory
// ============================================================================

test('should parse run command with directory', () => {
  const args = ['node', 'cli.js', 'run', '/path/to/sprint'];
  const result = parseArgs(args);

  assertEqual(result.command, 'run', 'Command should be "run"');
  assertEqual(result.directory, '/path/to/sprint', 'Directory should be parsed');
});

test('should parse run command with relative directory', () => {
  const args = ['node', 'cli.js', 'run', './my-sprint'];
  const result = parseArgs(args);

  assertEqual(result.command, 'run', 'Command should be "run"');
  assertEqual(result.directory, './my-sprint', 'Relative directory should be parsed');
});

// ============================================================================
// Scenario 2: CLI Accepts Max Iterations Option
// ============================================================================

test('should accept --max-iterations option', () => {
  const args = ['node', 'cli.js', 'run', '/path', '--max-iterations', '10'];
  const result = parseArgs(args);

  assertEqual(result.options.maxIterations, 10, 'maxIterations should be 10');
});

test('should accept -n shorthand for max-iterations', () => {
  const args = ['node', 'cli.js', 'run', '/path', '-n', '5'];
  const result = parseArgs(args);

  assertEqual(result.options.maxIterations, 5, 'maxIterations should be 5');
});

test('should default maxIterations to 0 (unlimited)', () => {
  const args = ['node', 'cli.js', 'run', '/path'];
  const result = parseArgs(args);

  assertEqual(result.options.maxIterations, 0, 'maxIterations should default to 0');
});

// ============================================================================
// Scenario 3: CLI Accepts Delay Option
// ============================================================================

test('should accept --delay option', () => {
  const args = ['node', 'cli.js', 'run', '/path', '--delay', '5000'];
  const result = parseArgs(args);

  assertEqual(result.options.delay, 5000, 'delay should be 5000');
});

test('should accept -d shorthand for delay', () => {
  const args = ['node', 'cli.js', 'run', '/path', '-d', '3000'];
  const result = parseArgs(args);

  assertEqual(result.options.delay, 3000, 'delay should be 3000');
});

test('should default delay to 2000ms', () => {
  const args = ['node', 'cli.js', 'run', '/path'];
  const result = parseArgs(args);

  assertEqual(result.options.delay, 2000, 'delay should default to 2000');
});

// ============================================================================
// Scenario 4: CLI Accepts Verbose Flag
// ============================================================================

test('should accept -v/--verbose flag', () => {
  const args = ['node', 'cli.js', 'run', '/path', '-v'];
  const result = parseArgs(args);

  assertEqual(result.options.verbose, true, 'verbose should be true');
});

test('should accept --verbose long form', () => {
  const args = ['node', 'cli.js', 'run', '/path', '--verbose'];
  const result = parseArgs(args);

  assertEqual(result.options.verbose, true, 'verbose should be true');
});

test('should default verbose to false', () => {
  const args = ['node', 'cli.js', 'run', '/path'];
  const result = parseArgs(args);

  assertEqual(result.options.verbose, false, 'verbose should default to false');
});

// ============================================================================
// Scenario 5: CLI Exits with Code 0 on Success
// ============================================================================

test('should exit with code 0 on success', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create a completed sprint
    const progress = createTestProgress({ status: 'completed' });
    writeProgress(testDir, progress);

    // Mock runLoop to return success
    const mockRunLoop = async () => ({
      finalState: { status: 'completed' as const, completedAt: '', elapsed: '' },
      iterations: 0,
      elapsedMs: 100,
    });

    const exitCode = await runCommand('run', testDir, {}, mockRunLoop);

    assertEqual(exitCode, 0, 'Exit code should be 0 on success');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('should exit with code 0 when sprint completes normally', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const mockRunLoop = async () => ({
      finalState: { status: 'completed' as const, completedAt: new Date().toISOString(), elapsed: '1s' },
      iterations: 1,
      elapsedMs: 1000,
    });

    const exitCode = await runCommand('run', testDir, {}, mockRunLoop);

    assertEqual(exitCode, 0, 'Exit code should be 0');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 6: CLI Exits with Code 1 on Failure
// ============================================================================

test('should exit with code 1 on failure', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const mockRunLoop = async () => ({
      finalState: {
        status: 'blocked' as const,
        error: 'Phase failed',
        failedPhase: 'phase-1',
        blockedAt: new Date().toISOString(),
      },
      iterations: 1,
      elapsedMs: 1000,
    });

    const exitCode = await runCommand('run', testDir, {}, mockRunLoop);

    assertEqual(exitCode, 1, 'Exit code should be 1 on failure');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('should exit with code 1 when sprint needs human', async () => {
  const testDir = createTestSprintDir();
  try {
    const progress = createTestProgress({ status: 'not-started' });
    writeProgress(testDir, progress);

    const mockRunLoop = async () => ({
      finalState: { status: 'needs-human' as const, reason: 'Manual action required' },
      iterations: 1,
      elapsedMs: 1000,
    });

    const exitCode = await runCommand('run', testDir, {}, mockRunLoop);

    assertEqual(exitCode, 1, 'Exit code should be 1 when needs-human');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('should exit with code 1 when directory does not exist', async () => {
  const mockRunLoop = async () => {
    throw new Error('ENOENT: no such file or directory');
  };

  const exitCode = await runCommand('run', '/nonexistent/path', {}, mockRunLoop);

  assertEqual(exitCode, 1, 'Exit code should be 1 for missing directory');
});

// ============================================================================
// Scenario 7: CLI Shows Help with --help
// ============================================================================

test('should show help with --help flag', () => {
  const args = ['node', 'cli.js', '--help'];
  const result = parseArgs(args);

  assertEqual(result.command, 'help', 'Command should be "help"');
});

test('should show help includes run command documentation', () => {
  const args = ['node', 'cli.js', '--help'];
  const result = parseArgs(args);

  // The help output should be generated by commander or our custom help
  assert(result.showHelp === true, 'showHelp should be true');
});

test('should recognize run --help', () => {
  const args = ['node', 'cli.js', 'run', '--help'];
  const result = parseArgs(args);

  assertEqual(result.showHelp, true, 'showHelp should be true for run --help');
});

// ============================================================================
// Scenario 8: CLI Exports Public API via index.ts
// ============================================================================

test('should export public API - runLoop function', () => {
  assert(typeof runLoop === 'function', 'runLoop should be exported as a function');
});

test('should export public API - types are accessible', () => {
  // Type-only imports - if this compiles, types are exported
  const options: LoopOptions = { maxIterations: 10 };
  assert(options !== undefined, 'LoopOptions should be usable');
});

// ============================================================================
// Edge Cases
// ============================================================================

test('should handle combined options', () => {
  const args = ['node', 'cli.js', 'run', '/path', '-v', '-n', '5', '-d', '1000'];
  const result = parseArgs(args);

  assertEqual(result.options.verbose, true, 'verbose should be true');
  assertEqual(result.options.maxIterations, 5, 'maxIterations should be 5');
  assertEqual(result.options.delay, 1000, 'delay should be 1000');
});

test('should handle options before directory', () => {
  const args = ['node', 'cli.js', 'run', '--verbose', '/path'];
  const result = parseArgs(args);

  assertEqual(result.directory, '/path', 'Directory should be parsed');
  assertEqual(result.options.verbose, true, 'verbose should be true');
});

test('should report error for missing directory argument', () => {
  const args = ['node', 'cli.js', 'run'];
  const result = parseArgs(args);

  assert(result.error !== undefined, 'Should report error for missing directory');
  assertIncludes(result.error!, 'directory', 'Error should mention directory');
});

test('should report unknown command', () => {
  const args = ['node', 'cli.js', 'unknown'];
  const result = parseArgs(args);

  assert(result.error !== undefined, 'Should report error for unknown command');
});

// ============================================================================
// CLI Version
// ============================================================================

test('should have CLI_VERSION defined', () => {
  assert(typeof CLI_VERSION === 'string', 'CLI_VERSION should be a string');
  assert(CLI_VERSION.length > 0, 'CLI_VERSION should not be empty');
});

test('should show version with --version flag', () => {
  const args = ['node', 'cli.js', '--version'];
  const result = parseArgs(args);

  assertEqual(result.showVersion, true, 'showVersion should be true');
});

// ============================================================================
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
