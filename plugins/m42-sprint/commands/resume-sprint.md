---
allowed-tools: Bash(ls:*), Read(*), Edit(*), Skill(*)
argument-hint: ""
description: Resume paused sprint execution
model: haiku
---

# Resume Sprint

Resume execution of a paused sprint.

## Preflight Checks

Find the most recent sprint directory:
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context

From the preflight output, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`).

Then use the Read tool to read:
- `<sprint-dir>/PROGRESS.yaml` - to check current status and pause state

## Task Instructions

1. Verify sprint status is "paused"
   - If "in-progress": "Sprint is already running."
   - If "not-started": "Sprint not started. Use /run-sprint."
   - If "completed": "Sprint completed. Nothing to resume."

2. Edit PROGRESS.yaml to clear pause flag:
   ```yaml
   pause-requested: false
   ```
   Or remove the pause-requested field entirely.

3. Edit SPRINT.yaml to update status:
   ```yaml
   status: "in-progress"
   ```

4. Output instructions:
   ```text
   Sprint resumed: {name}

   Status: in-progress
   Queue: {queue-count} tasks remaining
   Next task: {next-task-id}

   Run /run-sprint to continue execution.
   ```

## Success Criteria

- pause-requested cleared from PROGRESS.yaml
- SPRINT.yaml status changed to "in-progress"
- User instructed to run /run-sprint to continue
