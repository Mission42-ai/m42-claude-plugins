# Step Context: step-1

## Task
Implementiere die Ralph Loop Funktion in sprint-loop.sh.

## Related Code Patterns

### Similar Implementation: run_standard_loop (to be extracted)

The existing main loop logic in `sprint-loop.sh` (lines 978-1190) will be refactored into `run_standard_loop()`. Key patterns to preserve:

```bash
# Main loop pattern (lines 978-1190)
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  # 1. Force-retry check
  # 2. Iteration counter update
  # 3. Prompt building
  # 4. Parallel task handling
  # 5. Claude invocation
  # 6. Exit code handling
  # 7. Timestamp updates
  # 8. Status checks
  # 9. Delay between iterations
done
```

### Similar Implementation: spawn_parallel_task (lines 518-574)

Pattern for spawning background Claude processes:

```bash
spawn_parallel_task() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_idx="$3"

  # 1. Generate unique task ID
  local task_id="${step_id}-${phase_id}-${timestamp}"
  local log_file="$SPRINT_DIR/logs/${task_id}.log"
  local transcript_file="$SPRINT_DIR/transcripts/${task_id}.jsonl"

  # 2. Ensure directories exist
  mkdir -p "$SPRINT_DIR/logs"
  mkdir -p "$SPRINT_DIR/transcripts"

  # 3. Build prompt
  local prompt=$("$SCRIPT_DIR/build-parallel-prompt.sh" ...)

  # 4. Spawn Claude in background with JSON streaming
  (claude -p "$prompt" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --verbose \
    > "$transcript_file" 2>&1) &
  local pid=$!

  # 5. Register task in PROGRESS.yaml
  yq -i ".[\"parallel-tasks\"] += [{...}]" "$PROGRESS_FILE"
}
```

### Similar Implementation: wait_for_parallel_tasks (lines 593-621)

Pattern for waiting on background processes:

```bash
wait_for_parallel_tasks() {
  while true; do
    update_parallel_task_statuses
    running=$(yq -r '."parallel-tasks" // [] | map(select(.status == "spawned" or .status == "running")) | length' ...)
    if [[ -z "$running" ]] || [[ "$running" -eq 0 ]]; then
      break
    fi
    sleep "$check_interval"
  done
}
```

### Similar Implementation: update_parallel_task_statuses (lines 625-687)

Pattern for polling background process completion:

```bash
update_parallel_task_statuses() {
  local tasks=$(yq -r '."parallel-tasks" // [] | .[] | select(.status == "spawned" or .status == "running") | .id + ":" + (.pid | tostring)' ...)

  while IFS= read -r entry; do
    local task_id="${entry%%:*}"
    local pid="${entry##*:}"

    if ! kill -0 "$pid" 2>/dev/null; then
      # Process exited - update status
      wait "$pid" 2>/dev/null
      local exit_code=$?
      yq -i "(.[]...).status = \"completed\"" ...
    fi
  done <<< "$tasks"
}
```

## Required Functions

### 1. run_standard_loop()
Extract existing main loop (lines 978-1190) into this function. No logic changes, just encapsulation.

### 2. run_ralph_loop()
New function following this structure:

```bash
run_ralph_loop() {
  local iteration=0
  local idle_count=0
  local IDLE_THRESHOLD=$(yq -r '.ralph."idle-threshold" // 3' "$PROGRESS_FILE")

  while true; do
    iteration=$((iteration + 1))

    # 1. Determine mode: planning/executing/reflecting
    local PENDING_COUNT=$(yq '[.dynamic-steps[] | select(.status == "pending")] | length' "$PROGRESS_FILE")

    if [[ $PENDING_COUNT -eq 0 ]]; then
      idle_count=$((idle_count + 1))
      if [[ $idle_count -ge $IDLE_THRESHOLD ]]; then
        local LOOP_MODE="reflecting"
      else
        local LOOP_MODE="planning"
      fi
    else
      local LOOP_MODE="executing"
      idle_count=0
    fi

    # 2. Build prompt via build-ralph-prompt.sh
    PROMPT=$("$SCRIPT_DIR/build-ralph-prompt.sh" "$SPRINT_DIR" "$LOOP_MODE" "$iteration")

    # 3. Spawn per-iteration hooks
    spawn_per_iteration_hooks "$iteration"

    # 4. Execute Claude
    local TRANSCRIPT_FILE="$SPRINT_DIR/transcripts/iteration-$iteration.jsonl"
    claude -p "$PROMPT" \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --verbose \
      > "$TRANSCRIPT_FILE" 2>&1

    # 5. Check for RALPH_COMPLETE
    if grep -qE "RALPH_COMPLETE:" "$TRANSCRIPT_FILE"; then
      local SUMMARY=$(grep -oP "RALPH_COMPLETE:\s*\K.*" "$TRANSCRIPT_FILE" | head -1)
      record_ralph_completion "$iteration" "$SUMMARY"
      wait  # Wait for all parallel hooks
      exit 0
    fi

    # 6. Update iteration counter
    yq -i ".stats.\"current-iteration\" = $iteration" "$PROGRESS_FILE"
  done
}
```

### 3. spawn_per_iteration_hooks()

```bash
spawn_per_iteration_hooks() {
  local iteration=$1
  local HOOK_PIDS=()

  # Read enabled hooks
  local hooks_count=$(yq -r '.per-iteration-hooks // [] | map(select(.enabled == true)) | length' "$PROGRESS_FILE")

  for ((h=0; h<hooks_count; h++)); do
    local hook_id=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].id" "$PROGRESS_FILE")
    local workflow=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].workflow // \"\"" "$PROGRESS_FILE")
    local prompt=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].prompt // \"\"" "$PROGRESS_FILE")
    local parallel=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].parallel // false" "$PROGRESS_FILE")

    # Register task
    yq -i ".hook-tasks += [{\"iteration\": $iteration, \"hook-id\": \"$hook_id\", \"status\": \"in-progress\"}]" "$PROGRESS_FILE"

    # Build hook prompt
    local HOOK_PROMPT=""
    if [[ -n "$workflow" ]] && [[ "$workflow" != "null" ]]; then
      HOOK_PROMPT="/$workflow $SPRINT_DIR/transcripts/iteration-$iteration.jsonl"
    elif [[ -n "$prompt" ]] && [[ "$prompt" != "null" ]]; then
      HOOK_PROMPT="$prompt"
    fi

    if [[ "$parallel" == "true" ]]; then
      # Non-blocking: spawn in background
      (
        claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
        yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
      ) &
      HOOK_PIDS+=($!)
    else
      # Blocking: wait for completion
      claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
      yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
    fi
  done
}
```

### 4. record_ralph_completion()

```bash
record_ralph_completion() {
  local iteration="$1"
  local summary="$2"
  local completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Update ralph-exit section
  yq -i ".ralph-exit.\"detected-at\" = \"$completed_at\"" "$PROGRESS_FILE"
  yq -i ".ralph-exit.iteration = $iteration" "$PROGRESS_FILE"
  yq -i ".ralph-exit.\"final-summary\" = \"$summary\"" "$PROGRESS_FILE"

  # Set sprint status
  yq -i '.status = "completed"' "$PROGRESS_FILE"
  yq -i ".stats.\"completed-at\" = \"$completed_at\"" "$PROGRESS_FILE"
}
```

## Integration Points

### Called by: Mode Detection (new code at ~line 968)

```bash
# After PROGRESS.yaml validation (around line 110-119)
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

if [[ "$MODE" == "ralph" ]]; then
  run_ralph_loop
else
  run_standard_loop
fi
```

### Calls:
- `build-ralph-prompt.sh` (to be created in step-0 or exists)
- `yq` for YAML manipulation
- `claude` CLI for execution

### Tests:
- Syntax check: `bash -n plugins/m42-sprint/scripts/sprint-loop.sh`
- Shellcheck: `shellcheck plugins/m42-sprint/scripts/sprint-loop.sh || true`

## Implementation Notes

1. **Position of Mode Detection**: Insert mode detection logic AFTER the preflight checks and initial status setup (around line 968, before the main loop), but BEFORE the `echo "SPRINT LOOP STARTING"` output moves the detection must happen after all setup.

2. **Preserve Error Handling**: The new functions should use the existing error handling patterns (`classify_error`, `handle_phase_failure`, etc.) where applicable.

3. **Variable Scope**: Use `local` for all function-internal variables to avoid polluting global scope.

4. **Transcript Location**: Ralph mode stores transcripts in `$SPRINT_DIR/transcripts/iteration-N.jsonl` (different from standard mode's phase-based naming).

5. **RALPH_COMPLETE Detection**: Use grep on the transcript file rather than output variable to handle streaming JSON properly. Extract from result text field.

6. **Hook Spawning Order**: Spawn hooks BEFORE main Claude invocation so they can process in parallel.

7. **Wait on Exit**: The `wait` builtin without arguments waits for ALL background processes (not just tracked ones).

## PROGRESS.yaml Fields Used

### Read:
- `.mode` - "standard" or "ralph"
- `.ralph."idle-threshold"` - iterations without progress before reflection
- `.dynamic-steps[]` - Claude-created steps
- `.per-iteration-hooks[]` - Hook configurations

### Write:
- `.stats."current-iteration"` - Current loop iteration
- `.hook-tasks[]` - Per-iteration hook execution tracking
- `.ralph-exit.*` - Completion tracking
- `.status` - Sprint completion status
- `.stats."completed-at"` - Completion timestamp

## Files to Modify

| File | Action |
|------|--------|
| `plugins/m42-sprint/scripts/sprint-loop.sh` | Add 4 functions + mode detection |

## Files to Reference (read-only)

| File | Purpose |
|------|---------|
| `plugins/m42-sprint/scripts/build-sprint-prompt.sh` | Pattern for prompt generation |
| `plugins/m42-sprint/scripts/build-parallel-prompt.sh` | Pattern for parallel prompts |
| `plugins/m42-sprint/compiler/src/types.ts` | TypeScript interfaces for Ralph mode |

## Types from Compiler (for reference)

```typescript
// From types.ts - Ralph mode structures
interface PerIterationHook {
  id: string;
  workflow?: string;
  prompt?: string;
  parallel: boolean;
  enabled: boolean;
}

interface DynamicStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  'added-at': string;
  'added-in-iteration': number;
}

interface HookTask {
  iteration: number;
  'hook-id': string;
  status: ParallelTaskStatus;
  pid?: number;
  transcript?: string;
}

interface RalphConfig {
  'idle-threshold'?: number;
}

interface RalphExitInfo {
  'detected-at'?: string;
  iteration?: number;
  'final-summary'?: string;
}
```

## Gherkin Scenarios Summary (from artifacts/step-1-gherkin.md)

All 8 scenarios must pass:

| # | Scenario | Verification |
|---|----------|--------------|
| 1 | Script syntax valid | `bash -n sprint-loop.sh` |
| 2 | run_standard_loop exists | grep function definition |
| 3 | run_ralph_loop exists | grep function definition |
| 4 | Mode detection logic | grep mode read + conditional |
| 5 | spawn_per_iteration_hooks exists | grep function definition |
| 6 | record_ralph_completion exists | grep function definition |
| 7 | RALPH_COMPLETE detection | grep RALPH_COMPLETE patterns |
| 8 | build-ralph-prompt.sh integration | grep script invocation |

## Verification Commands

```bash
# Scenario 1: Syntax check
bash -n plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 2: run_standard_loop function exists
grep -qE '^run_standard_loop\s*\(\)|^function run_standard_loop' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 3: run_ralph_loop function exists
grep -qE '^run_ralph_loop\s*\(\)|^function run_ralph_loop' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 4: Mode detection reads from PROGRESS.yaml
grep -q '.mode // "standard"' plugins/m42-sprint/scripts/sprint-loop.sh && \
grep -qE 'if.*ralph.*run_ralph_loop|"ralph".*\).*run_ralph_loop' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 5: spawn_per_iteration_hooks function exists
grep -qE '^spawn_per_iteration_hooks\s*\(\)|^function spawn_per_iteration_hooks' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 6: record_ralph_completion function exists
grep -qE '^record_ralph_completion\s*\(\)|^function record_ralph_completion' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 7: RALPH_COMPLETE detection logic
grep -qE 'RALPH_COMPLETE' plugins/m42-sprint/scripts/sprint-loop.sh && \
grep -qE 'grep.*RALPH_COMPLETE|record_ralph_completion' plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 8: build-ralph-prompt.sh integration
grep -qE 'build-ralph-prompt\.sh' plugins/m42-sprint/scripts/sprint-loop.sh

# Informational: shellcheck
shellcheck plugins/m42-sprint/scripts/sprint-loop.sh || true
```
