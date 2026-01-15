---
allowed-tools: Bash(ls:*), Bash(test:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-sprint-loop.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/sprint-loop.sh:*), Read(*), Edit(*)
argument-hint: <sprint-directory> [--max-iterations N] [--dry-run]
description: Start sprint execution loop (fresh context per task)
model: sonnet
---

# Run Sprint Command

Starts the sprint loop to process the task queue with **fresh context per task**.

Each task iteration invokes Claude CLI as a separate process, ensuring 100% context
utilization with no accumulated context between tasks. This follows the Ralph Loop
pattern: "a dumb bash loop that keeps restarting the agent."

## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml and PROGRESS.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum loop iterations (default: 30)
   - `--dry-run` - Preview tasks without executing (read-only mode)

If no sprint directory is provided, output this error and stop:
```
Error: Sprint directory path is required.

Usage: /run-sprint <sprint-directory> [--max-iterations N] [--dry-run]

Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 50
Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --dry-run
```

## Preflight Checks

Using the parsed SPRINT_DIR from arguments:

1. **Directory exists**: `test -d "$SPRINT_DIR"`
2. **SPRINT.yaml exists**: `test -f "$SPRINT_DIR/SPRINT.yaml"`
3. **PROGRESS.yaml exists**: `test -f "$SPRINT_DIR/PROGRESS.yaml"`

If any check fails, report the specific issue and stop.

## Validation

Read PROGRESS.yaml and verify:
1. Queue has at least one task (queue is not empty)
2. Status is NOT "completed" or "blocked"

If validation fails, report the issue and stop.

## Context

Read current sprint state from the provided directory:

1. Read `$SPRINT_DIR/SPRINT.yaml` for sprint configuration
2. Read `$SPRINT_DIR/PROGRESS.yaml` for current progress and queue

## Task Instructions

### If --dry-run flag is present:

Display the task queue preview WITHOUT modifying any files:

```
Dry Run: Sprint Preview
========================

Sprint: {sprint-name}
Directory: {sprint-dir}
Status: {current-status}

Tasks to Execute (in order):
-----------------------------
1. [{task-type}] {task-id}
   {task-description or title}
   Priority: {priority}

2. [{task-type}] {task-id}
   {task-description or title}
   Priority: {priority}

... (list all tasks in queue)

Summary:
- Total tasks: {count}
- Estimated iterations: {count} (1 per task)

To start execution, run without --dry-run:
  /run-sprint {sprint-dir} --max-iterations {suggested-limit}
```

Then STOP - do not start the loop or modify any files.

### If --dry-run flag is NOT present:

1. **Run Setup Script**

   Execute the setup script to validate and prepare the sprint:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/setup-sprint-loop.sh" "$SPRINT_DIR" --max-iterations [N]
   ```

   Where [N] is the determined max iterations value (default: 30).

2. **Launch Sprint Loop**

   Execute the sprint loop as a **background task**:

   ```bash
   # Launch sprint loop in background
   "${CLAUDE_PLUGIN_ROOT}/scripts/sprint-loop.sh" "$SPRINT_DIR" --max-iterations [N]
   ```

   Use `run_in_background: true` when calling the Bash tool. This allows:
   - User to continue using Claude Code while sprint runs
   - Progress monitoring via `/sprint-status`
   - Output checking via TaskOutput tool

3. **Report Launch Status**

   After launching, inform the user:

   ```
   Sprint Loop Launched
   ====================

   Sprint: {sprint-name}
   Directory: {sprint-dir}
   Background Task ID: {task_id}

   Each task runs with FRESH context (no accumulation).

   Monitor progress:
   - /sprint-status - View PROGRESS.yaml status
   - TaskOutput({task_id}) - View loop output

   Stop the sprint:
   - /stop-sprint - Terminate the loop
   - /pause-sprint - Request graceful pause
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
                 ▼
┌────────────────────────────────────────────┐
│ sprint-loop.sh starts in background        │
│ (controls iteration, monitors status)      │
└────────────────┬───────────────────────────┘
                 │
        ┌────────┴────────┐
        │  BASH LOOP      │
        │  (iteration N)  │
        └────────┬────────┘
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
- Task queue displayed in execution order
- All task details shown (type, id, description, priority)
- No files modified
- Clear instructions to run without --dry-run

### For normal execution:
- Sprint directory path correctly parsed from arguments
- SPRINT.yaml and PROGRESS.yaml validated
- Sprint loop launched in background
- Task ID returned for monitoring
- User informed how to check progress and stop
