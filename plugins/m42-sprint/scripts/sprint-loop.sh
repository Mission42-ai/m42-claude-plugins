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
  --max-retries <n>       Maximum retries per phase on failure (default: 0)
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
MAX_RETRIES=0
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
    --max-retries)
      MAX_RETRIES="$2"
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

# Helper function to calculate elapsed time in HH:MM:SS format
calculate_elapsed() {
  local started_at="$1"
  local completed_at="$2"

  if [[ -z "$started_at" ]] || [[ "$started_at" == "null" ]]; then
    echo "00:00:00"
    return
  fi

  # Convert ISO timestamps to epoch seconds
  local start_epoch end_epoch
  if [[ "$(uname)" == "Darwin" ]]; then
    start_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$started_at" "+%s" 2>/dev/null || echo "0")
    end_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$completed_at" "+%s" 2>/dev/null || date "+%s")
  else
    start_epoch=$(date -d "$started_at" "+%s" 2>/dev/null || echo "0")
    end_epoch=$(date -d "$completed_at" "+%s" 2>/dev/null || date "+%s")
  fi

  local elapsed_seconds=$((end_epoch - start_epoch))
  if [[ $elapsed_seconds -lt 0 ]]; then
    elapsed_seconds=0
  fi

  # Format as HH:MM:SS
  local hours=$((elapsed_seconds / 3600))
  local minutes=$(((elapsed_seconds % 3600) / 60))
  local seconds=$((elapsed_seconds % 60))
  printf "%02d:%02d:%02d" "$hours" "$minutes" "$seconds"
}

# Helper function to update elapsed time for a completed phase
update_phase_elapsed() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_phase_idx="$3"

  local base_path=".phases[$phase_idx]"

  if [[ "$step_idx" != "null" ]] && [[ -n "$step_idx" ]]; then
    base_path="$base_path.steps[$step_idx]"
    if [[ "$sub_phase_idx" != "null" ]] && [[ -n "$sub_phase_idx" ]]; then
      base_path="$base_path.phases[$sub_phase_idx]"
    fi
  fi

  local status=$(yq -r "$base_path.status" "$PROGRESS_FILE")
  if [[ "$status" == "completed" ]]; then
    local started_at=$(yq -r "$base_path.\"started-at\" // \"null\"" "$PROGRESS_FILE")
    local completed_at=$(yq -r "$base_path.\"completed-at\" // \"null\"" "$PROGRESS_FILE")
    local existing_elapsed=$(yq -r "$base_path.elapsed // \"null\"" "$PROGRESS_FILE")

    # Only calculate if completed-at exists and elapsed not already set
    if [[ "$completed_at" != "null" ]] && [[ "$existing_elapsed" == "null" ]]; then
      local elapsed=$(calculate_elapsed "$started_at" "$completed_at")
      yq -i "$base_path.elapsed = \"$elapsed\"" "$PROGRESS_FILE"
    fi
  fi
}

# Helper function to get the YAML path for the current phase
get_current_phase_path() {
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  local base_path=".phases[$phase_idx]"

  # Check if phase has steps
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")
  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]]; then
    base_path="$base_path.steps[$step_idx]"
    if [[ "$sub_phase_idx" != "null" ]]; then
      base_path="$base_path.phases[$sub_phase_idx]"
    fi
  fi

  echo "$base_path"
}

# Helper function to handle phase failure with retry logic
handle_phase_failure() {
  local exit_code="$1"
  local error_output="$2"
  local phase_path=$(get_current_phase_path)

  # Get current retry count
  local retry_count=$(yq -r "$phase_path.\"retry-count\" // 0" "$PROGRESS_FILE")

  if [[ "$retry_count" -lt "$MAX_RETRIES" ]]; then
    # Increment retry count and keep status as in-progress for retry
    local new_retry_count=$((retry_count + 1))
    echo "Phase failed (attempt $new_retry_count/$((MAX_RETRIES + 1))). Retrying..."
    yq -i "$phase_path.\"retry-count\" = $new_retry_count" "$PROGRESS_FILE"
    yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output\"" "$PROGRESS_FILE"
    return 0  # Continue loop for retry
  else
    # Max retries exhausted, mark as blocked
    echo "Phase failed after $((retry_count + 1)) attempt(s). Marking as blocked."
    yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
    yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output (retries exhausted)\"" "$PROGRESS_FILE"
    yq -i '.status = "blocked"' "$PROGRESS_FILE"
    return 1  # Signal to exit loop
  fi
}

echo "============================================================"
echo "SPRINT LOOP STARTING (Hierarchical Workflow)"
echo "============================================================"
echo ""
echo "Sprint: $SPRINT_NAME"
echo "Directory: $SPRINT_DIR"
echo "Max iterations: $MAX_ITERATIONS"
echo "Max retries per phase: $MAX_RETRIES"
echo ""

# Run preflight checks before starting the loop
PREFLIGHT_SCRIPT="$SCRIPT_DIR/preflight-check.sh"
if [[ -f "$PREFLIGHT_SCRIPT" ]]; then
  echo "Running preflight checks..."
  if ! "$PREFLIGHT_SCRIPT" "$SPRINT_DIR"; then
    echo ""
    echo "============================================================"
    echo "PREFLIGHT CHECKS FAILED - Sprint cannot start"
    echo "============================================================"
    echo "Fix the issues above and try again."
    exit 1
  fi
  echo ""
fi

# Set initial status to in-progress if not-started
CURRENT_STATUS=$(yq -r '.status' "$PROGRESS_FILE")
if [[ "$CURRENT_STATUS" == "not-started" ]]; then
  yq -i '.status = "in-progress"' "$PROGRESS_FILE"
  yq -i ".stats.\"started-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
fi

# Write max iterations to PROGRESS.yaml for status display
yq -i ".stats.\"max-iterations\" = $MAX_ITERATIONS" "$PROGRESS_FILE"

# Main loop
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo ""
  echo "=== Iteration $i/$MAX_ITERATIONS ==="

  # Write current iteration to PROGRESS.yaml for status display
  yq -i ".stats.\"current-iteration\" = $i" "$PROGRESS_FILE"

  # Build prompt for current position
  PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")

  if [[ -z "$PROMPT" ]]; then
    echo "No more work to do. Sprint complete."
    yq -i '.status = "completed"' "$PROGRESS_FILE"
    COMPLETED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    yq -i ".stats.\"completed-at\" = \"$COMPLETED_AT\"" "$PROGRESS_FILE"
    # Calculate and set overall sprint elapsed time
    SPRINT_STARTED=$(yq -r '.stats."started-at" // "null"' "$PROGRESS_FILE")
    if [[ "$SPRINT_STARTED" != "null" ]]; then
      SPRINT_ELAPSED=$(calculate_elapsed "$SPRINT_STARTED" "$COMPLETED_AT")
      yq -i ".stats.elapsed = \"$SPRINT_ELAPSED\"" "$PROGRESS_FILE"
    fi
    echo ""
    echo "============================================================"
    echo "SPRINT COMPLETED"
    echo "============================================================"
    exit 0
  fi

  echo "Invoking Claude CLI..."
  echo ""

  # Capture output and exit code
  CLI_OUTPUT=""
  CLI_EXIT_CODE=0
  CLI_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1) || CLI_EXIT_CODE=$?
  echo "$CLI_OUTPUT"

  if [[ "$CLI_EXIT_CODE" -ne 0 ]]; then
    echo ""
    echo "Warning: Claude CLI returned non-zero exit code: $CLI_EXIT_CODE"

    # Handle the failure with retry logic
    ERROR_MSG=$(echo "$CLI_OUTPUT" | tail -c 500 | tr '\n' ' ')
    if ! handle_phase_failure "$CLI_EXIT_CODE" "$ERROR_MSG"; then
      echo ""
      echo "============================================================"
      echo "SPRINT BLOCKED - Phase failed after exhausting retries"
      echo "============================================================"
      exit 1
    fi

    # Retry will happen on next iteration, apply delay and continue
    if [[ $DELAY -gt 0 ]]; then
      sleep "$DELAY"
    fi
    continue
  fi

  # Update elapsed times for any completed phases
  # Read current pointer to know which phases to check
  CURR_PHASE=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  CURR_STEP=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  CURR_SUB=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  # Check completed phases and update elapsed times
  TOTAL_PHASES=$(yq -r '.phases | length' "$PROGRESS_FILE")
  for ((p=0; p<=CURR_PHASE && p<TOTAL_PHASES; p++)); do
    # Update top-level phase elapsed if completed
    update_phase_elapsed "$p" "" ""

    # Check steps within phase
    TOTAL_STEPS=$(yq -r ".phases[$p].steps | length // 0" "$PROGRESS_FILE")
    if [[ "$TOTAL_STEPS" -gt 0 ]]; then
      MAX_STEP=$((TOTAL_STEPS - 1))
      if [[ $p -eq $CURR_PHASE ]] && [[ "$CURR_STEP" != "null" ]]; then
        MAX_STEP="$CURR_STEP"
      fi
      for ((s=0; s<=MAX_STEP; s++)); do
        # Update step elapsed if completed
        update_phase_elapsed "$p" "$s" ""

        # Check sub-phases within step
        TOTAL_SUBS=$(yq -r ".phases[$p].steps[$s].phases | length // 0" "$PROGRESS_FILE")
        if [[ "$TOTAL_SUBS" -gt 0 ]]; then
          MAX_SUB=$((TOTAL_SUBS - 1))
          if [[ $p -eq $CURR_PHASE ]] && [[ $s -eq $CURR_STEP ]] && [[ "$CURR_SUB" != "null" ]]; then
            MAX_SUB="$CURR_SUB"
          fi
          for ((sp=0; sp<=MAX_SUB; sp++)); do
            update_phase_elapsed "$p" "$s" "$sp"
          done
        fi
      done
    fi
  done

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
