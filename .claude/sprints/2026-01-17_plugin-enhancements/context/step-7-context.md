# Step Context: step-7

## Task
Phase 3 - Step 2: Add Enhanced Error Messages with Recovery Actions

Show contextual error details with actionable recovery guidance.

Requirements:
- Create error classification system for phase failures
- Categories: network, rate-limit, timeout, validation, logic
- Display error category badge in failed phase cards
- Show recovery suggestions based on error type:
  - network: "Check internet connection and retry"
  - rate-limit: "Wait a few minutes before retrying"
  - timeout: "Phase took too long - try breaking into smaller steps"
  - validation: "Review input/output requirements"
  - logic: "Review Claude's reasoning in the log"
- Add "View Error Details" expandable section in phase cards
- Include stack trace or relevant error message

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Related Code Patterns

### Existing Error Category Infrastructure

**Already implemented:**
1. Error category types defined in `types.ts:24`
2. CSS for error category badges in `page.ts:644-676`
3. Error category badge display in `page.ts:2968-2972`
4. Error field passed through transforms.ts to PhaseTreeNode

### Similar Implementation: Error Category Badge CSS (page.ts:644-676)
```typescript
.error-category-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 500;
  margin-left: 4px;
}

.error-category-badge.network {
  background-color: rgba(88, 166, 255, 0.15);
  color: var(--accent-blue);
}
// ... other categories already styled
```

### Similar Implementation: Error Badge Display (page.ts:2968-2972)
```typescript
// Show error category badge if present
var errorCategory = node['error-category'];
if (errorCategory) {
  html += '<span class="error-category-badge ' + escapeHtml(errorCategory) + '">' + escapeHtml(errorCategory) + '</span>';
}
```

### Similar Implementation: Expandable Pattern (page.ts tree-toggle)
```typescript
// Tree collapse/expand toggle pattern (page.ts:2877-2895)
elements.phaseTree.querySelectorAll('.tree-toggle').forEach(toggle => {
  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    const nodeId = this.dataset.nodeId;
    const children = this.closest('.tree-node').querySelector('.tree-children');
    // Toggle collapsed class
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
      children.classList.add('collapsed');
    } else {
      expandedNodes.add(nodeId);
      children.classList.remove('collapsed');
    }
  });
});
```

### Similar Implementation: Log Viewer Toggle (page.ts:2977-2979)
```typescript
// View Log button for completed/in-progress phases
if (!hasChildren && (node.status === 'completed' || node.status === 'in-progress')) {
  html += '<button class="log-viewer-toggle" data-phase-id="' + escapeHtml(phaseId) + '" title="View Log">View Log</button>';
}
```

## Required Imports
### Internal
- None additional needed - all types are already available in page.ts via inline use

### External
- None additional needed

## Types/Interfaces to Use
```typescript
// From types.ts:24 - already defined
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';

// From status-types.ts:40-57 - already includes error fields
export interface PhaseTreeNode {
  // ... existing fields ...
  error?: string;
  'error-category'?: string;
}
```

## Integration Points
- **Called by**: `renderTreeNode()` function renders the error details section
- **Calls**: `escapeHtml()` for sanitizing error messages
- **Tests**: No direct test file for page.ts; validation via TypeScript compilation and visual testing

## Implementation Notes

### What Needs to Be Added

1. **Recovery Suggestions Mapping** (in getScript() JavaScript section)
   ```javascript
   const RECOVERY_SUGGESTIONS = {
     'network': 'Check internet connection and retry',
     'rate-limit': 'Wait a few minutes before retrying',
     'timeout': 'Phase took too long - try breaking into smaller steps',
     'validation': 'Review input/output requirements',
     'logic': "Review Claude's reasoning in the log"
   };
   ```

2. **getRecoverySuggestion() Function**
   ```javascript
   function getRecoverySuggestion(category) {
     return RECOVERY_SUGGESTIONS[category] || 'An error occurred. Check the log for details.';
   }
   ```

3. **CSS for Error Details Section** (add to getStyles())
   - `.error-details` - container for expandable error section
   - `.error-details-toggle` - button to show/hide details
   - `.error-details-content` - the content area (hidden by default)
   - `.recovery-suggestion` - styling for the recovery message
   - `.error-message` - styling for the actual error text

4. **HTML Rendering in renderTreeNode()** (after error category badge, ~line 2972)
   - Add "View Error Details" button for failed phases with error
   - Add expandable section containing:
     - Recovery suggestion based on error category
     - Error message (sanitized)

5. **Event Handlers** (in updatePhaseTree() ~line 2916)
   - Add click handler for `.error-details-toggle` buttons
   - Toggle visibility of corresponding `.error-details-content`

### Key Considerations

1. **XSS Prevention**: Always use `escapeHtml()` when displaying error messages
2. **State Management**: Consider using a Set (like `expandedNodes`) to track expanded error details
3. **Only Show for Failed Phases**: Error details should only appear for `status === 'failed'` with an error
4. **CSS Consistency**: Follow existing GitHub dark theme colors and spacing conventions
5. **View Log Button Coexistence**: Error details section should not conflict with existing "View Log" button

### Verification Scenarios
1. Recovery suggestions mapping exists with all 5 categories
2. Network error shows "Check internet connection" suggestion
3. Rate-limit error shows "wait" suggestion
4. View Error Details expandable section exists
5. CSS styles for error details exist
6. TypeScript compiles without errors
7. getRecoverySuggestion function or RECOVERY_SUGGESTIONS mapping exists
