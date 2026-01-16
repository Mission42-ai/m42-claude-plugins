# Step Context: step-8

## Task
Track D - Step 1: Add Skip/Retry Phase Buttons

Implement Skip and Retry buttons for individual phases in the status page.

Requirements:
- Add POST /api/skip/:phaseId endpoint to skip blocked/stuck phases
- Add POST /api/retry/:phaseId endpoint to retry failed phases without full restart
- Skip endpoint should:
  - Mark current phase as "skipped" in PROGRESS.yaml
  - Advance to next phase
  - Show confirmation dialog with data loss warning
- Retry endpoint should:
  - Reset phase status to "pending" in PROGRESS.yaml
  - Re-queue phase for execution
  - Preserve any partial work if possible
- Add contextual buttons in phase cards (Skip visible for stuck/blocked, Retry for failed)
- Include confirmation modal for Skip with warning about incomplete work
- Update SSE to reflect phase status changes immediately

Files to modify:
- compiler/src/status-server/server.ts (add API endpoints)
- compiler/src/status-server/page.ts (add contextual buttons per phase)

## Related Code Patterns

### Similar Implementation: Control Endpoints (server.ts:356-463)
The pause/resume/stop endpoints follow a consistent pattern that skip/retry should follow:
```typescript
/**
 * Handle POST /api/pause request
 * Creates .pause-requested signal file
 */
private handlePauseRequest(res: http.ServerResponse): void {
  try {
    const progress = this.loadProgress();
    const availableActions = this.getAvailableActions(progress.status);

    if (!availableActions.includes('pause')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'pause',
        error: `Cannot pause - sprint status is "${progress.status}"`,
      }));
      return;
    }

    const signalPath = path.join(this.config.sprintDir, '.pause-requested');
    fs.writeFileSync(signalPath, new Date().toISOString());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      action: 'pause',
      message: 'Pause requested - sprint will pause after current task',
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      action: 'pause',
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}
```

### URL Routing Pattern (server.ts:182-239)
The handleRequest method uses switch/case for routing. New endpoints need special handling for POST routes with params:
```typescript
// Control endpoints that accept POST
const controlEndpoints = ['/api/pause', '/api/resume', '/api/stop'];
const isControlEndpoint = controlEndpoints.includes(url);

switch (url) {
  case '/':
    this.handlePageRequest(res);
    break;
  case '/api/pause':
    this.handlePauseRequest(res);
    break;
  // ... etc
  default:
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}
```

For phaseId params, will need to parse URL pattern like `/api/skip/phase-1` or `/api/retry/execute-all > step-0 > plan`.

### Modal Pattern (page.ts:107-122)
Existing stop confirmation modal pattern:
```html
<div class="modal-overlay" id="stop-confirm-modal">
  <div class="modal-content">
    <div class="modal-title">Stop Sprint</div>
    <div class="modal-warning">
      <span class="modal-warning-icon">⚠</span>
      <span class="modal-warning-text">
        This will stop the sprint immediately. Any incomplete work will be left in its current state.
        Are you sure you want to stop?
      </span>
    </div>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" id="stop-cancel-btn">Cancel</button>
      <button class="modal-btn modal-btn-confirm" id="stop-confirm-btn">Stop Sprint</button>
    </div>
  </div>
</div>
```

### Tree Node Rendering (page.ts:1356-1396)
The renderTreeNode function generates phase cards in the sidebar. Buttons should be added within tree-node-content:
```javascript
let html = '<div class="tree-node" style="padding-left: ' + indent + 'px">';
html += '<div class="tree-node-content' + (isActive ? ' active' : '') + '">';

if (hasChildren) {
  html += '<span class="tree-toggle ' + (isExpanded ? 'expanded' : 'collapsed') + '" data-node-id="' + nodePath + '"></span>';
} else {
  html += '<span class="tree-toggle leaf"></span>';
}

html += '<span class="tree-icon ' + node.status + '"></span>';
html += '<span class="tree-label" title="' + escapeHtml(node.label) + '">' + escapeHtml(node.label) + '</span>';

if (node.elapsed) {
  html += '<span class="tree-elapsed">' + node.elapsed + '</span>';
}

html += '</div>';
```

### Toast Notification Pattern (page.ts:1185-1215)
Used for showing action results:
```javascript
function showToast(type, message) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = '<span class="toast-icon">' + icon + '</span>' +
    '<span class="toast-message">' + escapeHtml(message) + '</span>' +
    '<button class="toast-close">×</button>';
  // ... auto-remove logic
}
```

## Required Imports
### Internal
- `status-types.js`: Already has all needed types (PhaseStatus, CompiledProgress, etc.)
- `transforms.js`: Uses `toStatusUpdate` for broadcasting status changes

### External
- `js-yaml`: For loading and dumping PROGRESS.yaml (already imported in server.ts)
- `fs`: Already imported for file operations
- `path`: Already imported for path operations

## Types/Interfaces to Use
```typescript
// From types.ts
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

// From status-types.ts
interface PhaseTreeNode {
  id: string;
  label: string;
  status: PhaseStatus;
  type: 'phase' | 'step' | 'sub-phase';
  // ...
}

// For skip/retry response
interface PhaseActionResponse {
  success: boolean;
  action: 'skip' | 'retry';
  phaseId: string;
  message?: string;
  error?: string;
}
```

## Integration Points
- **Called by**: Frontend JavaScript in page.ts via fetch() POST requests
- **Calls**:
  - `this.loadProgress()` - Load current PROGRESS.yaml
  - `fs.writeFileSync()` - Save modified PROGRESS.yaml
  - `this.handleProgressChange()` - Trigger SSE broadcast after modification
- **Tests**: No existing test files for status-server; verify via gherkin scenarios

## Implementation Notes

### URL Parsing for PhaseId
PhaseIds can be paths like `execute-all > step-0 > plan`. Need URL decoding:
```typescript
// Extract phaseId from URL like /api/skip/execute-all%20%3E%20step-0%20%3E%20plan
const url = new URL(req.url, `http://${req.headers.host}`);
const match = url.pathname.match(/^\/api\/(skip|retry)\/(.+)$/);
if (match) {
  const action = match[1];
  const phaseId = decodeURIComponent(match[2]);
}
```

### PROGRESS.yaml Modification Pattern
For modifying phase status:
1. Load progress with `this.loadProgress()`
2. Find phase by traversing `progress.phases` hierarchy using phaseId path
3. Modify status field
4. Use `yaml.dump()` to serialize back
5. Write with `fs.writeFileSync()`
6. Call `this.handleProgressChange()` to broadcast update

### Phase Finding Logic
PhaseIds are paths like `execute-all > step-0 > plan`. Need recursive finder:
```typescript
function findPhaseByPath(progress: CompiledProgress, phaseId: string): CompiledPhase | null {
  const parts = phaseId.split(' > ');
  // Navigate through progress.phases[].steps[].phases[]
  // to find matching leaf or container
}
```

### Skip Logic
1. Set phase.status = 'skipped'
2. Advance current pointer to next phase
3. If phase has children (steps/sub-phases), skip all children too

### Retry Logic
1. Set phase.status = 'pending'
2. Clear any error field
3. Clear started-at and completed-at timestamps
4. Set current pointer to this phase

### Button Visibility Rules
- Skip button: visible when `status === 'blocked' || status === 'in-progress'` (stuck phases)
- Retry button: visible when `status === 'failed'`
- Both buttons should be small, inline with phase card, only shown on hover

### Skip Confirmation Modal
Required warning text must mention:
- "incomplete work"
- "data loss"
- These exact phrases are checked by gherkin scenario 7
