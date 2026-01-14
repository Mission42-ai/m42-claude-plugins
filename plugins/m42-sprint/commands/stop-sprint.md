---
allowed-tools: Bash(ls:*), Bash(find:*), Bash(rm:*), Bash(test:*), Read(*), Edit(*)
description: Stop active sprint loop immediately
model: haiku
---

# Stop Sprint

Forcefully stop an active sprint loop without waiting for task completion.

## Preflight Checks

Find active sprint with loop state:

```bash
find .claude/sprints -name "loop-state.md" -type f 2>/dev/null | head -1
```

## Context

If loop state found, read the first 15 lines to understand current state.

## Task Instructions

1. **If no active loop found:**

   Output:
   ```
   No active sprint loop found.

   Sprint loops are created by /run-sprint and automatically cleaned up
   when sprints complete, block, or pause.
   ```

2. **If active loop found:**

   - Extract sprint directory from loop-state.md path
   - Read current iteration from loop-state.md frontmatter
   - Remove the loop-state.md file:
     ```bash
     rm "$SPRINT_DIR/loop-state.md"
     ```
   - Edit PROGRESS.yaml to set status to "paused"
   - Clear pause-requested flag if set

3. **Output confirmation:**

   ```
   Sprint loop stopped.

   Sprint: {name}
   Was at iteration: {N}
   Status: paused

   To resume: /run-sprint {sprint-dir}
   To view status: /sprint-status
   ```

## Success Criteria

- loop-state.md removed from sprint directory
- PROGRESS.yaml status set to "paused"
- User informed of how to resume
