# BUG-010: Signal Files Cleanup on Sprint Completion - Analysis

## Root Cause Analysis

### Location
- **File**: `compiler/src/status-server/server.ts`
- **Lines**: 882-989 (signal creation handlers), plus line 1261 (force-retry)
- **Functions affected**:
  - `handlePauseRequest()` - creates `.pause-requested` (line 897)
  - `handleResumeRequest()` - creates `.resume-requested` (line 935)
  - `handleStopRequest()` - creates `.stop-requested` (line 973)
  - `handleForceRetryRequest()` - creates `.force-retry-requested` (line 1261)

### Root Cause
Signal files are created when API endpoints are called but there is **no cleanup mechanism** anywhere in the codebase. The `handleProgressChange()` method (lines 1573-1605) monitors for progress updates but does not check if the sprint has transitioned to a terminal state and clean up signals.

### Terminal States
Based on `getAvailableActions()` (lines 788-799), the terminal states where no actions are available are:
- `completed` - sprint finished successfully
- `failed` - sprint encountered unrecoverable error
- `stopped` - sprint was manually stopped

Currently, the server returns an empty action list for these states but performs no cleanup.

## Conditions That Trigger the Bug

1. **Signal Creation**: User calls POST `/api/pause`, `/api/resume`, `/api/stop`, or `/api/force-retry` endpoint
2. **Signal Consumption**: The runtime loop may or may not consume the signal (e.g., if sprint completes before signal is processed)
3. **Missing Cleanup**: Sprint transitions to terminal state (`completed`, `failed`, `stopped`)
4. **Persistence**: Signal files remain in sprint directory indefinitely
5. **Stale State**: On subsequent sprint restart, leftover signals may cause unexpected behavior

### File Locations
Signal files are created at:
```
<sprintDir>/.pause-requested
<sprintDir>/.resume-requested
<sprintDir>/.stop-requested
<sprintDir>/.force-retry-requested
```

## What Tests Should Verify

### Test Case 1: Cleanup on sprint completion
- **Given**: A sprint is running with a `.pause-requested` signal file
- **When**: The sprint status changes to `completed`
- **Then**: All signal files should be removed

### Test Case 2: Cleanup on sprint failure
- **Given**: A sprint is running with multiple signal files present
- **When**: The sprint status changes to `failed`
- **Then**: All signal files should be removed

### Test Case 3: Cleanup on sprint stopped
- **Given**: A sprint is running with a `.stop-requested` signal file
- **When**: The sprint status changes to `stopped`
- **Then**: All signal files should be removed

### Test Case 4: No cleanup during active states
- **Given**: A sprint with status `in-progress` or `paused`
- **When**: Progress file changes but status remains active
- **Then**: Signal files should NOT be removed

### Test Case 5: Cleanup at sprint start (optional)
- **Given**: Leftover signal files from a crashed sprint
- **When**: A new sprint starts
- **Then**: Stale signal files should be cleaned up

### Test Case 6: Non-existent files handled gracefully
- **Given**: No signal files exist
- **When**: Cleanup is triggered
- **Then**: No errors should occur

## Proposed Fix Location

Add cleanup logic in `handleProgressChange()` method to detect terminal state transitions:

```typescript
private handleProgressChange(): void {
  try {
    const progress = this.loadProgress();

    // Check for transition to terminal state and cleanup signals
    const isTerminalState = ['completed', 'failed', 'stopped'].includes(progress.status);
    const wasTerminal = this.lastProgress &&
      ['completed', 'failed', 'stopped'].includes(this.lastProgress.status);

    if (isTerminalState && !wasTerminal) {
      this.cleanupSignalFiles();
    }

    // ... rest of existing logic
  }
}

private cleanupSignalFiles(): void {
  const signals = ['.pause-requested', '.resume-requested', '.stop-requested', '.force-retry-requested'];
  for (const signal of signals) {
    const signalPath = path.join(this.config.sprintDir, signal);
    try {
      fs.unlinkSync(signalPath);
    } catch {
      // File doesn't exist, which is fine
    }
  }
}
```

## Related Code Paths

### Signal Creation
- `handlePauseRequest()`: line 897
- `handleResumeRequest()`: line 935
- `handleStopRequest()`: line 973
- `handleForceRetryRequest()`: line 1261

### State Change Detection
- `handleProgressChange()`: line 1573 - watches for PROGRESS.yaml changes
- `loadProgress()`: line 1610 - parses progress file
- `getAvailableActions()`: line 788 - defines state machine

### Runtime Signal Consumption (separate module)
- `runtime/src/loop.ts:127` - `checkPauseSignal()` checks for `PAUSE` file (note: different naming convention)

## Additional Notes

1. The runtime uses `PAUSE` file while status server uses `.pause-requested` - these are different signals for different purposes. The `.pause-requested` is a request from the UI, while `PAUSE` is the actual signal the runtime checks.

2. Consider also adding cleanup at server `start()` to handle crashed sprint scenarios where signals were never cleaned up.
