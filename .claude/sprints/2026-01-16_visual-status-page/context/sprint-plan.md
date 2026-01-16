# Sprint Plan: Visual Status Page

## Goal

This sprint creates a live, non-interactive web status page that displays sprint progress in real-time. The status server watches PROGRESS.yaml for changes and streams updates to connected browsers via Server-Sent Events (SSE). This enables users to monitor sprint progress without blocking their terminal, providing a visual dashboard with phase tree, current task, and activity feed.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Status Server System                         │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   sprint-loop.sh │     │  PROGRESS.yaml   │     │  Status Server   │
│                  │────▶│  (File on disk)  │◀────│  (Node.js HTTP)  │
│  Updates status  │     │                  │     │  Watches file    │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                              ┌─────────────────────────────┤
                              │                             │
                              ▼                             ▼
                    ┌──────────────────┐         ┌──────────────────┐
                    │   GET /events    │         │     GET /        │
                    │   (SSE stream)   │         │   (HTML page)    │
                    └────────┬─────────┘         └──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Browser      │
                    │   EventSource    │
                    │   + DOM updates  │
                    └──────────────────┘

New Files (compiler/src/status-server/):
├── status-types.ts    # TypeScript interfaces for server
├── watcher.ts         # File watcher with debounce
├── transforms.ts      # PROGRESS.yaml → StatusUpdate conversion
├── page.ts            # HTML/CSS/JS as template literal
├── server.ts          # HTTP server + SSE endpoint
└── index.ts           # CLI entry point (commander)

Modified Files:
├── compiler/src/types.ts      # Add iteration fields to SprintStats
├── compiler/package.json      # Add bin entry for sprint-status-server
├── scripts/sprint-loop.sh     # Write iteration counts to PROGRESS.yaml
├── commands/run-sprint.md     # Launch status server with sprint loop
└── commands/sprint-watch.md   # New command for standalone server
```

## Integration Points

### 1. Existing Types (compiler/src/types.ts)
- `CompiledProgress` - Main structure to transform for display
- `SprintStats` - Needs new `current-iteration` and `max-iterations` fields
- `PhaseStatus`, `SprintStatus` - Used for status badge colors
- `CompiledTopPhase`, `CompiledStep`, `CompiledPhase` - Phase hierarchy

### 2. Sprint Loop (scripts/sprint-loop.sh)
- Line ~247-249: Add iteration counter writes to PROGRESS.yaml
- Use yq to set `.stats."current-iteration"` and `.stats."max-iterations"`
- These values appear in the status page header

### 3. Package.json (compiler/package.json)
- Add new bin entry: `"sprint-status-server": "./dist/status-server/index.js"`
- Follows existing pattern from `"sprint-compile": "./dist/index.js"`

### 4. Run Sprint Command (commands/run-sprint.md)
- Launch status server after starting sprint loop
- Read port from `.sprint-status.port` file
- Display URL to user

### 5. File Discovery Pattern
- Use `.sprint-status.port` file in sprint directory for port discovery
- Server writes port on startup, deletes on shutdown
- Allows run-sprint command to find and display URL

## Step Success Criteria

### Step 0: Status Types (status-types.ts)
- [ ] `StatusUpdate` interface with sprint state, phase tree, current task
- [ ] `LogEntry` interface with timestamp, type, message
- [ ] `ServerConfig` interface with port, host, sprintDir
- [ ] `SSEEventType` union type: 'status-update' | 'log-entry' | 'keep-alive'
- [ ] Builds without TypeScript errors
- [ ] Interfaces are compatible with `CompiledProgress` from types.ts

### Step 1: File Watcher (watcher.ts)
- [ ] `ProgressWatcher` class using EventEmitter pattern
- [ ] Uses `fs.watch()` for file change detection
- [ ] Implements 100ms debounce using setTimeout
- [ ] Emits 'change' event when file modified
- [ ] Handles file deletion/recreation gracefully
- [ ] Provides `close()` method to stop watching
- [ ] Builds without TypeScript errors

### Step 2: Data Transforms (transforms.ts)
- [ ] `toStatusUpdate(progress: CompiledProgress): StatusUpdate` function
- [ ] Phase tree builder with status indicators
- [ ] Current task locator using `current` pointer
- [ ] Progress percentage calculator (completed/total phases)
- [ ] Log entry generator for status transitions
- [ ] Timestamp formatter (ISO → human-readable)
- [ ] Builds without TypeScript errors

### Step 3: HTML Page (page.ts)
- [ ] `getPageHtml(): string` function returning complete HTML
- [ ] Dark theme with CSS variables
- [ ] Monospace font (system or web-safe)
- [ ] Header: sprint name, status badge, progress bar, iteration
- [ ] Left panel: collapsible phase tree with status icons
- [ ] Right top: current task display (path, prompt, started time)
- [ ] Right bottom: scrolling activity feed (most recent at top)
- [ ] EventSource connection to /events
- [ ] DOM update functions for each section
- [ ] Keep-alive detection with connection status indicator
- [ ] All CSS/JS embedded (no external files)
- [ ] Builds without TypeScript errors

### Step 4: HTTP Server (server.ts)
- [ ] `StatusServer` class with `start()` and `stop()` methods
- [ ] Route: GET / → serve HTML page
- [ ] Route: GET /events → SSE stream with proper headers
- [ ] Route: GET /api/status → JSON API (optional but useful for debugging)
- [ ] SSE keep-alive ping every 15 seconds
- [ ] Client tracking for broadcast
- [ ] Graceful client disconnect handling
- [ ] Integration with watcher and transforms
- [ ] Builds without TypeScript errors

### Step 5: CLI Entry Point (index.ts)
- [ ] Uses commander for CLI parsing
- [ ] Command: `sprint-status-server <sprint-dir> [--port N] [--host HOST]`
- [ ] Default port: 3100
- [ ] Default host: localhost
- [ ] Validates sprint directory exists
- [ ] Validates PROGRESS.yaml exists
- [ ] Writes port to `.sprint-status.port` file
- [ ] Displays server URL on startup
- [ ] Handles SIGINT/SIGTERM for cleanup
- [ ] Deletes port file on shutdown
- [ ] Builds without TypeScript errors

### Step 6: Package.json Update
- [ ] Adds `"sprint-status-server": "./dist/status-server/index.js"` to bin
- [ ] Maintains existing sprint-compile entry
- [ ] Valid JSON after edit

### Step 7: SprintStats Interface Update (types.ts)
- [ ] Adds `'current-iteration'?: number` field
- [ ] Adds `'max-iterations'?: number` field
- [ ] No breaking changes to existing fields
- [ ] Builds without TypeScript errors

### Step 8: Sprint Loop Update (sprint-loop.sh)
- [ ] Writes `.stats."current-iteration" = $i` after each iteration
- [ ] Writes `.stats."max-iterations" = $MAX_ITERATIONS` on start
- [ ] Placed after PROGRESS.yaml validation
- [ ] Valid bash syntax (bash -n check passes)
- [ ] Existing loop behavior unchanged

### Step 9: Run Sprint Command Update (run-sprint.md)
- [ ] Launches sprint-status-server in background
- [ ] Reads port from .sprint-status.port file
- [ ] Displays "Live Status: http://localhost:{port}" message
- [ ] Handles case where status server fails to start
- [ ] Does not break existing dry-run mode

### Step 10: Sprint Watch Command (sprint-watch.md)
- [ ] Follows existing command file format (YAML frontmatter + markdown)
- [ ] Usage: /sprint-watch [sprint-dir]
- [ ] Default: find most recent sprint in .claude/sprints/
- [ ] Starts status server for existing sprint
- [ ] Shows URL and usage instructions

### Step 11: Build and Verify
- [ ] TypeScript build completes without errors
- [ ] `node dist/status-server/index.js --help` works
- [ ] Server starts and serves HTML page
- [ ] SSE connection works in browser
- [ ] File changes trigger updates in browser
- [ ] Manual PROGRESS.yaml edit shows in browser within ~200ms

## Dependencies

```
step-0 (types) ────┐
                   ├──► step-2 (transforms) ────┐
step-1 (watcher)───┘                            ├──► step-4 (server) ──► step-5 (cli)
step-3 (page) ──────────────────────────────────┘           │
                                                            │
step-6 (package.json) ◄─────────────────────────────────────┘

step-7 (types.ts) ──► step-8 (sprint-loop.sh)

step-5 (cli) ──► step-9 (run-sprint.md)
           ├──► step-10 (sprint-watch.md)
           └──► step-11 (build & verify)
```

**Execution Order:**
1. Steps 0, 1, 3 can run in parallel (no dependencies)
2. Step 2 requires step 0
3. Step 4 requires steps 1, 2, 3
4. Step 5 requires step 4
5. Step 6 requires step 5
6. Steps 7-8 are independent of steps 0-6
7. Steps 9-10 require step 5
8. Step 11 requires all previous steps

## Risk Areas

### 1. fs.watch() Platform Differences
- **Risk**: fs.watch() behavior varies between Linux, macOS, and Windows
- **Mitigation**: Use robust debounce, handle multiple events per change
- **Fallback**: If issues arise, could switch to polling with fs.stat()

### 2. SSE Connection Stability
- **Risk**: SSE connections may drop silently on network issues
- **Mitigation**: Implement keep-alive pings, connection status indicator in UI
- **Testing**: Verify reconnection works after brief disconnection

### 3. YAML Parse Errors During Updates
- **Risk**: sprint-loop.sh may be writing PROGRESS.yaml when watcher reads
- **Mitigation**: Catch YAML parse errors, retry after short delay
- **Implementation**: Debounce helps here by waiting for write to complete

### 4. Port Conflicts
- **Risk**: Port 3100 may be in use
- **Mitigation**: Allow --port option, consider auto-incrementing port
- **Future**: Could add port auto-detection in later iteration

### 5. Large Phase Trees
- **Risk**: Very large sprints may have slow DOM updates
- **Mitigation**: Start simple, optimize if needed
- **Current scope**: Likely fine for sprints with <100 phases

### 6. Browser Compatibility
- **Risk**: EventSource not supported in very old browsers
- **Mitigation**: All modern browsers support EventSource since ~2012
- **Target**: Chrome, Firefox, Safari, Edge (modern versions)

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| HTTP Server | Node.js built-in `http` | No dependencies, simple, reliable |
| CLI Parsing | commander | Already used in sprint-compile |
| YAML Parsing | js-yaml | Already a dependency |
| File Watching | fs.watch() | Built-in, efficient |
| Browser Updates | SSE | Simpler than WebSocket, one-way is enough |
| Styling | Embedded CSS | No build step needed, single HTML file |

## Testing Strategy

### Manual Testing Steps (for QA phases):
1. **Build test**: `cd plugins/m42-sprint/compiler && npm run build`
2. **CLI test**: `node dist/status-server/index.js --help`
3. **Start server**: `node dist/status-server/index.js .claude/sprints/<test-sprint>/`
4. **Browser test**: Open http://localhost:3100 in browser
5. **Live update test**: Edit PROGRESS.yaml manually, verify browser updates
6. **Integration test**: Run actual sprint with `/run-sprint`, watch status page

### No Automated Tests (by design)
- QA phases will perform build validation and manual smoke tests
- Unit tests not in current scope (focus on integration)
