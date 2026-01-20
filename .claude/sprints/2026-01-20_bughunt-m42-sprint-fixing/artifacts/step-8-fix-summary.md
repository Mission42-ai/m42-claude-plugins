# Step 8 Fix Summary: BUG-007 Async/Sync API Consistency

## Bug Information

- **Bug ID**: BUG-007
- **Severity**: low
- **Feature**: runtime/yaml-ops
- **File**: `runtime/src/yaml-ops.ts:106-139`

## Root Cause

The `writeProgressAtomic` function was declared as `async` and returned `Promise<void>`, but internally used synchronous file system operations:

- `fs.writeFileSync()` - blocks event loop during write
- `fs.renameSync()` - blocks event loop during rename
- `fs.existsSync()` + `fs.unlinkSync()` - blocks during cleanup

This created a misleading API contract where callers expected async I/O behavior but got blocking synchronous operations. The function would complete all file operations before yielding to the event loop, defeating the purpose of the async declaration.

## Solution Implemented

Changed all file system operations to use the asynchronous `fs.promises` API:

```typescript
// Before (blocking):
fs.writeFileSync(tempPath, content, 'utf8');
fs.renameSync(tempPath, filePath);

// After (non-blocking):
await fs.promises.writeFile(tempPath, content, 'utf8');
await fs.promises.rename(tempPath, filePath);
```

The fix also updated the cleanup logic in the `finally` block:

```typescript
// Before:
if (fs.existsSync(tempPath)) {
  fs.unlinkSync(tempPath);
}

// After:
try {
  await fs.promises.access(tempPath);
  await fs.promises.unlink(tempPath);
} catch {
  // Ignore cleanup errors
}
```

## Tests Added

Two new tests in `yaml-ops.test.ts` verify the fix:

### Test 1: Microtask Timing
```
✓ BUG-007: writeProgressAtomic should use fs.promises (truly async I/O)
```
Verifies the function doesn't complete synchronously by checking if a scheduled microtask runs before the write completes.

### Test 2: Concurrent Write Behavior
```
✓ BUG-007: concurrent writeProgressAtomic calls should not serialize (async I/O)
```
Verifies that concurrent writes allow the event loop to yield by checking if `setInterval` callbacks fire during parallel writes.

## Verification

### Full Test Suite Results

All tests pass:

- **yaml-ops.test.ts**: 35/35 passed
  - All existing tests continue to pass
  - Both new BUG-007 tests pass
- **loop.test.ts**: 31/31 passed
- **cli.test.ts**: 39/39 passed
- **transition.test.ts**: All passed
- **executor.test.ts**: 18/18 passed
- **prompt-builder.test.ts**: All passed
- **claude-runner.test.ts**: All passed

### Manual Verification

1. The function now properly yields to the event loop during I/O
2. Concurrent writes don't block each other
3. All existing functionality preserved (atomic write, checksum, temp file cleanup)

## Edge Cases Considered

1. **Temp file cleanup on error**: The `finally` block properly handles cases where the temp file doesn't exist (ignores ENOENT errors)
2. **Concurrent access**: The PID-based temp file naming prevents collisions between concurrent writes from different processes
3. **Backward compatibility**: All callers already `await` this function, so no code changes needed

## Follow-up Items

None required. This is a minimal, surgical fix that:
- Maintains the same API contract
- Doesn't change function signatures
- Doesn't require caller modifications
- Properly implements the async behavior the signature promised
