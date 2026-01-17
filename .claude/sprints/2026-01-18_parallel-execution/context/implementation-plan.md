# Parallel Execution for m42-sprint Plugin

## Overview

Add support for non-blocking parallel tasks at the **step level**. The primary use case: after completing a step's main work, spawn a "learning loop" (like documentation update) that runs in background while the next step starts immediately.

## Current Architecture

- **Sequential Ralph Loop**: `sprint-loop.sh` runs one task at a time with fresh context per task
- **Pointer-based navigation**: `current.phase`, `current.step`, `current.sub-phase` tracks position
- **PROGRESS.yaml**: State machine tracking status of all phases/steps/sub-phases
- **Step structure**: Each step has sub-phases from workflow (e.g., plan → implement → test)

## Proposed Design

### 1. Core Concept: Parallel Sub-Phases

Within a step's workflow, mark certain sub-phases as `parallel: true`. These spawn in background, allowing the main loop to advance to the next step.

```
Step 1: Feature A          Step 2: Feature B
├── plan (blocking)        ├── plan (blocking)
├── implement (blocking)   ├── implement (blocking)
├── test (blocking)        ├── test (blocking)
└── docs (parallel) ──────────────────────────────> runs in background
                           └── docs (parallel) ──────> runs in background
                                                        ↓
                                              [wait-for sync point]
```

### 2. Schema Extensions

**WorkflowPhase (types.ts:68-77)**
```typescript
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  // NEW
  parallel?: boolean;        // Run in background, don't block next step
}
```

**CompiledProgress (types.ts:202-211)**
```typescript
export interface CompiledProgress {
  // ... existing fields ...
  'parallel-tasks'?: ParallelTask[];  // Track background tasks
}

export interface ParallelTask {
  id: string;
  'step-id': string;         // Which step spawned this
  'phase-id': string;        // Which sub-phase
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at': string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

**Top-level phase for sync point**
```typescript
export interface WorkflowPhase {
  // ...existing...
  'wait-for-parallel'?: boolean;  // Wait for all parallel tasks to complete
}
```

### 3. Workflow Usage Example

```yaml
# .claude/workflows/feature-with-learning-loop.yaml
name: Feature with Learning Loop
phases:
  - id: development
    for-each: step
    workflow: feature-with-docs   # This workflow has parallel sub-phases

  - id: sync
    prompt: "Verify all documentation updates completed..."
    wait-for-parallel: true       # Block until all parallel tasks done

  - id: qa
    prompt: "Run final QA checks..."
```

```yaml
# .claude/workflows/feature-with-docs.yaml (step workflow)
name: Feature Implementation with Docs
phases:
  - id: plan
    prompt: "Plan implementation for: {{step.prompt}}"

  - id: implement
    prompt: "Implement: {{step.prompt}}"

  - id: test
    prompt: "Test the implementation..."

  - id: update-docs
    prompt: "Update documentation for {{step.prompt}}..."
    parallel: true    # Spawns in background, next step starts immediately
```

### 4. Implementation Changes

#### A. Type Definitions (`compiler/src/types.ts`)

```typescript
// Add to WorkflowPhase (line 68-77)
export interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // NEW: spawn in background
  'wait-for-parallel'?: boolean; // NEW: wait for all parallel tasks
}

// Add new interface
export interface ParallelTask {
  id: string;                    // e.g., "step-0-update-docs-1705123456"
  'step-id': string;             // "step-0"
  'phase-id': string;            // "update-docs"
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at': string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}

// Add to CompiledProgress (line 202-211)
export interface CompiledProgress {
  // ...existing...
  'parallel-tasks'?: ParallelTask[];
}

// Add to CompiledPhase (line 101-119) - for sub-phases
export interface CompiledPhase {
  // ...existing...
  parallel?: boolean;
  'parallel-task-id'?: string;  // Reference to parallel-tasks entry
}

// Add to CompiledTopPhase (line 148-168) - for sync phases
export interface CompiledTopPhase {
  // ...existing...
  'wait-for-parallel'?: boolean;
}
```

#### B. Compiler (`compiler/src/expand-foreach.ts`)

- When compiling sub-phases within a step, propagate `parallel` property
- Mark sub-phases with `parallel: true` so sprint-loop knows to spawn them

```typescript
// In expandForEach(), when creating CompiledPhase for sub-phases:
const compiledSubPhase: CompiledPhase = {
  id: phase.id,
  status: 'pending',
  prompt: substituteTemplateVars(phase.prompt, context),
  parallel: phase.parallel,  // NEW: propagate parallel flag
};
```

#### C. Compiler (`compiler/src/compile.ts`)

- Initialize `parallel-tasks: []` array in PROGRESS.yaml
- Handle `wait-for-parallel` on top-level phases

#### D. Validation (`compiler/src/validate.ts`)

- Validate `parallel` is boolean
- Validate `wait-for-parallel` is boolean
- Warn if `parallel: true` used on for-each phase (not supported, use in step workflow)

#### E. Sprint Loop (`scripts/sprint-loop.sh`)

**New helper functions:**

```bash
# Check if current sub-phase is parallel
is_parallel_subphase() {
  local phase_idx="$1" step_idx="$2" sub_idx="$3"
  yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].parallel // false" "$PROGRESS_FILE"
}

# Spawn a parallel task
spawn_parallel_task() {
  local phase_idx="$1" step_idx="$2" sub_idx="$3"
  local step_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].id" "$PROGRESS_FILE")
  local phase_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].id" "$PROGRESS_FILE")
  local task_id="${step_id}-${phase_id}-$(date +%s)"
  local log_file="$SPRINT_DIR/logs/${task_id}.log"

  mkdir -p "$SPRINT_DIR/logs"

  # Build prompt for parallel task
  local prompt=$("$SCRIPT_DIR/build-parallel-prompt.sh" "$SPRINT_DIR" "$phase_idx" "$step_idx" "$sub_idx" "$task_id")

  # Spawn in background
  (claude -p "$prompt" --dangerously-skip-permissions > "$log_file" 2>&1) &
  local pid=$!

  # Register in PROGRESS.yaml
  yq -i ".\"parallel-tasks\" += [{
    \"id\": \"$task_id\",
    \"step-id\": \"$step_id\",
    \"phase-id\": \"$phase_id\",
    \"status\": \"spawned\",
    \"pid\": $pid,
    \"log-file\": \"$log_file\",
    \"spawned-at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }]" "$PROGRESS_FILE"

  # Mark sub-phase as spawned
  yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].status = \"spawned\"" "$PROGRESS_FILE"
  yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].\"parallel-task-id\" = \"$task_id\"" "$PROGRESS_FILE"

  echo "Spawned parallel task: $task_id (PID: $pid)"
}

# Check if phase has wait-for-parallel
is_wait_for_parallel_phase() {
  local phase_idx="$1"
  yq -r ".phases[$phase_idx].\"wait-for-parallel\" // false" "$PROGRESS_FILE"
}

# Wait for all parallel tasks to complete
wait_for_parallel_tasks() {
  local running
  while true; do
    update_parallel_task_statuses
    running=$(yq -r '.["parallel-tasks"] // [] | map(select(.status == "spawned" or .status == "running")) | length' "$PROGRESS_FILE")
    if [[ "$running" -eq 0 ]]; then
      break
    fi
    echo "Waiting for $running parallel tasks..."
    sleep 5
  done
}

# Poll and update status of running parallel tasks
update_parallel_task_statuses() {
  local tasks=$(yq -r '.["parallel-tasks"][] | select(.status == "spawned" or .status == "running") | .id + ":" + (.pid | tostring)' "$PROGRESS_FILE" 2>/dev/null)

  for entry in $tasks; do
    local task_id="${entry%%:*}"
    local pid="${entry##*:}"

    if ! kill -0 "$pid" 2>/dev/null; then
      # Process finished
      wait "$pid" 2>/dev/null
      local exit_code=$?
      local status="completed"
      [[ $exit_code -ne 0 ]] && status="failed"

      yq -i "(.\"parallel-tasks\"[] | select(.id == \"$task_id\")) |= . + {
        \"status\": \"$status\",
        \"completed-at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"exit-code\": $exit_code
      }" "$PROGRESS_FILE"
    fi
  done
}
```

**Modified main loop logic:**

```bash
# When processing a sub-phase:
if is_parallel_subphase "$PHASE_IDX" "$STEP_IDX" "$SUB_IDX"; then
  spawn_parallel_task "$PHASE_IDX" "$STEP_IDX" "$SUB_IDX"
  # Advance pointer to next sub-phase/step (don't wait)
  advance_pointer
  continue
fi

# When processing a top-level phase with wait-for-parallel:
if is_wait_for_parallel_phase "$PHASE_IDX"; then
  wait_for_parallel_tasks
  # Check for failures
  failed=$(yq -r '.["parallel-tasks"] | map(select(.status == "failed")) | length' "$PROGRESS_FILE")
  if [[ "$failed" -gt 0 ]]; then
    echo "Warning: $failed parallel tasks failed. Check logs."
  fi
fi
```

#### F. New Script (`scripts/build-parallel-prompt.sh`)

```bash
#!/bin/bash
SPRINT_DIR="$1"
PHASE_IDX="$2"
STEP_IDX="$3"
SUB_IDX="$4"
TASK_ID="$5"

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
STEP_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].prompt" "$PROGRESS_FILE")
SUB_PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_IDX].prompt" "$PROGRESS_FILE")
SUB_PHASE_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_IDX].id" "$PROGRESS_FILE")

cat <<EOF
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: $STEP_PROMPT

## Your Task: $SUB_PHASE_ID
$SUB_PHASE_PROMPT

## Instructions
1. Execute this task independently
2. This runs in background - main workflow continues without waiting
3. Focus on completing this specific task
4. Commit changes when done

Note: Do NOT modify PROGRESS.yaml - the main loop tracks completion via process exit.
EOF
```

#### G. Status Command (`commands/sprint-status.md`)

Add parallel task display section:
```
Parallel Tasks:
[~] step-0-update-docs-1705123456 (running, 2m elapsed)
    Step: Implement user authentication
    Phase: update-docs
    PID: 12345 | Log: logs/step-0-update-docs-1705123456.log
[x] step-1-update-docs-1705123789 (completed, 1m 23s)
```

### 5. Files to Modify

| File | Changes |
|------|---------|
| `compiler/src/types.ts` | Add `parallel`, `wait-for-parallel`, `ParallelTask` |
| `compiler/src/expand-foreach.ts` | Propagate `parallel` to compiled sub-phases |
| `compiler/src/compile.ts` | Initialize `parallel-tasks: []`, handle `wait-for-parallel` |
| `compiler/src/validate.ts` | Validate new properties |
| `scripts/sprint-loop.sh` | Parallel spawning, wait logic, status polling |
| `scripts/build-parallel-prompt.sh` | **NEW**: Build prompts for parallel tasks |
| `scripts/build-sprint-prompt.sh` | Skip parallel sub-phases (already spawned) |
| `commands/sprint-status.md` | Show parallel task status |
| `skills/creating-workflows/references/workflow-schema.md` | Document schema |

### 6. Backward Compatibility

- All new properties are optional
- Existing workflows work unchanged (no `parallel` = sequential)
- No limit on concurrent parallel tasks (user decision)

### 7. Failure Handling

- Parallel task failures are tracked in `parallel-tasks[].status = "failed"`
- Failures only surface at `wait-for-parallel` sync points
- At sync point: warn about failures but don't block sprint (user can review logs)

### 8. Verification Plan

1. **Compiler tests**: Verify `parallel` propagates through compilation
2. **Integration test**:
   - Create workflow with `parallel: true` sub-phase in step workflow
   - Verify parallel tasks spawn as background processes
   - Verify main loop advances to next step without waiting
   - Verify `wait-for-parallel` blocks until all complete
3. **Status test**: Verify `sprint-status` shows parallel task progress
4. **Edge cases**: Parallel task failure, sprint stop (cleanup orphaned processes)
