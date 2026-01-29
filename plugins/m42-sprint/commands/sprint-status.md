---
allowed-tools: Bash(ls:* git:worktree:*), Read(*)
argument-hint: "[--all-worktrees]"
description: Show sprint progress dashboard
---

# Sprint Status Dashboard

Display current sprint progress with hierarchical phase/step/sub-phase status.

## Arguments

- `--all-worktrees` - Show sprints across ALL git worktrees in the repository

## Mode Detection

Check if `--all-worktrees` flag was passed in the arguments.

## Multi-Worktree Mode (--all-worktrees)

When `--all-worktrees` is specified:

1. List all git worktrees:
   !`git worktree list --porcelain`

2. For each worktree path found, check for sprints:
   - Look for `.claude/sprints/*/PROGRESS.yaml` in each worktree
   - Read PROGRESS.yaml from each sprint found

3. Display unified status view:

```text
Active Sprints Across Worktrees
================================

* /path/to/main-repo/.claude/sprints/2026-01-20_feature-a/
  Worktree: main (current)
  Working Dir: /path/to/main-repo
  Status: in-progress
  Phase: 3/8 (development)
  Worktree ID: abc123def456

  /path/to/worktree-1/.claude/sprints/2026-01-20_feature-b/
  Worktree: feature-branch
  Working Dir: /path/to/worktree-1
  Status: in-progress
  Phase: 1/8 (preflight)
  Worktree ID: 789ghi012jkl

Total: 2 sprint(s), 2 active
```

4. Status display rules:
   - Mark current worktree with `*` prefix
   - Show worktree branch name (or "main" for main worktree)
   - Show `working-dir` from PROGRESS.yaml
   - Show `worktree-id` for verification
   - Color-code by status: in-progress=yellow, completed=green, blocked=red, paused=cyan, paused-at-breakpoint=magenta

5. Error handling for multi-worktree mode:
   - Skip worktrees that don't have `.claude/sprints/` directory
   - Skip corrupted PROGRESS.yaml files (show error message)
   - Skip worktrees with permission errors (show warning)

## Single Worktree Mode (default)

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
   - `[B]` - paused at breakpoint (awaiting human review)

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

9. Display gate tracking (if `gate-tracking` exists on current phase):
   - Show gate status: `pending`, `passed`, `failed`, `blocked`
   - Show attempt count: "Attempt 2/3"
   - For failed gates, show last output excerpt if available
   - Format:
   ```text
   Gate Check: failed (attempt 2/3)
       Last output: "Error: Tests failed - 3 assertions failed"
   ```

10. Handle edge cases:
   - No sprint found: "No active sprint. Use /init-sprint to create one."
   - No PROGRESS.yaml: Sprint not yet compiled, show "Run /run-sprint to compile and start"
   - Paused: Show "PAUSED" status prominently
   - Paused at breakpoint: Show "PAUSED AT BREAKPOINT" with the phase that triggered it
   - Blocked: Show blocking reason

## Success Criteria

- Hierarchical phase structure displayed with proper indentation
- Current pointer position clearly indicated
- Completion statistics shown from stats field
- Parallel tasks displayed with step-id, phase-id, status, elapsed time, PID and log file location
- Actionable next steps shown based on status

## Multi-Worktree Success Criteria

When `--all-worktrees` is used:
- All worktrees discovered via `git worktree list`
- Sprints found in each worktree's `.claude/sprints/` directory
- Current worktree marked with `*`
- Worktree path and branch shown for each sprint
- worktree-id shown for verification
- Total count of sprints displayed
- Graceful handling of worktrees without sprints or with errors
