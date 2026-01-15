#!/bin/bash

# Build Sprint Prompt
# Generates minimal, focused prompt for each iteration
# Outputs prompt to stdout for use by sprint-loop.sh

set -euo pipefail

SPRINT_DIR="$1"
ITERATION="${2:-1}"

# Validate inputs
if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "Error: PROGRESS.yaml not found in: $SPRINT_DIR" >&2
  exit 1
fi

# Check for yq
if ! command -v yq &> /dev/null; then
  echo "Error: yq is required but not installed" >&2
  exit 1
fi

# Extract current task from queue[0]
QUEUE_LENGTH=$(yq -r '.queue | length' "$PROGRESS_FILE")

if [[ "$QUEUE_LENGTH" == "0" ]]; then
  # No tasks in queue - output empty (sprint-loop.sh handles this)
  exit 0
fi

# Get the first task from queue
TASK=$(yq -r '.queue[0] | to_yaml' "$PROGRESS_FILE")
TASK_ID=$(yq -r '.queue[0].id // "unknown"' "$PROGRESS_FILE")
TASK_TYPE=$(yq -r '.queue[0].type // "custom"' "$PROGRESS_FILE")
TASK_COMMAND=$(yq -r '.queue[0].command // empty' "$PROGRESS_FILE")

SPRINT_NAME=$(basename "$SPRINT_DIR")

# Generate the prompt
cat <<EOF
# Sprint Task: $TASK_ID
Sprint: $SPRINT_NAME | Iteration: $ITERATION

## Your Task

\`\`\`yaml
$TASK
\`\`\`

## Instructions

1. Complete this task following the task type conventions for "$TASK_TYPE"
2. Record your start time now (ISO 8601 format)
3. Do the work required by this task
4. Update $SPRINT_DIR/PROGRESS.yaml:
   - Remove this task from queue (the first item)
   - Add to completed[] with: completed-at, elapsed (duration), summary
   - If queue is now empty, set status: completed
5. Commit your changes with a descriptive message
6. **EXIT when done** - DO NOT continue to next task

## PROGRESS.yaml Update Example

After completing the task, update PROGRESS.yaml like this:

\`\`\`yaml
# Remove from queue (shift off the first element)
queue:
  # this task removed, remaining tasks stay

# Add to completed
completed:
  - id: $TASK_ID
    type: $TASK_TYPE
    completed-at: 2026-01-15T10:30:00Z  # Use actual timestamp
    elapsed: 15m  # Actual elapsed time
    summary: "Brief description of what was done"
    # ... preserve other original task fields

# Update stats
stats:
  tasks-completed: N+1  # Increment by 1
\`\`\`

## Breaking the Loop (Human Intervention)

If you encounter ANY of these situations, set status: needs-human and add explanation:

- **Critical decision required** - architectural choice, breaking change, security concern
- **Ambiguous requirements** - task unclear, multiple valid interpretations
- **Unexpected complexity** - task much larger than expected, needs breakdown
- **External dependency** - needs API key, credentials, external service
- **Risk detected** - potential data loss, production impact, irreversible action

Example:
\`\`\`yaml
status: needs-human
human-needed:
  reason: "Critical architectural decision"
  details: "Task requires choosing between SQL and NoSQL - impacts entire data layer"
  options: ["PostgreSQL for ACID compliance", "MongoDB for flexibility"]
\`\`\`

## Files

- Progress: $SPRINT_DIR/PROGRESS.yaml
- Sprint config: $SPRINT_DIR/SPRINT.yaml
EOF

# Include task-specific context if exists
if [[ -f "$SPRINT_DIR/context/$TASK_ID.md" ]]; then
  echo ""
  echo "## Task Context"
  echo ""
  cat "$SPRINT_DIR/context/$TASK_ID.md"
fi

# Include shared context if exists
if [[ -f "$SPRINT_DIR/context/_shared.md" ]]; then
  echo ""
  echo "## Shared Context"
  echo ""
  cat "$SPRINT_DIR/context/_shared.md"
fi

# If task has command, include invocation hint
if [[ -n "$TASK_COMMAND" ]]; then
  echo ""
  echo "## Workflow Command"
  echo ""
  echo "This task has a workflow command. Invoke it to get detailed instructions:"
  echo ""
  echo "    $TASK_COMMAND"
fi
