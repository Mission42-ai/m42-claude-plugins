# Bug Analysis: BUG-002 Race Condition on PROGRESS.yaml

## Executive Summary

A race condition exists between the sprint runner loop (`runtime/src/loop.ts`) and the status server (`compiler/src/status-server/server.ts`) when both processes attempt to modify `PROGRESS.yaml` concurrently.

---

## Root Cause Analysis

### Location
- **Primary File**: `runtime/src/loop.ts`
- **Function**: `runLoop()` main execution cycle
- **Critical Lines**: 361-429 (backup → execute → write cycle)

### Secondary Location
- **File**: `compiler/src/status-server/server.ts`
- **Functions**: `handleSkipRequest()`, `handleRetryRequest()`, `handleForceRetryRequest()`
- **Critical Methods**: `saveProgress()` (lines 1058-1067)

---

## Conditions That Trigger the Bug

### Timeline of Race Condition

```
T0: Loop reads PROGRESS.yaml (version A)
T1: Loop creates backup (backup contains version A)
T2: Loop starts Claude execution (long-running, holds version A in memory)
T3: User calls POST /api/skip/:phaseId via status server
T4: Status server loads PROGRESS.yaml (version A)
T5: Status server modifies progress (sets phase to 'skipped')
T6: Status server writes PROGRESS.yaml (version B with skip)
T7: Claude execution completes
T8: Loop writes PROGRESS.yaml (version A + Claude results)
    --> VERSION B OVERWRITTEN, SKIP ACTION LOST
T9: Loop cleans up backup
```

### Specific Trigger Conditions

1. **Timing Window**: Claude execution takes >100ms (typical: 5-60 seconds)
2. **User Action**: User interacts with status server UI during execution
3. **Concurrent Modification**: Both processes write to same file without coordination

### Affected API Endpoints

| Endpoint | Server Function | Modifies |
|----------|-----------------|----------|
| `POST /api/skip/:phaseId` | `handleSkipRequest()` | Phase status → 'skipped', pointer advancement |
| `POST /api/retry/:phaseId` | `handleRetryRequest()` | Phase status → 'pending', pointer reset |
| `POST /api/force-retry/:phaseId` | `handleForceRetryRequest()` | `next-retry-at` field |

---

## Current Implementation Details

### Loop Write Pattern (loop.ts:361-429)

```typescript
// Line 362: Backup before Claude execution
backupProgress(progressPath);

// Lines 383-388: Execute Claude (LONG RUNNING - race window opens here)
const spawnResult = await deps.runClaude({...});

// Lines 419-421: Process result and update in-memory progress
const result = transition(state, event, progress);
state = result.nextState;
updateProgressFromState(progress, state);

// Line 428: Write final state (OVERWRITES ANY INTERMEDIATE CHANGES)
await writeProgressAtomic(progressPath, progress);

// Line 429: Cleanup backup
cleanupBackup(progressPath);
```

### Status Server Write Pattern (server.ts:1058-1067)

```typescript
private saveProgress(progress: CompiledProgress): void {
  const content = yaml.dump(progress, {...});
  fs.writeFileSync(this.progressFilePath, content, 'utf-8');
  // Trigger update broadcast
  this.handleProgressChange();
}
```

### Key Observation

The status server uses **synchronous** `fs.writeFileSync()` while the loop uses **async** `writeProgressAtomic()`. Neither checks if the file was modified by another process before writing.

---

## What a Proper Test Should Verify

### Test 1: Skip Action Survives Claude Execution

```typescript
describe('Race condition: skip during Claude execution', () => {
  it('preserves skip action made during Claude execution', async () => {
    // Setup: PROGRESS.yaml with phase 0 = in-progress
    // Action 1: Start loop execution (mock Claude to take 500ms)
    // Action 2: While Claude is "executing", call skip API
    // Assert: After loop completes, phase 0 should be 'skipped', not 'completed'
  });
});
```

### Test 2: Retry Action Survives Claude Execution

```typescript
describe('Race condition: retry during Claude execution', () => {
  it('preserves retry action made during Claude execution', async () => {
    // Setup: PROGRESS.yaml with phase 0 = failed
    // Action 1: Start loop with retry logic (mock Claude to take 500ms)
    // Action 2: While Claude is "executing" on phase 1, call retry on phase 0
    // Assert: Phase 0 should be 'pending', pointer should be reset
  });
});
```

### Test 3: Concurrent Modifications Are Merged

```typescript
describe('Concurrent modifications', () => {
  it('merges status server changes with loop changes', async () => {
    // Setup: PROGRESS.yaml with multiple phases
    // Action 1: Loop completes phase 0 (marks as completed)
    // Action 2: Concurrently, status server skips phase 2
    // Assert: Final state has phase 0 = completed AND phase 2 = skipped
  });
});
```

### Test 4: Pointer Advancement Is Not Lost

```typescript
describe('Pointer consistency', () => {
  it('maintains correct pointer after concurrent skip', async () => {
    // Setup: PROGRESS.yaml at phase 0, step 0
    // Action 1: Loop advances to phase 0, step 1
    // Action 2: Status server skips phase 1
    // Assert: Pointer is at correct position (not reset to old value)
  });
});
```

### Test 5: Checksum Validation Detects Conflicts

```typescript
describe('Conflict detection', () => {
  it('detects file modification via checksum mismatch', async () => {
    // Setup: Store checksum before Claude execution
    // Action: Status server modifies file during execution
    // Assert: Loop detects checksum change before writing
    // Assert: Merge strategy is applied (not blind overwrite)
  });
});
```

---

## Recommended Fix Approach

Based on the bug report's recommendation, **Option 2 (Compare-and-Swap with Checksum)** is the best approach:

### Implementation Steps

1. **Before Claude execution**: Store file checksum in memory
2. **After Claude execution**:
   - Read current file
   - Compare checksum with stored value
   - If changed: Load current file, merge changes, write merged result
   - If unchanged: Write normally
3. **Merge strategy**:
   - Status changes (skip, retry) take precedence for targeted phases
   - Loop progress (phase completion) takes precedence for currently executing phase
   - Stats are recalculated after merge

### Why This Approach

| Approach | Pros | Cons |
|----------|------|------|
| **File Locking** | Strong consistency | Platform-dependent, complex deadlock handling |
| **Compare-and-Swap** | No external deps, detects conflicts | Requires merge logic |
| **IPC/Events** | Clean separation | Requires architectural changes |

Compare-and-swap balances complexity with reliability using the existing checksum infrastructure.

---

## Files Requiring Modification

1. `runtime/src/loop.ts` - Add checksum tracking and merge logic
2. `runtime/src/yaml-ops.ts` - Add merge function
3. (Optional) `compiler/src/status-server/server.ts` - Consider using atomic writes

---

## Test File Location

Create tests in: `runtime/src/loop.race.test.ts`

Dependencies needed:
- Ability to mock `runClaude` with controlled timing
- Ability to simulate concurrent file writes
- Assertion helpers for PROGRESS.yaml state validation
