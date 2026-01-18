---
allowed-tools: Bash(ls:*), Bash(test:*), Bash(grep:*), Bash(cat:*), Bash(sleep:*), Bash(rm:*), Bash(node:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/sprint-loop.sh:*), Read(*), Edit(*)
argument-hint: <sprint-directory> [--max-iterations N] [--dry-run] [--recompile] [--no-status] [--no-browser]
description: Start sprint execution loop (fresh context per task)
model: sonnet
---

# Run Sprint Command

Starts the sprint loop to process the workflow phases with **fresh context per task**.

Each task iteration invokes Claude CLI as a separate process, ensuring 100% context
utilization with no accumulated context between tasks. This follows the Ralph Loop
pattern: "a dumb bash loop that keeps restarting the agent."

## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum loop iterations (default: unlimited, use 0 for unlimited)
   - `--dry-run` - Preview tasks without executing (read-only mode)
   - `--recompile` - Force recompilation even if PROGRESS.yaml exists
   - `--no-status` - Skip launching the live status server
   - `--no-browser` - Disable automatic browser opening when status server starts

If no sprint directory is provided, output this error and stop:
```
Error: Sprint directory path is required.

Usage: /run-sprint <sprint-directory> [--max-iterations N] [--dry-run] [--recompile] [--no-status] [--no-browser]

Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 50
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --dry-run
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --recompile
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --no-status
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --no-browser
```

## Preflight Checks

Using the parsed SPRINT_DIR from arguments:

1. **Directory exists**: `test -d "$SPRINT_DIR"`
2. **SPRINT.yaml exists**: `test -f "$SPRINT_DIR/SPRINT.yaml"`

If any check fails, report the specific issue and stop.

## Workflow Compilation

Check if SPRINT.yaml uses the new workflow format (has `workflow:` and `steps:` keys):

```bash
# Check if SPRINT.yaml has workflow format
grep -q '^workflow:' "$SPRINT_DIR/SPRINT.yaml"
```

If SPRINT.yaml uses workflow format AND (PROGRESS.yaml doesn't exist OR --recompile flag):

1. **Compile the workflow** using the TypeScript compiler:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/index.js" "$SPRINT_DIR" -w ".claude/workflows" -v
   ```

2. Report compilation result:
   - On success: "Workflow compiled successfully. Generated PROGRESS.yaml"
   - On failure: Report errors and stop

## Validation

Read PROGRESS.yaml and verify:
1. Has at least one phase in `phases:` array
2. Status is NOT "completed" or "blocked"

If validation fails, report the issue and stop.

## Context

Read current sprint state from the provided directory:

1. Read `$SPRINT_DIR/SPRINT.yaml` for sprint configuration
2. Read `$SPRINT_DIR/PROGRESS.yaml` for current progress (compiled workflow)

## Task Instructions

### If --dry-run flag is present:

Display the workflow preview WITHOUT modifying any files:

```
Dry Run: Workflow Preview
==========================

Sprint: {sprint-id}
Directory: {sprint-dir}
Status: {current-status}

Workflow Phases:
-----------------
1. [phase] {phase-id}
   {prompt preview...}

2. [for-each] {phase-id}
   Steps ({count}):
     - step-0: {step prompt preview...}
       Sub-phases: planning → implement → test → document
     - step-1: {step prompt preview...}
       Sub-phases: planning → implement → test → document

3. [phase] {phase-id}
   {prompt preview...}

Summary:
- Total phases: {count}
- Total steps: {count}
- Total sub-phases: {count}
- Estimated iterations: {total}

To start execution, run without --dry-run:
  /run-sprint {sprint-dir} --max-iterations {suggested-limit}
```

Then STOP - do not start the loop or modify any files.

### If --dry-run flag is NOT present:

1. **Register Sprint Hooks in Settings**

   Before launching the sprint loop, register the activity logging hook in the project's `.claude/settings.json`. This enables PostToolUse events to be captured and written to `.sprint-activity.jsonl`.

   **Step 1**: Backup existing settings (if not already backed up):
   ```bash
   if [ ! -f ".claude/settings.json.pre-sprint" ]; then
     cp ".claude/settings.json" ".claude/settings.json.pre-sprint" 2>/dev/null || echo '{}' > ".claude/settings.json.pre-sprint"
   fi
   ```

   **Step 2**: Generate the hook configuration and merge into settings:
   ```bash
   # Create hook config for this sprint
   HOOK_COMMAND="bash ${PLUGIN_DIR}/hooks/sprint-activity-hook.sh ${SPRINT_DIR}"

   # Read existing settings or create empty object
   SETTINGS=$(cat .claude/settings.json 2>/dev/null || echo '{}')

   # Merge hook into settings using node (jq alternative)
   node -e "
     const settings = JSON.parse(process.argv[1]);
     settings.hooks = settings.hooks || {};
     settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

     // Add sprint hook if not already present
     const hookCmd = process.argv[2];
     const exists = settings.hooks.PostToolUse.some(h =>
       h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('sprint-activity-hook'))
     );

     if (!exists) {
       settings.hooks.PostToolUse.push({
         matcher: '',
         hooks: [{ type: 'command', command: hookCmd }]
       });
     }

     console.log(JSON.stringify(settings, null, 2));
   " "$SETTINGS" "$HOOK_COMMAND" > .claude/settings.json.tmp && mv .claude/settings.json.tmp .claude/settings.json
   ```

   **Important**: Replace `${PLUGIN_DIR}` and `${SPRINT_DIR}` with their actual absolute paths when generating the command.

   The hook captures PostToolUse events and writes them to `.sprint-activity.jsonl` in the sprint directory, enabling the live activity panel in the status page.

   **Verbosity Configuration**: Set the `SPRINT_ACTIVITY_VERBOSITY` environment variable before launching to control detail level:
   - `minimal` - Tool names only
   - `basic` - Tool names + file paths (default)
   - `detailed` - Full input summaries
   - `verbose` - Complete tool data

   If not set, defaults to "basic".

   Also save the hook config to `.sprint-hooks.json` for reference (this file is informational only):
   ```bash
   cat > "$SPRINT_DIR/.sprint-hooks.json" << HOOKEOF
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "$HOOK_COMMAND"
             }
           ]
         }
       ]
     }
   }
   HOOKEOF
   ```

2. **Launch Sprint Loop**

   Execute the sprint loop as a **background task** with the hook config:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/sprint-loop.sh" "$SPRINT_DIR" --max-iterations [N] --hook-config "$SPRINT_DIR/.sprint-hooks.json"
   ```

   Use `run_in_background: true` when calling the Bash tool. This allows:
   - User to continue using Claude Code while sprint runs
   - Progress monitoring via `/sprint-status`
   - Output checking via TaskOutput tool

3. **Launch Status Server** (unless `--no-status` flag is present)

   After starting the sprint loop, launch the status server in background:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/compiler/dist/status-server/index.js" "$SPRINT_DIR" &
   ```

   Use `run_in_background: true` when calling the Bash tool.

   Wait briefly (up to 2 seconds) for the port file to appear, then read it:

   ```bash
   # Wait for port file to appear (up to 2 seconds)
   for i in 1 2 3 4; do
     if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
       break
     fi
     sleep 0.5
   done

   # Read port if file exists
   if [ -f "$SPRINT_DIR/.sprint-status.port" ]; then
     cat "$SPRINT_DIR/.sprint-status.port"
   fi
   ```

   **Handle status server failures:**
   - If port file doesn't appear after 2 seconds, the status server may have failed
   - Continue with sprint execution (don't block on status server failure)
   - Display warning: "Status server failed to start. Sprint continues without live status."
   - The sprint loop is the critical path; status server is enhancement only

4. **Report Launch Status**

   After launching, inform the user:

   ```
   Sprint Loop Launched
   ====================

   Sprint: {sprint-id}
   Directory: {sprint-dir}
   Background Task ID: {task_id}

   Workflow: {workflow-name}
   Phases: {phase-count}
   Steps: {step-count}

   Live Status: http://localhost:{port}
   (Open in browser for real-time progress)

   Each phase/step runs with FRESH context (no accumulation).

   Monitor progress:
   - /sprint-status - View PROGRESS.yaml status
   - TaskOutput({task_id}) - View loop output

   Stop the sprint:
   - /stop-sprint - Terminate the loop
   - /pause-sprint - Request graceful pause
   ```

   If status server failed to start, omit the "Live Status" line and add a warning:
   ```
   ⚠ Status server not available (sprint continues normally)
   ```

## How the Sprint Loop Works

The sprint loop follows the Ralph Loop pattern:

1. **Bash loop** runs `claude -p` repeatedly
2. **Each invocation** is FRESH with only the task prompt
3. **Agent processes ONE task** and exits
4. **Bash loop checks** PROGRESS.yaml for status
5. **If not done**, starts NEW invocation with fresh context

```
┌─────────────────────────────────────────┐
│ User runs: /run-sprint <sprint-dir>     │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────────┐   ┌──────────────────────────────┐
│ sprint-loop.sh   │   │ sprint-status-server         │
│ (background)     │   │ (background, optional)       │
│                  │   │                              │
│ Controls loop,   │   │ Watches PROGRESS.yaml,       │
│ monitors status  │   │ serves live web status page  │
└────────┬─────────┘   └──────────────────────────────┘
         │
  ┌──────┴──────┐
  │ BASH LOOP   │
  │ (iter N)    │
  └──────┬──────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ claude -p "$(build-prompt)"                │
│                                            │
│ FRESH CONTEXT WINDOW                       │
│ • Loads task prompt only                   │
│ • Processes ONE task                       │
│ • Updates PROGRESS.yaml                    │
│ • Commits changes                          │
│ • EXITS (context cleared)                  │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ Bash loop checks PROGRESS.yaml status      │
│ • completed → exit loop (success)          │
│ • blocked → exit loop (failure)            │
│ • paused → exit loop (success)             │
│ • needs-human → exit loop (intervention)   │
│ • otherwise → continue to iteration N+1    │
└────────────────────────────────────────────┘
```

## Status Values

The sprint loop monitors these PROGRESS.yaml status values:

| Status | Meaning | Loop Action |
|--------|---------|-------------|
| `in-progress` | Tasks being processed | Continue |
| `completed` | All tasks done | Exit (success) |
| `blocked` | Task cannot proceed | Exit (failure) |
| `paused` | User requested pause | Exit (success) |
| `needs-human` | Human decision required | Exit (intervention) |

## Success Criteria

### For --dry-run mode:
- Workflow phases displayed in execution order
- All phases/steps/sub-phases shown
- No files modified
- Clear instructions to run without --dry-run

### For normal execution:
- Sprint directory path correctly parsed from arguments
- Workflow compiled (if needed) from SPRINT.yaml + workflows
- PROGRESS.yaml validated (has phases)
- Sprint loop launched in background
- Status server launched in background (unless --no-status)
- Live status URL displayed (if status server started successfully)
- Task ID returned for monitoring
- User informed how to check progress and stop
