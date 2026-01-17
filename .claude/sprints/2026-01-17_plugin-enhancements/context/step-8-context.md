# Step Context: step-8

## Task
Phase 3 - Step 3: Enhance Log Viewer

Improve the log viewer with line numbers, search navigation, and jump to error.

Requirements:
- Add line numbers column to log display (fixed width, right-aligned)
- Implement search within logs:
  - Search input field at top of log viewer
  - Highlight all matches in log content
  - "Next" and "Previous" buttons to navigate between matches
  - Show match count (e.g., "3 of 12 matches")
- Add "Jump to Error" button that scrolls to first error/failure line
- Error lines should be highlighted with red background
- Preserve line number visibility when scrolling horizontally

Verification:
- Open a log with errors, verify line numbers display
- Search for a term, verify highlighting and navigation
- Click "Jump to Error", verify scroll to error line

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Related Code Patterns

### Similar Implementation: Log Viewer Modal (page.ts:191-205)
```typescript
// Current log viewer HTML structure
<div class="log-viewer-modal" id="log-viewer-modal">
  <div class="log-viewer-content">
    <div class="log-viewer-header">
      <span class="log-viewer-title" id="log-viewer-title">Phase Log</span>
      <div class="log-viewer-controls">
        <input type="text" class="log-search-input" id="log-search-input" placeholder="Search logs..." />
        <button class="log-download-btn" id="log-download-btn">Download Log</button>
        <button class="log-viewer-close" id="log-viewer-close">Close</button>
      </div>
    </div>
    <div class="log-viewer-body" id="log-viewer-body">
      <div class="log-loading">Loading log...</div>
    </div>
  </div>
</div>
```

### Similar Implementation: Existing Search Highlight (page.ts:2125-2137)
```typescript
function renderLogContent(content, searchTerm) {
  let html = ansiToHtml(content);

  // Apply search highlighting if search term is provided
  if (searchTerm && searchTerm.length > 0) {
    var escapedTerm = escapeHtml(searchTerm).replace(/[.*+?^$\\{\\}()|\\[\\]\\\\]/g, '\\\\$&');
    var regex = new RegExp('(' + escapedTerm + ')', 'gi');
    html = html.replace(regex, '<span class="highlight">$1</span>');
  }

  elements.logViewerBody.innerHTML = '<pre class="log-content-pre">' + html + '</pre>';
}
```

### Similar Implementation: Button CSS Pattern (page.ts:1438-1453)
```css
.log-download-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.log-download-btn:hover {
  background-color: var(--bg-highlight);
  border-color: var(--text-muted);
}
```

### Similar Implementation: Search Input CSS (page.ts:1422-1436)
```css
.log-search-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 200px;
}

.log-search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}
```

### Similar Implementation: Highlight CSS (page.ts:1487-1491)
```css
.log-content-pre .highlight {
  background-color: rgba(210, 153, 34, 0.3);
  border-radius: 2px;
  padding: 0 2px;
}
```

## Required Imports
### Internal
- No additional internal imports needed - all code is embedded in template literals within page.ts

### External
- No additional external packages needed - using vanilla JavaScript and CSS

## Types/Interfaces to Use
```typescript
// No TypeScript interfaces needed - this is embedded JavaScript in template literals
// Global state variables to add:
var currentMatchIndex = 0;   // Current highlighted match position
var totalMatches = 0;        // Total number of search matches
var matchElements = [];      // Array of highlighted match elements
```

## Integration Points
- **Called by**: Log viewer modal interaction (existing `showLogViewer`, `handleLogSearch` functions)
- **Calls**: Existing `ansiToHtml`, `escapeHtml` utility functions
- **Tests**: No direct test files (manual verification via UI)

## Implementation Notes

### HTML Changes (getPageHtml function ~line 191-205)
1. Add search navigation controls in `.log-viewer-controls`:
   - "Jump to Error" button
   - Search input (existing)
   - Match count display span (e.g., "3 of 12 matches")
   - "Previous" button
   - "Next" button

### CSS Changes (getStyles function)
1. Add `.log-line-number` styles:
   - `width: 4ch` (fixed width for up to 9999 lines)
   - `text-align: right`
   - `position: sticky; left: 0` for horizontal scroll preservation
   - `background-color: var(--bg-secondary)` to separate from content
   - `color: var(--text-muted)`
   - `user-select: none` to prevent copying line numbers

2. Add `.log-line` wrapper styles:
   - `display: flex` to align line number and content
   - Error variant: `.log-line.error { background-color: rgba(248, 81, 73, 0.15); }`

3. Add search navigation button styles (follow `.log-download-btn` pattern)

4. Add `.log-search-nav` container styles for grouping prev/next/count

5. Add `.log-match-count` styles

6. Add `.highlight.current` for active match highlighting (brighter background)

### JavaScript Changes (getScript function)
1. Add global state variables:
   - `currentMatchIndex`, `totalMatches`, `matchElements`

2. Add new element references to `elements` object:
   - `logSearchPrev`, `logSearchNext`, `logMatchCount`, `logJumpToError`

3. Modify `renderLogContent` function:
   - Split content into lines
   - Wrap each line with `.log-line` div containing `.log-line-number` and `.log-line-content`
   - Detect error lines (patterns: "error", "Error", "ERROR", "failed", "Failed", "FAILED")
   - Add `.error` class to error lines

4. Add new functions:
   - `navigateToNextMatch()` - increment currentMatchIndex, scroll to match, update count display
   - `navigateToPrevMatch()` - decrement currentMatchIndex, scroll to match, update count display
   - `jumpToFirstError()` - find first `.log-line.error` element and scroll into view
   - `updateMatchCount()` - update "X of Y matches" display
   - `updateCurrentMatchHighlight()` - add/remove `.current` class from matches

5. Update `handleLogSearch`:
   - After rendering, collect all `.highlight` elements into `matchElements`
   - Reset `currentMatchIndex = 0` and set `totalMatches`
   - Call `updateMatchCount()` and `updateCurrentMatchHighlight()`

6. Update `setupLogViewer`:
   - Add event listeners for prev/next buttons and jump to error button

### Error Detection Patterns
```javascript
// Regex patterns to detect error lines
var errorPatterns = [
  /\berror\b/i,
  /\bfailed\b/i,
  /\bfailure\b/i,
  /\bexception\b/i,
  /^Error:/,
  /^Uncaught/,
  /\[ERROR\]/,
  /\[FATAL\]/
];
```

### Design Considerations
- Line numbers column should use monospace font for alignment
- Sticky positioning requires parent container to have `overflow: auto`
- Match navigation should wrap around (last→first, first→last)
- Error line highlighting should not interfere with search highlighting
- Current match should have distinct visual treatment from other matches
- Consider disabled state for prev/next buttons when no matches
