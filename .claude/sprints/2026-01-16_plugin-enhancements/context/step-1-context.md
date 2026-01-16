# Step Context: step-1

## Task
Track A - Step 2: Add Button UI Components to Status Page

Implement interactive control buttons in the status page UI.

Requirements:
- Add control bar below header with Pause/Resume/Stop buttons
- Button visibility based on sprint status (show Pause when running, Resume when paused)
- Stop button should be red and always visible when sprint is active
- Add confirmation modal for Stop button with warning about incomplete work
- Implement click handlers that call the new API endpoints
- Add loading states during API calls
- Add toast notifications for success/error feedback
- Ensure buttons are styled consistently with existing GitHub dark theme

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Related Code Patterns

### Similar Implementation: page.ts header structure
```typescript
// Key pattern to follow - header with flexbox layout
<header class="header">
  <div class="header-left">
    <h1 class="sprint-name" id="sprint-name">Loading...</h1>
    <span class="status-badge" id="status-badge">--</span>
  </div>
  <div class="header-right">
    <div class="iteration" id="iteration"></div>
    <div class="progress-container">...</div>
  </div>
</header>
```

### Similar Implementation: Status badge styling
```css
/* CSS pattern for status-based styling */
.status-badge.pending { background-color: var(--bg-tertiary); color: var(--text-secondary); }
.status-badge.in-progress { background-color: rgba(88, 166, 255, 0.15); color: var(--accent-blue); }
.status-badge.completed { background-color: rgba(63, 185, 80, 0.15); color: var(--accent-green); }
.status-badge.failed { background-color: rgba(248, 81, 73, 0.15); color: var(--accent-red); }
```

### Similar Implementation: SSE event handling
```javascript
// Pattern for handling server events and updating state
eventSource.addEventListener('status-update', function(e) {
  try {
    const event = JSON.parse(e.data);
    handleStatusUpdate(event.data);
  } catch (err) {
    console.error('Failed to parse status update:', err);
  }
});

function handleStatusUpdate(update) {
  updateHeader(update.header);
  // update.header.status contains current sprint status
}
```

## Required Imports
### Internal
- No new imports needed - this is a self-contained HTML/CSS/JS page generator

### External
- No new external packages needed
- Uses browser Fetch API for POST requests

## Types/Interfaces to Use
```typescript
// From status-types.ts - SprintStatus type for button visibility logic
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

// API response structure (from server.ts)
interface ControlResponse {
  success: boolean;
  action: 'pause' | 'resume' | 'stop';
  message?: string;
  error?: string;
}

// Available actions based on status (from server.ts:286-298)
// 'in-progress' -> ['pause', 'stop']
// 'paused' -> ['resume', 'stop']
// 'blocked' | 'needs-human' -> ['stop']
// default -> []
```

## Integration Points
- **Called by**: `server.ts:handlePageRequest()` at line 219 calls `getPageHtml()`
- **API endpoints**: POST to `/api/pause`, `/api/resume`, `/api/stop`
- **SSE events**: `status-update` events include `header.status` which determines button visibility
- **Tests**: No existing tests for page.ts (visual component)

## CSS Variables Available
```css
/* From page.ts:85-99 - GitHub dark theme colors */
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
--accent-red: #f85149;  /* Use for Stop button */
--accent-purple: #a371f7;
--font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
```

## Implementation Notes
- **Control bar placement**: Add new `<div class="control-bar">` immediately after `</header>` (line 37)
- **Button state tracking**: Store current sprint status in JS state variable to control button visibility
- **Modal pattern**: Create modal HTML at end of `.container` div, position fixed with backdrop
- **Toast pattern**: Create toast container fixed at bottom-right, use CSS animations for show/hide
- **Loading state**: Add `disabled` attribute and `.loading` class during API calls
- **API pattern**: Use fetch with POST method, handle both success and error responses

### Gherkin Verification Targets (from artifacts/step-1-gherkin.md)
1. Control bar: `class="control-bar"` or `class=\"control-bar\"`
2. Pause button: `id="pause-btn"` or `pauseBtn`
3. Resume button: `id="resume-btn"` or `resumeBtn`
4. Stop button: `stop-btn.*danger` or `danger.*stop` or `--accent-red.*stop`
5. Confirmation modal: `confirm.*modal` or `modal.*confirm` or `incomplete` or `warning`
6. API calls: `fetch.*api/(pause|resume|stop)` - need at least 2 matches
7. Loading states: `loading` or `disabled` or `isLoading` or `setLoading` or `.loading`
8. Toast notifications: `toast` or `notification` or `showMessage` or `showError` or `showSuccess`

### Button Visibility Logic
```javascript
function updateControlButtons(status) {
  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const stopBtn = document.getElementById('stop-btn');

  // Hide all first
  pauseBtn.style.display = 'none';
  resumeBtn.style.display = 'none';
  stopBtn.style.display = 'none';

  switch (status) {
    case 'in-progress':
      pauseBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
      break;
    case 'paused':
      resumeBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
      break;
    case 'blocked':
    case 'needs-human':
      stopBtn.style.display = 'inline-flex';
      break;
  }
}
```
