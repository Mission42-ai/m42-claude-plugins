# BUG-006 Fix Summary: Total Sprint Duration Not Displayed

## Overview
**Bug ID**: BUG-006
**Severity**: MEDIUM (missing information)
**Status**: FIXED

## Root Cause Analysis

The issue was in the `updateHeader()` function in `page.ts`. The function was setting `elements.elapsed.dataset.startedAt` from `header.startedAt`, but it relied entirely on the `updateElapsedTimes()` timer function to display the actual elapsed time.

The timer function (`updateElapsedTimes()` at line 4877-4891) has an early return for terminal statuses:

```javascript
if (currentSprintStatus && ['completed', 'failed', 'blocked', 'needs-human', 'paused'].includes(currentSprintStatus)) {
  return;
}
```

This meant that for completed sprints:
1. `header.elapsed` was available from `progress.stats.elapsed` in PROGRESS.yaml
2. `elements.elapsed.dataset.startedAt` was set correctly
3. But `elements.elapsed.textContent` was NEVER set because the timer skipped terminal statuses
4. Result: The elapsed time element remained empty

## Solution Implemented

Added explicit elapsed time setting in `updateHeader()` for terminal sprint statuses at lines 4240-4244:

```javascript
// BUG-006 fix: Set elapsed textContent directly for completed/terminal sprints
// The timer skips these statuses, so we must set the value here
if (header.elapsed && ['completed', 'failed', 'blocked', 'needs-human'].includes(header.status)) {
  elements.elapsed.textContent = 'Total: ' + header.elapsed;
}
```

### How It Works Now

| Sprint Status | Elapsed Time Display Method |
|--------------|----------------------------|
| `not-started` | Not displayed (no startedAt) |
| `in-progress` | Timer calculates from startedAt every second |
| `completed` | **FIX**: Set directly from header.elapsed |
| `failed` | **FIX**: Set directly from header.elapsed |
| `blocked` | **FIX**: Set directly from header.elapsed |
| `needs-human` | **FIX**: Set directly from header.elapsed |
| `paused` | Timer is frozen, elapsed shown from last update |

## Files Modified

### Source Changes
- `plugins/m42-sprint/compiler/src/status-server/page.ts` (lines 4240-4244)
  - Added BUG-006 fix comment and condition
  - Sets `elements.elapsed.textContent` directly for terminal statuses

### Test Files Added
- `plugins/m42-sprint/compiler/src/status-server/total-duration.test.ts`
  - 6 comprehensive test cases covering:
    - Header elapsed for completed sprints
    - Header elapsed for in-progress sprints
    - Header startedAt presence
    - Page HTML structure (dedicated elapsed element)
    - Page CSS (prominent duration styling)
    - Page JS (elapsed set for completed without relying on timer)

## Test Results

All 6 BUG-006 tests pass:
```
--- BUG-006: Total Sprint Duration Not Displayed Tests ---

BUG-006 tests completed.

✓ BUG-006: toStatusUpdate should include elapsed time in header for completed sprints
✓ BUG-006: toStatusUpdate should include elapsed time in header for in-progress sprints
✓ BUG-006: toStatusUpdate header should include startedAt for duration calculation
✓ BUG-006: Page HTML should include a dedicated total duration element
✓ BUG-006: Page CSS should style total duration prominently
✓ BUG-006: Page JavaScript should set elapsed for completed sprints without relying on timer
```

## Edge Cases Considered

### 1. Completed Sprints (Primary Fix)
- `header.elapsed` comes from `progress.stats.elapsed` in PROGRESS.yaml
- Set directly in `updateHeader()` - no timer dependency
- Works correctly: Shows "Total: Xh Ym"

### 2. In-Progress Sprints
- Timer calculates elapsed from `startedAt` every second
- Updates `elements.elapsed.textContent` dynamically
- Works correctly: Shows real-time updating elapsed

### 3. Paused Sprints (Potential Follow-up)
- Timer skips paused status (line 4881)
- `progress.stats.elapsed` is NOT written when pausing (only on completion)
- Current behavior: Shows elapsed from last timer update before pause
- Note: Not a regression, as this was the existing behavior before the fix

## Verification Steps

1. **Unit Tests**: All 6 BUG-006 tests pass
2. **Code Review**: Fix correctly checks for terminal statuses and sets textContent
3. **Data Flow**: `header.elapsed` flows from PROGRESS.yaml through transforms.ts to page.ts
4. **CSS Styling**: `.sprint-duration` class exists for prominent display

## Follow-up Items

1. **Paused sprints elapsed time**: Could be enhanced to calculate elapsed on-the-fly from `startedAt` when `header.elapsed` is undefined. Currently relies on the last timer update before pause.

2. **Consider storing elapsed in PROGRESS.yaml on pause**: The runtime could write `stats.elapsed` when pausing, similar to how it's written on completion.
