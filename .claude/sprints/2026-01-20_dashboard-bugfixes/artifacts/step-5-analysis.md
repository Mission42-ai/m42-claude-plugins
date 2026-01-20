# BUG-006 Analysis: Total Sprint Duration Not Displayed

## Summary

The sprint detail page does not display total sprint duration for completed sprints. While the code infrastructure exists to show elapsed time, there's a logic bug that prevents the duration from being displayed when the sprint has finished.

## Root Cause Location

**Primary File**: `plugins/m42-sprint/compiler/src/status-server/page.ts`

**Function**: `updateElapsedTimes()` (lines 4865-4879)

**Root Cause**: The `updateElapsedTimes` function exits early without updating the display when the sprint status is in a terminal state.

```javascript
// Line 4865-4871
function updateElapsedTimes() {
  // Skip updates for terminal/paused statuses
  // Timer stops for: 'completed', 'failed', 'blocked', 'needs-human'
  // Timer freezes for: 'paused' (resumes when status changes back to 'in-progress')
  if (currentSprintStatus && ['completed', 'failed', 'blocked', 'needs-human', 'paused'].includes(currentSprintStatus)) {
    return;  // <-- BUG: Early return prevents final duration display
  }
  // ... rest of function never executes for completed sprints
}
```

**Secondary Issue**: The `updateHeader` function (line 4213) only stores `startedAt` in dataset but doesn't use the server-provided `elapsed` value:

```javascript
// Line 4230-4232
if (header.startedAt) {
  elements.elapsed.dataset.startedAt = header.startedAt;
}
// NOTE: header.elapsed is available but never used!
```

## Data Flow Analysis

### Server-side (transforms.ts)
The server correctly calculates and provides elapsed time:
- `SprintHeader.elapsed` is populated from `progress.stats.elapsed` (line 687)
- `SprintHeader.startedAt` is populated from `progress.stats['started-at']` (line 685)
- Both fields are correctly sent in the SSE status-update events

### Client-side (page.ts)
The client has the infrastructure but doesn't use it correctly:
1. `updateHeader()` stores `startedAt` in dataset but ignores `header.elapsed`
2. `updateElapsedTimes()` calculates live duration but exits early for completed sprints
3. Result: Completed sprints show nothing in the elapsed display

## Conditions That Trigger the Bug

1. **Running sprints**: Duration IS displayed (timer updates every second)
2. **Completed sprints**: Duration NOT displayed (early return in `updateElapsedTimes`)
3. **Failed sprints**: Duration NOT displayed (same reason)
4. **Blocked sprints**: Duration NOT displayed (same reason)
5. **Paused sprints**: Duration NOT displayed (same reason)

## What a Proper Test Should Verify

### Test 1: Completed sprint shows final duration
```typescript
test('displays total duration for completed sprints', () => {
  // Given: A completed sprint with started-at and elapsed in stats
  const header = {
    sprintId: 'test-sprint',
    status: 'completed',
    startedAt: '2024-01-20T10:00:00Z',
    elapsed: '1h 23m',  // Server-provided final duration
    progressPercent: 100,
    completedPhases: 5,
    totalPhases: 5
  };

  // When: updateHeader is called
  updateHeader(header);

  // Then: elapsed element shows the total duration
  expect(elements.elapsed.textContent).toContain('1h 23m');
});
```

### Test 2: Running sprint shows live duration
```typescript
test('displays live updating duration for running sprints', () => {
  // Given: A running sprint
  const header = {
    status: 'in-progress',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
  };

  // When: updateHeader and updateElapsedTimes are called
  updateHeader(header);
  updateElapsedTimes();

  // Then: elapsed element shows approximately 5m
  expect(elements.elapsed.textContent).toMatch(/Total: 5m \d+s/);
});
```

### Test 3: Duration updates stop when completed
```typescript
test('duration stops updating when sprint completes', () => {
  // Given: Sprint transitions from in-progress to completed
  updateHeader({ status: 'in-progress', startedAt: '2024-01-20T10:00:00Z' });

  // When: Sprint completes
  updateHeader({
    status: 'completed',
    startedAt: '2024-01-20T10:00:00Z',
    elapsed: '1h 23m'  // Final duration from server
  });

  // Then: Display shows final duration and doesn't change
  const displayedDuration = elements.elapsed.textContent;
  jest.advanceTimersByTime(5000); // Advance 5 seconds
  expect(elements.elapsed.textContent).toBe(displayedDuration);
});
```

## Proposed Fix

### Option A: Use server-provided elapsed (Recommended)

In `updateHeader()`, use `header.elapsed` when available:

```javascript
function updateHeader(header) {
  // ... existing code ...

  if (header.startedAt) {
    elements.elapsed.dataset.startedAt = header.startedAt;
  }

  // Use server-provided elapsed for terminal states
  if (header.elapsed && ['completed', 'failed', 'blocked', 'needs-human'].includes(header.status)) {
    elements.elapsed.textContent = 'Total: ' + header.elapsed;
  }

  // ... rest of function ...
}
```

### Option B: Modify updateElapsedTimes to show final time

Calculate one last time when transitioning to terminal state:

```javascript
function updateElapsedTimes() {
  const isTerminal = currentSprintStatus &&
    ['completed', 'failed', 'blocked', 'needs-human'].includes(currentSprintStatus);

  if (isTerminal && elements.elapsed.dataset.finalDisplayed === 'true') {
    return; // Already displayed final time
  }

  const startedAt = elements.elapsed.dataset.startedAt;
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    elements.elapsed.textContent = 'Total: ' + formatElapsed(elapsed);

    if (isTerminal) {
      elements.elapsed.dataset.finalDisplayed = 'true';
    }
  }
}
```

### Recommendation

**Option A is preferred** because:
1. The server already calculates `elapsed` accurately based on actual `completed-at` timestamps
2. No additional client-side calculation needed
3. Consistent with how other terminal state values are handled (e.g., ETA shows "Done")
4. Simpler change with less risk of regression

## Files to Modify

1. **page.ts** (line ~4230): Update `updateHeader()` to display `header.elapsed` for terminal states
2. **Optional**: Add test file `page.test.ts` for elapsed duration display verification

## Impact Assessment

- **Severity**: MEDIUM - Missing information rather than broken functionality
- **Risk of fix**: LOW - Simple conditional addition
- **User impact**: Improves visibility into sprint execution time
- **Testing required**: Manual verification of completed, failed, and running sprints
