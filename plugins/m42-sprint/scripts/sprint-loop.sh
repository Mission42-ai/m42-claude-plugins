#!/bin/bash

# Sprint Loop Wrapper
# Invokes Claude CLI with FRESH context each iteration
# This is the "dumb bash loop" pattern from Ralph Loop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print usage
usage() {
  cat << 'EOF'
Sprint Loop - Fresh context per iteration

USAGE:
  sprint-loop.sh <sprint-dir> [OPTIONS]

ARGUMENTS:
  sprint-dir    Path to sprint directory (required)

OPTIONS:
  --max-iterations <n>    Maximum iterations (default: 30)
  --delay <seconds>       Delay between iterations (default: 2)
  -h, --help              Show this help message

DESCRIPTION:
  Runs a bash loop that invokes `claude -p` with fresh context each iteration.
  Each invocation processes ONE task and exits. The loop checks PROGRESS.yaml
  status after each iteration and continues until complete/blocked/paused.

  This ensures 100% context utilization - no accumulated context between tasks.

EXIT CODES:
  0 - Sprint completed successfully or paused
  1 - Sprint blocked or max iterations reached
  2 - Human intervention required

EXAMPLE:
  sprint-loop.sh .claude/sprints/2026-01-15_my-sprint --max-iterations 50
EOF
}

# Parse arguments
SPRINT_DIR=""
MAX_ITERATIONS=30
DELAY=2

# First positional argument is sprint directory
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  SPRINT_DIR="$1"
  shift
fi

# Parse remaining options
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
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
    --delay)
      if [[ -z "${2:-}" ]] || [[ ! "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --delay requires a positive integer" >&2
        exit 1
      fi
      DELAY="$2"
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
  usage
  exit 1
fi

if [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Sprint directory does not exist: $SPRINT_DIR" >&2
  exit 1
fi

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "Error: PROGRESS.yaml not found in: $SPRINT_DIR" >&2
  exit 1
fi

# Check for yq (required for YAML parsing)
if ! command -v yq &> /dev/null; then
  echo "Error: yq is required but not installed" >&2
  echo "Install with: brew install yq (macOS) or snap install yq (Linux)" >&2
  exit 1
fi

# Extract sprint name for display
SPRINT_NAME=$(basename "$SPRINT_DIR")

echo "============================================================"
echo "SPRINT LOOP STARTING"
echo "============================================================"
echo ""
echo "Sprint: $SPRINT_NAME"
echo "Directory: $SPRINT_DIR"
echo "Max iterations: $MAX_ITERATIONS"
echo "Delay between iterations: ${DELAY}s"
echo ""
echo "Each iteration runs with FRESH context (no accumulation)"
echo "============================================================"
echo ""

# Main loop
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo ""
  echo "=== Sprint Iteration $i/$MAX_ITERATIONS ==="
  echo ""

  # Build prompt for this iteration
  PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")

  if [[ -z "$PROMPT" ]]; then
    echo "No tasks in queue. Sprint may be complete."
    # Update status to completed if queue is empty
    yq -i '.status = "completed"' "$PROGRESS_FILE"
    echo "Sprint completed successfully after $i iterations"
    exit 0
  fi

  # Invoke Claude with fresh context (non-interactive, auto-approve)
  # --dangerously-skip-permissions allows unattended execution
  # -p enables print mode (non-interactive, exits after completion)
  echo "Invoking Claude CLI with fresh context..."
  echo ""

  if ! claude -p "$PROMPT" --dangerously-skip-permissions; then
    echo ""
    echo "Warning: Claude CLI returned non-zero exit code"
    echo "Checking sprint status..."
  fi

  echo ""

  # Check completion status from PROGRESS.yaml
  STATUS=$(yq -r '.status // "in-progress"' "$PROGRESS_FILE")

  case "$STATUS" in
    completed)
      echo "============================================================"
      echo "SPRINT COMPLETED"
      echo "============================================================"
      echo "Sprint completed successfully after $i iterations"
      exit 0
      ;;
    blocked)
      echo "============================================================"
      echo "SPRINT BLOCKED"
      echo "============================================================"
      echo "Sprint blocked - manual intervention needed"
      echo ""
      echo "Blocked tasks:"
      yq -r '.blocked | .[-1] | to_yaml' "$PROGRESS_FILE" 2>/dev/null || echo "No blocked info"
      exit 1
      ;;
    paused)
      echo "============================================================"
      echo "SPRINT PAUSED"
      echo "============================================================"
      echo "Sprint paused by user request"
      echo "Resume with: /run-sprint $SPRINT_DIR"
      exit 0
      ;;
    needs-human)
      echo "============================================================"
      echo "HUMAN INTERVENTION REQUIRED"
      echo "============================================================"
      echo ""
      yq -r '.["human-needed"] | to_yaml' "$PROGRESS_FILE" 2>/dev/null || echo "No details provided"
      echo ""
      echo "After resolving, resume with: /run-sprint $SPRINT_DIR"
      exit 2
      ;;
  esac

  # Check if queue is empty (another completion condition)
  QUEUE_LENGTH=$(yq -r '.queue | length' "$PROGRESS_FILE")
  if [[ "$QUEUE_LENGTH" == "0" ]]; then
    echo "Queue is empty - marking sprint as completed"
    yq -i '.status = "completed"' "$PROGRESS_FILE"
    echo ""
    echo "============================================================"
    echo "SPRINT COMPLETED"
    echo "============================================================"
    echo "Sprint completed successfully after $i iterations"
    exit 0
  fi

  # Small delay between iterations
  if [[ $DELAY -gt 0 ]]; then
    echo "Waiting ${DELAY}s before next iteration..."
    sleep "$DELAY"
  fi
done

echo ""
echo "============================================================"
echo "MAX ITERATIONS REACHED"
echo "============================================================"
echo "Warning: Max iterations ($MAX_ITERATIONS) reached"
echo "Sprint may not be complete. Check $PROGRESS_FILE"
exit 1
