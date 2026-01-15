---
name: orchestrating-sprints
description: Manages development sprints with ralph-loop driven task queue processing. Supports polymorphic task types (implement-issue, refactor, update-docs, custom). This skill should be used when starting sprints, managing task queues, or tracking sprint progress. Triggers on "start sprint", "create sprint", "run sprint", "sprint status", "add task", "import tasks".
---

# Sprint Orchestration

Manages development sprints through ralph-loop task queue processing with polymorphic task types and persistent progress tracking.

## Sprint Structure

```text
sprints/
  YYYY-MM-DD_sprint-name/
    SPRINT.yaml        # Sprint config and metadata
    PROGRESS.yaml      # Task queue and execution state
    context/           # Cached context for tasks
    artifacts/         # Generated outputs
```

## Task Types

| Type | Purpose | Required Params | Done-When |
|------|---------|-----------------|-----------|
| `implement-issue` | GitHub issue implementation | `issue-number` | PR merged or issue closed |
| `refactor` | Code improvement | `target-path`, `goal` | Tests pass, goal achieved |
| `update-docs` | Documentation updates | `doc-path`, `changes` | Docs updated, validated |
| `custom` | Arbitrary work | `description`, `done-when` | Custom criteria met |

## Sprint Lifecycle

1. **Initialize** - Create sprint directory with SPRINT.yaml and PROGRESS.yaml
2. **Import tasks** - Add tasks from GitHub issues, manual entry, or batch import
3. **Start ralph-loop** - Begin automated task processing
4. **Execute** - Ralph-loop processes tasks sequentially, caching context
5. **Track** - PROGRESS.yaml updated after each task completion
6. **Complete** - All tasks done or sprint time-boxed

## Commands

| Command | Action |
|---------|--------|
| `start sprint <name>` | Initialize new sprint directory |
| `add task <type>` | Add single task to queue |
| `import tasks` | Batch import from GitHub or file |
| `sprint status` | Show current progress |
| `run sprint` | Start ralph-loop processing |

## Ralph Loop Integration

Sprint execution uses the Ralph Loop pattern for autonomous task processing with **fresh context per task**:

```yaml
# PROGRESS.yaml task queue drives the sprint loop
status: in-progress
queue:
  - id: implement-issue-42
    type: implement-issue
    ...
  - id: refactor-auth-module
    type: refactor
    ...
```

The sprint loop is a bash script that:
1. Invokes `claude -p` for ONE task (fresh context)
2. Waits for Claude to complete and exit
3. Checks PROGRESS.yaml status
4. Continues to next task or exits based on status

This ensures 100% context utilization - no accumulated context between tasks.

## References

- `references/sprint-setup.md` - Directory structure and initialization
- `references/task-types.md` - Task type specifications and params
- `references/progress-tracking.md` - PROGRESS.yaml schema and state management

## Assets

- `assets/sprint-template.yaml` - SPRINT.yaml template
- `assets/progress-template.yaml` - PROGRESS.yaml template
- `assets/task-list-template.yaml` - Example task definitions

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Sprint loop exits early | Missing PROGRESS.yaml or malformed task | Validate YAML syntax, ensure queue has valid tasks |
| Task stuck in queue | Incomplete done-when criteria | Check task completion criteria, manually update status if needed |
| Context not cached | First run or cache invalidated | Normal behavior; context rebuilds on next task |
| Sprint status stale | PROGRESS.yaml not updated | Re-run `sprint status` or check file permissions |
| Import fails | Invalid issue numbers or permissions | Verify GitHub CLI auth (`gh auth status`), check issue exists |
| yq not found | yq not installed | Install yq: `brew install yq` (macOS) or `snap install yq` (Linux) |

**Recovery Procedures:**
- Task failure: Update task status to `blocked`, add `blocked-reason`, continue with next task
- Sprint abort: Set sprint status to `aborted` in PROGRESS.yaml, document reason
- Resume after error: Fix underlying issue, run `/run-sprint` to continue from current task
