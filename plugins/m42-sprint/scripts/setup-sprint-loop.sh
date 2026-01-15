#!/bin/bash

# Sprint Loop Setup Script
# Creates state file for sprint execution loop

set -euo pipefail

# Parse arguments
SPRINT_DIR=""
MAX_ITERATIONS=10

# First positional argument is sprint directory
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  SPRINT_DIR="$1"
  shift
fi

# Parse remaining options
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
Sprint Loop Setup - Initialize sprint execution loop

USAGE:
  setup-sprint-loop.sh <sprint-dir> [OPTIONS]

ARGUMENTS:
  sprint-dir    Path to sprint directory (required)

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 10)
  -h, --help              Show this help message

DESCRIPTION:
  Creates loop-state.md in the sprint directory to enable the stop hook
  to intercept exit attempts and continue processing the task queue.

EXAMPLE:
  setup-sprint-loop.sh .claude/sprints/2026-01-15_my-sprint --max-iterations 30
HELP_EOF
      exit 0
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]] || [[ ! "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-iterations requires a positive integer" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validate sprint directory
if [[ -z "$SPRINT_DIR" ]]; then
  echo "Error: Sprint directory path is required" >&2
  echo "Usage: setup-sprint-loop.sh <sprint-dir> [--max-iterations N]" >&2
  exit 1
fi

if [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Sprint directory does not exist: $SPRINT_DIR" >&2
  exit 1
fi

if [[ ! -f "$SPRINT_DIR/PROGRESS.yaml" ]]; then
  echo "Error: PROGRESS.yaml not found in: $SPRINT_DIR" >&2
  exit 1
fi

# Check for existing active loop
if [[ -f "$SPRINT_DIR/loop-state.md" ]]; then
  echo "Error: Sprint loop already active in: $SPRINT_DIR" >&2
  echo "Use /stop-sprint to stop the current loop first." >&2
  exit 1
fi

# Build the sprint execution prompt
SPRINT_NAME=$(basename "$SPRINT_DIR")
COMPLETION_PROMISE="SPRINT COMPLETE|SPRINT BLOCKED|SPRINT PAUSED"

PROMPT="Process sprint task queue from $SPRINT_DIR.

## Workflow Per Task

1. Read PROGRESS.yaml to get current-task from queue[0]
2. Check if task has a 'command' field
3. If command exists: invoke the command to get task-specific workflow instructions
4. If no command: execute task using task-type conventions
5. Follow the workflow instructions to complete the task
6. Update PROGRESS.yaml (remove from queue, add to completed, update stats)
7. Output a summary of what was accomplished
8. END TURN (do not continue to next task inline)

## Loop Control

After each task completion, check exit conditions:
- If pause-requested in PROGRESS.yaml is true: <promise>SPRINT PAUSED</promise>
- If queue is empty: <promise>SPRINT COMPLETE</promise>
- If task is blocked: update status, add to blocked list, <promise>SPRINT BLOCKED</promise>

The stop hook will trigger the next iteration automatically."

# Create state file in sprint directory
cat > "$SPRINT_DIR/loop-state.md" <<EOF
---
active: true
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: "$COMPLETION_PROMISE"
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sprint_dir: "$SPRINT_DIR"
---

$PROMPT
EOF

# Output setup message
cat <<EOF
Sprint loop activated!

Sprint: $SPRINT_NAME
Location: $SPRINT_DIR
Iteration: 1
Max iterations: $(if [[ $MAX_ITERATIONS -gt 0 ]]; then echo $MAX_ITERATIONS; else echo "unlimited"; fi)

The stop hook is now active. When you try to exit, the sprint prompt will be
fed back to continue processing the task queue.

Stop conditions (output as <promise>TEXT</promise>):
  - SPRINT COMPLETE - All tasks processed
  - SPRINT BLOCKED - Current task cannot proceed
  - SPRINT PAUSED - Pause was requested via /pause-sprint

To monitor: cat "$SPRINT_DIR/loop-state.md" | head -10
To stop: /stop-sprint

EOF

# Echo the prompt to start processing
echo ""
echo "$PROMPT"

# Display completion requirements
echo ""
echo "============================================================"
echo "SPRINT LOOP ACTIVE"
echo "============================================================"
echo ""
echo "To complete this sprint, output one of these EXACT texts:"
echo "  <promise>SPRINT COMPLETE</promise>  - When queue is empty"
echo "  <promise>SPRINT BLOCKED</promise>   - When task is blocked"
echo "  <promise>SPRINT PAUSED</promise>    - When pause requested"
echo ""
echo "IMPORTANT: Only output when the condition is TRUE."
echo "============================================================"
