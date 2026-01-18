# Step Context: step-6

## Task
Update scripts/build-sprint-prompt.sh to skip parallel sub-phases:

When building prompts for the main loop, skip sub-phases that:
- Have status 'spawned' (already running in background)
- Have parallel-task-id set (reference to parallel-tasks entry)

This prevents re-executing tasks that are already running in parallel.

Reference: context/implementation-plan.md section 5 (Files to Modify table)

## Related Code Patterns

### Similar Implementation: build-sprint-prompt.sh (existing skip logic)
```bash
# Lines 86-94: Existing skip logic for completed/blocked status
# Skip if already completed
if [[ "$SUB_PHASE_STATUS" == "completed" ]]; then
  exit 0
fi

# Skip if blocked (retries exhausted)
if [[ "$SUB_PHASE_STATUS" == "blocked" ]]; then
  exit 0
fi
```

### Similar Implementation: sprint-loop.sh (parallel detection)
```bash
# Lines 497-515: is_parallel_subphase function
is_parallel_subphase() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_idx="$3"

  if [[ -z "$phase_idx" ]] || [[ -z "$step_idx" ]] || [[ -z "$sub_idx" ]]; then
    echo "false"
    return
  fi
  if [[ "$step_idx" == "null" ]] || [[ "$sub_idx" == "null" ]]; then
    echo "false"
    return
  fi

  local parallel_flag
  parallel_flag=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].parallel // false" "$PROGRESS_FILE" 2>/dev/null)
  echo "$parallel_flag"
}
```

### Similar Implementation: sprint-loop.sh (spawned status marking)
```bash
# Lines 567-570: How spawn_parallel_task marks sub-phase as spawned
yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].status = \"spawned\"" "$PROGRESS_FILE"
yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].\"parallel-task-id\" = \"$task_id\"" "$PROGRESS_FILE"
```

## Required Imports
### Internal
- No TypeScript imports needed - this is a pure bash script modification

### External
- `yq`: YAML manipulation (already used in script)

## Types/Interfaces to Use
```yaml
# From PROGRESS.yaml (CompiledPhase structure)
# Sub-phase within a step
phases:
  - id: development
    steps:
      - id: step-0
        phases:
          - id: update-docs
            status: spawned               # NEW: indicates running in background
            parallel: true                # Flag from workflow definition
            parallel-task-id: step-0-update-docs-1705123456  # Link to parallel-tasks entry
```

## Integration Points
- **Called by**: sprint-loop.sh at line 1002 (`PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")`)
- **Calls**: yq for YAML queries
- **Related scripts**:
  - `spawn_parallel_task()` in sprint-loop.sh sets status='spawned' and parallel-task-id
  - Main loop in sprint-loop.sh handles pointer advancement after spawning
- **Tests**: Need to create test scripts per gherkin:
  - `test-skip-spawned.sh` - verify exit 0 for spawned status
  - `test-skip-parallel-task-id.sh` - verify exit 0 for parallel-task-id present
  - `test-normal-subphase.sh` - verify prompt output for normal pending phases

## Implementation Notes

### Location for New Skip Logic
The skip logic should be added at lines 86-94 in build-sprint-prompt.sh, after the existing completed/blocked checks:

```bash
# After line 94 (after "blocked" check), add:

# Skip if spawned (running in background)
if [[ "$SUB_PHASE_STATUS" == "spawned" ]]; then
  exit 0
fi

# Skip if has parallel-task-id (already tracked as parallel)
SUB_PHASE_TASK_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].\"parallel-task-id\" // \"null\"" "$PROGRESS_FILE")
if [[ "$SUB_PHASE_TASK_ID" != "null" ]]; then
  exit 0
fi
```

### Test Scripts Required
Per gherkin scenarios 4-6, need to create:
1. `test-skip-spawned.sh` - Create PROGRESS.yaml with spawned status, verify exit 0
2. `test-skip-parallel-task-id.sh` - Create PROGRESS.yaml with parallel-task-id, verify exit 0
3. `test-normal-subphase.sh` - Create PROGRESS.yaml with pending status, verify non-empty output

### Important Behavior
- Exit code 0 with no output = skip this sub-phase (sprint-loop interprets this correctly)
- Exit code 0 with prompt output = execute this sub-phase
- The main loop handles pointer advancement after spawn, so build-sprint-prompt.sh only needs to detect and skip

### Gherkin Scenarios Summary
1. Script exists and is executable - already true
2. Script contains 'spawned' check - implementation needed
3. Script contains 'parallel-task-id' check - implementation needed
4. Exit 0 for spawned status - test needed
5. Exit 0 for parallel-task-id - test needed
6. Normal prompt output for pending - test needed
