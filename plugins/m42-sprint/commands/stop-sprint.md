---
allowed-tools: Bash(ls:*), Bash(ps:*), Bash(pkill:*), Bash(test:*), Read(*), Edit(*)
description: Stop active sprint loop immediately
---

# Stop Sprint

Forcefully stop an active sprint loop immediately.

## Preflight Checks

1. Find the latest sprint directory:
   ```bash
   ls -dt .claude/sprints/*/ 2>/dev/null | head -1
   ```

2. Check if PROGRESS.yaml exists in that directory

## Context

Read `<sprint-dir>/PROGRESS.yaml` to get current status.

## Task Instructions

1. **If no sprint found or status is completed/blocked/needs-human/paused/paused-at-breakpoint:**

   Output:
   ```
   No active sprint found (or already paused).

   Sprint loops are created by /run-sprint and automatically cleaned up
   when sprints complete, block, pause, or need human intervention.
   ```

2. **If sprint is in-progress:**

   a. Update PROGRESS.yaml to set status to "paused":
      ```yaml
      status: paused
      ```

   b. Add a `pause-reason` field:
      ```yaml
      pause-reason: "Stopped by user via /stop-sprint"
      ```

   c. The sprint runtime background process will detect status change
      on next iteration and exit gracefully.

   d. If you need immediate termination (process still running),
      the background task can be killed via `/tasks` command.

3. **Output confirmation:**

   ```
   Sprint stopped.

   Sprint: {name}
   Directory: {sprint-dir}
   Status: paused

   The sprint loop will exit on its next status check.

   To resume: /run-sprint {sprint-dir}
   To view status: /sprint-status
   ```

## Notes on Background Tasks

The sprint loop runs as a background task. It checks PROGRESS.yaml status
after each task iteration. Setting status to "paused" causes it to exit
gracefully within seconds (at most, after the current task completes).

For truly immediate termination, users can:
1. Use `/tasks` to find the background task ID
2. Use `KillShell` to terminate it

## Success Criteria

- PROGRESS.yaml status set to "paused"
- User informed of how to resume
- Sprint loop will exit gracefully
