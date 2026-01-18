#!/bin/bash

# Build Ralph Prompt - Goal-driven autonomous execution
# Generates prompts for Ralph Mode iterations based on current state
# Outputs prompt to stdout for use by sprint-loop.sh
#
# DETERMINISTIC WORKFLOW: Agent returns JSON, loop handles all YAML updates

set -euo pipefail

SPRINT_DIR="$1"
MODE="$2"
ITERATION="${3:-1}"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

if [[ -z "$MODE" ]]; then
  echo "Error: Mode required (planning, executing, reflecting)" >&2
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

# Read goal from PROGRESS.yaml
GOAL=$(yq -r '.goal // "No goal defined"' "$PROGRESS_FILE")

# Read workflow file path and optional prompts
WORKFLOW_FILE=$(yq -r '.workflow-file // ""' "$PROGRESS_FILE")
GOAL_PROMPT=""
REFLECTION_PROMPT=""

if [[ -n "$WORKFLOW_FILE" ]] && [[ -f "$WORKFLOW_FILE" ]]; then
  GOAL_PROMPT=$(yq -r '."goal-prompt" // ""' "$WORKFLOW_FILE")
  REFLECTION_PROMPT=$(yq -r '."reflection-prompt" // ""' "$WORKFLOW_FILE")
fi

# Get existing pending steps for context
PENDING_STEPS=$(yq -r '[.dynamic-steps // [] | .[] | select(.status == "pending")] | .[] | "- " + .id + ": " + .prompt' "$PROGRESS_FILE" 2>/dev/null || echo "")
COMPLETED_STEPS=$(yq -r '[.dynamic-steps // [] | .[] | select(.status == "completed")] | .[] | "- " + .id + ": " + .prompt' "$PROGRESS_FILE" 2>/dev/null || echo "")

# Output JSON result reporting section (common to all modes)
output_json_instructions() {
  cat <<'JSONEOF'

## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output.

**Continue working (add/reorder steps):**
```json
{
  "status": "continue",
  "summary": "What was done this iteration",
  "completedStepIds": ["step-0", "step-1"],
  "pendingSteps": [
    {"id": "step-2", "prompt": "Existing step to do next"},
    {"id": null, "prompt": "New step to add"},
    {"id": "step-3", "prompt": "Existing step moved later"}
  ]
}
```

**Goal complete:**
```json
{
  "status": "goal-complete",
  "summary": "What was done this iteration",
  "completedStepIds": ["step-5"],
  "goalCompleteSummary": "Detailed summary of all accomplishments"
}
```

**Need human help:**
```json
{
  "status": "needs-human",
  "summary": "What was attempted",
  "humanNeeded": {"reason": "Why human is needed", "details": "Context"}
}
```

### JSON Field Reference

- `status`: Required. One of "continue", "goal-complete", "needs-human"
- `summary`: Required. Brief summary of this iteration's work
- `completedStepIds`: Array of step IDs you completed this iteration
- `pendingSteps`: Complete ordered list of ALL pending steps (existing + new). First item = next to execute
  - Set `id` to existing step ID to keep it, or `null` for new steps
  - The order you provide IS the execution order
- `goalCompleteSummary`: Final summary when goal is achieved
- `humanNeeded.reason` / `humanNeeded.details`: Required when status is "needs-human"
JSONEOF
}

case "$MODE" in
  planning)
    # First iteration or after reflection - analyze goal, create steps
    cat <<EOF
# Ralph Mode: Goal Analysis
Iteration: $ITERATION

## Your Goal
$GOAL
EOF

    # Include goal-prompt template if defined
    if [[ -n "$GOAL_PROMPT" ]]; then
      cat <<EOF

## Goal Analysis Guidelines
$GOAL_PROMPT
EOF
    fi

    cat <<EOF

## Instructions
1. Analyze the goal and break it into concrete, actionable steps
2. Execute the first step if you can
3. Report your result as JSON (see below)

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this iteration
EOF

    output_json_instructions
    ;;

  executing)
    # Has pending steps - execute next step
    STEP_ID=$(yq -r '[.dynamic-steps[] | select(.status == "pending")][0].id // "null"' "$PROGRESS_FILE")
    STEP_PROMPT=$(yq -r "[.dynamic-steps[] | select(.id == \"$STEP_ID\")][0].prompt // \"No prompt\"" "$PROGRESS_FILE")

    if [[ "$STEP_ID" == "null" ]]; then
      echo "Error: No pending step found" >&2
      exit 1
    fi

    cat <<EOF
# Ralph Mode: Execute Step
Iteration: $ITERATION

## Goal (context)
$GOAL

## Current Task: $STEP_ID
$STEP_PROMPT
EOF

    # Show other pending steps for context
    if [[ -n "$PENDING_STEPS" ]]; then
      OTHER_PENDING=$(echo "$PENDING_STEPS" | grep -v "^- $STEP_ID:" || true)
      if [[ -n "$OTHER_PENDING" ]]; then
        cat <<EOF

## Other Pending Steps
$OTHER_PENDING
EOF
      fi
    fi

    cat <<EOF

## Instructions
1. Execute this task fully
2. If you discover additional work needed, add it to pendingSteps
3. Mark this step as completed in completedStepIds
4. If this completes the entire goal, use status "goal-complete"

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this task
EOF

    output_json_instructions
    ;;

  reflecting)
    # No pending steps for multiple iterations - reflection required
    COMPLETED_COUNT=$(yq -r '[.dynamic-steps[] | select(.status == "completed")] | length' "$PROGRESS_FILE")

    cat <<EOF
# Ralph Mode: Reflection Required
Iteration: $ITERATION

## Goal
$GOAL

## Completed Steps ($COMPLETED_COUNT total)
$COMPLETED_STEPS

No pending steps remain.
EOF

    # Include reflection-prompt template if defined
    if [[ -n "$REFLECTION_PROMPT" ]]; then
      cat <<EOF

## Reflection Guidelines
$REFLECTION_PROMPT
EOF
    fi

    cat <<EOF

## Choose Your Path

**Option A: Goal Achieved**
If the goal is fully accomplished, report status "goal-complete"

**Option B: More Work Needed**
If additional work is required, add new steps to pendingSteps

**Option C: Blocked / Need Human**
If you cannot proceed without human input, report status "needs-human"

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this reflection
EOF

    output_json_instructions
    ;;

  *)
    echo "Error: Unknown mode '$MODE'. Use: planning, executing, reflecting" >&2
    exit 1
    ;;
esac
