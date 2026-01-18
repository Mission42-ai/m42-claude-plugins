# Step Context: step-4

## Task
Create new script: scripts/build-parallel-prompt.sh

This script builds the prompt for parallel tasks spawned in background.

Parameters:
- SPRINT_DIR, PHASE_IDX, STEP_IDX, SUB_IDX, TASK_ID

Output format:
```
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: [step prompt from PROGRESS.yaml]

## Your Task: [sub-phase-id]
[sub-phase prompt from PROGRESS.yaml]

## Instructions
1. Execute this task independently
2. This runs in background - main workflow continues without waiting
3. Focus on completing this specific task
4. Commit changes when done

Note: Do NOT modify PROGRESS.yaml - the main loop tracks completion via process exit.
```

Reference: context/implementation-plan.md section 4.F

## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/scripts/build-sprint-prompt.sh
```bash
#!/bin/bash
# Build Sprint Prompt - Hierarchical Workflow Navigation
set -euo pipefail

SPRINT_DIR="$1"
ITERATION="${2:-1}"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "Error: PROGRESS.yaml not found" >&2
  exit 1
fi

if ! command -v yq &> /dev/null; then
  echo "Error: yq is required" >&2
  exit 1
fi

# Key patterns to follow:
# 1. Read current pointer indices
PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
STEP_IDX=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
SUB_PHASE_IDX=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

# 2. Read step and sub-phase prompts with yq
STEP_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].prompt" "$PROGRESS_FILE")
SUB_PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].prompt" "$PROGRESS_FILE")
SUB_PHASE_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].id" "$PROGRESS_FILE")

# 3. Output using heredoc
cat <<EOF
# Sprint Workflow Execution
...content...
EOF
```

### Similar Implementation: plugins/m42-sprint/scripts/preflight-check.sh
```bash
#!/bin/bash
set -euo pipefail

SPRINT_DIR="$1"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
```

## Required Imports
### Internal
- No internal imports (pure bash script)

### External
- `yq`: YAML manipulation CLI tool (already validated by preflight)
- `bash`: Script interpreter

## Types/Interfaces to Use
The script works with YAML data from PROGRESS.yaml. Relevant schema paths:

```yaml
# From PROGRESS.yaml
phases:
  - id: string         # top-level phase id
    steps:
      - id: string     # step id (e.g., "step-0")
        prompt: string # step prompt text
        phases:
          - id: string   # sub-phase id (e.g., "update-docs")
            prompt: string # sub-phase prompt text
            parallel: boolean # if true, runs in background
            parallel-task-id: string # set after spawning

parallel-tasks:
  - id: string        # e.g., "step-0-update-docs-1705123456"
    step-id: string
    phase-id: string
    status: spawned | running | completed | failed
    pid: number
    log-file: string
```

## Integration Points
- **Called by**: `sprint-loop.sh` via `spawn_parallel_task()` function (see implementation-plan.md section 4.E)
- **Calls**: `yq` for YAML reading
- **Output**: stdout (prompt text captured by caller)
- **Tests**: Manual testing via sprint execution (no automated tests for bash scripts)

## Implementation Notes

### Key Requirements from Gherkin Scenarios
1. Script must exist at `plugins/m42-sprint/scripts/build-parallel-prompt.sh`
2. Script must have execute permission (`chmod +x`)
3. Script must use `set -euo pipefail` for bash strict mode
4. Must output "Task ID:" with the TASK_ID parameter
5. Must use `yq` to read `.phases[].steps[].prompt`
6. Must use `yq` to read `.phases[].steps[].phases[].prompt`

### Script Parameters
```bash
SPRINT_DIR="$1"   # Path to sprint directory
PHASE_IDX="$2"    # Top-level phase index (integer)
STEP_IDX="$3"     # Step index within phase (integer)
SUB_IDX="$4"      # Sub-phase index within step (integer)
TASK_ID="$5"      # Unique task identifier (string)
```

### Output Format (exact)
```
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: [step prompt from PROGRESS.yaml]

## Your Task: [sub-phase-id]
[sub-phase prompt from PROGRESS.yaml]

## Instructions
1. Execute this task independently
2. This runs in background - main workflow continues without waiting
3. Focus on completing this specific task
4. Commit changes when done

Note: Do NOT modify PROGRESS.yaml - the main loop tracks completion via process exit.
```

### Differences from build-sprint-prompt.sh
- **Purpose**: build-parallel-prompt.sh generates prompts for background tasks; build-sprint-prompt.sh generates prompts for main loop tasks
- **Parameters**: Takes explicit indices as args (not read from current pointer)
- **Output**: Simpler format, no progress update instructions (main loop tracks completion)
- **Pointer**: Does NOT read/modify `.current` pointer
- **State**: Does NOT update phase status (no `yq -i` writes)

### Error Handling
- Validate all required parameters present
- Validate PROGRESS_FILE exists
- Validate yq is available
- Use `set -euo pipefail` for strict mode
- Output errors to stderr with exit code 1

### Naming Convention
- Constants: SCREAMING_SNAKE_CASE (`SPRINT_DIR`, `PROGRESS_FILE`)
- Variables: snake_case (lowercase)
- Script: kebab-case filename (`build-parallel-prompt.sh`)
