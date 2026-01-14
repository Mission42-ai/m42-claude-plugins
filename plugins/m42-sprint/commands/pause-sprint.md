---
allowed-tools: Read(*), Edit(*)
argument-hint: ""
description: Pause sprint after current task
model: haiku
---

# Pause Sprint

Request sprint to pause gracefully after current task completes.

## Preflight Checks

!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

!`SPRINT_DIR=$(ls -dt .claude/sprints/*/ 2>/dev/null | head -1); grep "^status:" "$SPRINT_DIR/SPRINT.yaml" 2>/dev/null || echo "status: unknown"`

## Context

!`SPRINT_DIR=$(ls -dt .claude/sprints/*/ 2>/dev/null | head -1); cat "$SPRINT_DIR/PROGRESS.yaml" 2>/dev/null || echo "No PROGRESS.yaml"`

## Task Instructions

1. Verify sprint status is "in-progress"
   - If "not-started": "Sprint has not started. Nothing to pause."
   - If "paused": "Sprint already paused. Use /resume-sprint."
   - If "completed": "Sprint completed. Nothing to pause."

2. Edit PROGRESS.yaml to add pause flag:
   ```yaml
   pause-requested: true
   ```

3. Edit SPRINT.yaml to update status:
   ```yaml
   status: "pausing"
   ```

4. Output confirmation:
   ```text
   Pause requested for sprint: {name}

   Current task will complete before pausing.
   Status: pausing

   Use /resume-sprint to continue.
   Use /sprint-status to check progress.
   ```

## Success Criteria

- pause-requested: true set in PROGRESS.yaml
- SPRINT.yaml status changed to "pausing"
- User informed of graceful pause behavior
