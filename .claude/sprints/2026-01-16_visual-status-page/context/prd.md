# Visual Status Page for m42-sprint Plugin

## Summary

Create a live, non-interactive web status page that displays sprint progress in real-time. The server watches PROGRESS.yaml and streams updates via SSE to a browser-based dashboard.

## Architecture

```
Browser                    Status Server              Sprint Loop
   |                            |                          |
   |--- GET / -------------->   |                          |
   |<-- HTML page ------------- |                          |
   |                            |                          |
   |--- GET /events --------->  |                          |
   |    (SSE connection)        |                          |
   |                            |--- fs.watch() ---------> |
   |                            |    PROGRESS.yaml         |
   |<-- data: {update} ------- |<-- file changed -------- |
   |<-- data: {log} ---------- |                          |
```

## Files to Create

### 1. `compiler/src/status-server/status-types.ts`
TypeScript interfaces for status events and server config.

### 2. `compiler/src/status-server/watcher.ts`
File watcher with 100ms debounce for PROGRESS.yaml changes.

### 3. `compiler/src/status-server/transforms.ts`
Convert CompiledProgress to StatusUpdate, generate log entries for changes.

### 4. `compiler/src/status-server/page.ts`
Single HTML page with embedded CSS/JS as template literal:
- Dark theme, monospace font
- Header: sprint name, status badge, progress bar, iteration count
- Left panel: hierarchical phase tree with status icons
- Right top: current task (path, prompt, started time)
- Right bottom: activity feed (log entries)
- Client JS uses EventSource for SSE

### 5. `compiler/src/status-server/server.ts`
HTTP server using Node.js built-in `http`:
- `GET /` - serve HTML page
- `GET /events` - SSE endpoint with keep-alive
- `GET /api/status` - JSON API (optional)

### 6. `compiler/src/status-server/index.ts`
CLI entry point using commander:
```
sprint-status-server <sprint-dir> [--port N] [--host HOST]
```
Writes port to `.sprint-status.port` file for discovery.

### 7. `commands/sprint-watch.md`
New command to start the status server standalone.

## Files to Modify

### 1. `compiler/package.json`
Add new bin entry:
```json
"bin": {
  "sprint-compile": "./dist/index.js",
  "sprint-status-server": "./dist/status-server/index.js"
}
```

### 2. `compiler/src/types.ts`
Add iteration fields to SprintStats:
```typescript
'current-iteration'?: number;
'max-iterations'?: number;
```

### 3. `scripts/sprint-loop.sh` (line ~249)
Write iteration to PROGRESS.yaml:
```bash
yq -i ".stats.\"current-iteration\" = $i" "$PROGRESS_FILE"
yq -i ".stats.\"max-iterations\" = $MAX_ITERATIONS" "$PROGRESS_FILE"
```

### 4. `commands/run-sprint.md`
Add status server startup after launching sprint loop:
```
Live Status: http://localhost:{port}
```

## Implementation Order

1. Create `status-types.ts` (interfaces)
2. Create `watcher.ts` (file watching)
3. Create `transforms.ts` (data conversion)
4. Create `page.ts` (HTML/CSS/JS)
5. Create `server.ts` (HTTP + SSE)
6. Create `index.ts` (CLI)
7. Update `package.json`
8. Update `types.ts` (iteration fields)
9. Update `sprint-loop.sh` (write iteration)
10. Update `run-sprint.md` (show URL)
11. Create `sprint-watch.md` command
12. Build and test

## Key Dependencies

No new dependencies needed:
- `http` - Node.js built-in
- `fs` - Node.js built-in
- `js-yaml` - already installed
- `commander` - already installed

## UI Design

```
+----------------------------------------------------------+
| Sprint: 2026-01-16_improvements           [in-progress]   |
| Progress: =========>              41% | Iteration: 23/50  |
+----------------------------------------------------------+
|                          |                                |
|  Phases                  |  Current Task                  |
|  -------                 |  ------------                  |
|  [x] prepare             |  Path: development > step-2    |
|  [>] development         |        > implement             |
|    [x] step-0 (4/4)      |                                |
|    [>] step-1 (2/4)      |  Prompt:                       |
|      [x] planning        |  Implement the login form      |
|      [>] implement  <--  |  validation...                 |
|      [ ] test            |                                |
|      [ ] document        |  Started: 2m 30s ago           |
|    [ ] step-2 (0/4)      +--------------------------------+
|  [ ] qa                  |  Activity                      |
|  [ ] deploy              |  --------                      |
|                          |  12:34:56 step-0 completed     |
|                          |  12:35:01 step-1 started       |
|                          |  12:35:15 planning completed   |
|                          |  12:35:20 implement started    |
+----------------------------------------------------------+
```

## Verification

1. **Manual test**:
   - Create a test sprint with `--dry-run`
   - Start status server manually
   - Edit PROGRESS.yaml to simulate changes
   - Verify UI updates in real-time

2. **Integration test**:
   - Run actual sprint with `/run-sprint`
   - Open status URL in browser
   - Watch live progress

3. **Build verification**:
   ```bash
   cd plugins/m42-sprint/compiler
   npm run build
   node dist/status-server/index.js --help
   ```
