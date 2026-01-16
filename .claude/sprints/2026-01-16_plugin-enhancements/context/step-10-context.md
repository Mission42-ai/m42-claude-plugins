# Step Context: step-10

## Task
Track D - Step 3: Add Desktop Notifications

Implement browser desktop notifications for sprint events.

Requirements:
- Use Browser Notification API for desktop alerts
- Notify on the following events:
  - Sprint completed (success)
  - Sprint failed
  - Phase blocked/stuck
  - Human intervention needed
- Add notification permission request flow on first visit
- Add optional sound alerts (configurable)
- Create notification settings panel in status page:
  - Enable/disable notifications toggle
  - Per-event notification toggles
  - Sound on/off toggle
  - Sound selection dropdown
- Persist notification preferences in localStorage
- Include sprint/phase info in notification body
- Add click handler to focus status page tab

Files to modify:
- compiler/src/status-server/page.ts (notification logic and settings UI)

Assets to add:
- compiler/src/status-server/assets/notification-sounds/ (optional sound files)


## Related Code Patterns

### Similar Implementation: localStorage for verbosity (page.ts:1345-1346, 2060-2068)
```typescript
// State initialization with localStorage
let verbosityLevel = localStorage.getItem('verbosity') || 'detailed';

// Restore from localStorage on init
if (verbosityLevel && elements.verbositySelect) {
  elements.verbositySelect.value = verbosityLevel;
}

// Save to localStorage on change
elements.verbositySelect.addEventListener('change', function() {
  verbosityLevel = this.value;
  localStorage.setItem('verbosity', verbosityLevel);
  renderLiveActivity();
});
```

### Similar Implementation: Toast Notifications Pattern (page.ts:1655-1686)
```typescript
// Toast notifications with auto-dismiss
function showToast(type, message) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  // ... icon and message content
  elements.toastContainer.appendChild(toast);
  setTimeout(function() {
    removeToast(toast);
  }, 5000);
}
```

### Similar Implementation: Settings Dropdown (page.ts:77-82)
```html
<select id="verbosity-select" class="verbosity-dropdown">
  <option value="minimal">Minimal</option>
  <option value="basic">Basic</option>
  <option value="detailed" selected>Detailed</option>
  <option value="verbose">Verbose</option>
</select>
```

### Similar Implementation: Status Change Detection (page.ts:1849-1878)
```typescript
function handleStatusUpdate(update) {
  updateHeader(update.header);
  // ... header.status is the sprint status
}

function updateHeader(header) {
  // header.status contains: 'not-started', 'in-progress', 'completed',
  //                         'blocked', 'paused', 'needs-human'
  updateControlButtons(header.status);
}
```

### Similar Implementation: CSS Toggle Button (page.ts:678-696)
```css
.clear-activity-btn,
.collapse-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}
```

## Required Imports
### Internal
- No additional imports needed - all code lives in page.ts as embedded template literals

### External
- No external packages needed - uses Browser Notification API (standard Web API)

## Types/Interfaces to Use
```typescript
// From status-types.ts
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

// New interfaces to define in page.ts script section
interface NotificationPreferences {
  enabled: boolean;
  events: {
    sprintCompleted: boolean;
    sprintFailed: boolean;
    phaseBlocked: boolean;
    needsHuman: boolean;
  };
  sound: {
    enabled: boolean;
    soundId: string; // 'default', 'chime', 'bell', etc.
  };
}
```

## Integration Points
- **Called by**: `handleStatusUpdate()` when sprint status changes
- **Calls**: Browser `Notification` API, `window.focus()` on click
- **Status Events to Monitor**:
  - `completed` → trigger "Sprint Completed" notification
  - `failed` → trigger "Sprint Failed" notification
  - `blocked` → trigger "Phase Blocked" notification
  - `needs-human` → trigger "Human Intervention Needed" notification
- **UI Location**: New settings panel in header area (near control buttons) or as modal

## Implementation Notes

### Notification Permission Flow
1. On first visit, check `Notification.permission`
2. If `'default'`, show a non-intrusive prompt asking to enable notifications
3. If user clicks "Enable", call `Notification.requestPermission()`
4. Store permission request state to avoid repeated prompts

### Status Change Detection
```typescript
// Track previous status to detect changes
let previousSprintStatus = null;

function handleStatusUpdate(update) {
  const newStatus = update.header.status;

  // Detect status transitions that should trigger notifications
  if (previousSprintStatus !== newStatus) {
    checkAndSendNotification(newStatus, previousSprintStatus, update);
    previousSprintStatus = newStatus;
  }
  // ... existing update logic
}
```

### localStorage Key
- Use `'notificationPreferences'` key
- Store as JSON string: `JSON.stringify(preferences)`
- Default preferences when not set

### Sound Implementation Options
1. **Base64 embedded audio**: Small audio files can be embedded as data URLs
2. **Web Audio API**: Generate simple tones programmatically (no assets needed)
3. **External URLs**: Reference hosted audio files (requires assets)

Recommended: Use Web Audio API for simple beep/chime sounds to avoid external assets.

### Settings Panel HTML Structure
```html
<div id="notification-settings" class="notification-settings-panel">
  <div class="settings-header">
    <span class="settings-title">Notifications</span>
    <button class="settings-close">×</button>
  </div>
  <div class="settings-body">
    <label class="settings-toggle">
      <input type="checkbox" id="notifications-enabled" />
      <span>Enable Desktop Notifications</span>
    </label>
    <div class="settings-section">
      <span class="settings-section-title">Notify on:</span>
      <label><input type="checkbox" id="notify-completed" /> Sprint Completed</label>
      <label><input type="checkbox" id="notify-failed" /> Sprint Failed</label>
      <label><input type="checkbox" id="notify-blocked" /> Phase Blocked</label>
      <label><input type="checkbox" id="notify-human" /> Needs Human</label>
    </div>
    <div class="settings-section">
      <label class="settings-toggle">
        <input type="checkbox" id="sound-enabled" />
        <span>Sound Alerts</span>
      </label>
      <select id="sound-select">
        <option value="default">Default</option>
        <option value="chime">Chime</option>
        <option value="bell">Bell</option>
      </select>
    </div>
  </div>
</div>
```

### Gherkin Scenarios to Pass (from step-10-gherkin.md)
1. `id="notification-settings"` - Settings panel container
2. `Notification.requestPermission` - Permission request call
3. `sendNotification/triggerNotification/showNotification` with completed/failed/blocked/human
4. `localStorage.*notification` and `setItem.*notification`
5. `notifications-enabled/enable-notifications/notification-toggle/notificationsEnabled` with checkbox/toggle/input
6. `onclick.*focus` or `notification.*onclick.*window.focus`
7. TypeScript compiles without errors

### Notification Click Handler
```typescript
const notification = new Notification(title, { body, icon });
notification.onclick = function() {
  window.focus();
  notification.close();
};
```
