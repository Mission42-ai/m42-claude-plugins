---
allowed-tools: Bash(ls:*), Bash(test:*), Bash(cat:*), Bash(sleep:*), Bash(node:*), Read(*)
argument-hint: "[sprint-directory]"
description: Start status server for existing sprint
model: haiku
---

# Sprint Watch Command

Starts the live status server for monitoring an existing sprint's progress without running the sprint loop. Use this to watch a sprint that's already running or to review a completed sprint's status page.

## Argument Parsing

Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (OPTIONAL): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - If not provided, will find the most recent sprint

## Find Sprint Directory

If no sprint directory is provided in arguments, find the most recent one:

```bash
ls -dt .claude/sprints/*/ 2>/dev/null | head -1
```

## Preflight Checks

Using the sprint directory (either provided or discovered):

1. **Directory exists**: `test -d "$SPRINT_DIR"`
2. **PROGRESS.yaml exists**: `test -f "$SPRINT_DIR/PROGRESS.yaml"`

If any check fails:
- No sprint directory found: "No active sprint found. Use /start-sprint to create one."
- Directory doesn't exist: "Sprint directory not found: {path}"
- No PROGRESS.yaml: "PROGRESS.yaml not found. Run /run-sprint first to compile the workflow."

## Context

Read current sprint state:

1. Read `$SPRINT_DIR/SPRINT.yaml` for sprint name
2. Read `$SPRINT_DIR/PROGRESS.yaml` for current status

## Task Instructions

1. **Check for Existing Server**

   Check if a status server is already running for this sprint:

   ```bash
   if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
     cat "$SPRINT_DIR/.sprint-status.port"
   fi
   ```

   If port file exists, read the port and inform user:
   ```
   Status server already running for this sprint.

   Live Status: http://localhost:{port}
   ```

   Then STOP - don't start another server.

2. **Launch Status Server**

   Start the status server in background:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/status-server/index.js" "$SPRINT_DIR" &
   ```

   Use `run_in_background: true` when calling the Bash tool.

3. **Wait for Server Startup**

   Wait for the port file to appear (up to 2 seconds):

   ```bash
   for i in 1 2 3 4; do
     if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
       break
     fi
     sleep 0.5
   done

   if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
     cat "$SPRINT_DIR/.sprint-status.port"
   fi
   ```

4. **Report Status**

   **On success** (port file exists):
   ```
   Sprint Status Server Started
   ============================

   Sprint: {sprint-id}
   Directory: {sprint-dir}
   Status: {current-status}

   Live Status: http://localhost:{port}

   Open the URL in your browser to see:
   - Real-time phase tree with status indicators
   - Current task details and progress
   - Activity feed with recent updates

   The page auto-updates when PROGRESS.yaml changes.

   To stop the server, close this terminal or use Ctrl+C.
   ```

   **On failure** (port file not found):
   ```
   Failed to start status server.

   Possible causes:
   - Port 3100 may be in use
   - PROGRESS.yaml may be invalid
   - Compiler dist may need rebuilding

   Try running manually:
     node plugins/m42-sprint/compiler/dist/status-server/index.js {sprint-dir}
   ```

## Usage Examples

```bash
# Watch most recent sprint
/sprint-watch

# Watch specific sprint
/sprint-watch .claude/sprints/2026-01-15_my-sprint
```

## Success Criteria

- Sprint directory found (explicitly provided or most recent)
- PROGRESS.yaml verified to exist
- Status server launched in background
- Port file detected within timeout
- URL displayed to user with clear instructions
- Handles existing server gracefully (shows existing URL)
