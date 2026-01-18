#!/bin/bash

# Build Ralph Prompt - Goal-driven autonomous execution
# Generates prompts for Ralph Mode iterations based on current state
# Outputs prompt to stdout for use by sprint-loop.sh

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
2. Add steps to PROGRESS.yaml using this command:
   \`\`\`bash
   yq -i '.dynamic-steps += [{"id": "step-N", "prompt": "Task description here", "status": "pending", "added-at": "'\$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "added-in-iteration": $ITERATION}]' "$PROGRESS_FILE"
   \`\`\`
   Replace N with the next step number (0, 1, 2, ...)
3. Create multiple steps if the goal is complex
4. After adding steps, execute the first pending step
5. Mark steps as completed when done:
   \`\`\`bash
   yq -i '(.dynamic-steps[] | select(.id == "step-N")).status = "completed"' "$PROGRESS_FILE"
   \`\`\`

## Completion
When the goal is FULLY achieved, signal completion:
RALPH_COMPLETE: [summary of what was accomplished]

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this iteration
EOF
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

## Instructions
1. Execute this task fully
2. When complete, mark it done:
   \`\`\`bash
   yq -i '(.dynamic-steps[] | select(.id == "$STEP_ID")).status = "completed"' "$PROGRESS_FILE"
   \`\`\`
3. If you discover additional work needed, add new steps:
   \`\`\`bash
   yq -i '.dynamic-steps += [{"id": "step-N", "prompt": "New task", "status": "pending", "added-at": "'\$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "added-in-iteration": $ITERATION}]' "$PROGRESS_FILE"
   \`\`\`

## Completion
If this step completes the entire goal: RALPH_COMPLETE: [summary]

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this task
EOF
    ;;

  reflecting)
    # No pending steps for multiple iterations - reflection required
    COMPLETED_COUNT=$(yq -r '[.dynamic-steps[] | select(.status == "completed")] | length' "$PROGRESS_FILE")

    cat <<EOF
# Ralph Mode: Reflection Required
Iteration: $ITERATION

## Goal
$GOAL

## Completed: $COMPLETED_COUNT steps
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
If the goal is fully accomplished:
RALPH_COMPLETE: [detailed summary of accomplishments]

**Option B: More Work Needed**
If additional work is required, add new steps:
\`\`\`bash
yq -i '.dynamic-steps += [{"id": "step-N", "prompt": "Additional task", "status": "pending", "added-at": "'\$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "added-in-iteration": $ITERATION}]' "$PROGRESS_FILE"
\`\`\`

**Option C: Blocked / Need Human**
If you cannot proceed without human input:
\`\`\`bash
yq -i '.status = "needs-human"' "$PROGRESS_FILE"
yq -i '.human-needed.reason = "Why human intervention is needed"' "$PROGRESS_FILE"
yq -i '.human-needed.details = "Additional context"' "$PROGRESS_FILE"
\`\`\`

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## EXIT after this reflection
EOF
    ;;

  *)
    echo "Error: Unknown mode '$MODE'. Use: planning, executing, reflecting" >&2
    exit 1
    ;;
esac
