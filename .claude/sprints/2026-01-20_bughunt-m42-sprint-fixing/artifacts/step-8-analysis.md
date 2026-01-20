# BUG-007: Async/Sync API Consistency Analysis

## Bug Summary

**Severity**: low
**Feature**: runtime/yaml-ops
**File**: `plugins/m42-sprint/runtime/src/yaml-ops.ts:106-139`

## Root Cause Location

### File
`plugins/m42-sprint/runtime/src/yaml-ops.ts`

### Function
`writeProgressAtomic` (lines 106-139)

### Line Numbers
- Lines 106-109: Function signature declares `async` and returns `Promise<void>`
- Line 121: `fs.writeFileSync(tempPath, content, 'utf8')` - blocking call
- Line 124: `fs.renameSync(tempPath, filePath)` - blocking call
- Line 128: `fs.writeFileSync(checksumPath, checksum, 'utf8')` - blocking call
- Line 132: `fs.existsSync(tempPath)` - blocking call (cleanup)
- Line 133: `fs.unlinkSync(tempPath)` - blocking call (cleanup)

## Conditions That Trigger the Bug

The bug manifests under these conditions:

1. **Any call to `writeProgressAtomic`**: Every invocation blocks the event loop despite the function appearing asynchronous

2. **High-frequency writes**: When progress is updated frequently (e.g., rapid step transitions), the blocking calls accumulate and can cause noticeable delays

3. **Slow filesystem**: On slower storage (network drives, spinning disks), the synchronous I/O blocks the event loop for longer periods

4. **Large progress files**: Larger YAML content takes longer to serialize and write, extending the block duration

5. **Concurrent operations**: When other async operations are pending, they cannot proceed while `writeProgressAtomic` blocks

## The Core Problem

The function signature is misleading:

```typescript
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
```

This signature promises:
- The function is asynchronous (non-blocking)
- Callers can `await` it and expect other async operations to proceed during I/O
- The event loop remains responsive during file operations

But the implementation uses synchronous file system calls:
- `fs.writeFileSync()` - blocks until write completes
- `fs.renameSync()` - blocks until rename completes

## What Proper Tests Should Verify

### 1. API Contract Test
Verify the function is truly asynchronous by checking that:
- The function returns a Promise
- The Promise resolves after file operations complete
- No synchronous blocking occurs during the Promise lifecycle

### 2. Non-Blocking Behavior Test
```typescript
// Conceptual test: verify other async operations can interleave
it('should not block the event loop', async () => {
  const writes: number[] = [];

  // Start a long write operation
  const writePromise = writeProgressAtomic(filePath, progress);

  // This should execute before the file write completes
  // if the implementation is truly async
  const immediatePromise = Promise.resolve().then(() => writes.push(1));

  await Promise.all([writePromise, immediatePromise]);

  // With true async, immediatePromise would resolve first
  // With sync blocking, the order is deterministic but misleading
});
```

### 3. Functional Correctness Tests
After the fix, verify the function still:
- Writes valid YAML content to the file
- Creates the checksum file with correct hash
- Uses atomic write pattern (temp file + rename)
- Cleans up temp files on success
- Cleans up temp files on failure

### 4. Error Handling Tests
Verify async error propagation:
- Permission denied errors reject the Promise
- Disk full errors reject the Promise
- Invalid path errors reject the Promise
- Cleanup still occurs on errors

### 5. Atomicity Preservation Tests
After migration to async:
- `fs.promises.rename` still provides atomicity on POSIX
- Partial writes don't corrupt the progress file
- Concurrent reads during write get consistent data

## Recommended Fix Approach

Convert to truly async implementation using `fs.promises`:

```typescript
import { promises as fsp } from 'fs';

export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const tempPath = getTempPath(filePath);
  const checksumPath = getChecksumPath(filePath);

  try {
    // Write to temp file first (async)
    await fsp.writeFile(tempPath, content, 'utf8');

    // Atomic rename (async, still atomic on POSIX)
    await fsp.rename(tempPath, filePath);

    // Calculate and write checksum (async)
    const checksum = calculateChecksum(content);
    await fsp.writeFile(checksumPath, checksum, 'utf8');
  } finally {
    // Clean up temp file if it still exists
    try {
      await fsp.access(tempPath);
      await fsp.unlink(tempPath);
    } catch {
      // Ignore cleanup errors (file may not exist)
    }
  }
}
```

## Impact Assessment

### Current Impact (Low)
- Event loop blocking is brief for typical progress files
- Most callers don't depend on concurrent async operations
- The function still works correctly, just inefficiently

### Why Fix It
1. **API Honesty**: The signature should match the behavior
2. **Scalability**: Non-blocking I/O scales better under load
3. **Future-Proofing**: Callers may add concurrent operations expecting true async
4. **Best Practices**: Async functions should not contain sync blocking calls

## Files Requiring Changes

1. `plugins/m42-sprint/runtime/src/yaml-ops.ts` - Main fix location
2. `plugins/m42-sprint/runtime/src/yaml-ops.test.ts` - Add/update tests (if exists)

## Test File Location

Tests should be added to:
- `plugins/m42-sprint/runtime/src/yaml-ops.test.ts` (create if doesn't exist)
