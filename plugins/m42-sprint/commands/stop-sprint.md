---
allowed-tools: Bash(ls:*), Bash(ps:*), Bash(pkill:*), Bash(test:*), Read(*), Edit(*)
description: Stop active sprint loop immediately
model: haiku
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

1. **If no sprint found or status is completed:**

   Output:
   ```
   No active sprint found.

   Sprint loops are created by /run-sprint and automatically cleaned up
   when sprints complete, block, or pause.
   ```

2. **If sprint is in-progress or pausing:**

   a. Update PROGRESS.yaml to set status to "paused":
      ```yaml
      status: paused
      ```

   b. Remove any `pause-requested: true` flag if present

   c. The sprint runtime background process will detect status change
      on next iteration and exit gracefully.

   d. Remove sprint hook from settings:
      ```bash
      # Remove sprint hook from .claude/settings.json
      if [ -f ".claude/settings.json" ]; then
        node -e "
          const fs = require('fs');
          const settings = JSON.parse(fs.readFileSync('.claude/settings.json', 'utf8'));
          if (settings.hooks && settings.hooks.PostToolUse) {
            settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(h =>
              !(h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('sprint-activity-hook')))
            );
            if (settings.hooks.PostToolUse.length === 0) {
              delete settings.hooks.PostToolUse;
            }
            if (Object.keys(settings.hooks).length === 0) {
              delete settings.hooks;
            }
          }
          fs.writeFileSync('.claude/settings.json', JSON.stringify(settings, null, 2) + '\n');
        "
      fi
      ```

   e. If you need immediate termination (process still running),
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
