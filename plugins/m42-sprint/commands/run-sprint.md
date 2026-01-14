---
allowed-tools: Bash(ls:*), Bash(test:*), Read(*), Edit(*), Skill(*)
argument-hint: <sprint-directory> [--max-iterations N]
description: Start ralph-loop sprint execution
model: sonnet
---

# Run Sprint Command

Starts ralph-loop to process the sprint task queue sequentially.

## Argument Parsing

The first argument MUST be the sprint directory path. Parse $ARGUMENTS to extract:

1. **Sprint Directory Path** (REQUIRED): The path to the sprint directory
   - Example: `.claude/sprints/2026-01-15_my-sprint`
   - Must contain SPRINT.yaml and PROGRESS.yaml

2. **Options** (OPTIONAL):
   - `--max-iterations N` - Maximum ralph-loop iterations (default: 10)

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

Load the orchestrating-sprints skill for workflow guidance.

## Task Instructions

1. **Update Sprint Status**
   - Set PROGRESS.yaml status to "in-progress" if currently "not-started"
   - Set PROGRESS.yaml current-task to the first task ID in queue

2. **Determine Max Iterations**
   - Use --max-iterations from arguments if provided
   - Or default to 10 if not specified

3. **Invoke Ralph-Loop**

   Use the Skill tool to invoke ralph-loop with the following:

   ```
   Skill("m42-ralph-loop:ralph-loop", args="--max-iterations [N] --completion-promise 'SPRINT COMPLETE|SPRINT BLOCKED|SPRINT PAUSED' --task '[PROMPT]'")
   ```

   Where [PROMPT] is:

   ```
   Process sprint task queue from [SPRINT_DIR].

   ## Workflow Per Task

   Read PROGRESS.yaml to get current-task from queue[0].

   Execute task using 6-phase workflow:

   **Phase 1 - Context:**
   - Load task-execution skill if needed
   - Read task definition from PROGRESS.yaml
   - Gather context for task type (issue data, target files, etc.)
   - Cache context in sprint context/ directory

   **Phase 2 - Planning:**
   - Create TodoWrite breakdown with 15-30 min granularity
   - Identify parallelizable work units

   **Phase 3 - Execution:**
   - Implement the task following task-type patterns
   - Make atomic commits with task ID reference
   - Delegate to subagents where appropriate

   **Phase 4 - Quality:**
   - Run: npm run build
   - Run: npm run typecheck
   - Run: npm run lint
   - Run: npm run test
   - If any fail, fix issues before proceeding

   **Phase 5 - Progress:**
   - Remove task from queue in PROGRESS.yaml
   - Add task to completed with timestamp
   - Update stats (tasks-completed count)

   **Phase 6 - Learning:**
   - Document any blockers encountered
   - Record patterns discovered
   - Note process improvements

   ## Loop Control

   After completing a task:
   - Check pause flag in PROGRESS.yaml; if true: <promise>SPRINT PAUSED</promise>
   - If queue is empty: <promise>SPRINT COMPLETE</promise>
   - If task is blocked: update status to blocked, add to blocked list, <promise>SPRINT BLOCKED</promise>
   - Otherwise: continue to next task in queue
   ```

4. **Configure Ralph-Loop Options**
   - Set --max-iterations from determined value
   - Set completion promise to: "SPRINT COMPLETE|SPRINT BLOCKED|SPRINT PAUSED"

## Success Criteria

- Sprint directory path correctly parsed from arguments
- SPRINT.yaml and PROGRESS.yaml located using provided path
- Ralph-loop started successfully with correct sprint directory
- Sprint status updated to "in-progress"
- Tasks processed sequentially from queue
- Progress persisted to PROGRESS.yaml after each task
- Sprint terminates cleanly on completion, block, or pause
