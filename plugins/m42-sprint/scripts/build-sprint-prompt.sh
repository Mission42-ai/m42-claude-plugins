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

  # Skip if already completed
  if [[ "$SUB_PHASE_STATUS" == "completed" ]]; then
    exit 0
  fi

  # Set started-at timestamp for sub-phase if not already set
  SUB_PHASE_STARTED=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].\"started-at\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$SUB_PHASE_STARTED" == "null" ]]; then
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  # Set started-at for step if this is the first sub-phase starting
  STEP_STARTED=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].\"started-at\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$STEP_STARTED" == "null" ]]; then
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
    yq -i ".phases[$PHASE_IDX].steps[$STEP_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  # Set started-at for top phase if this is the first step starting
  PHASE_STARTED=$(yq -r ".phases[$PHASE_IDX].\"started-at\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$PHASE_STARTED" == "null" ]]; then
    yq -i ".phases[$PHASE_IDX].\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
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

## Step Context
$STEP_PROMPT

## Your Task: $SUB_PHASE_ID

$SUB_PHASE_PROMPT

## Instructions

1. Execute this sub-phase task
2. When complete, update PROGRESS.yaml:

\`\`\`bash
# Mark current sub-phase as completed
yq -i '.phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].status = "completed"' "$PROGRESS_FILE"
yq -i '.phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX]."completed-at" = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"' "$PROGRESS_FILE"

# Advance the pointer
EOF

  # Calculate next position
  NEXT_SUB=$((SUB_PHASE_IDX + 1))
  if [[ "$NEXT_SUB" -ge "$TOTAL_SUB_PHASES" ]]; then
    # Move to next step
    NEXT_STEP=$((STEP_IDX + 1))
    if [[ "$NEXT_STEP" -ge "$TOTAL_STEPS" ]]; then
      # Move to next phase
      cat <<EOF
yq -i '.phases[$PHASE_IDX].status = "completed"' "$PROGRESS_FILE"
yq -i '.current.phase = $((PHASE_IDX + 1))' "$PROGRESS_FILE"
yq -i '.current.step = 0' "$PROGRESS_FILE"
yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"
EOF
    else
      cat <<EOF
yq -i '.phases[$PHASE_IDX].steps[$STEP_IDX].status = "completed"' "$PROGRESS_FILE"
yq -i '.current.step = $NEXT_STEP' "$PROGRESS_FILE"
yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"
EOF
    fi
  else
    cat <<EOF
yq -i '.current."sub-phase" = $NEXT_SUB' "$PROGRESS_FILE"
EOF
  fi

  cat <<EOF
\`\`\`

3. Commit your changes
4. **EXIT immediately** - do NOT continue to next task

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## Breaking the Loop

If you need human intervention, set:
\`\`\`yaml
status: needs-human
human-needed:
  reason: "Why human is needed"
  details: "Additional context"
\`\`\`
EOF

else
  # Simple phase (no steps)
  PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].prompt" "$PROGRESS_FILE")

  # Skip if already completed
  if [[ "$PHASE_STATUS" == "completed" ]]; then
    exit 0
  fi

  # Set started-at timestamp for phase if not already set
  PHASE_STARTED=$(yq -r ".phases[$PHASE_IDX].\"started-at\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$PHASE_STARTED" == "null" ]]; then
    yq -i ".phases[$PHASE_IDX].\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
    yq -i ".phases[$PHASE_IDX].status = \"in-progress\"" "$PROGRESS_FILE"
  fi

  cat <<EOF
# Sprint Workflow Execution
Sprint: $SPRINT_ID | Iteration: $ITERATION

## Current Position
- Phase: **$PHASE_ID** ($((PHASE_IDX + 1))/$TOTAL_PHASES)

## Your Task

$PHASE_PROMPT

## Instructions

1. Execute this phase
2. When complete, update PROGRESS.yaml:

\`\`\`bash
# Mark phase as completed and advance
yq -i '.phases[$PHASE_IDX].status = "completed"' "$PROGRESS_FILE"
yq -i '.phases[$PHASE_IDX]."completed-at" = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"' "$PROGRESS_FILE"
yq -i '.current.phase = $((PHASE_IDX + 1))' "$PROGRESS_FILE"
yq -i '.current.step = 0' "$PROGRESS_FILE"
yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"
EOF

  # Check if this is the last phase
  if [[ $((PHASE_IDX + 1)) -ge "$TOTAL_PHASES" ]]; then
    cat <<EOF

# This is the last phase - mark sprint as completed
yq -i '.status = "completed"' "$PROGRESS_FILE"
EOF
  fi

  cat <<EOF
\`\`\`

3. Commit your changes
4. **EXIT immediately** - do NOT continue to next task

## Files
- Progress: $PROGRESS_FILE
- Sprint: $SPRINT_DIR/SPRINT.yaml

## Breaking the Loop

If you need human intervention, set:
\`\`\`yaml
status: needs-human
human-needed:
  reason: "Why human is needed"
  details: "Additional context"
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
