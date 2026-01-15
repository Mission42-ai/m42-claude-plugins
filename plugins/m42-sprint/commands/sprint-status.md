---
allowed-tools: Bash(ls:*), Read(*)
argument-hint: ""
description: Show sprint progress dashboard
model: haiku
---

# Sprint Status Dashboard

Display current sprint progress with task completion status and statistics.

## Preflight Checks

Find the most recent sprint directory:
!`ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context

From the preflight output, identify the sprint directory path (e.g., `.claude/sprints/YYYY-MM-DD_name/`).

Then use the Read tool to read both:
- `<sprint-dir>/SPRINT.yaml` - sprint configuration
- `<sprint-dir>/PROGRESS.yaml` - progress tracking

## Task Instructions

1. Parse SPRINT.yaml for sprint name, status, and configuration
2. Parse PROGRESS.yaml for queue, completed, blocked, and stats
3. Calculate progress percentage: completed / (completed + queue + blocked)
4. Display formatted dashboard:

```text
Sprint: {name}
Status: {status}
Progress: {completed}/{total} tasks ({percentage}%)

Current Task: {current-task}
Queue: {queue-count} remaining
Completed: {completed-count}
Blocked: {blocked-count}

Tasks:
[x] {completed-task-id} (timestamp)
[>] {current-task-id} (in progress)
[ ] {queued-task-id}
[!] {blocked-task-id} - {reason}

Stats:
  Elapsed: {elapsed}
  Avg Task Time: {avg-task-time}
```

5. Handle edge cases:
   - No sprint found: "No active sprint. Use /start-sprint to create one."
   - Empty queue + no current: Sprint complete or not started
   - Paused: Show "PAUSED" status prominently

## Success Criteria

- Sprint status displayed in readable format
- All queue, completed, and blocked tasks listed
- Progress percentage calculated correctly
- Actionable next steps shown based on status
