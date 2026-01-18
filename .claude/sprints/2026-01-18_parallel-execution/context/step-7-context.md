# Step Context: step-7

## Task
Update commands/sprint-status.md to display parallel task status:

Add new section after step/phase display:
```
Parallel Tasks:
[~] step-0-update-docs-1705123456 (running, 2m elapsed)
    Step: Implement user authentication
    Phase: update-docs
    PID: 12345 | Log: logs/step-0-update-docs-1705123456.log
[x] step-1-update-docs-1705123789 (completed, 1m 23s)
```

Show:
- Task ID, status, elapsed time
- Which step/phase spawned it
- PID and log file location

Reference: context/implementation-plan.md section 4.G

## Related Code Patterns

### Target File: plugins/m42-sprint/commands/sprint-status.md
```markdown
# Current structure (lines 1-81):
# - Preflight checks to find sprint directory
# - Read SPRINT.yaml and PROGRESS.yaml
# - Parse hierarchical phases/steps/sub-phases
# - Display status indicators: [x] completed, [>] in-progress, [ ] pending, [!] blocked
# - Show current pointer position
# - Display stats from PROGRESS.yaml
```

### Similar Status Display Pattern: lines 36-53
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

### Status Indicators Convention: lines 55-59
- `[x]` - completed phase/step/sub-phase
- `[>]` - in-progress (current pointer location)
- `[ ]` - pending (not yet started)
- `[!]` - blocked (requires intervention)
- NEW: `[~]` - running (for parallel tasks)

## Required Imports
### Internal
- No code imports needed (this is a command markdown file)
- Read from PROGRESS.yaml: `parallel-tasks` array

### External
- yq CLI for YAML parsing (used in preflight)
- date command for elapsed time calculation

## Types/Interfaces to Use
```typescript
// From compiler/src/types.ts:106-127
interface ParallelTask {
  id: string;              // e.g., "step-0-update-docs-1705123456"
  'step-id': string;       // "step-0"
  'phase-id': string;      // "update-docs"
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at'?: string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

## Integration Points
- **Data source**: `PROGRESS.yaml` field `parallel-tasks` (array of ParallelTask)
- **Called by**: User via `/sprint-status` command
- **Existing display**: After the phase hierarchy display (line 53)
- **Tests**: Manual verification via sprint execution

## YAML Access Patterns
From sprint-loop.sh (reference implementation):
```bash
# Count running tasks
yq -r '."parallel-tasks" // [] | map(select(.status == "spawned" or .status == "running")) | length' "$PROGRESS_FILE"

# Count failed tasks
yq -r '."parallel-tasks" // [] | map(select(.status == "failed")) | length' "$PROGRESS_FILE"

# Access individual task fields
yq -r '."parallel-tasks"[]' "$PROGRESS_FILE"
```

## Display Format Requirements

### Status Indicators for Parallel Tasks
- `[~]` - running/spawned (in progress, not blocking)
- `[x]` - completed successfully
- `[!]` - failed (exit-code != 0)

### Required Fields per Task
1. **Task ID**: e.g., `step-0-update-docs-1705123456`
2. **Status**: running, completed, failed
3. **Elapsed time**: Calculate from `spawned-at` to now (or `completed-at`)
4. **Step context**: From `step-id` field
5. **Phase context**: From `phase-id` field
6. **PID**: From `pid` field
7. **Log file**: From `log-file` field

### Format Template
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

## Implementation Notes
- Add parallel tasks section AFTER the hierarchical phase display (after line 68)
- Handle empty `parallel-tasks` array gracefully (don't show section if empty)
- Calculate elapsed time from ISO timestamps
- Show PID and log file only for running tasks (not completed/failed)
- For failed tasks, show the error message if available
- Match existing indentation style (4 spaces for sub-items)
- Use the same status indicator style as existing code
