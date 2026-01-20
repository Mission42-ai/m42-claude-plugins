/**
 * Integration Tests for Bash Removal Step
 *
 * These tests verify that:
 * 1. Replaced bash scripts have been deleted
 * 2. Integration test scripts are preserved
 * 3. Commands no longer reference deleted scripts
 * 4. Documentation has been updated
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, __dirname is runtime/dist/, so go up 2 levels to get to m42-sprint
// When running source, __dirname is runtime/src/, so we need to handle both
const distOrSrc = path.basename(__dirname);
const levelsUp = distOrSrc === 'dist' || distOrSrc === 'src' ? '../..' : '../../..';


// ============================================================================
// Test Infrastructure
// ============================================================================

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Path Helpers
// ============================================================================

const PLUGIN_ROOT = path.resolve(__dirname, levelsUp);

function pluginPath(...parts: string[]): string {
  return path.join(PLUGIN_ROOT, ...parts);
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(pluginPath(relativePath));
}

function fileContains(relativePath: string, pattern: RegExp): boolean {
  if (!fileExists(relativePath)) return false;
  const content = fs.readFileSync(pluginPath(relativePath), 'utf-8');
  return pattern.test(content);
}

// ============================================================================
// Scenario 1: Bash scripts deleted
// ============================================================================

console.log('\n=== Scenario 1: Bash scripts deleted ===');

test('sprint-loop.sh should not exist', () => {
  assert(
    !fileExists('scripts/sprint-loop.sh'),
    'scripts/sprint-loop.sh still exists - should be deleted'
  );
});

test('build-sprint-prompt.sh should not exist', () => {
  assert(
    !fileExists('scripts/build-sprint-prompt.sh'),
    'scripts/build-sprint-prompt.sh still exists - should be deleted'
  );
});

test('build-parallel-prompt.sh should not exist', () => {
  assert(
    !fileExists('scripts/build-parallel-prompt.sh'),
    'scripts/build-parallel-prompt.sh still exists - should be deleted'
  );
});

test('preflight-check.sh should not exist', () => {
  assert(
    !fileExists('scripts/preflight-check.sh'),
    'scripts/preflight-check.sh still exists - should be deleted'
  );
});

// ============================================================================
// Scenario 2: Integration test scripts preserved
// ============================================================================

console.log('\n=== Scenario 2: Integration test scripts preserved ===');

test('test-sprint-features.sh should exist', () => {
  assert(
    fileExists('scripts/test-sprint-features.sh'),
    'scripts/test-sprint-features.sh should be preserved'
  );
});

test('test-skip-spawned.sh should exist', () => {
  assert(
    fileExists('scripts/test-skip-spawned.sh'),
    'scripts/test-skip-spawned.sh should be preserved'
  );
});

test('test-skip-parallel-task-id.sh should exist', () => {
  assert(
    fileExists('scripts/test-skip-parallel-task-id.sh'),
    'scripts/test-skip-parallel-task-id.sh should be preserved'
  );
});

test('test-normal-subphase.sh should exist', () => {
  assert(
    fileExists('scripts/test-normal-subphase.sh'),
    'scripts/test-normal-subphase.sh should be preserved'
  );
});

// ============================================================================
// Scenario 3 & 4: No bash script references in commands
// ============================================================================

console.log('\n=== Scenario 3 & 4: No bash script references in commands ===');

test('run-sprint.md should not reference sprint-loop.sh', () => {
  assert(
    !fileContains('commands/run-sprint.md', /sprint-loop\.sh/),
    'commands/run-sprint.md still references sprint-loop.sh'
  );
});

test('run-sprint.md should not reference build-sprint-prompt', () => {
  assert(
    !fileContains('commands/run-sprint.md', /build-sprint-prompt/),
    'commands/run-sprint.md still references build-sprint-prompt'
  );
});

test('pause-sprint.md should not reference sprint-loop.sh', () => {
  assert(
    !fileContains('commands/pause-sprint.md', /sprint-loop\.sh/),
    'commands/pause-sprint.md still references sprint-loop.sh'
  );
});

test('resume-sprint.md should not reference sprint-loop.sh', () => {
  assert(
    !fileContains('commands/resume-sprint.md', /sprint-loop\.sh/),
    'commands/resume-sprint.md still references sprint-loop.sh'
  );
});

test('stop-sprint.md should not reference sprint-loop.sh', () => {
  assert(
    !fileContains('commands/stop-sprint.md', /sprint-loop\.sh/),
    'commands/stop-sprint.md still references sprint-loop.sh'
  );
});

// ============================================================================
// Scenario 5: run-sprint command uses TypeScript runtime
// ============================================================================

console.log('\n=== Scenario 5: run-sprint uses TypeScript runtime ===');

test('run-sprint.md should reference TypeScript CLI', () => {
  const hasNodeRuntime = fileContains('commands/run-sprint.md', /node.*runtime\/dist\/cli\.js/);
  const hasSprintRun = fileContains('commands/run-sprint.md', /sprint\s+run/);
  assert(
    hasNodeRuntime || hasSprintRun,
    'commands/run-sprint.md should reference TypeScript CLI (node runtime/dist/cli.js or "sprint run")'
  );
});

// ============================================================================
// Scenario 6: README documents TypeScript runtime
// ============================================================================

console.log('\n=== Scenario 6: README documents TypeScript runtime ===');

test('README.md should not require yq installation', () => {
  assert(
    !fileContains('README.md', /brew install yq/),
    'README.md still mentions "brew install yq"'
  );
  assert(
    !fileContains('README.md', /snap install yq/),
    'README.md still mentions "snap install yq"'
  );
});

test('README.md should document Node.js requirement', () => {
  assert(
    fileContains('README.md', /Node\.js|node\.js|nodejs/i),
    'README.md should mention Node.js requirement'
  );
});

// ============================================================================
// Summary
// ============================================================================

console.log('\nIntegration tests completed.');
