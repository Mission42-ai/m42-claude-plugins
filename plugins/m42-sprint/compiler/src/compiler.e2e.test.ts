/**
 * E2E Tests for Sprint Compiler
 *
 * Tests compiler behavior including Bug 5 (checksum file handling)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

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

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestDir(): string {
  const testDir = `/tmp/test-compiler-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function createTestWorkflowsDir(baseDir: string): string {
  const workflowsDir = path.join(baseDir, '.claude', 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });

  // Create a minimal workflow
  const workflowContent = yaml.dump({
    name: 'minimal-workflow',
    description: 'Minimal workflow for testing',
    phases: [
      { id: 'phase-1', prompt: 'Execute phase 1' },
      { id: 'phase-2', prompt: 'Execute phase 2' }
    ]
  });
  fs.writeFileSync(path.join(workflowsDir, 'minimal-workflow.yaml'), workflowContent, 'utf8');

  return workflowsDir;
}

function createTestSprintDir(baseDir: string, workflowName: string = 'minimal-workflow'): string {
  const sprintDir = path.join(baseDir, 'test-sprint');
  fs.mkdirSync(sprintDir, { recursive: true });

  // Create minimal SPRINT.yaml
  const sprintContent = yaml.dump({
    'sprint-id': 'test-sprint-id',
    name: 'Test Sprint',
    workflow: workflowName,
    collections: {
      step: [
        { id: 'step-1', prompt: 'Test step 1' }
      ]
    }
  });
  fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

  return sprintDir;
}

function cleanupTestDir(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ============================================================================
// Bug 5: Compiler Should Handle Stale Checksum Files
// ============================================================================

test('Bug 5: compiler should remove stale checksum file after writing PROGRESS.yaml', async () => {
  // Bug 5: When the compiler rewrites PROGRESS.yaml, any existing .checksum
  // file from a previous runtime session becomes stale and causes checksum
  // mismatch errors when the runtime tries to read the newly compiled file.
  //
  // BEFORE FIX: Stale .checksum file remains, causing runtime read failure
  // AFTER FIX: Compiler removes or updates .checksum file after writing

  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = createTestSprintDir(baseDir);
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');

    // Create a "stale" checksum file (simulating a previous runtime session)
    const staleChecksum = 'a7c63f7579afc797844188d00f7c5100b5775d97c96e6da2eaed44865c8bd927';
    fs.writeFileSync(checksumPath, staleChecksum, 'utf8');

    // Run the compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    try {
      execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      console.error('Compiler stdout:', err.stdout);
      console.error('Compiler stderr:', err.stderr);
      throw e;
    }

    // Verify PROGRESS.yaml was created
    assert(fs.existsSync(progressPath), 'PROGRESS.yaml should exist after compilation');

    // Bug 5 check: After compilation, either:
    // 1. The checksum file should be deleted, OR
    // 2. The checksum file should be updated to match the new content
    //
    // If the checksum file still has the stale value, the test fails

    if (fs.existsSync(checksumPath)) {
      // If checksum file exists, it should match the compiled content
      const progressContent = fs.readFileSync(progressPath, 'utf8');
      const expectedChecksum = calculateChecksum(progressContent);
      const actualChecksum = fs.readFileSync(checksumPath, 'utf8').trim();

      assertEqual(
        actualChecksum,
        expectedChecksum,
        `Bug 5: Checksum file has stale value. Expected: ${expectedChecksum}, Got: ${actualChecksum}`
      );
    }
    // If checksum file doesn't exist, that's also acceptable (compiler deleted it)

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('Bug 5: runtime should be able to read compiler-generated PROGRESS.yaml without checksum errors', async () => {
  // This tests the full flow: compile, then read with runtime yaml-ops

  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = createTestSprintDir(baseDir);
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const checksumPath = path.join(sprintDir, 'PROGRESS.yaml.checksum');

    // Create stale checksum
    fs.writeFileSync(checksumPath, 'stale-checksum-value-12345', 'utf8');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Now try to read using the runtime's readProgress logic
    // (simulated here since we can't easily import from runtime)
    const content = fs.readFileSync(progressPath, 'utf8');

    if (fs.existsSync(checksumPath)) {
      const storedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
      const actualChecksum = calculateChecksum(content);

      if (storedChecksum !== actualChecksum) {
        throw new Error(
          `Bug 5: Runtime would fail with checksum mismatch. ` +
          `Stored: ${storedChecksum}, Actual: ${actualChecksum}`
        );
      }
    }

    // Verify we can parse the YAML
    const progress = yaml.load(content) as { 'sprint-id': string };
    assert(progress['sprint-id'] !== undefined, 'Should have sprint-id');

  } finally {
    cleanupTestDir(baseDir);
  }
});

// ============================================================================
// Basic Compiler E2E Tests
// ============================================================================

test('compiler should generate valid PROGRESS.yaml from minimal sprint', async () => {
  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = createTestSprintDir(baseDir);
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Verify output
    assert(fs.existsSync(progressPath), 'PROGRESS.yaml should be created');

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      'sprint-id': string;
      status: string;
      phases?: unknown[];
    };

    assertEqual(progress['sprint-id'], 'test-sprint-id', 'Sprint ID should match');
    assertEqual(progress.status, 'not-started', 'Initial status should be not-started');
    assert(Array.isArray(progress.phases), 'Should have phases array');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should fail gracefully on missing SPRINT.yaml', async () => {
  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = path.join(baseDir, 'empty-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });
    // Don't create SPRINT.yaml

    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');

    let threwError = false;
    try {
      execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch {
      threwError = true;
    }

    assert(threwError, 'Should throw error when SPRINT.yaml is missing');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should fail gracefully on invalid workflow reference', async () => {
  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = path.join(baseDir, 'invalid-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    // Create SPRINT.yaml with invalid workflow reference
    const sprintContent = yaml.dump({
      'sprint-id': 'test',
      name: 'Test',
      workflow: 'nonexistent-workflow',
      collections: { step: [{ id: 'step-1', prompt: 'Test' }] }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');

    let threwError = false;
    try {
      execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch {
      threwError = true;
    }

    assert(threwError, 'Should throw error when workflow is not found');

  } finally {
    cleanupTestDir(baseDir);
  }
});

// ============================================================================
// Worktree Config Inheritance Tests
// ============================================================================

test('compiler should include worktree config in PROGRESS.yaml when workflow enables it', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory with a worktree-enabled workflow
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    const workflowContent = yaml.dump({
      name: 'worktree-workflow',
      description: 'Workflow with worktree enabled',
      worktree: {
        enabled: true,
        'branch-prefix': 'sprint/',
        'path-prefix': '../worktrees/',
        cleanup: 'on-complete'
      },
      phases: [
        { id: 'implement', prompt: 'Implement: {{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'worktree-workflow.yaml'), workflowContent, 'utf8');

    // Create sprint directory
    const sprintDir = path.join(baseDir, 'worktree-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': '2026-01-29_worktree-test',
      name: 'Worktree Test Sprint',
      workflow: 'worktree-workflow',
      collections: {
        step: [
          { id: 'step-1', prompt: 'First step' }
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Verify PROGRESS.yaml has worktree config
    assert(fs.existsSync(progressPath), 'PROGRESS.yaml should be created');

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      'sprint-id': string;
      worktree?: {
        enabled: boolean;
        branch: string;
        path: string;
        cleanup: string;
      };
    };

    assert(progress.worktree !== undefined, 'PROGRESS.yaml should have worktree config');
    assertEqual(progress.worktree!.enabled, true, 'worktree.enabled should be true');
    assertEqual(progress.worktree!.branch, 'sprint/2026-01-29_worktree-test', 'worktree.branch should be resolved');
    assertEqual(progress.worktree!.path, '../worktrees/2026-01-29_worktree-test', 'worktree.path should be resolved');
    assertEqual(progress.worktree!.cleanup, 'on-complete', 'worktree.cleanup should match workflow');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should NOT include worktree config when workflow does not have it', async () => {
  const baseDir = createTestDir();
  try {
    const workflowsDir = createTestWorkflowsDir(baseDir);
    const sprintDir = createTestSprintDir(baseDir);
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      worktree?: unknown;
    };

    assertEqual(progress.worktree, undefined, 'PROGRESS.yaml should NOT have worktree config');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('sprint worktree config should override workflow worktree config', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory with a worktree-enabled workflow
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    const workflowContent = yaml.dump({
      name: 'worktree-workflow',
      worktree: {
        enabled: true,
        'branch-prefix': 'sprint/',
        'path-prefix': '../worktrees/'
      },
      phases: [
        { id: 'implement', prompt: 'Implement: {{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'worktree-workflow.yaml'), workflowContent, 'utf8');

    // Create sprint directory with worktree DISABLED at sprint level
    const sprintDir = path.join(baseDir, 'override-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': '2026-01-29_override-test',
      workflow: 'worktree-workflow',
      worktree: {
        enabled: false  // Sprint overrides workflow
      },
      collections: {
        step: [
          { id: 'step-1', prompt: 'First step' }
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      worktree?: unknown;
    };

    assertEqual(progress.worktree, undefined, 'Sprint disabling worktree should override workflow');

  } finally {
    cleanupTestDir(baseDir);
  }
});

// ============================================================================
// Dependency Graph Compilation Tests
// ============================================================================

test('compiler should build dependency-graph for steps with depends-on', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory with a for-each workflow
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    // Create a step workflow
    const stepWorkflowContent = yaml.dump({
      name: 'step-workflow',
      phases: [
        { id: 'implement', prompt: 'Implement: {{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'step-workflow.yaml'), stepWorkflowContent, 'utf8');

    // Create main workflow with for-each
    const mainWorkflowContent = yaml.dump({
      name: 'dependency-workflow',
      phases: [
        { id: 'development', 'for-each': 'step', workflow: 'step-workflow' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'dependency-workflow.yaml'), mainWorkflowContent, 'utf8');

    // Create sprint directory with dependencies
    const sprintDir = path.join(baseDir, 'dep-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': 'dep-test',
      workflow: 'dependency-workflow',
      collections: {
        step: [
          { id: 'setup', prompt: 'Setup the project' },
          { id: 'build', prompt: 'Build the project', 'depends-on': ['setup'] },
          { id: 'test', prompt: 'Test the project', 'depends-on': ['build'] },
          { id: 'deploy', prompt: 'Deploy the project', 'depends-on': ['build', 'test'] }
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Verify PROGRESS.yaml has dependency-graph
    assert(fs.existsSync(progressPath), 'PROGRESS.yaml should be created');

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      'sprint-id': string;
      'dependency-graph'?: Array<{
        'phase-id': string;
        nodes: Array<{
          id: string;
          'depends-on': string[];
          'blocked-by': string[];
        }>;
      }>;
      phases?: Array<{
        id: string;
        steps?: Array<{
          id: string;
          'depends-on'?: string[];
        }>;
      }>;
    };

    // Verify dependency-graph exists
    assert(progress['dependency-graph'] !== undefined, 'PROGRESS.yaml should have dependency-graph');
    assertEqual(progress['dependency-graph']!.length, 1, 'Should have 1 dependency graph (for development phase)');

    const graph = progress['dependency-graph']![0];
    assertEqual(graph['phase-id'], 'development', 'Graph should be for development phase');
    assertEqual(graph.nodes.length, 4, 'Should have 4 nodes');

    // Verify setup node
    const setupNode = graph.nodes.find(n => n.id === 'setup');
    assert(setupNode !== undefined, 'Should have setup node');
    assertEqual(setupNode!['depends-on'].length, 0, 'setup should have no dependencies');
    assertEqual(setupNode!['blocked-by'].length, 0, 'setup should have no blocked-by');

    // Verify build node
    const buildNode = graph.nodes.find(n => n.id === 'build');
    assert(buildNode !== undefined, 'Should have build node');
    assertEqual(buildNode!['depends-on'].length, 1, 'build should have 1 dependency');
    assertEqual(buildNode!['depends-on'][0], 'setup', 'build should depend on setup');
    assertEqual(buildNode!['blocked-by'].length, 1, 'build should be blocked by 1 node');
    assertEqual(buildNode!['blocked-by'][0], 'setup', 'build should be blocked by setup');

    // Verify deploy node
    const deployNode = graph.nodes.find(n => n.id === 'deploy');
    assert(deployNode !== undefined, 'Should have deploy node');
    assertEqual(deployNode!['depends-on'].length, 2, 'deploy should have 2 dependencies');
    assertEqual(deployNode!['blocked-by'].length, 2, 'deploy should be blocked by 2 nodes');

    // Verify steps also have depends-on preserved
    const devPhase = progress.phases?.find(p => p.id === 'development');
    assert(devPhase !== undefined, 'Should have development phase');
    assert(devPhase!.steps !== undefined, 'Development phase should have steps');

    const buildStep = devPhase!.steps!.find(s => s.id === 'build');
    assert(buildStep !== undefined, 'Should have build step');
    assert(buildStep!['depends-on'] !== undefined, 'Build step should have depends-on');
    assertEqual(buildStep!['depends-on']![0], 'setup', 'Build step should depend on setup');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should NOT include dependency-graph when no steps have dependencies', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    // Create a step workflow
    const stepWorkflowContent = yaml.dump({
      name: 'step-workflow',
      phases: [
        { id: 'implement', prompt: 'Implement: {{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'step-workflow.yaml'), stepWorkflowContent, 'utf8');

    // Create main workflow with for-each
    const mainWorkflowContent = yaml.dump({
      name: 'no-deps-workflow',
      phases: [
        { id: 'development', 'for-each': 'step', workflow: 'step-workflow' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'no-deps-workflow.yaml'), mainWorkflowContent, 'utf8');

    // Create sprint directory WITHOUT dependencies
    const sprintDir = path.join(baseDir, 'no-dep-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': 'no-dep-test',
      workflow: 'no-deps-workflow',
      collections: {
        step: [
          { id: 'step-1', prompt: 'First step' },
          { id: 'step-2', prompt: 'Second step' },
          { id: 'step-3', prompt: 'Third step' }
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

    // Run compiler
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');
    execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const content = fs.readFileSync(progressPath, 'utf8');
    const progress = yaml.load(content) as {
      'dependency-graph'?: unknown;
    };

    assertEqual(progress['dependency-graph'], undefined, 'PROGRESS.yaml should NOT have dependency-graph when no dependencies');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should validate dependencies at compile time', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    const workflowContent = yaml.dump({
      name: 'validation-workflow',
      phases: [
        { id: 'dev', 'for-each': 'step', prompt: '{{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'validation-workflow.yaml'), workflowContent, 'utf8');

    // Create sprint with invalid dependency reference
    const sprintDir = path.join(baseDir, 'invalid-dep-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': 'invalid-dep-test',
      workflow: 'validation-workflow',
      collections: {
        step: [
          { id: 'step-1', prompt: 'First step' },
          { id: 'step-2', prompt: 'Second step', 'depends-on': ['nonexistent'] } // Invalid reference
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    // Run compiler - should fail
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');

    let threwError = false;
    let errorOutput = '';
    try {
      execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      threwError = true;
      const err = e as { stderr?: string; stdout?: string };
      errorOutput = err.stderr || err.stdout || '';
    }

    assert(threwError, 'Compiler should fail when dependency does not exist');
    assert(errorOutput.includes('nonexistent') || errorOutput.includes('DEPENDENCY'),
      'Error should mention the missing dependency');

  } finally {
    cleanupTestDir(baseDir);
  }
});

test('compiler should reject circular dependencies', async () => {
  const baseDir = createTestDir();
  try {
    // Create workflows directory
    const workflowsDir = path.join(baseDir, '.claude', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    const workflowContent = yaml.dump({
      name: 'circular-workflow',
      phases: [
        { id: 'dev', 'for-each': 'step', prompt: '{{item.prompt}}' }
      ]
    });
    fs.writeFileSync(path.join(workflowsDir, 'circular-workflow.yaml'), workflowContent, 'utf8');

    // Create sprint with circular dependency
    const sprintDir = path.join(baseDir, 'circular-dep-sprint');
    fs.mkdirSync(sprintDir, { recursive: true });

    const sprintContent = yaml.dump({
      'sprint-id': 'circular-dep-test',
      workflow: 'circular-workflow',
      collections: {
        step: [
          { id: 'step-a', prompt: 'Step A', 'depends-on': ['step-b'] },
          { id: 'step-b', prompt: 'Step B', 'depends-on': ['step-a'] } // Circular!
        ]
      }
    });
    fs.writeFileSync(path.join(sprintDir, 'SPRINT.yaml'), sprintContent, 'utf8');

    // Run compiler - should fail
    const compilerPath = path.resolve(__dirname, '..', 'dist', 'index.js');

    let threwError = false;
    let errorOutput = '';
    try {
      execSync(`node "${compilerPath}" "${sprintDir}" -w "${workflowsDir}"`, {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      threwError = true;
      const err = e as { stderr?: string; stdout?: string };
      errorOutput = err.stderr || err.stdout || '';
    }

    assert(threwError, 'Compiler should fail when circular dependency exists');
    assert(errorOutput.includes('CIRCULAR') || errorOutput.includes('circular'),
      'Error should mention circular dependency');

  } finally {
    cleanupTestDir(baseDir);
  }
});

// ============================================================================
// Run Tests
// ============================================================================

// Tests run via setImmediate callback
