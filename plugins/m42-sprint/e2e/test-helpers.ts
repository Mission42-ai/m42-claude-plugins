/**
 * E2E Test Helpers for Sprint Plugin
 *
 * Provides utilities for creating test sprints, mock Claude runners,
 * and cleanup functions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

export interface MockClaudeResponse {
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
  jsonResult?: Record<string, unknown>;
}

export interface MockClaudeRunner {
  runClaude: (options: { prompt: string; cwd?: string }) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
    error?: string;
    jsonResult?: Record<string, unknown>;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

// When running from dist/, __dirname is e2e/dist, so go up one level to e2e/
export const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');
export const WORKFLOWS_DIR = path.join(FIXTURES_DIR, 'workflows');

// ============================================================================
// Test Directory Management
// ============================================================================

/**
 * Create a temporary test directory
 */
export function createTestDir(prefix: string = 'test-e2e'): string {
  const testDir = `/tmp/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * Clean up a test directory
 */
export function cleanupTestDir(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Copy a fixture sprint to a test directory
 */
export function copyFixture(fixtureName: string, destDir: string): void {
  const srcDir = path.join(FIXTURES_DIR, fixtureName);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Fixture not found: ${fixtureName}`);
  }

  // Copy all files from fixture
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (fs.statSync(srcPath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      const subFiles = fs.readdirSync(srcPath);
      for (const subFile of subFiles) {
        fs.copyFileSync(path.join(srcPath, subFile), path.join(destPath, subFile));
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Copy workflows to .claude/workflows
  const workflowsDestDir = path.join(destDir, '.claude', 'workflows');
  fs.mkdirSync(workflowsDestDir, { recursive: true });
  const workflowFiles = fs.readdirSync(WORKFLOWS_DIR);
  for (const file of workflowFiles) {
    fs.copyFileSync(
      path.join(WORKFLOWS_DIR, file),
      path.join(workflowsDestDir, file)
    );
  }
}

// ============================================================================
// Mock Claude Runner Factory
// ============================================================================

/**
 * Create a mock Claude runner that returns predefined responses
 *
 * @param responses - Array of responses to return in sequence
 * @returns Mock deps object compatible with runLoop
 */
export function createMockClaudeRunner(responses: MockClaudeResponse[]): MockClaudeRunner {
  let callIndex = 0;

  return {
    runClaude: async () => {
      if (callIndex >= responses.length) {
        // Default: return success after exhausting predefined responses
        return {
          success: true,
          output: '',
          exitCode: 0,
          jsonResult: { status: 'completed', summary: 'Done' },
        };
      }

      const response = responses[callIndex++];
      return {
        success: response.success,
        output: response.output,
        exitCode: response.exitCode,
        error: response.error,
        jsonResult: response.jsonResult,
      };
    },
  };
}

/**
 * Create a mock that always succeeds
 */
export function createSuccessMock(): MockClaudeRunner {
  return {
    runClaude: async () => ({
      success: true,
      output: 'Task completed successfully',
      exitCode: 0,
      jsonResult: { status: 'completed', summary: 'Phase completed successfully' },
    }),
  };
}

/**
 * Create a mock that fails on specific iteration
 */
export function createFailOnIterationMock(failIteration: number, error: string = 'Test failure'): MockClaudeRunner {
  let callCount = 0;

  return {
    runClaude: async () => {
      callCount++;
      if (callCount === failIteration) {
        return {
          success: false,
          output: '',
          exitCode: 1,
          error,
        };
      }
      return {
        success: true,
        output: '',
        exitCode: 0,
        jsonResult: { status: 'completed', summary: 'Done' },
      };
    },
  };
}

/**
 * Create a mock that returns needs-human status
 */
export function createNeedsHumanMock(reason: string, details?: string): MockClaudeRunner {
  return {
    runClaude: async () => ({
      success: true,
      output: '',
      exitCode: 0,
      jsonResult: {
        status: 'needs-human',
        summary: 'Human intervention required',
        humanNeeded: { reason, details },
      },
    }),
  };
}

// ============================================================================
// Compiler Helper
// ============================================================================

/**
 * Run the compiler on a sprint directory
 */
export function compileSprint(sprintDir: string, workflowsDir?: string): void {
  // When running from dist/, __dirname is e2e/dist, so go up two levels
  const compilerPath = path.resolve(__dirname, '..', '..', 'compiler', 'dist', 'index.js');
  const wDir = workflowsDir || path.join(sprintDir, '.claude', 'workflows');

  execSync(`node "${compilerPath}" "${sprintDir}" -w "${wDir}"`, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

// ============================================================================
// Progress File Helpers
// ============================================================================

/**
 * Read PROGRESS.yaml from a sprint directory
 */
export function readProgress(sprintDir: string): Record<string, unknown> {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = fs.readFileSync(progressPath, 'utf8');
  return yaml.load(content) as Record<string, unknown>;
}

/**
 * Write PROGRESS.yaml to a sprint directory (for test setup)
 * Also updates the checksum file to avoid mismatch errors
 */
export function writeProgress(sprintDir: string, progress: Record<string, unknown>): void {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');

  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(progressPath, content, 'utf8');

  // Calculate and write checksum to avoid mismatch errors
  const checksum = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  fs.writeFileSync(checksumPath, checksum, 'utf8');
}

/**
 * Create a PAUSE file in the sprint directory
 */
export function createPauseFile(sprintDir: string, reason: string = 'Test pause'): void {
  const pausePath = path.join(sprintDir, 'PAUSE');
  fs.writeFileSync(pausePath, reason, 'utf8');
}

/**
 * Remove the PAUSE file from the sprint directory
 */
export function removePauseFile(sprintDir: string): void {
  const pausePath = path.join(sprintDir, 'PAUSE');
  if (fs.existsSync(pausePath)) {
    fs.unlinkSync(pausePath);
  }
}

// ============================================================================
// Test Infrastructure
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

let testResults: TestResult[] = [];
let testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
let testsStarted = false;

/**
 * Reset test state (call before each test file)
 */
export function resetTests(): void {
  testResults = [];
  testQueue = [];
  testsStarted = false;
}

/**
 * Register a test
 */
export function test(name: string, fn: () => void | Promise<void>): void {
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
      testResults.push({ name, passed: true });
      console.log(`✓ ${name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      testResults.push({ name, passed: false, error: errorMsg });
      console.error(`✗ ${name}`);
      console.error(`  ${errorMsg}`);
    }
  }

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log('');
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

/**
 * Assertion helpers
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  if (actual !== expected) throw new Error(msg);
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  const msg = message || `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`;
  if (actualStr !== expectedStr) throw new Error(msg);
}
