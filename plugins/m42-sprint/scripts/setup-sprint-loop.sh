#!/bin/bash

# Sprint Loop Setup Script
# Validates sprint directory and prepares for execution
# No longer creates stop-hook state file (using bash loop pattern instead)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
SPRINT_DIR=""
MAX_ITERATIONS=30

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
Sprint Loop Setup - Prepare sprint for execution

USAGE:
  setup-sprint-loop.sh <sprint-dir> [OPTIONS]

ARGUMENTS:
  sprint-dir    Path to sprint directory (required)

OPTIONS:
  --max-iterations <n>    Maximum iterations to pass to sprint-loop.sh (default: 30)
  -h, --help              Show this help message

DESCRIPTION:
  Validates the sprint directory structure and prepares for execution.
  Then launches sprint-loop.sh which invokes Claude with fresh context
  for each task iteration.

EXAMPLE:
  setup-sprint-loop.sh .claude/sprints/2026-01-15_my-sprint --max-iterations 50
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

# Check for yq (required for YAML operations)
if ! command -v yq &> /dev/null; then
  echo "Error: yq is required but not installed" >&2
  echo "Install with: brew install yq (macOS) or snap install yq (Linux)" >&2
  exit 1
fi

# Clean up any old loop-state.md files (migration from stop-hook pattern)
if [[ -f "$SPRINT_DIR/loop-state.md" ]]; then
  echo "Cleaning up old loop-state.md file (migrating from stop-hook pattern)..."
  rm "$SPRINT_DIR/loop-state.md"
fi

# Create context directory if it doesn't exist
mkdir -p "$SPRINT_DIR/context"

# Update sprint status if needed
CURRENT_STATUS=$(yq -r '.status // "not-started"' "$SPRINT_DIR/PROGRESS.yaml")
if [[ "$CURRENT_STATUS" == "not-started" ]]; then
  echo "Updating sprint status to in-progress..."
  yq -i '.status = "in-progress"' "$SPRINT_DIR/PROGRESS.yaml"
fi

# Record start time if not set
STARTED_AT=$(yq -r '.stats["started-at"] // null' "$SPRINT_DIR/PROGRESS.yaml")
if [[ "$STARTED_AT" == "null" ]]; then
  echo "Recording sprint start time..."
  yq -i ".stats[\"started-at\"] = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$SPRINT_DIR/PROGRESS.yaml"
fi

# Get queue info
QUEUE_LENGTH=$(yq -r '.queue | length' "$SPRINT_DIR/PROGRESS.yaml")

if [[ "$QUEUE_LENGTH" == "0" ]]; then
  echo "Warning: Task queue is empty. Nothing to execute."
  exit 0
fi

# Output setup summary
SPRINT_NAME=$(basename "$SPRINT_DIR")
cat <<EOF

Sprint Setup Complete
=====================

Sprint: $SPRINT_NAME
Directory: $SPRINT_DIR
Status: $(yq -r '.status' "$SPRINT_DIR/PROGRESS.yaml")
Tasks in queue: $QUEUE_LENGTH
Max iterations: $MAX_ITERATIONS

Ready to launch sprint loop with fresh context per iteration.

EOF

# Output the command to run (for reference)
echo "Sprint loop command:"
echo "  $SCRIPT_DIR/sprint-loop.sh \"$SPRINT_DIR\" --max-iterations $MAX_ITERATIONS"
echo ""
