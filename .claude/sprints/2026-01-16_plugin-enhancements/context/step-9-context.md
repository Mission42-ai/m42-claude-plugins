# Step Context: step-9

## Task
Track D - Step 2: Implement Phase Log Viewer

Add expandable log viewer for each phase showing Claude's actual output.

Requirements:
- Capture stdout/stderr from each `claude -p` invocation in sprint-loop.sh
- Store phase logs in <sprint-dir>/logs/<phase-id>.log
- Create logs/ directory in sprint directory structure
- Modify sprint-loop.sh to tee output to log files while displaying
- Add expandable "View Log" section in each phase card
- Implement syntax highlighting for code blocks in output
- Add search/filter functionality within logs
- Add "Download Log" button for individual phase logs
- Add "Download All Logs" button (zip archive) in sprint header
- Handle large log files efficiently (lazy loading, virtualized scrolling)
- Preserve ANSI color codes and convert to HTML for display

Files to modify:
- scripts/sprint-loop.sh (add logging to files)
- compiler/src/status-server/server.ts (add log serving endpoints)
- compiler/src/status-server/page.ts (add log viewer UI)

New endpoints:
- GET /api/logs/:phaseId - Get log content for a phase
- GET /api/logs/download/:phaseId - Download individual log
- GET /api/logs/download-all - Download all logs as zip

## Related Code Patterns

### Similar Implementation: sprint-loop.sh CLI invocation (line ~304-310)
```bash
# Current pattern captures output but doesn't save to files
CLI_OUTPUT=""
CLI_EXIT_CODE=0

if [[ -n "$HOOK_CONFIG" ]] && [[ -f "$HOOK_CONFIG" ]]; then
  CLI_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions --hook-config "$HOOK_CONFIG" 2>&1) || CLI_EXIT_CODE=$?
else
  CLI_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1) || CLI_EXIT_CODE=$?
fi
echo "$CLI_OUTPUT"
```

### Similar Implementation: server.ts endpoint pattern (skip/retry endpoints)
```typescript
// URL pattern matching for dynamic routes (line ~229-256)
const skipMatch = url.match(/^\/api\/skip\/(.+)$/);
const retryMatch = url.match(/^\/api\/retry\/(.+)$/);

// Switch statement with default case for routing
switch (url) {
  case '/':
    this.handlePageRequest(res);
    break;
  // ...
  default:
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}
```

### Similar Implementation: server.ts file reading (loadProgress pattern)
```typescript
// File reading with validation (line ~902-911)
private loadProgress(): CompiledProgress {
  const content = fs.readFileSync(this.progressFilePath, 'utf-8');
  const progress = yaml.load(content) as CompiledProgress;

  if (!progress || typeof progress !== 'object') {
    throw new Error('Invalid PROGRESS.yaml format');
  }

  return progress;
}
```

### Similar Implementation: page.ts expandable UI pattern (tree children)
```typescript
// Expandable section pattern from phase tree (line ~1596-1604)
if (hasChildren) {
  html += '<div class="tree-children' + (isExpanded ? '' : ' collapsed') + '">';
  html += node.children.map(child => renderTreeNode(child, nodePath)).join('');
  html += '</div>';
}
```

### Similar Implementation: page.ts Live Activity panel (collapsible section)
```css
/* Collapsible section pattern (line ~602-615) */
.live-activity {
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  max-height: 300px;
  transition: max-height 0.2s ease;
}

.live-activity.collapsed {
  max-height: 36px;
  overflow: hidden;
}
```

## Required Imports
### Internal (server.ts)
- `fs` (already imported): for reading log files
- `path` (already imported): for constructing log file paths
- `http` (already imported): for request/response handling

### External
- `archiver` or built-in `zlib`: for creating zip archives for download-all
  - Note: Native Node.js approach using tar/gzip may be simpler
  - Alternative: Generate zip on-the-fly without external dependencies

## Types/Interfaces to Use
```typescript
// Extend existing patterns - no new types needed
// Log content returned as plain text with ANSI codes
// Log metadata could use existing PhaseTreeNode for phase lookup
```

## Integration Points
- Called by: Status page UI (JavaScript fetch calls)
- Calls: File system (fs.readFileSync for log content)
- Tests: No existing test files to extend (simple verification via grep/gherkin)

## Implementation Notes

### sprint-loop.sh Changes
1. Create logs directory before main loop:
   ```bash
   mkdir -p "$SPRINT_DIR/logs"
   ```

2. Generate phase-specific log filename based on current pointer:
   - Format: `<phase-idx>-<step-idx>-<subphase-idx>.log` or use phase ID
   - Example: `development-step-0-context.log`

3. Use `tee` to capture output while still displaying:
   ```bash
   # Replace current capture pattern with tee
   LOG_FILE="$SPRINT_DIR/logs/$(get_phase_id).log"
   if [[ -n "$HOOK_CONFIG" ]] && [[ -f "$HOOK_CONFIG" ]]; then
     claude -p "$PROMPT" --dangerously-skip-permissions --hook-config "$HOOK_CONFIG" 2>&1 | tee "$LOG_FILE"
     CLI_EXIT_CODE=${PIPESTATUS[0]}
   else
     claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$LOG_FILE"
     CLI_EXIT_CODE=${PIPESTATUS[0]}
   fi
   ```

### server.ts Endpoint Implementation
1. Add URL pattern matching before switch statement:
   ```typescript
   const logContentMatch = url.match(/^\/api\/logs\/([^/]+)$/);
   const logDownloadMatch = url.match(/^\/api\/logs\/download\/([^/]+)$/);
   const downloadAllMatch = url === '/api/logs/download-all';
   ```

2. Implement handlers:
   - `handleLogContentRequest(res, phaseId)`: Read and return log file content
   - `handleLogDownloadRequest(res, phaseId)`: Set Content-Disposition header for download
   - `handleDownloadAllLogs(res)`: Create zip archive of all logs

### page.ts UI Implementation
1. Add "View Log" button to tree node (similar to skip/retry pattern)
2. Add expandable log viewer section with:
   - ANSI to HTML conversion function
   - Search/filter input
   - Virtual scrolling for large logs (chunk loading)
3. Add download buttons to header

### ANSI to HTML Conversion
```javascript
// Basic ANSI color code mapping
function ansiToHtml(text) {
  const ansiColors = {
    '30': 'color: #000',
    '31': 'color: #f85149',  // red
    '32': 'color: #3fb950',  // green
    '33': 'color: #d29922',  // yellow
    '34': 'color: #58a6ff',  // blue
    '35': 'color: #a371f7',  // magenta
    '36': 'color: #56d4dd',  // cyan
    '37': 'color: #c9d1d9',  // white
    '0': '',  // reset
    '1': 'font-weight: bold',
  };
  // Convert \x1b[XXm sequences to <span style="...">
  return text.replace(/\x1b\[(\d+)m/g, (match, code) => {
    const style = ansiColors[code];
    return style ? `<span style="${style}">` : '</span>';
  });
}
```

### Zip Archive Without External Dependencies
```typescript
// Use Node.js built-in zlib with tar-like structure
// Or implement simple concatenation with headers
// Alternative: Return JSON with all log contents for client-side zip creation
```

### Log File Path Construction
```typescript
// Generate consistent log filename from phase path
function getLogFilePath(sprintDir: string, phaseId: string): string {
  // phaseId format: "development > step-0 > context"
  // Convert to filename: "development-step-0-context.log"
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(sprintDir, 'logs', `${sanitized}.log`);
}
```

## Gherkin Verification Commands
```bash
# Scenario 1: Logs directory creation
grep -q 'mkdir.*logs' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 2: Log file output
grep -E '(tee|>>|>).*\.log' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 3: Log content endpoint
grep -E '/api/logs/[^d]' plugins/m42-sprint/compiler/src/status-server/server.ts | grep -v download

# Scenario 4: Single log download endpoint
grep -q '/api/logs/download/' plugins/m42-sprint/compiler/src/status-server/server.ts

# Scenario 5: All logs download endpoint
grep -q '/api/logs/download-all' plugins/m42-sprint/compiler/src/status-server/server.ts

# Scenario 6: Log viewer UI
grep -qE '(view-log|log-viewer|View Log|expandable.*log)' plugins/m42-sprint/compiler/src/status-server/page.ts

# Scenario 7: ANSI to HTML
grep -qE '(ansi|ANSI|\\x1b|\\033|escape.*color|color.*code)' plugins/m42-sprint/compiler/src/status-server/page.ts

# Scenario 8: TypeScript compilation
cd plugins/m42-sprint/compiler && npm run build
```
