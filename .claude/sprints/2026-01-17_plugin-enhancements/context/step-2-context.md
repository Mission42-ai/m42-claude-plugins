# Step Context: step-2

## Task
Phase 1 - Step 3: Fix Desktop Notifications Not Working

Notifications are enabled but not appearing due to browser autoplay policy and missing error handling.

Requirements:
- Add try-catch error handling to `showNotification()` function
- Pre-initialize AudioContext on first user interaction (click handler)
- Add "Test Notification" button in the notification settings panel
- Show toast fallback when notification permission denied or fails
- Log notification errors to console for debugging
- Handle case where Notification API is not available

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (~lines 1948-2169, notification section)

## Related Code Patterns

### Similar Implementation: Error handling in control buttons (page.ts:2180-2191)
```javascript
async function handlePauseClick() {
  if (isLoading.pause) return;
  setLoading('pause', true);
  try {
    const response = await fetch('/api/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    handleControlResponse('pause', result);
  } catch (err) {
    showToast('error', 'Failed to pause: ' + err.message);
  } finally {
    setLoading('pause', false);
  }
}
```

### Similar Implementation: Audio error handling in playNotificationSound (page.ts:2127-2169)
```javascript
function playNotificationSound(soundId) {
  try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // ... oscillator setup ...
  } catch (e) {
    console.error('Failed to play notification sound:', e);
  }
}
```

### Similar Implementation: localStorage with error handling (page.ts:1740-1757)
```javascript
function loadNotificationPreferences() {
  try {
    var stored = localStorage.getItem('notificationPreferences');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load notification preferences:', e);
  }
  return getDefaultNotificationPreferences();
}
```

## Current showNotification Function (page.ts:2107-2125)
```javascript
function showNotification(title, body) {
  var notification = new Notification(title, {
    body: body,
    icon: '/favicon.ico',
    tag: 'sprint-status'
  });

  notification.onclick = function() { window.focus(); notification.close(); };

  // Play sound if enabled
  if (notificationPreferences.sound.enabled) {
    playNotificationSound(notificationPreferences.sound.soundId);
  }

  // Auto-close after 10 seconds
  setTimeout(function() {
    notification.close();
  }, 10000);
}
```
**Problem**: No try-catch, no fallback to toast, no logging on error.

## HTML Structure for Notification Settings (page.ts:48-81)
```html
<div id="notification-settings" class="notification-settings-panel">
  <div class="notification-settings-header">...</div>
  <div class="notification-settings-body">
    <div class="notification-permission-prompt" id="notification-permission-prompt">...</div>
    <label class="notification-settings-toggle">...</label>
    <div class="notification-settings-section">
      <span class="notification-settings-section-title">Notify on:</span>
      <!-- checkboxes -->
    </div>
    <div class="notification-settings-section">
      <!-- sound settings -->
    </div>
  </div>
</div>
```
**Need to add**: Test Notification button after sound settings section.

## Required Imports
### Internal
- None - all functions are inline within `getScript()` template literal

### External
- None - uses browser-native APIs (Notification, AudioContext)

## Types/Interfaces to Use
No TypeScript interfaces - this is client-side JavaScript within a template literal string.

## Key Elements Object Entries to Add (page.ts:1641-1690)
```javascript
const elements = {
  // ... existing entries ...
  // ADD:
  testNotificationBtn: document.getElementById('test-notification-btn'),
};
```

## Integration Points
- **Called by**: `checkAndSendNotification()` calls `showNotification()` (page.ts:2103)
- **Calls**: `playNotificationSound()`, `showToast()` (for fallback)
- **Tests**: No dedicated test files - manual browser testing via verification commands

## Implementation Notes

1. **AudioContext Pre-initialization Pattern**:
   - Modern browsers require user interaction before playing audio
   - Create a shared `audioContext` variable at module level
   - Initialize it on first click anywhere in the document
   - Reuse the same AudioContext in `playNotificationSound()`

2. **Error Handling Pattern for showNotification**:
   ```javascript
   function showNotification(title, body) {
     // Check if Notification API is available
     if (!('Notification' in window)) {
       console.warn('[Notifications] Notification API not available');
       showToast('info', title + ': ' + body);
       return;
     }

     // Check permission
     if (Notification.permission !== 'granted') {
       console.warn('[Notifications] Permission not granted');
       showToast('info', title + ': ' + body);
       return;
     }

     try {
       var notification = new Notification(title, { ... });
       // ... rest of implementation
     } catch (e) {
       console.error('[Notifications] Failed to show notification:', e);
       showToast('info', title + ': ' + body);
     }
   }
   ```

3. **Test Notification Button**:
   - Add HTML button in the notification settings panel (after sound section)
   - Add element reference to `elements` object
   - Add click handler in `setupNotifications()` function
   - Handler should call `showNotification('Test', 'Notification test successful!')`

4. **CSS for Test Button**: Follow existing button patterns:
   - Use `.notification-enable-btn` styling as reference
   - Add distinct class `.test-notification-btn`

5. **Console Logging Convention**: Use prefix `[Notifications]` for all notification-related logs to match codebase patterns.

## Files to Modify
1. `plugins/m42-sprint/compiler/src/status-server/page.ts`
   - HTML section (~line 79): Add test notification button
   - CSS section: Add styling for test button (if needed)
   - Elements object (~line 1686): Add `testNotificationBtn` entry
   - `setupNotifications()` function (~line 1948): Add test button click handler
   - `showNotification()` function (~line 2107): Add try-catch, fallback, logging
   - Global scope: Add shared `audioContext` variable and initialization

## Verification Commands
```bash
# Scenario 1: try-catch exists
grep -A 20 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "try {"

# Scenario 2: AudioContext pre-init on user interaction
grep -E "(audioContext|AudioContext).*resume|initAudioContext|preInitAudio" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q -E "click|interaction|user"

# Scenario 3: Test notification button
grep -E "test.*notification|testNotification|Test Notification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q -i "button\|btn\|click"

# Scenario 4: Toast fallback
grep -A 30 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "showToast"

# Scenario 5: Console logging
grep -A 30 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "console\.\(error\|warn\)"

# Scenario 6: TypeScript compiles
cd plugins/m42-sprint/compiler && npx tsc --noEmit
```
