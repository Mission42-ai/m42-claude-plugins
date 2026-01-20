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
```bash
ls -dt .claude/sprints/*/ 2>/dev/null | head -1
```

## Context

From the preflight output, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`).

Then use the Read tool to read:
- `<sprint-dir>/PROGRESS.yaml` - to check current status

## Task Instructions

1. **Verify sprint status is "paused":**
   - If "in-progress": "Sprint is already running. Use /sprint-status to check."
   - If "not-started": "Sprint not started. Use /run-sprint."
   - If "completed": "Sprint completed. Nothing to resume."

2. **Update PROGRESS.yaml status:**

   Edit PROGRESS.yaml to set status back to "in-progress":
   ```yaml
   status: in-progress
   ```

   Also remove any `pause-requested: true` field if present.

3. **Output instructions:**

   ```text
   Sprint resumed: {name}

   Status: in-progress
   Queue: {queue-count} tasks remaining
   Next task: {next-task-id}

   To start processing tasks:
   /run-sprint {sprint-dir}
   ```

## Notes

The resume command only updates the status. To actually start processing
tasks again, the user needs to run `/run-sprint` which will launch the
TypeScript sprint runtime with fresh context per task.

## Success Criteria

- PROGRESS.yaml status set to "in-progress"
- pause-requested field removed if present
- User instructed to run /run-sprint to continue
