# Step Context: step-2

## Task
Erstelle das Prompt-Builder Script und die Ralph Workflow-Datei.

## Related Code Patterns

### Similar Implementation: build-sprint-prompt.sh (plugins/m42-sprint/scripts/build-sprint-prompt.sh)

The existing `build-sprint-prompt.sh` serves as the primary reference. Key patterns:

1. **Script Structure**:
```bash
#!/bin/bash
set -euo pipefail

SPRINT_DIR="$1"
# Additional args...

# Validate inputs
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
```

2. **YAML Reading with yq**:
```bash
# Read fields
PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
GOAL=$(yq -r '.goal' "$PROGRESS_FILE")
TOTAL_PHASES=$(yq -r '.phases | length' "$PROGRESS_FILE")
```

3. **Prompt Generation with heredoc**:
```bash
cat <<EOF
# Sprint Workflow Execution
Sprint: $SPRINT_ID | Iteration: $ITERATION

## Current Position
- Phase: **$PHASE_ID** ($((PHASE_IDX + 1))/$TOTAL_PHASES)

## Your Task
$PHASE_PROMPT
EOF
```

4. **Mode-based Logic with case**:
```bash
case "$MODE" in
  planning)
    # Generate planning prompt
    ;;
  executing)
    # Generate execution prompt
    ;;
  reflecting)
    # Generate reflection prompt
    ;;
esac
```

### Workflow File Pattern: sprint-default.yaml (.claude/workflows/sprint-default.yaml)

Standard workflow structure:
```yaml
name: Standard Sprint
description: Complete sprint workflow with...

phases:
  - id: prepare
    prompt: |
      Multi-line prompt...
```

For Ralph mode, the workflow extends this with new fields:
```yaml
name: Ralph Mode Workflow
description: Autonomous goal-driven execution

mode: ralph                    # NEW: Mode identifier

goal-prompt: |                 # NEW: Template for goal analysis
  ...

reflection-prompt: |           # NEW: Template for reflection
  ...

per-iteration-hooks:           # NEW: Deterministic parallel tasks
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false
```

## Required Imports
### Internal
- None (pure bash script with yq dependency)

### External
- `yq`: YAML manipulation tool (v4+)
- Standard bash utilities (cat, grep, date)

## Types/Interfaces to Use

### Dynamic Step Structure (in PROGRESS.yaml)
```yaml
dynamic-steps:
  - id: step-0
    prompt: "Task description"
    status: pending | completed
    added-at: "2026-01-18T10:00:00Z"
    added-in-iteration: 1
```

### Per-Iteration Hook Structure (in workflow YAML)
```yaml
per-iteration-hooks:
  - id: string              # Unique identifier
    workflow?: string       # External workflow reference (e.g., "m42-signs:learning-extraction")
    prompt?: string         # OR inline prompt
    parallel: boolean       # true = non-blocking
    enabled: boolean        # Default enabled state
```

## Integration Points

### Called by
- `scripts/sprint-loop.sh` in `run_ralph_loop()` function
- Called with: `$SCRIPT_DIR/build-ralph-prompt.sh "$SPRINT_DIR" "$MODE" "$iteration"`

### Calls
- Reads from `$SPRINT_DIR/PROGRESS.yaml` via `yq`
- May read from workflow file for `goal-prompt` and `reflection-prompt`

### Tests
- No formal test framework for bash scripts
- Verification via:
  - `bash -n scripts/build-ralph-prompt.sh` (syntax check)
  - Manual testing with mock PROGRESS.yaml
  - Gherkin scenarios defined in step-2-gherkin.md

## Implementation Notes

### 1. Mode Selection Logic
The MODE argument determines which prompt template to use:
- `planning`: First iteration or after idle threshold - analyze goal, create steps
- `executing`: Has pending steps - execute next step
- `reflecting`: No pending steps for N iterations - reflect on completion

### 2. RALPH_COMPLETE Keyword
The script must include instructions about the completion signal:
```
When goal is FULLY achieved: RALPH_COMPLETE: [summary]
```
This keyword is detected by sprint-loop.sh to exit the loop.

### 3. yq Commands for Dynamic Steps
Planning mode must show Claude how to add steps:
```bash
yq -i '.dynamic-steps += [{"id": "step-N", "prompt": "...", "status": "pending", "added-at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "added-in-iteration": N}]' "$PROGRESS_FILE"
```

### 4. Workflow File Location
The ralph.yaml workflow goes in `.claude/workflows/ralph.yaml` following existing conventions.

### 5. Per-Iteration Hooks Default State
All hooks should be `enabled: false` by default - SPRINT.yaml overrides enable them:
```yaml
# In workflow:
per-iteration-hooks:
  - id: learning
    enabled: false  # Default off

# In SPRINT.yaml override:
per-iteration-hooks:
  learning:
    enabled: true   # Override to enable
```

### 6. Script Arguments
```bash
SPRINT_DIR="$1"    # Required: Path to sprint directory
MODE="$2"          # Required: planning | executing | reflecting
ITERATION="$3"     # Required: Current iteration number
```

### 7. Error Handling
Follow existing pattern - exit with error message to stderr:
```bash
if [[ -z "$SPRINT_DIR" ]]; then
  echo "Error: Sprint directory required" >&2
  exit 1
fi
```

## File Locations

| File | Purpose |
|------|---------|
| `plugins/m42-sprint/scripts/build-ralph-prompt.sh` | New prompt builder script |
| `.claude/workflows/ralph.yaml` | Ralph mode workflow definition |
| `$SPRINT_DIR/PROGRESS.yaml` | Runtime progress (read by script) |

## Gherkin Verification Summary

8 scenarios must pass:
1. Script file exists
2. Script is executable
3. Script passes bash syntax check
4. Workflow file exists
5. Workflow has valid YAML syntax
6. Workflow contains `mode: ralph`
7. Workflow contains `per-iteration-hooks` array
8. Script handles all three modes (planning, executing, reflecting)
