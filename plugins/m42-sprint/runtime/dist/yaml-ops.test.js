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
import { writeProgressAtomic, readProgress, backupProgress, restoreProgress, cleanupBackup, calculateChecksum, } from './yaml-ops.js';
// ============================================================================
// Test Utilities
// ============================================================================
function test(name, fn) {
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
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertThrows(fn, messagePattern) {
    let threw = false;
    let errorMessage = '';
    try {
        fn();
    }
    catch (error) {
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
function createTestDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaml-ops-test-'));
    return {
        tempDir,
        progressFile: path.join(tempDir, 'PROGRESS.yaml'),
        checksumFile: path.join(tempDir, 'PROGRESS.yaml.checksum'),
        backupFile: path.join(tempDir, 'PROGRESS.yaml.backup'),
        checksumBackup: path.join(tempDir, 'PROGRESS.yaml.checksum.backup'),
    };
}
function cleanupTestDir(ctx) {
    try {
        fs.rmSync(ctx.tempDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
function createMinimalProgress() {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
        assertThrows(() => readProgress(ctx.progressFile), 'checksum mismatch');
    }
    finally {
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
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('readProgress: throws on missing file', () => {
    const ctx = createTestDir();
    try {
        assertThrows(() => readProgress(path.join(ctx.tempDir, 'nonexistent.yaml')), 'ENOENT');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('readProgress: throws on invalid YAML', () => {
    const ctx = createTestDir();
    try {
        fs.writeFileSync(ctx.progressFile, 'invalid: yaml: content: [');
        assertThrows(() => readProgress(ctx.progressFile), /yaml|parse|syntax/i);
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
        assertEqual(fs.readFileSync(ctx.checksumBackup, 'utf8'), 'checksum-value', 'Checksum backup should match');
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
        assertEqual(fs.readFileSync(ctx.progressFile, 'utf8'), 'backup content', 'Content should be restored');
    }
    finally {
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
    }
    finally {
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
        assertEqual(fs.readFileSync(ctx.checksumFile, 'utf8'), 'checksum-backup', 'Checksum should be restored');
        assert(!fs.existsSync(ctx.checksumBackup), 'Checksum backup should be removed');
    }
    finally {
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
    }
    finally {
        cleanupTestDir(ctx);
    }
});
test('restoreProgress: does not modify files when no backup', () => {
    const ctx = createTestDir();
    try {
        fs.writeFileSync(ctx.progressFile, 'original');
        // No backup
        restoreProgress(ctx.progressFile);
        assertEqual(fs.readFileSync(ctx.progressFile, 'utf8'), 'original', 'File should not be modified');
    }
    finally {
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
        assertEqual(fs.readFileSync(ctx.progressFile, 'utf8'), 'restored content', 'Content should be from backup');
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
        original.phases[0].status = 'completed';
        original.current.phase = 1;
        await writeProgressAtomic(ctx.progressFile, original);
        const readBack = readProgress(ctx.progressFile);
        assertEqual(readBack['sprint-id'], original['sprint-id'], 'sprint-id preserved');
        assertEqual(readBack.status, original.status, 'status preserved');
        assertEqual(readBack.current.phase, original.current.phase, 'current.phase preserved');
        const readBackPhases = readBack.phases;
        assertEqual(readBackPhases[0].status, 'completed', 'phase status preserved');
    }
    finally {
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
    }
    finally {
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
        assertThrows(() => readProgress(ctx.progressFile), 'checksum mismatch');
    }
    finally {
        cleanupTestDir(ctx);
    }
});
// ============================================================================
// Test: BUG-007 - Async/Sync API Consistency
// ============================================================================
console.log('\n=== BUG-007: Async/Sync API Consistency Tests ===\n');
/**
 * BUG-007: writeProgressAtomic is declared async but uses sync fs operations.
 *
 * This test verifies that writeProgressAtomic uses truly async fs.promises API
 * by checking if the function internally awaits any async operation.
 *
 * Test approach: Use Promise microtask timing. A truly async function that uses
 * fs.promises will have multiple microtask boundaries (after each await).
 * A fake async function (sync body, returns immediately resolved promise)
 * resolves in the same microtask as the call.
 */
test('BUG-007: writeProgressAtomic should use fs.promises (truly async I/O)', async () => {
    const ctx = createTestDir();
    try {
        const progress = createMinimalProgress();
        // Track microtask execution order
        let promiseResolvedInSameMicrotask = true;
        let writeCompleted = false;
        // Start the write operation
        const writePromise = writeProgressAtomic(ctx.progressFile, progress).then(() => {
            writeCompleted = true;
        });
        // Schedule a microtask to check if write already completed
        // If using sync fs operations, writeCompleted will already be true
        // If using async fs.promises, writeCompleted will still be false
        await Promise.resolve().then(() => {
            promiseResolvedInSameMicrotask = writeCompleted;
        });
        // Wait for write to actually complete
        await writePromise;
        // With truly async fs.promises: writeCompleted should be false in the microtask
        // because the I/O hasn't completed yet (it's waiting on the event loop)
        // With sync fs operations: writeCompleted is true immediately because sync
        // operations block and complete before any microtask runs
        assert(!promiseResolvedInSameMicrotask, `writeProgressAtomic completed synchronously (in same microtask), indicating it uses blocking ` +
            `fs.writeFileSync/fs.renameSync instead of async fs.promises.writeFile/fs.promises.rename. ` +
            `This blocks the event loop despite the async function signature.`);
    }
    finally {
        cleanupTestDir(ctx);
    }
});
/**
 * Additional test: Verify multiple concurrent writes don't serialize unexpectedly.
 * With truly async operations, multiple writes should interleave their I/O.
 * With sync operations, they execute sequentially, blocking each other.
 */
test('BUG-007: concurrent writeProgressAtomic calls should not serialize (async I/O)', async () => {
    const ctx1 = createTestDir();
    const ctx2 = createTestDir();
    try {
        const progress1 = createMinimalProgress();
        progress1['sprint-id'] = 'concurrent-test-1';
        const progress2 = createMinimalProgress();
        progress2['sprint-id'] = 'concurrent-test-2';
        // Track which operations yield to event loop
        let eventLoopYields = 0;
        // Set up a counter that increments on each event loop tick during the writes
        const tickCounter = setInterval(() => {
            eventLoopYields++;
        }, 0);
        // Start both writes concurrently
        const startTime = Date.now();
        await Promise.all([
            writeProgressAtomic(ctx1.progressFile, progress1),
            writeProgressAtomic(ctx2.progressFile, progress2),
        ]);
        const elapsed = Date.now() - startTime;
        clearInterval(tickCounter);
        // Verify files were written correctly
        assert(fs.existsSync(ctx1.progressFile), 'First progress file should exist');
        assert(fs.existsSync(ctx2.progressFile), 'Second progress file should exist');
        // With truly async I/O, we should see event loop yields during the operations
        // With sync I/O, the event loop is blocked and we see 0 or very few yields
        // Note: This is a heuristic test - on fast systems, even async I/O might complete
        // before the interval fires, but sync I/O definitely blocks all yields.
        // We expect at least 1 yield if the operations are truly async
        // (allowing the interval to fire at least once during I/O wait)
        assert(eventLoopYields >= 1, `Expected event loop to yield during async I/O (got ${eventLoopYields} yields in ${elapsed}ms). ` +
            `Zero yields indicates blocking sync operations are being used.`);
    }
    finally {
        cleanupTestDir(ctx1);
        cleanupTestDir(ctx2);
    }
});
// ============================================================================
// Test Summary
// ============================================================================
console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
//# sourceMappingURL=yaml-ops.test.js.map