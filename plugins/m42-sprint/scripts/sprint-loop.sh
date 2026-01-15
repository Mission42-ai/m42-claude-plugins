#!/bin/bash

# Sprint Loop - Hierarchical Workflow Execution
# Iterates through phases → steps → sub-phases with fresh context each iteration
# This is the "dumb bash loop" pattern from Ralph Loop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat << 'EOF'
Sprint Loop - Hierarchical Workflow Execution

USAGE:
  sprint-loop.sh <sprint-dir> [OPTIONS]

ARGUMENTS:
  sprint-dir    Path to sprint directory (required)

OPTIONS:
  --max-iterations <n>    Maximum iterations (default: 100)
  --delay <seconds>       Delay between iterations (default: 2)
  -h, --help              Show this help message

DESCRIPTION:
  Executes a compiled workflow by iterating through the phase hierarchy:
  - Top-level phases (prepare, development, qa, deploy)
  - Steps within for-each phases
  - Sub-phases within each step

  Each iteration processes ONE sub-phase/phase and exits.
  Navigation is controlled via the `current` pointer in PROGRESS.yaml.

EXIT CODES:
  0 - Sprint completed successfully or paused
  1 - Sprint blocked or max iterations reached
  2 - Human intervention required

EXAMPLE:
  sprint-loop.sh .claude/sprints/2026-01-15_my-sprint --max-iterations 100
EOF
}

# Parse arguments
SPRINT_DIR=""
MAX_ITERATIONS=100
DELAY=2

if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  SPRINT_DIR="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --delay)
      DELAY="$2"
      shift 2
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validate
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
  echo "Error: PROGRESS.yaml not found. Run the compiler first." >&2
  exit 1
fi

if ! command -v yq &> /dev/null; then
  echo "Error: yq is required but not installed" >&2
  exit 1
fi

SPRINT_NAME=$(basename "$SPRINT_DIR")

echo "============================================================"
echo "SPRINT LOOP STARTING (Hierarchical Workflow)"
echo "============================================================"
echo ""
echo "Sprint: $SPRINT_NAME"
echo "Directory: $SPRINT_DIR"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

# Set initial status to in-progress if not-started
CURRENT_STATUS=$(yq -r '.status' "$PROGRESS_FILE")
if [[ "$CURRENT_STATUS" == "not-started" ]]; then
  yq -i '.status = "in-progress"' "$PROGRESS_FILE"
  yq -i ".stats.\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
fi

# Main loop
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo ""
  echo "=== Iteration $i/$MAX_ITERATIONS ==="

  # Build prompt for current position
  PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")

  if [[ -z "$PROMPT" ]]; then
    echo "No more work to do. Sprint complete."
    yq -i '.status = "completed"' "$PROGRESS_FILE"
    yq -i ".stats.\"completed-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
    echo ""
    echo "============================================================"
    echo "SPRINT COMPLETED"
    echo "============================================================"
    exit 0
  fi

  echo "Invoking Claude CLI..."
  echo ""

  if ! claude -p "$PROMPT" --dangerously-skip-permissions; then
    echo "Warning: Claude CLI returned non-zero exit code"
  fi

  # Check status
  STATUS=$(yq -r '.status' "$PROGRESS_FILE")

  case "$STATUS" in
    completed)
      echo ""
      echo "============================================================"
      echo "SPRINT COMPLETED"
      echo "============================================================"
      exit 0
      ;;
    blocked)
      echo ""
      echo "============================================================"
      echo "SPRINT BLOCKED"
      echo "============================================================"
      exit 1
      ;;
    paused)
      echo ""
      echo "============================================================"
      echo "SPRINT PAUSED"
      echo "============================================================"
      exit 0
      ;;
    needs-human)
      echo ""
      echo "============================================================"
      echo "HUMAN INTERVENTION REQUIRED"
      echo "============================================================"
      exit 2
      ;;
  esac

  # Delay between iterations
  if [[ $DELAY -gt 0 ]]; then
    sleep "$DELAY"
  fi
done

echo ""
echo "============================================================"
echo "MAX ITERATIONS REACHED"
echo "============================================================"
exit 1
