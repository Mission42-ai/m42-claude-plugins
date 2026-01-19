# Step Context: ralph-cleanup

## Task
GIVEN the extended TypeScript schema
WHEN removing Ralph mode completely
THEN prepare clean codebase for unified loop

## Scope
This step REMOVES code only - no new functionality.

## Code Locations to Remove

### 1. sprint-loop.sh Functions (Lines to Delete)

#### `process_ralph_result()` - Lines 885-1035
```bash
# Process Ralph mode result and update PROGRESS.yaml
# Args: transcript_file, iteration
process_ralph_result() {
  # ... ~150 lines of Ralph-specific result processing
  # Handles: continue, goal-complete, needs-human statuses
  # Updates: dynamic-steps, min-iterations checks
}
```

#### `record_ralph_completion()` - Lines 1041-1079
```bash
# Record Ralph mode completion
# Uses atomic update to ensure completion state is consistent
record_ralph_completion() {
  # ... records ralph-exit metadata
}
```

#### `spawn_per_iteration_hooks()` - Lines 1081-1163
```bash
# Spawn per-iteration hooks for Ralph mode
spawn_per_iteration_hooks() {
  # ... handles per-iteration-hooks from PROGRESS.yaml
}
```

#### `run_ralph_loop()` - Lines 1165-1327
```bash
# Ralph Loop - Autonomous goal-driven execution
run_ralph_loop() {
  # ... main Ralph mode execution loop
  # Includes: idle detection, planning/executing/reflecting modes
  # Calls: build-ralph-prompt.sh, process_ralph_result
}
```

#### Mode Dispatch - Lines 2107-2112
```bash
# Detect mode from PROGRESS.yaml and dispatch to appropriate loop
SPRINT_MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

case "$SPRINT_MODE" in
  "ralph") run_ralph_loop ;;
  *) run_standard_loop ;;
esac
```

### 2. preflight-check.sh Ralph Checks - Lines 60-67
```bash
# Standard mode requires 'phases', Ralph mode requires 'goal'
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")
if [[ "$MODE" == "ralph" ]]; then
  GOAL=$(yq -r '.goal // ""' "$PROGRESS_FILE")
  if [[ -z "$GOAL" ]]; then
    ERRORS+=("PROGRESS.yaml missing required field for ralph mode: goal")
  fi
fi
```

### 3. test-sprint-features.sh Ralph Tests - Lines 137-194
The entire "Ralph Mode Features" test section needs removal, including:
- `run_ralph_loop` existence check
- `process_ralph_result` existence check
- Ralph prompt builder mode tests
- Ralph preflight config test

### 4. Comment Reference - Line 5
```bash
# This is the "dumb bash loop" pattern from Ralph Loop
```
This comment can be updated or removed.

## Files to Delete

### 1. `plugins/m42-sprint/scripts/build-ralph-prompt.sh`
~410 lines - generates prompts for Ralph mode iterations based on:
- Planning mode (idle, no pending steps)
- Executing mode (has pending steps)
- Reflecting mode (idle threshold reached)

### 2. `.claude/workflows/ralph.yaml`
Basic Ralph workflow definition (if exists).

### 3. `.claude/workflows/ralph-with-bookends.yaml`
Enhanced Ralph workflow with pre/post hooks.

## Integration Points

### What Remains After Cleanup

The standard loop (`run_standard_loop()`) remains as the sole execution path:
- Called by: Main script execution (after mode dispatch removal)
- Uses: `build-sprint-prompt.sh` for prompts
- Updates: PROGRESS.yaml via atomic updates
- Processes results via: `process_standard_result()`

### Files Unchanged
- `build-sprint-prompt.sh` - Standard mode prompt builder (keep)
- `build-parallel-prompt.sh` - Parallel task prompts (keep)
- All compiler TypeScript files - Already cleaned in foundation step

## Verification Commands

```bash
# Scenario 1: build-ralph-prompt.sh deleted
test ! -f plugins/m42-sprint/scripts/build-ralph-prompt.sh

# Scenario 2: ralph.yaml deleted
test ! -f .claude/workflows/ralph.yaml

# Scenario 3: ralph-with-bookends.yaml deleted
test ! -f .claude/workflows/ralph-with-bookends.yaml

# Scenario 4: No ralph references in scripts
! grep -ri "ralph" plugins/m42-sprint/scripts/

# Scenario 5: run_ralph_loop removed
! grep -q "run_ralph_loop" plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 6: process_ralph_result removed
! grep -q "process_ralph_result" plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 7: Valid bash syntax
bash -n plugins/m42-sprint/scripts/sprint-loop.sh
```

## Implementation Strategy

### Order of Operations

1. **Delete files first** (3 files)
   - `build-ralph-prompt.sh`
   - `ralph.yaml` (if exists)
   - `ralph-with-bookends.yaml`

2. **Clean sprint-loop.sh** (largest change)
   - Remove `process_ralph_result()` function (lines ~885-1035)
   - Remove `# RALPH MODE FUNCTIONS` section comment (line 1038)
   - Remove `record_ralph_completion()` function (lines ~1041-1079)
   - Remove `spawn_per_iteration_hooks()` function (lines ~1081-1163)
   - Remove `run_ralph_loop()` function (lines ~1165-1327)
   - Simplify mode dispatch to just call `run_standard_loop` (lines ~2107-2112)
   - Update header comment (line 5)

3. **Clean preflight-check.sh**
   - Remove Ralph mode check (lines ~60-67)
   - Simplify to only check standard mode requirements

4. **Clean test-sprint-features.sh**
   - Remove Ralph Mode Features test section (lines ~137-194)
   - Update Ralph preflight config test to standard mode

5. **Final verification**
   - Run all 7 gherkin verification commands
   - Ensure bash syntax valid

## Risk Assessment

### Low Risk
- File deletions are straightforward
- Ralph code is self-contained (functions call each other)
- No external consumers of Ralph mode

### Attention Points
- Ensure all Ralph references are removed (use grep verification)
- The mode dispatch section at end of file must be cleaned
- Test file changes may affect test count expectations

## Notes

- The `spawn_per_iteration_hooks()` function is Ralph-specific and should be removed
- Per-iteration hooks concept may be reintroduced in future unified orchestration
- The "dumb bash loop" comment references Ralph but describes the general pattern
