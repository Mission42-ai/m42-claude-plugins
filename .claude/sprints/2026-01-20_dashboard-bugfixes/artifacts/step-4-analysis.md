# Bug Analysis: BUG-005 - Completed Sprint Triggers Completion Sound

## Executive Summary

The completion sound plays whenever a user views an already-completed sprint because the notification system lacks persistent tracking of which sprints have already been notified.

## Root Cause Location

**File**: `plugins/m42-sprint/compiler/src/status-server/page.ts`

**Primary Issue - Lines 2943-2944**:
```javascript
// Notification state
let previousSprintStatus = null;
```

**Trigger Logic - Lines 4101-4105**:
```javascript
// Check for status change and send notification if needed
if (previousSprintStatus !== newStatus && newStatus) {
  checkAndSendNotification(newStatus, previousSprintStatus, update);
  previousSprintStatus = newStatus;
}
```

**Notification Decision - Lines 3449-3455**:
```javascript
// sendNotification for completed - Sprint completed (success)
if (newStatus === 'completed' && previousStatus !== 'completed') {
  if (notificationPreferences.events.sprintCompleted) {
    title = 'Sprint Completed!';
    body = 'Sprint ' + (update.header ? update.header.sprintId : '') + ' has completed successfully.';
    shouldNotify = true;
  }
}
```

## Bug Mechanism

1. **Page Load**: When the dashboard page loads, `previousSprintStatus` is initialized to `null`
2. **First Status Update**: Server sends status update with `header.status = 'completed'`
3. **Condition Check**: `previousSprintStatus (null) !== newStatus ('completed')` evaluates to `true`
4. **Notification Triggered**: `checkAndSendNotification('completed', null, update)` is called
5. **Sound Plays**: Since `newStatus === 'completed'` and `previousStatus !== 'completed'` (null !== 'completed'), the notification and sound play

**The core problem**: The system only tracks status changes within a single page session (in-memory `previousSprintStatus`), not across browser sessions. Every page load resets this state to `null`, making any completed sprint appear as a "new completion."

## Conditions That Trigger the Bug

| Scenario | Bug Triggered? | Reason |
|----------|---------------|--------|
| User opens completed sprint for first time ever | Yes | previousStatus is null |
| User refreshes page while viewing completed sprint | Yes | previousStatus resets to null |
| User navigates away and returns to completed sprint | Yes | previousStatus resets to null |
| Sprint completes while user is watching | No (correct) | previousStatus was 'in-progress' |
| User opens in-progress sprint | No | Status is not 'completed' |

## Current Notification Preferences Storage

The code already uses localStorage for notification preferences (line 2987-2994):
```javascript
function loadNotificationPreferences() {
  try {
    var stored = localStorage.getItem('notificationPreferences');
    if (stored) { return JSON.parse(stored); }
  } catch (e) {
    console.error('Failed to load notification preferences:', e);
  }
  return getDefaultNotificationPreferences();
}
```

However, there is **no persistent tracking of which sprints have already been notified**.

## What Tests Should Verify

### Unit Tests

1. **Test: Notification NOT sent for already-notified completed sprint**
   - Given: Sprint "sprint-123" is already in `notifiedSprints` in localStorage
   - When: Page loads with status 'completed' for "sprint-123"
   - Then: `showNotification()` should NOT be called
   - Then: `playNotificationSound()` should NOT be called

2. **Test: Notification IS sent for newly completed sprint**
   - Given: Sprint "sprint-456" is NOT in `notifiedSprints` in localStorage
   - Given: Previous status was 'in-progress'
   - When: Status update changes to 'completed' for "sprint-456"
   - Then: `showNotification()` SHOULD be called
   - Then: Sprint "sprint-456" should be added to `notifiedSprints`

3. **Test: Notified sprints list persists across page reloads**
   - Given: Sprint was notified and saved to localStorage
   - When: Page is reloaded (simulated by resetting in-memory state)
   - Then: Sprint should still be in loaded `notifiedSprints` list

4. **Test: Initial page load with completed sprint (never notified)**
   - Given: Fresh browser session (no localStorage)
   - Given: Sprint status is 'completed'
   - When: First status update received
   - Then: Notification SHOULD be sent (first time seeing this completion)
   - Then: Sprint added to `notifiedSprints`

5. **Test: localStorage cleanup for old sprint IDs**
   - Given: `notifiedSprints` contains entries older than 7 days
   - When: Cleanup function runs
   - Then: Old entries should be removed
   - Then: Recent entries should be preserved

### Integration Tests

1. **Browser Session Test**
   - Open completed sprint -> notification plays
   - Refresh page -> notification does NOT play
   - Clear localStorage -> notification plays again

2. **Real-time Completion Test**
   - Start viewing in-progress sprint
   - Sprint completes (status changes to 'completed')
   - Notification plays
   - Refresh page -> no notification

## Proposed Fix Architecture

### Data Structure for localStorage

```javascript
// Key: 'notifiedSprints'
// Value: JSON object mapping sprintId to notification timestamp
{
  "sprint-2026-01-20-abc123": 1737388800000,
  "sprint-2026-01-19-def456": 1737302400000
}
```

### Required Code Changes

1. **Add new functions** (near line 2998):
   - `loadNotifiedSprints()`: Load from localStorage
   - `saveNotifiedSprint(sprintId)`: Add sprint to notified list
   - `hasBeenNotified(sprintId)`: Check if sprint was already notified
   - `cleanupOldNotifications()`: Remove entries older than 7 days

2. **Modify `checkAndSendNotification()`** (line 3440):
   - Before sending notification, check `hasBeenNotified(sprintId)`
   - After sending notification, call `saveNotifiedSprint(sprintId)`

3. **Modify initialization** (near line 2944):
   - Load `notifiedSprints` from localStorage on page load
   - Run cleanup of old entries

### Key Considerations

- **Sprint ID**: Must use unique sprint identifier (available in `update.header.sprintId`)
- **Storage Size**: Limit stored entries to prevent localStorage bloat
- **Cleanup**: Auto-cleanup entries older than 7 days
- **Session vs Persistent**: Use localStorage (persists) not sessionStorage (clears on tab close)
- **Manual Replay**: Consider adding "Replay notification" button if user wants to re-hear sound

## Files to Modify

| File | Changes |
|------|---------|
| `page.ts` | Add notifiedSprints tracking, modify checkAndSendNotification |

## Test File Location

Create: `plugins/m42-sprint/compiler/src/status-server/notification-persistence.test.ts`
