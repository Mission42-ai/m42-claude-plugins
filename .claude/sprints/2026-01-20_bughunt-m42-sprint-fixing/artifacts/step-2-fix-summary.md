# BUG-010 Fix Summary: Signal Files Cleanup on Sprint Completion

**Bug ID**: BUG-010
**Severity**: High
**Feature**: status-server
**Status**: FIXED

## Root Cause

The status server creates signal files (`.pause-requested`, `.resume-requested`, `.stop-requested`, `.force-retry-requested`) in the sprint directory when API control endpoints are called. These files are used for inter-process communication between the status server and the sprint runner.

However, there was no cleanup mechanism for these files:
- When the sprint completes (success, failure, or stopped)
- When the status server stops
- When a new sprint starts (leftover files from crashed sprints)

This could cause:
1. Stale signal files persisting after sprint completion
2. Unexpected behavior when restarting a sprint (e.g., immediate pause due to leftover `.pause-requested` file)
3. Directory pollution with obsolete signal files

## Solution Implemented

### 1. Added SIGNAL_FILES constant (lines 79-88)

Centralized the signal file names as a constant object for consistency:

```typescript
const SIGNAL_FILES = {
  PAUSE: '.pause-requested',
  RESUME: '.resume-requested',
  STOP: '.stop-requested',
  FORCE_RETRY: '.force-retry-requested',
} as const;
```

### 2. Added cleanupSignalFiles() method (lines 1642-1651)

Created a private method that iterates through all signal files and removes them:

```typescript
private cleanupSignalFiles(): void {
  for (const signal of Object.values(SIGNAL_FILES)) {
    const signalPath = path.join(this.config.sprintDir, signal);
    try {
      fs.unlinkSync(signalPath);
    } catch {
      // Ignore errors (file may not exist)
    }
  }
}
```

The try-catch with empty catch block is intentional - we want to silently ignore errors when files don't exist, as this is the expected state when cleanup runs on a fresh sprint.

### 3. Cleanup on server start() (line 142)

Added cleanup at the beginning of `start()` to handle leftover files from crashed sprints:

```typescript
async start(): Promise<void> {
  // Validate that PROGRESS.yaml exists
  if (!fs.existsSync(this.progressFilePath)) {
    throw new Error(`PROGRESS.yaml not found: ${this.progressFilePath}`);
  }

  // Clean up any leftover signal files from crashed sprints
  this.cleanupSignalFiles();
  // ... rest of start logic
}
```

### 4. Cleanup on server stop() (lines 206-208)

Added cleanup at the beginning of `stop()` to ensure files are removed when sprint ends:

```typescript
async stop(): Promise<void> {
  // Clean up signal files
  this.cleanupSignalFiles();
  // ... rest of stop logic
}
```

## Tests Added

Added tests in `compiler/src/status-server/server.test.ts`:

1. **`BUG-010: StatusServer should have cleanupSignalFiles method`**
   - Static analysis test that verifies the cleanup method exists in source

2. **`BUG-010: stop() method should call cleanupSignalFiles`**
   - Static analysis test that verifies stop() calls cleanup

3. **`BUG-010: signal files should be removed when server stops`**
   - Integration test that:
     - Creates a sprint directory with PROGRESS.yaml
     - Creates all 4 signal files
     - Starts StatusServer
     - Stops StatusServer
     - Verifies all signal files were removed

4. **`BUG-010: leftover signal files should be cleaned on server start`**
   - Integration test that:
     - Creates a sprint directory with PROGRESS.yaml
     - Creates all 4 signal files (simulating crash)
     - Starts StatusServer
     - Verifies all signal files were removed on start
     - Stops server and confirms cleanup

## Verification

### All Tests Pass

```bash
$ node dist/status-server/server.test.js
✓ BUG-010: StatusServer should have cleanupSignalFiles method
✓ BUG-010: stop() method should call cleanupSignalFiles
✓ BUG-010: signal files should be removed when server stops
✓ BUG-010: leftover signal files should be cleaned on server start
```

### Manual Verification

Tested the fix by:
1. Creating a sprint directory with all 4 signal files
2. Starting the server - verified files cleaned (4 → 0)
3. Creating files again during runtime
4. Stopping the server - verified files cleaned (4 → 0)

### Edge Cases Verified

1. **No signal files present**: Server starts/stops without errors
2. **Partial signal files**: Only some files present - cleaned correctly
3. **Multiple start/stop cycles**: No errors or file leaks

## Follow-up Items

None required. The fix is complete and comprehensive.

## Files Modified

- `compiler/src/status-server/server.ts`: Added SIGNAL_FILES constant, cleanupSignalFiles() method, and calls in start()/stop()
- `compiler/src/status-server/server.test.ts`: Added 4 test cases for BUG-010
