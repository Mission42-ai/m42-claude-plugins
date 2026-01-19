/**
 * Tests for yaml-ops module - Atomic YAML operations with checksum validation
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './yaml-ops.js' (until implementation exists)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import from yaml-ops.js - this will fail until implementation exists
// This is the expected RED phase behavior
import {
  writeProgressAtomic,
  readProgress,
  backupProgress,
  restoreProgress,
  cleanupBackup,
  calculateChecksum,
} from './yaml-ops.js';

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

function assertThrows(fn: () => void, messagePattern: string | RegExp): void {
  let threw = false;
  let errorMessage = '';
  try {
    fn();
  } catch (error) {
    threw = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it did not`);
  }
  const pattern = typeof messagePattern === 'string' ? new RegExp(messagePattern, 'i') : messagePattern;
  if (!pattern.test(errorMessage)) {
    throw new Error(`Expected error message to match ${pattern}, got: ${errorMessage}`);
  }
}

async function assertThrowsAsync(fn: () => Promise<void>, messagePattern: string | RegExp): Promise<void> {
  let threw = false;
  let errorMessage = '';
  try {
    await fn();
  } catch (error) {
    threw = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it did not`);
  }
  const pattern = typeof messagePattern === 'string' ? new RegExp(messagePattern, 'i') : messagePattern;
  if (!pattern.test(errorMessage)) {
    throw new Error(`Expected error message to match ${pattern}, got: ${errorMessage}`);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestContext {
  tempDir: string;
  progressFile: string;
  checksumFile: string;
  backupFile: string;
  checksumBackup: string;
}

function createTestDir(): TestContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaml-ops-test-'));
  return {
    tempDir,
    progressFile: path.join(tempDir, 'PROGRESS.yaml'),
    checksumFile: path.join(tempDir, 'PROGRESS.yaml.checksum'),
    backupFile: path.join(tempDir, 'PROGRESS.yaml.backup'),
    checksumBackup: path.join(tempDir, 'PROGRESS.yaml.checksum.backup'),
  };
}

function cleanupTestDir(ctx: TestContext): void {
  try {
    fs.rmSync(ctx.tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Import types from yaml-ops for test fixtures
import type { CompiledProgress, SprintStatus, SprintStats } from './yaml-ops.js';

// Simple interface for test fixtures - compatible with CompiledProgress
interface TestProgress {
  'sprint-id': string;
  status: SprintStatus;
  current: { phase: number; step: number | null; 'sub-phase': number | null };
  stats: SprintStats;
  phases?: Array<{ id: string; status: string; prompt: string }>;
  [key: string]: unknown;
}

function createMinimalProgress(): TestProgress {
  return {
    'sprint-id': 'test-sprint-2026',
    status: 'in-progress',
    current: { phase: 0, step: null, 'sub-phase': null },
    stats: {
      'started-at': '2026-01-20T10:00:00Z',
      'total-phases': 2,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'phase-0',
        status: 'in-progress',
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

// ============================================================================
// Test: calculateChecksum
// ============================================================================

console.log('\n=== calculateChecksum Tests ===\n');

test('calculateChecksum: returns SHA256 hex string', () => {
  const content = 'test content';
  const checksum = calculateChecksum(content);

  // SHA256 produces 64 hex characters
  assertEqual(checksum.length, 64, 'Checksum should be 64 characters');
  assert(/^[0-9a-f]+$/.test(checksum), 'Checksum should be hex string');
});

test('calculateChecksum: same content produces same hash', () => {
  const content = 'identical content';
  const checksum1 = calculateChecksum(content);
  const checksum2 = calculateChecksum(content);

  assertEqual(checksum1, checksum2, 'Same content should produce same hash');
});

test('calculateChecksum: different content produces different hash', () => {
  const checksum1 = calculateChecksum('content A');
  const checksum2 = calculateChecksum('content B');

  assert(checksum1 !== checksum2, 'Different content should produce different hash');
});

test('calculateChecksum: empty string has valid hash', () => {
  const checksum = calculateChecksum('');

  assertEqual(checksum.length, 64, 'Empty string should have valid 64-char hash');
});

// ============================================================================
// Test: writeProgressAtomic
// ============================================================================

console.log('\n=== writeProgressAtomic Tests ===\n');

test('writeProgressAtomic: creates valid YAML file', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();

    await writeProgressAtomic(ctx.progressFile, progress);

    assert(fs.existsSync(ctx.progressFile), 'Progress file should exist');
    const content = fs.readFileSync(ctx.progressFile, 'utf8');
    assert(content.includes('sprint-id: test-sprint-2026'), 'Content should contain sprint-id');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('writeProgressAtomic: creates checksum file', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();

    await writeProgressAtomic(ctx.progressFile, progress);

    assert(fs.existsSync(ctx.checksumFile), 'Checksum file should exist');
    const checksum = fs.readFileSync(ctx.checksumFile, 'utf8').trim();
    assertEqual(checksum.length, 64, 'Checksum should be 64 characters');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('writeProgressAtomic: checksum matches file content', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();

    await writeProgressAtomic(ctx.progressFile, progress);

    const content = fs.readFileSync(ctx.progressFile, 'utf8');
    const storedChecksum = fs.readFileSync(ctx.checksumFile, 'utf8').trim();
    const expectedChecksum = calculateChecksum(content);
    assertEqual(storedChecksum, expectedChecksum, 'Stored checksum should match content');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('writeProgressAtomic: no temp files remain after success', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();

    await writeProgressAtomic(ctx.progressFile, progress);

    const files = fs.readdirSync(ctx.tempDir);
    const tempFiles = files.filter((f) => f.includes('.tmp.'));
    assertEqual(tempFiles.length, 0, 'No temp files should remain');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('writeProgressAtomic: overwrites existing file', async () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'old content');

    const progress = createMinimalProgress();
    await writeProgressAtomic(ctx.progressFile, progress);

    const content = fs.readFileSync(ctx.progressFile, 'utf8');
    assert(!content.includes('old content'), 'Old content should be replaced');
    assert(content.includes('sprint-id'), 'New content should be present');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('writeProgressAtomic: content can be read back correctly', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();

    await writeProgressAtomic(ctx.progressFile, progress);
    const readBack = readProgress(ctx.progressFile);

    assertEqual(readBack['sprint-id'], progress['sprint-id'], 'Sprint ID should match');
    assertEqual(readBack.status, progress.status, 'Status should match');
    assertEqual(readBack.current.phase, progress.current.phase, 'Current phase should match');
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test: readProgress
// ============================================================================

console.log('\n=== readProgress Tests ===\n');

test('readProgress: reads valid YAML file', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: test-sprint
status: in-progress
current:
  phase: 1
  step: null
  sub-phase: null
stats:
  started-at: "2026-01-20T10:00:00Z"
  total-phases: 2
  completed-phases: 1
phases:
  - id: phase-0
    status: completed
    prompt: Done
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);

    const progress = readProgress(ctx.progressFile);

    assertEqual(progress['sprint-id'], 'test-sprint', 'Should read sprint-id');
    assertEqual(progress.status, 'in-progress', 'Should read status');
    assertEqual(progress.current.phase, 1, 'Should read current phase');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('readProgress: validates checksum when checksum file exists', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: validated-sprint
status: not-started
current:
  phase: 0
  step: null
  sub-phase: null
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);
    const checksum = calculateChecksum(yamlContent);
    fs.writeFileSync(ctx.checksumFile, checksum);

    // Should not throw
    const progress = readProgress(ctx.progressFile);
    assertEqual(progress['sprint-id'], 'validated-sprint', 'Should read content');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('readProgress: throws on checksum mismatch', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: corrupted-sprint
status: in-progress
current:
  phase: 0
  step: null
  sub-phase: null
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);
    // Write wrong checksum
    fs.writeFileSync(ctx.checksumFile, 'wrong-checksum-value');

    assertThrows(
      () => readProgress(ctx.progressFile),
      'checksum mismatch'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

test('readProgress: succeeds without checksum file (first run)', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: new-sprint
status: not-started
current:
  phase: 0
  step: null
  sub-phase: null
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);
    // No checksum file

    const progress = readProgress(ctx.progressFile);
    assertEqual(progress['sprint-id'], 'new-sprint', 'Should read without checksum');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('readProgress: throws on missing file', () => {
  const ctx = createTestDir();
  try {
    assertThrows(
      () => readProgress(path.join(ctx.tempDir, 'nonexistent.yaml')),
      'ENOENT'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

test('readProgress: throws on invalid YAML', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'invalid: yaml: content: [');

    assertThrows(
      () => readProgress(ctx.progressFile),
      /yaml|parse|syntax/i
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test: backupProgress
// ============================================================================

console.log('\n=== backupProgress Tests ===\n');

test('backupProgress: creates .backup file', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: backup-test
status: in-progress
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);

    backupProgress(ctx.progressFile);

    assert(fs.existsSync(ctx.backupFile), 'Backup file should exist');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('backupProgress: backup content matches original', () => {
  const ctx = createTestDir();
  try {
    const yamlContent = `sprint-id: backup-content-test
status: completed
`;
    fs.writeFileSync(ctx.progressFile, yamlContent);

    backupProgress(ctx.progressFile);

    const original = fs.readFileSync(ctx.progressFile, 'utf8');
    const backup = fs.readFileSync(ctx.backupFile, 'utf8');
    assertEqual(backup, original, 'Backup content should match original');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('backupProgress: backs up checksum file if present', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'content');
    fs.writeFileSync(ctx.checksumFile, 'checksum-value');

    backupProgress(ctx.progressFile);

    assert(fs.existsSync(ctx.checksumBackup), 'Checksum backup should exist');
    assertEqual(
      fs.readFileSync(ctx.checksumBackup, 'utf8'),
      'checksum-value',
      'Checksum backup should match'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

test('backupProgress: overwrites existing backup', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'new content');
    fs.writeFileSync(ctx.backupFile, 'old backup');

    backupProgress(ctx.progressFile);

    const backup = fs.readFileSync(ctx.backupFile, 'utf8');
    assertEqual(backup, 'new content', 'Backup should be overwritten');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('backupProgress: works without checksum file', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'content without checksum');

    backupProgress(ctx.progressFile);

    assert(fs.existsSync(ctx.backupFile), 'Backup should be created');
    assert(!fs.existsSync(ctx.checksumBackup), 'No checksum backup if no checksum');
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test: restoreProgress
// ============================================================================

console.log('\n=== restoreProgress Tests ===\n');

test('restoreProgress: restores from backup', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.backupFile, 'backup content');
    fs.writeFileSync(ctx.progressFile, 'current content');

    const result = restoreProgress(ctx.progressFile);

    assertEqual(result, true, 'Should return true on success');
    assertEqual(
      fs.readFileSync(ctx.progressFile, 'utf8'),
      'backup content',
      'Content should be restored'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

test('restoreProgress: removes backup file after restore', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.backupFile, 'backup');
    fs.writeFileSync(ctx.progressFile, 'current');

    restoreProgress(ctx.progressFile);

    assert(!fs.existsSync(ctx.backupFile), 'Backup should be removed');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('restoreProgress: restores checksum backup if present', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.backupFile, 'backup');
    fs.writeFileSync(ctx.checksumBackup, 'checksum-backup');
    fs.writeFileSync(ctx.progressFile, 'current');
    fs.writeFileSync(ctx.checksumFile, 'current-checksum');

    restoreProgress(ctx.progressFile);

    assertEqual(
      fs.readFileSync(ctx.checksumFile, 'utf8'),
      'checksum-backup',
      'Checksum should be restored'
    );
    assert(!fs.existsSync(ctx.checksumBackup), 'Checksum backup should be removed');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('restoreProgress: returns false when no backup exists', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'content');
    // No backup file

    const result = restoreProgress(ctx.progressFile);

    assertEqual(result, false, 'Should return false');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('restoreProgress: does not modify files when no backup', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'original');
    // No backup

    restoreProgress(ctx.progressFile);

    assertEqual(
      fs.readFileSync(ctx.progressFile, 'utf8'),
      'original',
      'File should not be modified'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

test('restoreProgress: restores when main file is missing', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.backupFile, 'restored content');
    // No main file

    const result = restoreProgress(ctx.progressFile);

    assertEqual(result, true, 'Should return true');
    assert(fs.existsSync(ctx.progressFile), 'File should be created');
    assertEqual(
      fs.readFileSync(ctx.progressFile, 'utf8'),
      'restored content',
      'Content should be from backup'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test: cleanupBackup
// ============================================================================

console.log('\n=== cleanupBackup Tests ===\n');

test('cleanupBackup: removes backup file', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'main');
    fs.writeFileSync(ctx.backupFile, 'backup');

    cleanupBackup(ctx.progressFile);

    assert(!fs.existsSync(ctx.backupFile), 'Backup should be removed');
    assert(fs.existsSync(ctx.progressFile), 'Main file should remain');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('cleanupBackup: removes checksum backup', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'main');
    fs.writeFileSync(ctx.backupFile, 'backup');
    fs.writeFileSync(ctx.checksumBackup, 'checksum');

    cleanupBackup(ctx.progressFile);

    assert(!fs.existsSync(ctx.checksumBackup), 'Checksum backup should be removed');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('cleanupBackup: no-op when no backup exists', () => {
  const ctx = createTestDir();
  try {
    fs.writeFileSync(ctx.progressFile, 'main');
    // No backup

    // Should not throw
    cleanupBackup(ctx.progressFile);

    assert(fs.existsSync(ctx.progressFile), 'Main file should remain');
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test: Integration - Write/Read Cycle
// ============================================================================

console.log('\n=== Integration Tests ===\n');

test('Integration: full write-read cycle preserves data', async () => {
  const ctx = createTestDir();
  try {
    const original = createMinimalProgress();
    original.phases![0].status = 'completed';
    original.current.phase = 1;

    await writeProgressAtomic(ctx.progressFile, original);
    const readBack = readProgress(ctx.progressFile);

    assertEqual(readBack['sprint-id'], original['sprint-id'], 'sprint-id preserved');
    assertEqual(readBack.status, original.status, 'status preserved');
    assertEqual(readBack.current.phase, original.current.phase, 'current.phase preserved');
    const readBackPhases = readBack.phases as Array<{ status: string }>;
    assertEqual(readBackPhases[0].status, 'completed', 'phase status preserved');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('Integration: backup-modify-restore cycle', async () => {
  const ctx = createTestDir();
  try {
    const original = createMinimalProgress();
    original['sprint-id'] = 'original-id';

    await writeProgressAtomic(ctx.progressFile, original);

    // Create backup
    backupProgress(ctx.progressFile);

    // Modify
    const modified = createMinimalProgress();
    modified['sprint-id'] = 'modified-id';
    await writeProgressAtomic(ctx.progressFile, modified);

    // Verify modified
    let current = readProgress(ctx.progressFile);
    assertEqual(current['sprint-id'], 'modified-id', 'Should be modified');

    // Restore
    restoreProgress(ctx.progressFile);

    // Verify restored
    current = readProgress(ctx.progressFile);
    assertEqual(current['sprint-id'], 'original-id', 'Should be restored');
  } finally {
    cleanupTestDir(ctx);
  }
});

test('Integration: corrupted file detected after external modification', async () => {
  const ctx = createTestDir();
  try {
    const progress = createMinimalProgress();
    await writeProgressAtomic(ctx.progressFile, progress);

    // Simulate external modification (corruption)
    fs.appendFileSync(ctx.progressFile, '\n# corrupted');

    // Read should fail due to checksum mismatch
    assertThrows(
      () => readProgress(ctx.progressFile),
      'checksum mismatch'
    );
  } finally {
    cleanupTestDir(ctx);
  }
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
