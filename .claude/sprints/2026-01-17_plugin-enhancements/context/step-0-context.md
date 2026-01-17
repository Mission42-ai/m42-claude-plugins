# Step Context: step-0

## Task
Phase 1 - Step 1: Fix Elapsed Timer Running Indefinitely

The elapsed time timer continues updating after sprint completes/pauses/fails.

Requirements:
- Modify `updateElapsedTimes()` function in page.ts
- Check sprint status before updating timers
- Stop updating for terminal statuses: 'completed', 'failed', 'stopped', 'blocked'
- Also handle 'paused' status (freeze timer, don't stop)
- Ensure timer resumes correctly when sprint is resumed from pause

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (~line 2989, updateElapsedTimes function)

## Related Code Patterns

### Current updateElapsedTimes Implementation: page.ts:2989
```javascript
function updateElapsedTimes() {
  // Update footer elapsed time
  const startedAt = elements.elapsed.dataset.startedAt;
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    elements.elapsed.textContent = 'Total: ' + formatElapsed(elapsed);
  }
}
```
The function currently has no status check - it updates unconditionally.

### Status Variable Pattern: page.ts:1699
```javascript
let currentSprintStatus = null;
```
Global variable tracking current sprint status, updated by `updateControlButtons()`.

### Status Assignment: page.ts:2257
```javascript
function updateControlButtons(status) {
  currentSprintStatus = status;
  // ... button visibility logic based on status
}
```
Called whenever status updates come in, so `currentSprintStatus` is always current.

### Status Check Pattern (updateControlButtons): page.ts:2264
```javascript
switch (status) {
  case 'in-progress':
    elements.pauseBtn.style.display = 'inline-flex';
    elements.stopBtn.style.display = 'inline-flex';
    break;
  case 'paused':
    elements.resumeBtn.style.display = 'inline-flex';
    elements.stopBtn.style.display = 'inline-flex';
    break;
  case 'blocked':
  case 'needs-human':
    elements.stopBtn.style.display = 'inline-flex';
    break;
}
```
Shows the pattern for handling multiple status cases - uses switch or includes() for grouping.

### Timer Interval Setup: page.ts:1850
```javascript
// Update elapsed time every second
setInterval(updateElapsedTimes, 1000);
```
Timer runs continuously every 1 second. Cannot be stopped after setup, so status check must be inside the function.

## Required Imports
### Internal
None - all dependencies are already in scope within the getScript() template literal.

### External
None - pure vanilla JavaScript.

## Types/Interfaces to Use
```typescript
// From types.ts (line 96)
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

Note: The gherkin mentions 'stopped' and 'failed' statuses, but the official `SprintStatus` type only includes:
- 'not-started'
- 'in-progress'
- 'completed'
- 'blocked'
- 'paused'
- 'needs-human'

There is no 'stopped' or 'failed' status in the type. Implementation should use 'completed' for terminal states and 'blocked' for error states as per the type definition.

## Integration Points
- Called by: `setInterval()` every 1000ms (page.ts:1850)
- Reads from: `currentSprintStatus` global variable (page.ts:1699)
- Reads from: `elements.elapsed.dataset.startedAt` (footer element)
- Writes to: `elements.elapsed.textContent` (footer elapsed time display)
- Tests: No dedicated tests for client-side JavaScript (it's embedded in HTML generation)

## Implementation Notes

1. **Terminal statuses to stop timer**: `'completed'`, `'blocked'`, `'needs-human'`
   - Timer should stop updating completely
   - Last displayed value remains frozen at final time

2. **Paused status to freeze timer**: `'paused'`
   - Timer should freeze (not update)
   - When status changes back to `'in-progress'`, timer should resume
   - The `startedAt` timestamp is preserved, so resuming works automatically

3. **Active statuses where timer updates**: `'in-progress'`, `'not-started'`
   - Timer updates normally every second
   - For `'not-started'`, there's typically no `startedAt` yet, so nothing displays

4. **Early return pattern**: Add status check at the start of `updateElapsedTimes()`:
   ```javascript
   function updateElapsedTimes() {
     // Skip updates for terminal/paused statuses
     if (['completed', 'blocked', 'needs-human', 'paused'].includes(currentSprintStatus)) {
       return;
     }
     // ... rest of function unchanged
   }
   ```

5. **Resume behavior**: Works automatically because:
   - The timer interval keeps running (just returns early when paused)
   - When status changes to `'in-progress'`, the early return condition is no longer met
   - Timer resumes calculating from the same `startedAt` timestamp

6. **Gherkin verification scripts**: Use grep patterns that look for status strings in the function, so implementation must include the literal strings 'completed', 'failed', 'blocked', 'paused' within the function body (within 30 lines of function declaration per the verification commands).
