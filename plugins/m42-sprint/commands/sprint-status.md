---
allowed-tools: Bash(ls:*), Read(*)
argument-hint: ""
description: Show sprint progress dashboard
model: haiku
---

# Sprint Status Dashboard

Display current sprint progress with hierarchical phase/step/sub-phase status.

## Preflight Checks

Find the most recent sprint directory:
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context

From the preflight output, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`).

Then use the Read tool to read both:
- `<sprint-dir>/SPRINT.yaml` - sprint configuration
- `<sprint-dir>/PROGRESS.yaml` - progress tracking with phases hierarchy

## Task Instructions

1. Parse SPRINT.yaml for sprint name and configuration
2. Parse PROGRESS.yaml for:
   - `status` - current sprint status
   - `pointer` - current position (phase/step/sub-phase)
   - `phases` - hierarchical structure with completion state
   - `stats` - completion statistics
3. Calculate progress from stats field or count completed phases
4. Display formatted hierarchical dashboard:

```text
Sprint: YYYY-MM-DD_name
Status: in-progress
Progress: 5/12 phases (41%)

Phases:
[x] prepare (completed)
[>] development (in-progress)
    [x] step-1 (4/4 phases)
    [>] step-2 (2/4 phases)
        [x] planning
        [>] implement (current)
        [ ] test
        [ ] document
    [ ] step-3 (0/4 phases)
[ ] qa (pending)
[ ] deploy (pending)
```

5. Status indicators:
   - `[x]` - completed phase/step/sub-phase
   - `[>]` - in-progress (current pointer location)
   - `[ ]` - pending (not yet started)
   - `[!]` - blocked (requires intervention)

6. Show current pointer position prominently:
   - Format: `Current: development > step-2 > implement`

7. Display parallel tasks section (if `parallel-tasks` array exists and is non-empty):
   - Read `parallel-tasks` array from PROGRESS.yaml
   - Status indicators for parallel tasks:
     - `[~]` - running/spawned (in progress, non-blocking)
     - `[x]` - completed successfully
     - `[!]` - failed (exit-code != 0)
   - Display format:
   ```text
   Parallel Tasks:
   [~] step-0-update-docs-1705123456 (running, 2m elapsed)
       Step: step-0
       Phase: update-docs
       PID: 12345 | Log: logs/step-0-update-docs-1705123456.log
   [x] step-1-update-docs-1705123789 (completed, 1m 23s)
       Step: step-1
       Phase: update-docs
   [!] step-2-update-docs-1705124000 (failed, 45s)
       Step: step-2
       Phase: update-docs
       Error: Process exited with code 1
   ```
   - Calculate elapsed time from `spawned-at` to now (for running) or `completed-at` (for completed/failed)
   - Show PID and log-file location only for running/spawned tasks
   - For failed tasks, show the error message if available
   - Access pattern: `yq -r '."parallel-tasks" // []' "$PROGRESS_FILE"`

8. Display stats from PROGRESS.yaml:
   - Phases completed / total
   - Steps completed / total
   - Elapsed time if available

9. Handle edge cases:
   - No sprint found: "No active sprint. Use /start-sprint to create one."
   - No PROGRESS.yaml: Sprint not yet compiled, show "Run /run-sprint to compile and start"
   - Paused: Show "PAUSED" status prominently
   - Blocked: Show blocking reason

## Success Criteria

- Hierarchical phase structure displayed with proper indentation
- Current pointer position clearly indicated
- Completion statistics shown from stats field
- Parallel tasks displayed with step-id, phase-id, status, elapsed time, PID and log file location
- Actionable next steps shown based on status
