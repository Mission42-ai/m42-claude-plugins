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
  --max-iterations <n>    Maximum iterations (default: unlimited, 0 = unlimited)
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
  sprint-loop.sh .claude/sprints/2026-01-15_my-sprint --max-iterations 0
EOF
}

# Parse arguments
SPRINT_DIR=""
MAX_ITERATIONS=0
MAX_RETRIES=0
DELAY=2
HOOK_CONFIG=""
CLI_MAX_ITER_SET=false

# Default exponential backoff delays in milliseconds: 1s, 5s, 30s
BACKOFF_MS=(1000 5000 30000)

# Retryable error types (auto-retry with backoff)
RETRY_ON=("network" "rate-limit" "timeout")

# Export PLUGIN_DIR for hook script to use
export PLUGIN_DIR="${SCRIPT_DIR%/scripts}"

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
      CLI_MAX_ITER_SET=true
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
    --hook-config)
      HOOK_CONFIG="$2"
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
SPRINT_YAML="$SPRINT_DIR/SPRINT.yaml"

# Read max-iterations from SPRINT.yaml config if present and no CLI override was provided
# CLI flag takes precedence over config file
if [[ "$MAX_ITERATIONS" -eq 0 ]] && [[ "$CLI_MAX_ITER_SET" != "true" ]] && [[ -f "$SPRINT_YAML" ]]; then
  CONFIG_MAX_ITER=$(yq -r '.config."max-iterations" // "null"' "$SPRINT_YAML" 2>/dev/null || echo "null")
  if [[ "$CONFIG_MAX_ITER" != "null" ]]; then
    if [[ "$CONFIG_MAX_ITER" == "unlimited" ]] || [[ "$CONFIG_MAX_ITER" == "0" ]]; then
      MAX_ITERATIONS=0
      echo "Config: max-iterations set to unlimited (from SPRINT.yaml)"
    else
      MAX_ITERATIONS="$CONFIG_MAX_ITER"
      echo "Config: max-iterations set to $MAX_ITERATIONS (from SPRINT.yaml)"
    fi
  fi
fi

# Handle unlimited iterations (0 = unlimited, use very large number for bash for-loop)
UNLIMITED_MODE=false
if [[ "$MAX_ITERATIONS" -eq 0 ]]; then
  UNLIMITED_MODE=true
  # Use a very large number that effectively means unlimited
  # 2147483647 is max signed 32-bit int, but we use 1000000 for sanity
  MAX_ITERATIONS=1000000
  echo "Running in unlimited iteration mode (will only stop on status conditions)"
fi

# Cleanup function to remove sprint hook from settings on exit
# Cleanup function to remove sprint hook from settings on exit
cleanup_hook_config() {
  # Remove sprint hook from .claude/settings.json
  local settings_file=".claude/settings.json"
  if [[ -f "$settings_file" ]]; then
    node -e "
      const fs = require('fs');
      try {
        const settings = JSON.parse(fs.readFileSync('$settings_file', 'utf8'));
        if (settings.hooks && settings.hooks.PostToolUse) {
          settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(h =>
            !(h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('sprint-activity-hook')))
          );
          if (settings.hooks.PostToolUse.length === 0) {
            delete settings.hooks.PostToolUse;
          }
          if (Object.keys(settings.hooks).length === 0) {
            delete settings.hooks;
          }
          fs.writeFileSync('$settings_file', JSON.stringify(settings, null, 2) + '\n');
          console.log('Cleaned up sprint hook from settings');
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    " 2>/dev/null || true
  fi

  # Also remove old hook config file if present
  if [[ -n "$HOOK_CONFIG" ]] && [[ -f "$HOOK_CONFIG" ]]; then
    rm -f "$HOOK_CONFIG"
  fi
}

# Register cleanup trap for EXIT, INT, TERM signals
trap cleanup_hook_config EXIT

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

      # Record timing to JSONL for progress estimation
      record_phase_timing "$phase_idx" "$step_idx" "$sub_phase_idx" "$started_at" "$completed_at"
    fi
  fi
}

# Set phase timestamps from loop-captured times (deterministic timing)
# This function sets started-at and completed-at based on actual Claude process boundaries
set_phase_timestamps() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_phase_idx="$3"
  local start_iso="$4"
  local end_iso="$5"

  local base_path=".phases[$phase_idx]"

  if [[ "$step_idx" != "null" ]] && [[ -n "$step_idx" ]]; then
    base_path="$base_path.steps[$step_idx]"
    if [[ "$sub_phase_idx" != "null" ]] && [[ -n "$sub_phase_idx" ]]; then
      base_path="$base_path.phases[$sub_phase_idx]"
    fi
  fi

  # Update started-at if not already set (preserves original start on retries)
  local existing_start=$(yq -r "$base_path.\"started-at\" // \"null\"" "$PROGRESS_FILE")
  if [[ "$existing_start" == "null" ]]; then
    yq -i "$base_path.\"started-at\" = \"$start_iso\"" "$PROGRESS_FILE"
  fi

  # Set completed-at with actual end time (only if phase is completed)
  local status=$(yq -r "$base_path.status" "$PROGRESS_FILE")
  if [[ "$status" == "completed" ]]; then
    yq -i "$base_path.\"completed-at\" = \"$end_iso\"" "$PROGRESS_FILE"
  fi
}

# Helper function to record phase timing to timing.jsonl
# Format: {"phaseId":"string","workflow":"string","startTime":"ISO","endTime":"ISO","durationMs":number}
# Optional epoch params (6,7) provide precise duration when available from loop capture
record_phase_timing() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_phase_idx="$3"
  local startTime="$4"
  local endTime="$5"
  local start_epoch_provided="${6:-}"  # Optional: epoch seconds from loop
  local end_epoch_provided="${7:-}"    # Optional: epoch seconds from loop

  # Determine phaseId based on hierarchy level
  local phaseId=""
  if [[ "$sub_phase_idx" != "null" ]] && [[ -n "$sub_phase_idx" ]]; then
    phaseId=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_phase_idx].id // \"unknown\"" "$PROGRESS_FILE")
  elif [[ "$step_idx" != "null" ]] && [[ -n "$step_idx" ]]; then
    phaseId=$(yq -r ".phases[$phase_idx].steps[$step_idx].id // \"unknown\"" "$PROGRESS_FILE")
  else
    phaseId=$(yq -r ".phases[$phase_idx].id // \"unknown\"" "$PROGRESS_FILE")
  fi

  # Get workflow name from PROGRESS.yaml
  local workflow=$(yq -r '.workflow // "unknown"' "$PROGRESS_FILE")

  # Calculate duration in milliseconds - prefer provided epochs for precision
  local start_epoch end_epoch durationMs
  if [[ -n "$start_epoch_provided" ]] && [[ -n "$end_epoch_provided" ]]; then
    # Use loop-captured epochs for precise timing
    durationMs=$(( (end_epoch_provided - start_epoch_provided) * 1000 ))
  else
    # Fallback to ISO timestamp conversion
    if [[ "$(uname)" == "Darwin" ]]; then
      start_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$startTime" "+%s" 2>/dev/null || echo "0")
      end_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$endTime" "+%s" 2>/dev/null || echo "0")
    else
      start_epoch=$(date -d "$startTime" "+%s" 2>/dev/null || echo "0")
      end_epoch=$(date -d "$endTime" "+%s" 2>/dev/null || echo "0")
    fi
    durationMs=$(( (end_epoch - start_epoch) * 1000 ))
  fi

  # Get sprint ID
  local sprintId=$(yq -r '."sprint-id" // "unknown"' "$PROGRESS_FILE")

  # Build JSON record
  local json_record
  json_record=$(cat <<EOF
{"phaseId":"$phaseId","workflow":"$workflow","startTime":"$startTime","endTime":"$endTime","durationMs":$durationMs,"sprintId":"$sprintId"}
EOF
)

  # Append to timing.jsonl atomically
  local TIMING_FILE="$SPRINT_DIR/timing.jsonl"
  local TEMP_TIMING_FILE=$(mktemp -p "$SPRINT_DIR" .timing.tmp.XXXXXX 2>/dev/null || mktemp)

  {
    if [[ -f "$TIMING_FILE" ]]; then
      cat "$TIMING_FILE"
    fi
    echo "$json_record"
  } > "$TEMP_TIMING_FILE"

  mv "$TEMP_TIMING_FILE" "$TIMING_FILE"
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

# Classify error into categories: network, rate-limit, timeout, validation, logic
# Returns error type via ERROR_TYPE variable
classify_error() {
  local exit_code="$1"
  local error_output="$2"

  # Check for specific exit codes first
  if [[ "$exit_code" == "124" ]] || [[ "$exit_code" == "137" ]]; then
    ERROR_TYPE="timeout"
    return
  fi

  # Check for network errors
  if echo "$error_output" | grep -qiE "ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connection.*refused|connection.*reset|DNS.*failed|network.*error|socket.*hang.*up|unable.*to.*connect"; then
    ERROR_TYPE="network"
    return
  fi

  # Check for rate limiting
  if echo "$error_output" | grep -qiE "429|rate.*limit|too.*many.*requests|throttl|quota.*exceeded|overloaded"; then
    ERROR_TYPE="rate-limit"
    return
  fi

  # Check for timeout errors
  if echo "$error_output" | grep -qiE "timeout|timed.*out|exceeded.*time|deadline.*exceeded"; then
    ERROR_TYPE="timeout"
    return
  fi

  # Check for validation errors
  if echo "$error_output" | grep -qiE "invalid.*input|schema.*error|validation.*failed|required.*field|malformed|parse.*error|syntax.*error"; then
    ERROR_TYPE="validation"
    return
  fi

  # Default to logic error
  ERROR_TYPE="logic"
}

# Check if error type should be retried
is_retryable() {
  local error_type="$1"
  for retryable_type in "${RETRY_ON[@]}"; do
    if [[ "$error_type" == "$retryable_type" ]]; then
      return 0
    fi
  done
  return 1
}

# Get backoff delay for current retry attempt
get_backoff_delay() {
  local retry_count=$1
  local index=$((retry_count - 1))

  # Clamp to last backoff value if exceeding array
  if [[ $index -ge ${#BACKOFF_MS[@]} ]]; then
    index=$((${#BACKOFF_MS[@]} - 1))
  fi

  if [[ $index -lt 0 ]]; then
    index=0
  fi

  echo "${BACKOFF_MS[$index]}"
}

# Apply backoff delay before retry
apply_backoff() {
  local delay_ms=$1
  local delay_s=$((delay_ms / 1000))
  local phase_path=$(get_current_phase_path)

  # Calculate next retry timestamp
  local next_retry_at
  if [[ "$(uname)" == "Darwin" ]]; then
    next_retry_at=$(date -u -v+${delay_s}S +%Y-%m-%dT%H:%M:%SZ)
  else
    next_retry_at=$(date -u -d "+${delay_s} seconds" +%Y-%m-%dT%H:%M:%SZ)
  fi

  # Store next-retry-at in PROGRESS.yaml for UI display
  yq -i "$phase_path.\"next-retry-at\" = \"$next_retry_at\"" "$PROGRESS_FILE"

  echo "Waiting ${delay_s}s before retry (next retry at $next_retry_at)..."
  sleep "$delay_s"

  # Clear next-retry-at after backoff completes
  yq -i "del($phase_path.\"next-retry-at\")" "$PROGRESS_FILE"
}

# Add entry to intervention queue for non-retryable errors
add_to_intervention_queue() {
  local phase_id="$1"
  local error_msg="$2"
  local error_category="$3"

  local INTERVENTION_FILE="$SPRINT_DIR/intervention-queue.jsonl"
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Truncate error message to 1000 chars and escape quotes
  local truncated_error=$(echo "$error_msg" | head -c 1000 | sed 's/"/\\"/g' | tr '\n' ' ')

  # Append to intervention queue
  echo "{\"phaseId\":\"$phase_id\",\"error\":\"$truncated_error\",\"category\":\"$error_category\",\"timestamp\":\"$timestamp\"}" >> "$INTERVENTION_FILE"

  echo "Added to intervention queue: $phase_id (category: $error_category)"
}

# Check for force-retry signal file
check_force_retry() {
  local FORCE_RETRY_FILE="$SPRINT_DIR/.force-retry-requested"
  if [[ -f "$FORCE_RETRY_FILE" ]]; then
    # Read and remove the signal file
    local force_data=$(cat "$FORCE_RETRY_FILE")
    rm -f "$FORCE_RETRY_FILE"
    echo "Force retry requested: $force_data"
    return 0
  fi
  return 1
}

# Helper function to handle phase failure with retry logic
handle_phase_failure() {
  local exit_code="$1"
  local error_output="$2"
  local phase_path=$(get_current_phase_path)

  # Classify the error
  classify_error "$exit_code" "$error_output"
  echo "Error classified as: $ERROR_TYPE"

  # Store error category in PROGRESS.yaml
  yq -i "$phase_path.\"error-category\" = \"$ERROR_TYPE\"" "$PROGRESS_FILE"

  # Get phase ID for intervention queue
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")
  local phase_id=""

  if [[ "$sub_phase_idx" != "null" ]] && [[ -n "$sub_phase_idx" ]]; then
    phase_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_phase_idx].id // \"unknown\"" "$PROGRESS_FILE")
  elif [[ "$step_idx" != "null" ]] && [[ -n "$step_idx" ]]; then
    phase_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].id // \"unknown\"" "$PROGRESS_FILE")
  else
    phase_id=$(yq -r ".phases[$phase_idx].id // \"unknown\"" "$PROGRESS_FILE")
  fi

  # Get current retry count
  local retry_count=$(yq -r "$phase_path.\"retry-count\" // 0" "$PROGRESS_FILE")

  # Check if this error type is retryable
  if is_retryable "$ERROR_TYPE"; then
    if [[ "$retry_count" -lt "$MAX_RETRIES" ]]; then
      # Increment retry count
      local new_retry_count=$((retry_count + 1))
      echo "Phase failed (attempt $new_retry_count/$((MAX_RETRIES + 1))). Error type: $ERROR_TYPE (retryable)"

      yq -i "$phase_path.\"retry-count\" = $new_retry_count" "$PROGRESS_FILE"
      yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output\"" "$PROGRESS_FILE"

      # Apply exponential backoff
      local backoff_delay=$(get_backoff_delay "$new_retry_count")
      apply_backoff "$backoff_delay"

      return 0  # Continue loop for retry
    else
      # Max retries exhausted for retryable error, mark as blocked
      echo "Phase failed after $((retry_count + 1)) attempt(s). Error type: $ERROR_TYPE (retries exhausted)"
      yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
      yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output (retries exhausted)\"" "$PROGRESS_FILE"
      yq -i '.status = "blocked"' "$PROGRESS_FILE"

      # Add to intervention queue for human review
      add_to_intervention_queue "$phase_id" "$error_output" "$ERROR_TYPE"

      return 1  # Signal to exit loop
    fi
  else
    # Non-retryable error (validation, logic)
    echo "Phase failed with non-retryable error type: $ERROR_TYPE"

    if [[ "$ERROR_TYPE" == "validation" ]]; then
      # Validation errors: mark as skipped (or blocked for human review)
      echo "Validation error - marking phase as skipped"
      yq -i "$phase_path.status = \"skipped\"" "$PROGRESS_FILE"
      yq -i "$phase_path.error = \"Validation error (skipped): $exit_code - $error_output\"" "$PROGRESS_FILE"

      # Add to intervention queue for review
      add_to_intervention_queue "$phase_id" "$error_output" "$ERROR_TYPE"

      return 0  # Continue to next phase (skip this one)
    else
      # Logic errors: require human intervention
      echo "Logic error - requires human intervention"
      yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
      yq -i "$phase_path.error = \"Exit code: $exit_code - $error_output\"" "$PROGRESS_FILE"
      yq -i '.status = "needs-human"' "$PROGRESS_FILE"

      # Add to intervention queue with full context
      add_to_intervention_queue "$phase_id" "$error_output" "$ERROR_TYPE"

      return 1  # Signal to exit loop
    fi
  fi
}

echo "============================================================"
echo "SPRINT LOOP STARTING (Hierarchical Workflow)"
echo "============================================================"
echo ""
echo "Sprint: $SPRINT_NAME"
echo "Directory: $SPRINT_DIR"
if [[ "$UNLIMITED_MODE" == "true" ]]; then
  echo "Max iterations: unlimited (loop until completion)"
else
  echo "Max iterations: $MAX_ITERATIONS"
fi
echo "Max retries per phase: $MAX_RETRIES"
echo ""

# Create logs directory for phase output
mkdir -p "$SPRINT_DIR/logs"
echo "Logs directory: $SPRINT_DIR/logs"
echo ""

# Helper function to generate log filename from current pointer
get_log_filename() {
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  # Get phase name
  local phase_name=$(yq -r ".phases[$phase_idx].id // \"phase-$phase_idx\"" "$PROGRESS_FILE")

  # Build filename
  local log_name="$phase_name"

  # Check if phase has steps
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")
  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]]; then
    local step_name=$(yq -r ".phases[$phase_idx].steps[$step_idx].id // \"step-$step_idx\"" "$PROGRESS_FILE")
    log_name="${log_name}-${step_name}"

    if [[ "$sub_phase_idx" != "null" ]]; then
      local sub_name=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_phase_idx].id // \"subphase-$sub_phase_idx\"" "$PROGRESS_FILE")
      log_name="${log_name}-${sub_name}"
    fi
  fi

  # Sanitize filename (replace spaces and special chars)
  log_name=$(echo "$log_name" | tr ' ' '-' | tr -cd 'a-zA-Z0-9_-')

  echo "$SPRINT_DIR/logs/${log_name}.log"
}

# Helper function to generate transcript filename (mirrors get_log_filename)
get_transcript_filename() {
  local log_file=$(get_log_filename)
  local base_name=$(basename "$log_file" .log)
  mkdir -p "$SPRINT_DIR/transcripts"
  echo "$SPRINT_DIR/transcripts/${base_name}.jsonl"
}

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
  if [[ "$UNLIMITED_MODE" == "true" ]]; then
    echo "=== Iteration $i (unlimited mode) ==="
  else
    echo "=== Iteration $i/$MAX_ITERATIONS ==="
  fi

  # Check for force-retry signal (bypasses normal backoff wait)
  if check_force_retry; then
    echo "Force retry detected - bypassing normal backoff"
    # Clear any next-retry-at that may be set
    phase_path=$(get_current_phase_path)
    yq -i "del($phase_path.\"next-retry-at\")" "$PROGRESS_FILE" 2>/dev/null || true
  fi

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

  # Get log file path for this phase
  LOG_FILE=$(get_log_filename)
  TRANSCRIPT_FILE=$(get_transcript_filename)
  echo "Logging to: $LOG_FILE"
  echo "Transcript: $TRANSCRIPT_FILE"
  echo ""

  # Capture current position BEFORE Claude runs (it advances the pointer after completion)
  PREV_PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  PREV_STEP_IDX=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  PREV_SUB_IDX=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  # BEFORE Claude invocation - capture start time for deterministic timing
  PHASE_START_EPOCH=$(date +%s)
  PHASE_START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Invoke Claude with JSON streaming to capture full transcript
  # Note: HOOK_CONFIG is accepted but not used - Claude Code hooks are configured via settings files
  claude -p "$PROMPT" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --verbose \
    > "$TRANSCRIPT_FILE" 2>&1
  CLI_EXIT_CODE=$?

  # Extract final result text for legacy log file
  jq -r 'select(.type=="result") | .result // empty' "$TRANSCRIPT_FILE" > "$LOG_FILE" 2>/dev/null || true

  # Also extract CLI_OUTPUT for error handling
  CLI_OUTPUT=$(jq -r 'select(.type=="result") | .result // empty' "$TRANSCRIPT_FILE" 2>/dev/null || cat "$TRANSCRIPT_FILE")

  # AFTER Claude exits - capture end time for deterministic timing
  PHASE_END_EPOCH=$(date +%s)
  PHASE_END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  if [[ "$CLI_EXIT_CODE" -ne 0 ]]; then
    echo ""
    echo "Warning: Claude CLI returned non-zero exit code: $CLI_EXIT_CODE"

    # Handle the failure with retry logic (includes error classification and backoff)
    ERROR_MSG=$(echo "$CLI_OUTPUT" | tail -c 500 | tr '\n' ' ')
    if ! handle_phase_failure "$CLI_EXIT_CODE" "$ERROR_MSG"; then
      echo ""
      echo "============================================================"
      echo "SPRINT BLOCKED - Phase failed (error type: $ERROR_TYPE)"
      echo "Check intervention queue: $SPRINT_DIR/intervention-queue.jsonl"
      echo "============================================================"
      exit 1
    fi

    # Backoff already applied in handle_phase_failure, add normal delay
    if [[ $DELAY -gt 0 ]]; then
      sleep "$DELAY"
    fi
    continue
  fi

  # Set timestamps for the phase that was just executed using loop-captured times
  # (Claude advances pointer after marking complete, so we use PREV_* indices)
  set_phase_timestamps "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX" \
    "$PHASE_START_ISO" "$PHASE_END_ISO"

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
echo "ITERATION LIMIT REACHED ($MAX_ITERATIONS iterations)"
echo "============================================================"
echo ""
echo "The sprint loop has reached its iteration limit but the sprint"
echo "is not yet complete. This is a safety limit, not a failure."
echo ""
echo "Options:"
echo "  1. Resume with: /run-sprint $SPRINT_DIR"
echo "  2. Increase limit: --max-iterations <N> or set in SPRINT.yaml:"
echo "     config:"
echo "       max-iterations: unlimited"
echo ""
echo "Current status: $(yq -r '.status' "$PROGRESS_FILE")"
exit 1
