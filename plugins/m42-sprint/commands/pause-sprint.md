---
allowed-tools: Bash(ls:*), Bash(test:*), Read(*), Edit(*)
argument-hint: ""
description: Pause sprint after current task
---

# Pause Sprint

Request sprint to pause gracefully after current task completes.

## Preflight Checks

1. Find the latest sprint directory:
   ```bash
   ls -dt .claude/sprints/*/ 2>/dev/null | head -1
   ```

2. Check if PROGRESS.yaml exists in that directory

## Context

Using the sprint directory identified in preflight, use the Read tool to read:
- `<sprint-dir>/PROGRESS.yaml` - to get current sprint status

## Task Instructions

1. **Verify sprint status is "in-progress":**
   - If "not-started": "Sprint has not started. Nothing to pause."
   - If "paused": "Sprint already paused. Use /resume-sprint to continue."
   - If "completed": "Sprint completed. Nothing to pause."

2. **Set status to paused:**

   Edit PROGRESS.yaml to set:
   ```yaml
   status: paused
   ```

   The sprint runtime background process checks PROGRESS.yaml status after
   each task iteration. When it sees "paused", it exits gracefully.

3. **Output confirmation:**

   ```text
   Pause requested for sprint: {name}

   Current task will complete before pausing.
   Status: paused

   The sprint loop will stop after the current iteration completes.

   Use /resume-sprint to continue.
   Use /sprint-status to check progress.
   Use /stop-sprint for immediate stop (kills task mid-execution).
   ```

## How Pausing Works

The sprint loop follows the Ralph Loop pattern with fresh context per task.
It runs as a background TypeScript runtime that:

1. Invokes `claude -p` for ONE task
2. Waits for Claude to complete and exit
3. Checks PROGRESS.yaml status
4. If status is "paused" → exits gracefully
5. Otherwise → continues to next task

Setting status to "paused" causes the loop to exit after the current
task completes (at the status check step).

## Success Criteria

- PROGRESS.yaml status set to "paused"
- User informed of graceful pause behavior
- User given options for resuming, checking status, or forcing stop
