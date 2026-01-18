#!/bin/bash

# Build Parallel Prompt - Generates prompt for parallel background tasks
# Unlike build-sprint-prompt.sh, this script:
# - Takes explicit indices as parameters (not from current pointer)
# - Outputs simpler format (no progress update instructions)
# - Does NOT modify PROGRESS.yaml (main loop tracks completion via process exit)

set -euo pipefail

SPRINT_DIR="$1"
PHASE_IDX="$2"
STEP_IDX="$3"
SUB_IDX="$4"
TASK_ID="$5"

# Validate required parameters
if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

if [[ -z "$PHASE_IDX" ]] || [[ -z "$STEP_IDX" ]] || [[ -z "$SUB_IDX" ]] || [[ -z "$TASK_ID" ]]; then
  echo "Error: All parameters required (SPRINT_DIR, PHASE_IDX, STEP_IDX, SUB_IDX, TASK_ID)" >&2
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

# Read step prompt from PROGRESS.yaml
STEP_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].prompt" "$PROGRESS_FILE")

# Read sub-phase details from PROGRESS.yaml
SUB_PHASE_ID=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_IDX].id" "$PROGRESS_FILE")
SUB_PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_IDX].prompt" "$PROGRESS_FILE")

# Output the parallel task prompt
cat <<EOF
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: $STEP_PROMPT

## Your Task: $SUB_PHASE_ID
$SUB_PHASE_PROMPT

## Instructions
1. Execute this task independently
2. This runs in background - main workflow continues without waiting
3. Focus on completing this specific task
4. Commit changes when done

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
