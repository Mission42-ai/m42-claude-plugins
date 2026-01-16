# Task Context: custom-refactor-sprint-command-workflow

## Current Implementation Analysis

### setup-sprint-loop.sh (lines 87-132)
- Hardcoded 6-phase workflow in PROMPT variable
- Phases: Context, Planning, Execution, Quality, Progress, Learning
- Loop control at end: pause/complete/blocked checks + "continue to next task"

### Issues Identified
1. **Hardcoded workflow** - All sprints forced into dev workflow
2. **No task-specific commands** - Tasks can't define their own workflow
3. **Inline continuation** - "Otherwise: continue to next task" prevents summary+exit pattern
4. **Inflexible** - Can't support docs sprints, cleanup sprints, etc.

## Desired Architecture

### Task Schema Enhancement
Add optional `command` field to PROGRESS.yaml tasks:
```yaml
- id: implement-issue-42
  type: implement-issue
  command: /implement-issue  # NEW: task-specific workflow provider
  issue-number: 42
```

### Minimal Loop Prompt
Replace 6-phase workflow with:
1. Read PROGRESS.yaml queue[0]
2. If task.command exists, invoke it for workflow instructions
3. Execute those instructions
4. Output summary and END TURN (no inline continuation)

### Loop Control (UNCHANGED)
- Check pause-requested → SPRINT PAUSED
- Queue empty → SPRINT COMPLETE
- Task blocked → SPRINT BLOCKED
- (Remove "continue to next task" - stop hook handles iteration)

## Files to Modify
- `plugins/m42-sprint/scripts/setup-sprint-loop.sh` (lines 87-132)
