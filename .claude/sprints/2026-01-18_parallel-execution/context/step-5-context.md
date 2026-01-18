# Step Context: step-5

## Task
Update scripts/sprint-loop.sh with parallel task management:

Add new helper functions:
1. is_parallel_subphase() - Check if current sub-phase has parallel flag
2. spawn_parallel_task() - Spawn task in background, register in PROGRESS.yaml
3. is_wait_for_parallel_phase() - Check if phase has wait-for-parallel flag
4. wait_for_parallel_tasks() - Block until all parallel tasks complete
5. update_parallel_task_statuses() - Poll and update status of running tasks

Update main loop:
- When processing sub-phase, check if parallel - if yes, spawn and continue
- When processing top-level phase, check wait-for-parallel - if yes, wait
- Call update_parallel_task_statuses() periodically

Reference: context/implementation-plan.md section 4.E

## Related Code Patterns

### Similar Implementation: sprint-loop.sh existing helper functions
```bash
# Pattern: Reading YAML values with yq (lines 350-366)
get_current_phase_path() {
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  local base_path=".phases[$phase_idx]"

  # Check if phase has steps
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")
  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]]; then
    base_path="$base_path.steps[$step_idx]"
    if [[ "$sub_phase_idx" != "null" ]]; then
      base_path="$base_path.phases[$sub_phase_idx]"
    fi
  fi

  echo "$base_path"
}
```

### Similar Implementation: Timestamp and timing patterns (lines 188-217)
```bash
# Pattern: ISO timestamp generation
PHASE_START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Pattern: Cross-platform date handling (macOS vs Linux)
if [[ "$(uname)" == "Darwin" ]]; then
  start_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$started_at" "+%s" 2>/dev/null || echo "0")
else
  start_epoch=$(date -d "$started_at" "+%s" 2>/dev/null || echo "0")
fi
```

### Similar Implementation: Updating YAML with yq (lines 539-541)
```bash
# Pattern: Setting status and error in PROGRESS.yaml
yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output (retries exhausted)\"" "$PROGRESS_FILE"
yq -i '.status = "blocked"' "$PROGRESS_FILE"
```

### Similar Implementation: Log file naming (lines 597-624)
```bash
# Pattern: Building deterministic log file paths
get_log_filename() {
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  local phase_name=$(yq -r ".phases[$phase_idx].id // \"phase-$phase_idx\"" "$PROGRESS_FILE")
  local log_name="$phase_name"
  # ... build name from hierarchy ...
  echo "$SPRINT_DIR/logs/${log_name}.log"
}
```

### Similar Implementation: Background process handling pattern
```bash
# Pattern: Spawning background processes (from implementation-plan.md)
(claude -p "$prompt" --dangerously-skip-permissions > "$log_file" 2>&1) &
local pid=$!
```

## Required Imports/Dependencies

### External Commands
- `yq`: YAML manipulation (already used extensively)
- `claude`: Claude CLI for spawning parallel tasks
- `kill -0`: POSIX process status check
- `date`: Timestamp generation (cross-platform handling needed)

### Internal Scripts
- `$SCRIPT_DIR/build-parallel-prompt.sh`: Already implemented in step-4, generates prompts for parallel tasks

### Existing Variables (from sprint-loop.sh)
- `$PROGRESS_FILE`: Path to PROGRESS.yaml
- `$SPRINT_DIR`: Sprint directory path
- `$SCRIPT_DIR`: Scripts directory path

## Types/Interfaces to Match

### From types.ts - ParallelTask (lines 106-127)
```typescript
interface ParallelTask {
  id: string;               // e.g., "step-0-update-docs-1705123456"
  'step-id': string;        // "step-0"
  'phase-id': string;       // "update-docs"
  status: ParallelTaskStatus; // 'spawned' | 'running' | 'completed' | 'failed'
  pid?: number;
  'log-file'?: string;
  'spawned-at'?: string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

### From types.ts - CompiledPhase.parallel (lines 150-153)
```typescript
// Sub-phases can have parallel flag and parallel-task-id
interface CompiledPhase {
  // ...
  parallel?: boolean;
  'parallel-task-id'?: string;
}
```

### From types.ts - CompiledTopPhase.'wait-for-parallel' (lines 203-204)
```typescript
// Top-level phases can have wait-for-parallel flag
interface CompiledTopPhase {
  // ...
  'wait-for-parallel'?: boolean;
}
```

## Integration Points

### Called by: Main loop in sprint-loop.sh (lines 779-969)
The new functions integrate into the existing main loop structure:
- `is_parallel_subphase()` called when evaluating sub-phase execution
- `spawn_parallel_task()` called instead of normal Claude invocation for parallel phases
- `is_wait_for_parallel_phase()` called when entering a top-level phase
- `wait_for_parallel_tasks()` called at sync points
- `update_parallel_task_statuses()` called periodically or in wait loop

### Calls:
- `$SCRIPT_DIR/build-parallel-prompt.sh` - For generating parallel task prompts (already implemented)
- `yq` - For reading/writing PROGRESS.yaml
- `claude` - CLI for spawning background tasks

### PROGRESS.yaml Schema Changes (already in types.ts):
- `parallel-tasks[]`: Array at root level for tracking background tasks
- `phases[].steps[].phases[].parallel`: Boolean flag on sub-phases
- `phases[].steps[].phases[].parallel-task-id`: Links to parallel-tasks entry
- `phases[].'wait-for-parallel'`: Boolean flag on top-level phases

## Implementation Notes

### 1. Function Placement
- Add new functions AFTER existing helper functions (around line 490)
- Follow existing function documentation style with comments

### 2. yq Array Operations
```bash
# Append to array (yq 4.x syntax)
yq -i '."parallel-tasks" += [{"id": "task-123", "status": "spawned"}]' "$PROGRESS_FILE"

# Select from array
yq -r '.["parallel-tasks"][] | select(.status == "spawned" or .status == "running") | .id' "$PROGRESS_FILE"

# Update array element by condition
yq -i '(."parallel-tasks"[] | select(.id == "task-123")) |= . + {"status": "completed"}' "$PROGRESS_FILE"
```

### 3. Process Status Checking
```bash
# Check if PID is still running (POSIX-compliant)
if ! kill -0 "$pid" 2>/dev/null; then
  # Process has exited
fi
```

### 4. Background Process Spawning
```bash
# Spawn and capture PID
(claude -p "$prompt" --dangerously-skip-permissions > "$log_file" 2>&1) &
local pid=$!

# Use process substitution to avoid subshell
# Background process runs independently
```

### 5. Main Loop Integration Points

Insert parallel checks at two locations:

**Location 1: Sub-phase processing (around line 804)**
Before invoking Claude for a sub-phase, check if it's parallel:
```bash
# Check if this sub-phase should spawn as parallel
if is_parallel_subphase "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX"; then
  spawn_parallel_task "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX"
  # Skip normal Claude invocation, continue to next iteration
  continue
fi
```

**Location 2: Top-level phase entry (early in loop)**
When entering a phase with wait-for-parallel:
```bash
if is_wait_for_parallel_phase "$PHASE_IDX"; then
  wait_for_parallel_tasks
fi
```

### 6. Gherkin Verification Commands
From artifacts/step-5-gherkin.md, these verifications must pass:
1. `grep -q 'is_parallel_subphase()' ... && grep -A5 ... | grep -q 'parallel'`
2. `grep -q 'spawn_parallel_task()' ... && grep -A20 ... | grep -qE '&$|&"'`
3. `grep -q 'is_wait_for_parallel_phase()' ... && grep -A5 ... | grep -q 'wait-for-parallel'`
4. `grep -q 'wait_for_parallel_tasks()' ... && grep -A20 ... | grep -qE 'while|sleep'`
5. `grep -q 'update_parallel_task_statuses()' ... && grep -A30 ... | grep -qE 'kill -0|parallel-tasks'`
6. Function calls in main loop (non-definition, non-comment occurrences)
7. `spawn_parallel_task` updates `parallel-tasks` array with proper schema

### 7. Error Handling
- Failed parallel tasks: Set status to 'failed', capture exit code
- Orphaned processes: Consider cleanup in trap handlers
- yq errors: Use `2>/dev/null` where appropriate
