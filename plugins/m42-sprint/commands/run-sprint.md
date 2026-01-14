---
allowed-tools: Bash(ls:*), Bash(test:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-sprint-loop.sh:*), Read(*), Edit(*)
argument-hint: <sprint-directory> [--max-iterations N]
description: Start sprint execution loop
model: sonnet
---

# Run Sprint Command

Starts the sprint loop to process the task queue sequentially.

## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml and PROGRESS.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum loop iterations (default: 10)

If no sprint directory is provided, output this error and stop:
```
Error: Sprint directory path is required.

Usage: /run-sprint <sprint-directory> [--max-iterations N]

Example: /run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 30
```

## Preflight Checks

Using the parsed SPRINT_DIR from arguments:

1. **Directory exists**: `test -d "$SPRINT_DIR"`
2. **SPRINT.yaml exists**: `test -f "$SPRINT_DIR/SPRINT.yaml"`
3. **PROGRESS.yaml exists**: `test -f "$SPRINT_DIR/PROGRESS.yaml"`
4. **No active loop**: `test ! -f "$SPRINT_DIR/loop-state.md"`

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

1. **Update Sprint Status**
   - Set PROGRESS.yaml status to "in-progress" if currently "not-started"
   - Set PROGRESS.yaml current-task to the first task ID in queue
   - Record stats.started-at timestamp if not set

2. **Determine Max Iterations**
   - Use --max-iterations from arguments if provided
   - Or default to 10 if not specified

3. **Start Sprint Loop**

   Execute the setup script to initialize the sprint loop:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/setup-sprint-loop.sh" "$SPRINT_DIR" --max-iterations [N]
   ```

   Where [N] is the determined max iterations value.

4. **Work on Sprint**

   After the loop is initialized, begin processing tasks. When you try to exit,
   the stop hook will feed the same prompt back for the next iteration.

   CRITICAL: Output one of these promises ONLY when the condition is TRUE:
   - `<promise>SPRINT COMPLETE</promise>` - All tasks done, queue empty
   - `<promise>SPRINT BLOCKED</promise>` - Current task cannot proceed
   - `<promise>SPRINT PAUSED</promise>` - Pause was requested

## Success Criteria

- Sprint directory path correctly parsed from arguments
- SPRINT.yaml and PROGRESS.yaml validated
- Sprint loop initialized with correct parameters
- Sprint status updated to "in-progress"
- Tasks processed sequentially from queue
- Progress persisted to PROGRESS.yaml after each task
- Sprint terminates cleanly on completion, block, or pause
