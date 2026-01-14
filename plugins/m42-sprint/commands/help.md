---
description: "Show sprint plugin help and available commands"
model: haiku
---

# M42 Sprint Plugin Help

Please explain the following to the user:

## What is Sprint?

The M42 Sprint plugin provides autonomous task processing for development workflows.
It processes a queue of tasks sequentially, with each iteration working on one task
until completion.

**Core concept:**
- Define a sprint with tasks in a queue
- Run the sprint to start autonomous processing
- Each task is executed using a 6-phase workflow
- Progress is tracked in PROGRESS.yaml
- Sprint continues until complete, blocked, or paused

## Available Commands

### Sprint Lifecycle

| Command | Description |
|---------|-------------|
| `/start-sprint <name>` | Initialize new sprint directory structure |
| `/run-sprint <dir> [--max-iterations N]` | Start sprint execution loop |
| `/pause-sprint` | Pause gracefully after current task |
| `/resume-sprint` | Resume a paused sprint |
| `/stop-sprint` | Forcefully stop active loop |
| `/sprint-status` | Show progress dashboard |

### Task Management

| Command | Description |
|---------|-------------|
| `/add-task issue <num>` | Add GitHub issue to queue |
| `/add-task refactor <path> --goal "..."` | Add refactor task |
| `/add-task docs <path> --changes "..."` | Add documentation task |
| `/add-task custom --desc "..." --done "..."` | Add custom task |
| `/import-tasks issues --label <label>` | Bulk import by label |

## Quick Start Example

```
# 1. Create a sprint
/start-sprint auth-feature

# 2. Add tasks
/add-task issue 123
/add-task refactor src/auth/ --goal "Migrate to new patterns"

# 3. Run the sprint
/run-sprint .claude/sprints/2026-01-15_auth-feature --max-iterations 20

# 4. Check progress
/sprint-status
```

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_sprint-name/
  SPRINT.yaml       # Configuration and goals
  PROGRESS.yaml     # Task queue and execution state
  loop-state.md     # Active loop state (when running)
  context/          # Cached task context
  artifacts/        # Generated outputs
```

## Task Types

| Type | Purpose | Done-When |
|------|---------|-----------|
| `implement-issue` | GitHub issue implementation | PR merged or issue closed |
| `refactor` | Code improvement | Tests pass, goal achieved |
| `update-docs` | Documentation updates | Docs validated |
| `custom` | Arbitrary work | Custom criteria met |

## Loop Mechanism

The sprint uses a stop-hook mechanism for continuous task processing:

1. Claude receives the sprint processing prompt
2. Executes one task from the queue
3. Attempts to exit
4. Stop hook intercepts and feeds same prompt back
5. Claude sees updated PROGRESS.yaml with next task
6. Continues until completion promise detected

**Completion Promises:**
- `<promise>SPRINT COMPLETE</promise>` - All tasks done
- `<promise>SPRINT BLOCKED</promise>` - Task cannot proceed
- `<promise>SPRINT PAUSED</promise>` - Pause requested

## When to Use Sprint

**Good for:**
- Processing multiple related tasks
- Autonomous development workflows
- Tasks with clear completion criteria
- Batch implementation of issues

**Not good for:**
- Single quick tasks (just do them directly)
- Tasks requiring human decisions mid-execution
- Unclear requirements

## Tips

- Always set `--max-iterations` as a safety limit
- Use `/pause-sprint` for graceful stops
- Use `/stop-sprint` for immediate stops
- Check `/sprint-status` to monitor progress
- Keep sprints focused: 5-10 related tasks
