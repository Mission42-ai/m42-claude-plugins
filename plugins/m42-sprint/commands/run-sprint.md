---
allowed-tools: Bash(ls:*), Read(*), Edit(*), Skill(*)
argument-hint: [--max-iterations N]
description: Start ralph-loop sprint execution
model: sonnet
---

# Run Sprint Command

Starts ralph-loop to process the sprint task queue sequentially.

## Preflight Checks

!`ls -d sprints/*/PROGRESS.yaml 2>/dev/null | tail -1 || echo "NO_SPRINT_FOUND"`

!`if [ -f "$(ls -d sprints/*/PROGRESS.yaml 2>/dev/null | tail -1)" ]; then cat "$(ls -d sprints/*/PROGRESS.yaml 2>/dev/null | tail -1)" | grep -E "^status:|^queue:" | head -5; else echo "status: missing"; fi`

## Validation

Before proceeding, verify:
1. Sprint directory exists with PROGRESS.yaml
2. Queue has at least one task
3. Status is NOT "completed" or "blocked"

If validation fails, report the issue and stop.

## Context

Read current sprint state:
!`SPRINT_DIR=$(ls -d sprints/*/ 2>/dev/null | tail -1) && cat "${SPRINT_DIR}SPRINT.yaml" 2>/dev/null || echo "No SPRINT.yaml found"`

!`SPRINT_DIR=$(ls -d sprints/*/ 2>/dev/null | tail -1) && cat "${SPRINT_DIR}PROGRESS.yaml" 2>/dev/null || echo "No PROGRESS.yaml found"`

Load the orchestrating-sprints and task-execution skills for workflow guidance.

## Task Instructions

1. **Update Sprint Status**
   - Set SPRINT.yaml status to "in-progress" if currently "not-started"
   - Set PROGRESS.yaml current-task to queue[0]

2. **Determine Max Iterations**
   - Use --max-iterations from argument: $ARGUMENTS
   - Or use default from SPRINT.yaml settings.max-iterations
   - Or default to 10 if not specified

3. **Invoke Ralph-Loop**

   Start ralph-loop with the following prompt:

   ```
   Process sprint task queue from [SPRINT_DIRECTORY].

   ## Workflow Per Task

   Read PROGRESS.yaml to get current-task from queue[0].

   Execute task using 6-phase workflow:

   **Phase 1 - Context:**
   - Load task-execution skill
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
   - Set completion promise to match: "SPRINT COMPLETE" or "SPRINT BLOCKED" or "SPRINT PAUSED"

## Success Criteria

- Ralph-loop started successfully
- Sprint status updated to "in-progress"
- Tasks processed sequentially from queue
- Progress persisted to PROGRESS.yaml after each task
- Sprint terminates cleanly on completion, block, or pause
