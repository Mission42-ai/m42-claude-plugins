# Sprint Findings

## Issue: Status Page Doesn't Display Ralph Mode Sprints

**Discovered**: During sprint launch
**Severity**: Medium (sprint runs, but no visibility)
**Status**: PARTIALLY FIXED (Iteration 2)

### Problem
The status server UI was built for phase-based workflows and doesn't render Ralph mode sprints properly:

- `phaseTree: []` - empty because Ralph uses `dynamic-steps` not `phases`
- `totalPhases: 0` - Ralph is goal-driven, not phase-driven
- `currentTask: null` - no current task rendering for Ralph mode

### Fix Applied (Iteration 2)
Updated the status server data transformation layer to support Ralph mode:

**Files changed:**
- `plugins/m42-sprint/compiler/src/status-server/status-types.ts`
  - Added 'task' type to PhaseTreeNode
  - Added `mode` and `goal` fields to SprintHeader

- `plugins/m42-sprint/compiler/src/status-server/transforms.ts`
  - Added `countRalphTasks()` for counting dynamic-steps
  - Added `buildRalphTaskTree()` for converting dynamic-steps to tree nodes
  - Updated `countPhases()` to detect mode and delegate appropriately
  - Updated `toStatusUpdate()` to:
    - Detect Ralph vs standard mode
    - Include mode and goal in header
    - Build appropriate tree (tasks vs phases)

**API Response (now includes Ralph data):**
```json
{
  "header": {
    "sprintId": "2026-01-18_m42-sprint-refactor",
    "status": "in-progress",
    "mode": "ralph",
    "goal": "Refactor and harden...",
    "currentIteration": 2,
    "completedPhases": 0,
    "totalPhases": 0
  },
  "phaseTree": [
    { "id": "step-1", "label": "...", "type": "task", "status": "completed" }
  ],
  "currentTask": null
}
```

### Still Needed (UI Layer)
The data layer now provides Ralph-aware data. The frontend (page.ts) needs updates:
1. Conditional sidebar title ("Active Tasks" vs "Phase Tree")
2. Different rendering for task nodes vs phase nodes
3. Goal display in header area
4. Hook task status display

### Workaround (still valid)
Monitor via CLI:
```bash
yq '.status, .stats, ."dynamic-steps"' PROGRESS.yaml
tail -f transcripts/iteration-*.jsonl | jq '.type'
```

---

## Issue: Preflight Check Failed for Ralph Mode

**Discovered**: During sprint launch
**Severity**: High (blocked sprint start)
**Status**: FIXED

### Problem
The preflight-check.sh script required `phases` field, but Ralph mode uses `goal` instead.

### Fix Applied
Updated `/plugins/m42-sprint/scripts/preflight-check.sh` to check for mode-specific required fields:
- Standard mode: requires `phases`
- Ralph mode: requires `goal`
