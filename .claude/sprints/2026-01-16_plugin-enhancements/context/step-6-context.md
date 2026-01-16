# Step Context: step-6

## Task
Track C - Step 3: Add Live Activity UI Panel to Status Page

Implement Live Activity display panel in the status page.

Requirements:
- Add "Live Activity" panel below current task section
- Subscribe to activity SSE events from server
- Display activity entries with timestamps, icons, and descriptions
- Add verbosity dropdown selector (Minimal/Basic/Detailed/Verbose)
- Store verbosity preference in localStorage
- Implement auto-scroll behavior with manual scroll lock
- Add "Clear Activity" button to reset display
- Use appropriate icons for different tool types (Read=📖, Write=✏️, Bash=⚡, etc.)
- Limit displayed entries (e.g., last 100) for performance
- Style consistently with existing GitHub dark theme

Files to modify:
- compiler/src/status-server/page.ts

Design considerations:
- Activity panel should be collapsible to save space
- Timestamps should be relative (e.g., "2s ago") with tooltip showing absolute time
- Long file paths should be truncated with tooltip showing full path


## Related Code Patterns

### Existing SSE Event Handling: page.ts:1033-1054
```typescript
eventSource.addEventListener('status-update', function(e) {
  try {
    const event = JSON.parse(e.data);
    handleStatusUpdate(event.data);
  } catch (err) {
    console.error('Failed to parse status update:', err);
  }
});

eventSource.addEventListener('log-entry', function(e) {
  try {
    const event = JSON.parse(e.data);
    handleLogEntry(event.data);
  } catch (err) {
    console.error('Failed to parse log entry:', err);
  }
});
```

### Existing Activity Feed Pattern: page.ts:1225-1251
```typescript
function handleLogEntry(entry) {
  activityLog.unshift(entry);

  // Trim to max entries
  if (activityLog.length > maxLogEntries) {
    activityLog.pop();
  }

  renderActivityFeed();
}

function renderActivityFeed() {
  if (activityLog.length === 0) {
    elements.activityFeed.innerHTML = '<div class="feed-empty">Waiting for updates...</div>';
    return;
  }

  const html = activityLog.map(entry => {
    return '<div class="feed-entry">' +
      '<span class="feed-time">' + formatTime(entry.timestamp) + '</span>' +
      '<span class="feed-icon ' + entry.type + '"></span>' +
      '<span class="feed-message">' + escapeHtml(entry.message) + '</span>' +
      '</div>';
  }).join('');

  elements.activityFeed.innerHTML = html;
}
```

### Existing Section Structure: page.ts:62-75
```html
<section class="current-task" id="current-task-section">
  <h2 class="section-title">Current Task</h2>
  <div class="task-content" id="current-task">
    <div class="no-task">No active task</div>
  </div>
</section>

<section class="activity-feed">
  <h2 class="section-title">Activity Feed</h2>
  <div class="feed-content" id="activity-feed">
    <div class="feed-empty">Waiting for updates...</div>
  </div>
</section>
```

### CSS Variables (GitHub Dark Theme): page.ts:119-134
```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --bg-highlight: #30363d;
  --border-color: #30363d;
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-yellow: #d29922;
  --accent-red: #f85149;
  --accent-purple: #a371f7;
}
```

## Required Imports
### Internal
- No additional imports needed - page.ts generates HTML/CSS/JS as template literals

### External
- No external packages needed - all functionality is vanilla JS embedded in template

## Types/Interfaces to Use
```typescript
// From activity-types.ts
export type VerbosityLevel = 'minimal' | 'basic' | 'detailed' | 'verbose';

export interface ActivityEvent {
  ts: string;          // ISO-8601 timestamp
  type: 'tool';        // Event type
  tool: string;        // Tool name (Read, Write, Bash, Edit, etc.)
  level: VerbosityLevel;
  file?: string;       // File path (for Read, Write, Edit)
  params?: string;     // Additional parameters
  input?: unknown;     // Full input (verbose only)
  response?: unknown;  // Full response (verbose only)
}

// SSE Event wrapper
export interface ActivityEventSSE {
  type: 'activity-event';
  data: ActivityEvent;
  timestamp: string;
}
```

## Integration Points
- **SSE Event**: Server broadcasts `activity-event` SSE events (server.ts:100-102)
- **Event Source**: Existing EventSource connection at `/events` (page.ts:1020)
- **New listener needed**: `eventSource.addEventListener('activity-event', ...)`
- **Tests**: No existing tests for page.ts (UI is tested manually via browser)

## Implementation Notes

### HTML Structure for Live Activity Panel
Add new section after current task, before existing activity-feed:
```html
<section class="live-activity" id="live-activity-section">
  <div class="section-header">
    <h2 class="section-title">Live Activity</h2>
    <div class="activity-controls">
      <select id="verbosity-select" class="verbosity-dropdown">
        <option value="minimal">Minimal</option>
        <option value="basic">Basic</option>
        <option value="detailed" selected>Detailed</option>
        <option value="verbose">Verbose</option>
      </select>
      <button class="clear-activity-btn" id="clear-activity-btn">Clear</button>
      <button class="collapse-btn" id="collapse-activity-btn">▼</button>
    </div>
  </div>
  <div class="activity-content" id="live-activity-content">
    <div class="activity-empty">Waiting for activity...</div>
  </div>
</section>
```

### Tool Icons Mapping
```javascript
const toolIcons = {
  Read: '📖',
  Write: '✏️',
  Edit: '📝',
  Bash: '⚡',
  Grep: '🔍',
  Glob: '📂',
  Task: '🔄',
  WebFetch: '🌐',
  WebSearch: '🔎',
  TodoWrite: '📋',
  default: '🔧'
};
```

### State Variables to Add
```javascript
const liveActivityLog = [];
const MAX_ACTIVITY_ENTRIES = 100;
let verbosityLevel = localStorage.getItem('verbosity') || 'detailed';
let activityAutoScroll = true;
let activityCollapsed = false;
```

### localStorage Keys
- `verbosity` - stores VerbosityLevel string ('minimal'|'basic'|'detailed'|'verbose')

### Scroll Lock Behavior
- Auto-scroll when user is at bottom (within ~20px threshold)
- Lock scroll when user scrolls up manually
- Resume auto-scroll when user scrolls back to bottom

### Relative Time Format
```javascript
function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}
```

### Verbosity Level Filtering
```javascript
const VERBOSITY_ORDER = { minimal: 0, basic: 1, detailed: 2, verbose: 3 };

function shouldShowEvent(eventLevel, displayLevel) {
  return VERBOSITY_ORDER[eventLevel] <= VERBOSITY_ORDER[displayLevel];
}
```

### Path Truncation
```javascript
function truncatePath(filePath, maxLength = 40) {
  if (!filePath || filePath.length <= maxLength) return filePath;
  const fileName = filePath.split('/').pop();
  const remaining = maxLength - fileName.length - 3; // for '...'
  if (remaining <= 0) return '...' + fileName.slice(-maxLength + 3);
  return filePath.slice(0, remaining) + '...' + fileName;
}
```
