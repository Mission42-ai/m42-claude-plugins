#!/bin/bash

# Build Sprint Prompt - Hierarchical Workflow Navigation
# Generates prompt for the current position in the workflow hierarchy
# Outputs prompt to stdout for use by sprint-loop.sh

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

# Build previous step context if available (passed via environment variables)
PREV_CONTEXT=""
if [[ -n "${PREV_TRANSCRIPT_FILE:-}" ]] && [[ -f "$PREV_TRANSCRIPT_FILE" ]]; then
  PREV_CONTEXT="
## Previous Step Output
- Transcript (JSON): $PREV_TRANSCRIPT_FILE
- Log (text): ${PREV_LOG_FILE:-}"
fi

# Read current pointer
PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
STEP_IDX=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
SUB_PHASE_IDX=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

# Get total phases
TOTAL_PHASES=$(yq -r '.phases | length' "$PROGRESS_FILE")

# Check if we've completed all phases
if [[ "$PHASE_IDX" -ge "$TOTAL_PHASES" ]]; then
  # No more work
  exit 0
fi

# Get current phase info
PHASE_ID=$(yq -r ".phases[$PHASE_IDX].id" "$PROGRESS_FILE")
PHASE_STATUS=$(yq -r ".phases[$PHASE_IDX].status" "$PROGRESS_FILE")

# Check if phase has steps (for-each phase) or is simple
HAS_STEPS=$(yq -r ".phases[$PHASE_IDX].steps // \"null\"" "$PROGRESS_FILE")

SPRINT_ID=$(yq -r '.["sprint-id"]' "$PROGRESS_FILE")
SPRINT_NAME=$(basename "$SPRINT_DIR")

# Determine what to execute
if [[ "$HAS_STEPS" != "null" ]]; then
  # This is a for-each phase with steps
  TOTAL_STEPS=$(yq -r ".phases[$PHASE_IDX].steps | length" "$PROGRESS_FILE")

  if [[ "$STEP_IDX" == "null" ]] || [[ "$STEP_IDX" -ge "$TOTAL_STEPS" ]]; then
    # All steps done, move to next phase
    exit 0
  fi

  STEP_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].id" "$PROGRESS_FILE")
  STEP_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].prompt" "$PROGRESS_FILE")
  TOTAL_SUB_PHASES=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases | length" "$PROGRESS_FILE")

  if [[ "$SUB_PHASE_IDX" == "null" ]] || [[ "$SUB_PHASE_IDX" -ge "$TOTAL_SUB_PHASES" ]]; then
    # All sub-phases done for this step
    exit 0
  fi

  SUB_PHASE_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].id" "$PROGRESS_FILE")
  SUB_PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].prompt" "$PROGRESS_FILE")
  SUB_PHASE_STATUS=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].status" "$PROGRESS_FILE")
  SUB_PHASE_RETRY_COUNT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].\"retry-count\" // 0" "$PROGRESS_FILE")
  SUB_PHASE_ERROR=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].error // \"null\"" "$PROGRESS_FILE")

  # Skip if already completed
  if [[ "$SUB_PHASE_STATUS" == "completed" ]]; then
    exit 0
  fi

  # Skip if blocked (retries exhausted)
  if [[ "$SUB_PHASE_STATUS" == "blocked" ]]; then
    exit 0
  fi

  # Skip if spawned (running in background as parallel task)
  if [[ "$SUB_PHASE_STATUS" == "spawned" ]]; then
    exit 0
  fi

  # Skip if has parallel-task-id (already tracked as parallel task)
  SUB_PHASE_TASK_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].\"parallel-task-id\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$SUB_PHASE_TASK_ID" != "null" ]]; then
    exit 0
  fi

  # Mark sub-phase as in-progress (timestamps set by sprint-loop.sh for accuracy)
  SUB_PHASE_STATUS=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].status // \"pending\"" "$PROGRESS_FILE")
  if [[ "$SUB_PHASE_STATUS" == "pending" ]]; then
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  # Mark step as in-progress if this is the first sub-phase starting
  STEP_STATUS=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].status // \"pending\"" "$PROGRESS_FILE")
  if [[ "$STEP_STATUS" == "pending" ]]; then
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  # Mark top phase as in-progress if this is the first step starting
  PHASE_STATUS_CHECK=$(yq -r ".phases[$PHASE_IDX].status // \"pending\"" "$PROGRESS_FILE")
  if [[ "$PHASE_STATUS_CHECK" == "pending" ]]; then
    yq -i ".phases[$PHASE_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  # Generate prompt for sub-phase within step
  cat <<EOF
# Sprint Workflow Execution
Sprint: $SPRINT_ID | Iteration: $ITERATION

## Current Position
- Phase: **$PHASE_ID** ($((PHASE_IDX + 1))/$TOTAL_PHASES)
- Step: **$STEP_ID** ($((STEP_IDX + 1))/$TOTAL_STEPS)
- Sub-Phase: **$SUB_PHASE_ID** ($((SUB_PHASE_IDX + 1))/$TOTAL_SUB_PHASES)
EOF

  # Add retry information if this is a retry attempt
  if [[ "$SUB_PHASE_RETRY_COUNT" -gt 0 ]]; then
    cat <<EOF

## ⚠️ RETRY ATTEMPT $SUB_PHASE_RETRY_COUNT
This task previously failed. Please review the error and try a different approach.

Previous error: $SUB_PHASE_ERROR
EOF
  fi

  cat <<EOF

## Step Context
$STEP_PROMPT

## Your Task: $SUB_PHASE_ID

$SUB_PHASE_PROMPT

## Instructions

1. Execute this sub-phase task
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml
$PREV_CONTEXT

## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output:

**On Success:**
\`\`\`json
{"status": "completed", "summary": "Brief description of what was accomplished"}
\`\`\`

**On Failure:**
\`\`\`json
{"status": "failed", "summary": "What was attempted", "error": "What went wrong"}
\`\`\`

**If Human Needed:**
\`\`\`json
{"status": "needs-human", "summary": "What was done so far", "humanNeeded": {"reason": "Why human is needed", "details": "Additional context"}}
\`\`\`
EOF

else
  # Simple phase (no steps)
  PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].prompt" "$PROGRESS_FILE")
  PHASE_RETRY_COUNT=$(yq -r ".phases[$PHASE_IDX].\"retry-count\" // 0" "$PROGRESS_FILE")
  PHASE_ERROR=$(yq -r ".phases[$PHASE_IDX].error // \"null\"" "$PROGRESS_FILE")

  # Skip if already completed
  if [[ "$PHASE_STATUS" == "completed" ]]; then
    exit 0
  fi

  # Skip if blocked (retries exhausted)
  if [[ "$PHASE_STATUS" == "blocked" ]]; then
    exit 0
  fi

  # Skip if spawned (running in background as parallel task)
  if [[ "$PHASE_STATUS" == "spawned" ]]; then
    exit 0
  fi

  # Skip if has parallel-task-id (already tracked as parallel task)
  PHASE_TASK_ID=$(yq -r ".phases[$PHASE_IDX].\"parallel-task-id\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$PHASE_TASK_ID" != "null" ]]; then
    exit 0
  fi

  # Mark phase as in-progress (timestamps set by sprint-loop.sh for accuracy)
  PHASE_STATUS_SIMPLE=$(yq -r ".phases[$PHASE_IDX].status // \"pending\"" "$PROGRESS_FILE")
  if [[ "$PHASE_STATUS_SIMPLE" == "pending" ]]; then
    yq -i ".phases[$PHASE_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  cat <<EOF
# Sprint Workflow Execution
Sprint: $SPRINT_ID | Iteration: $ITERATION

## Current Position
- Phase: **$PHASE_ID** ($((PHASE_IDX + 1))/$TOTAL_PHASES)
EOF

  # Add retry information if this is a retry attempt
  if [[ "$PHASE_RETRY_COUNT" -gt 0 ]]; then
    cat <<EOF

## ⚠️ RETRY ATTEMPT $PHASE_RETRY_COUNT
This task previously failed. Please review the error and try a different approach.

Previous error: $PHASE_ERROR
EOF
  fi

  cat <<EOF

## Your Task

$PHASE_PROMPT

## Instructions

1. Execute this phase
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml
$PREV_CONTEXT

## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output:

**On Success:**
\`\`\`json
{"status": "completed", "summary": "Brief description of what was accomplished"}
\`\`\`

**On Failure:**
\`\`\`json
{"status": "failed", "summary": "What was attempted", "error": "What went wrong"}
\`\`\`

**If Human Needed:**
\`\`\`json
{"status": "needs-human", "summary": "What was done so far", "humanNeeded": {"reason": "Why human is needed", "details": "Additional context"}}
\`\`\`
EOF
fi

# Include context files if they exist
if [[ -f "$SPRINT_DIR/context/_shared.md" ]]; then
  echo ""
  echo "## Shared Context"
  echo ""
  cat "$SPRINT_DIR/context/_shared.md"
fi
