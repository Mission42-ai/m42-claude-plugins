# Step Context: step-6

## Task
Phase 3 - Step 1: Implement Keyboard Shortcuts

Add keyboard navigation for common actions in the status page.

Requirements:
- Add global keydown event listener
- Implement shortcuts:
  - `P` - Pause/Resume sprint (toggle based on current state)
  - `L` - Toggle live activity panel visibility
  - `N` - Open notification settings modal
  - `D` - Download all logs (trigger download-all-logs action)
  - `Esc` - Close any open modals
  - `?` - Show keyboard shortcuts help modal
- Create shortcuts help modal with list of all shortcuts
- Ignore shortcuts when typing in input fields
- Add visual hints in UI (e.g., underline P in Pause button)

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts


## Related Code Patterns

### Similar Implementation: Escape key handling for log viewer (line 1908)
```typescript
// Existing escape handler in setupLogViewer()
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && elements.logViewerModal.classList.contains('visible')) {
    hideLogViewer();
  }
});
```
This pattern shows how to handle keyboard events. The new global handler should consolidate this and other modals.

### Similar Implementation: Modal visibility pattern (lines 1069, 2288-2294)
```typescript
// Modal visibility via CSS class toggle
function showStopModal() {
  elements.stopConfirmModal.classList.add('visible');
}

function hideStopModal() {
  elements.stopConfirmModal.classList.remove('visible');
}
```

### Similar Implementation: Pause/Resume toggle logic (lines 2332-2354)
```typescript
// updateControlButtons determines which button to show based on status
function updateControlButtons(status) {
  currentSprintStatus = status;
  // Hide all buttons first
  elements.pauseBtn.style.display = 'none';
  elements.resumeBtn.style.display = 'none';
  elements.stopBtn.style.display = 'none';

  switch (status) {
    case 'in-progress':
      elements.pauseBtn.style.display = 'inline-flex';
      // ...
    case 'paused':
      elements.resumeBtn.style.display = 'inline-flex';
      // ...
  }
}
```

### Similar Implementation: Activity collapse toggle (lines 2910-2918)
```typescript
elements.collapseActivityBtn.addEventListener('click', function() {
  activityCollapsed = !activityCollapsed;
  if (activityCollapsed) {
    elements.liveActivitySection.classList.add('collapsed');
    this.textContent = '▶';
  } else {
    elements.liveActivitySection.classList.remove('collapsed');
    this.textContent = '▼';
  }
});
```

### Similar Implementation: Notification panel toggle (lines 2001-2015)
```typescript
elements.notificationSettingsBtn.addEventListener('click', function() {
  elements.notificationSettingsPanel.classList.toggle('visible');
});

elements.notificationSettingsClose.addEventListener('click', function() {
  elements.notificationSettingsPanel.classList.remove('visible');
});
```

## Required Imports
### Internal
No additional imports needed - page.ts is a self-contained HTML/CSS/JS generator.

### External
No additional packages needed - uses vanilla JavaScript APIs.

## Types/Interfaces to Use
No TypeScript interfaces needed within the embedded JavaScript. The JavaScript runs in browser context.

## Integration Points
- Called by: Browser's document when page loads (init() function at ~line 1887)
- Calls:
  - `handlePauseClick()` for P key
  - `handleResumeClick()` for P key (when paused)
  - `activityCollapsed` toggle logic for L key
  - `elements.notificationSettingsPanel.classList.toggle('visible')` for N key
  - `downloadAllLogs()` for D key
  - `hide*Modal()` functions for Escape key
- Tests: No unit tests for page.ts (it's browser code as template literal)

## Implementation Notes

### 1. Global Keydown Handler Structure
Create a single `setupKeyboardShortcuts()` function called from `init()`. This consolidates the existing Escape handler from `setupLogViewer()` and adds new shortcuts.

### 2. Input Field Detection
Use this pattern to ignore shortcuts when typing:
```javascript
const target = e.target;
const tagName = target.tagName.toLowerCase();
if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
  return;
}
```

### 3. Modal Elements to Close on Escape
- `stopConfirmModal` - stop confirmation dialog
- `skipConfirmModal` - skip phase confirmation
- `logViewerModal` - log viewer (already has Escape handler at line 1908)
- `notificationSettingsPanel` - notification settings panel
- `shortcutsHelpModal` - new shortcuts help modal (to be created)

### 4. P Key Toggle Logic
Check `currentSprintStatus` state variable (line 1721) to determine whether to pause or resume:
```javascript
if (key === 'p') {
  if (currentSprintStatus === 'in-progress') {
    handlePauseClick();
  } else if (currentSprintStatus === 'paused') {
    handleResumeClick();
  }
}
```

### 5. Shortcuts Help Modal HTML
Add new modal near existing modals (after line 205):
```html
<div class="modal-overlay" id="shortcuts-help-modal">
  <div class="modal-content shortcuts-help-content">
    <div class="modal-title">Keyboard Shortcuts</div>
    <div class="shortcuts-list">
      <div class="shortcut-row"><kbd>P</kbd> <span>Pause/Resume sprint</span></div>
      <div class="shortcut-row"><kbd>L</kbd> <span>Toggle live activity</span></div>
      ...
    </div>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-primary" id="shortcuts-close-btn">Close</button>
    </div>
  </div>
</div>
```

### 6. Visual Hints Pattern
Use `<u>` tag or CSS class for shortcut hints:
```html
<span><u>P</u>ause</span>
```
Or with CSS:
```html
<span class="kbd-hint">P</span>ause
```
With style:
```css
.kbd-hint {
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

### 7. Elements to Add
Add to elements object (around line 1711):
```javascript
shortcutsHelpModal: document.getElementById('shortcuts-help-modal'),
shortcutsCloseBtn: document.getElementById('shortcuts-close-btn')
```

### 8. CSS Additions Needed
- `.shortcuts-help-content` styling (wider modal for table)
- `.shortcuts-list` and `.shortcut-row` for layout
- `kbd` element styling (keyboard key appearance)
- `.kbd-hint` for button visual hints

### 9. Key Comparison
Use `e.key.toLowerCase()` for letter keys, exact match for special keys:
```javascript
const key = e.key.toLowerCase();
if (key === 'p') { ... }
if (key === 'l') { ... }
if (e.key === 'Escape') { ... }  // Exact match for Escape
if (e.key === '?') { ... }  // Requires Shift, so check e.key directly
```

### 10. Prevent Default
For some shortcuts (like `?` which would normally open browser search), use `e.preventDefault()`.
