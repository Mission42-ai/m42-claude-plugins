---
title: Progress Tracking
description: PROGRESS.yaml schema specification, context caching strategy, and state transition rules.
keywords: state, queue, cache, statistics, transitions, yaml
skill: orchestrating-sprints
---

# Progress Tracking

## PROGRESS.yaml Schema

| Field | Type | Description |
|-------|------|-------------|
| `sprint-id` | string | Sprint identifier |
| `status` | enum | not-started, in-progress, completed, blocked |
| `current-task` | string | Active task ID |
| `queue` | list | Ordered task IDs pending |
| `completed` | list | Finished task IDs with timestamps |
| `blocked` | list | Blocked task IDs with reasons |
| `stats` | object | Execution statistics |

## State Transitions

```text
not-started -> in-progress   # First task starts
in-progress -> in-progress   # Task completes, next starts
in-progress -> blocked       # Current task blocked
blocked -> in-progress       # Blocker resolved
in-progress -> completed     # Queue empty, all done
```

## Context Caching Strategy

| Cache Type | Location | Lifecycle |
|------------|----------|-----------|
| Task context | `context/{task-id}.md` | Until task complete |
| Shared context | `context/_shared.md` | Sprint duration |
| Issue data | `context/issues/{num}.json` | 24h TTL |

**Cache on gather:** Store gathered context immediately to avoid re-fetching.

**Share across tasks:** Related tasks (same feature) share context via `_shared.md`.

**Invalidate on change:** Re-gather if source files modified since cache.

## Stats Object

| Field | Description |
|-------|-------------|
| `started-at` | Sprint start timestamp |
| `completed-at` | Sprint end timestamp |
| `tasks-total` | Total task count |
| `tasks-completed` | Completed count |
| `tasks-blocked` | Blocked count |
| `elapsed` | Total elapsed time |
| `avg-task-time` | Average completion time |
