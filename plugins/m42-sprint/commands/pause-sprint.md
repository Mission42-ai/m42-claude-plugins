---
allowed-tools: Bash(ls:*), Bash(test:*), Read(*), Edit(*)
argument-hint: ""
description: Pause sprint after current task
model: haiku
---

# Pause Sprint

Request sprint to pause gracefully after current task completes.

## Preflight Checks

1. Find the latest sprint directory:
   !`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

2. From the output above, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`)

3. Check if loop is active by testing for loop-state.md:
   !`test -f .claude/sprints/*/loop-state.md && ls .claude/sprints/*/loop-state.md 2>/dev/null || echo "NO_ACTIVE_LOOP"`

## Context

Using the sprint directory identified in preflight, use the Read tool to read:
- `<sprint-dir>/PROGRESS.yaml` - to get current sprint status

## Task Instructions

1. Verify sprint status is "in-progress"
   - If "not-started": "Sprint has not started. Nothing to pause."
   - If "paused": "Sprint already paused. Use /resume-sprint."
   - If "completed": "Sprint completed. Nothing to pause."

2. Check for active loop:
   - If `loop-state.md` exists in sprint directory: Loop is active
   - Include in output: "Current task will complete before pausing."

3. Edit PROGRESS.yaml to add pause flag:
   ```yaml
   pause-requested: true
   ```

4. Edit SPRINT.yaml to update status:
   ```yaml
   status: "pausing"
   ```

5. Output confirmation:
   ```text
   Pause requested for sprint: {name}

   Current task will complete before pausing.
   Status: pausing

   The sprint loop will stop after the current iteration completes.

   Use /resume-sprint to continue.
   Use /sprint-status to check progress.
   Use /stop-sprint to force immediate stop.
   ```

## Success Criteria

- pause-requested: true set in PROGRESS.yaml
- SPRINT.yaml status changed to "pausing"
- User informed of graceful pause behavior
