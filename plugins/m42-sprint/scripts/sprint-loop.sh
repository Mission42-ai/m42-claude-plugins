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

# =============================================================================
# JSON RESULT PARSING FUNCTIONS
# =============================================================================

# Extract JSON result from Claude transcript
# Looks for JSON block in the result text (between ```json and ```)
# Returns the JSON string or empty if not found
extract_json_result() {
  local transcript_file="$1"

  # First, try to extract from result field in stream-json output
  local result_text
  result_text=$(jq -r 'select(.type=="result") | .result // empty' "$transcript_file" 2>/dev/null | tail -1)

  if [[ -z "$result_text" ]]; then
    # Fallback: try to read raw file content
    result_text=$(cat "$transcript_file" 2>/dev/null)
  fi

  # Extract JSON from markdown code block
  # Look for ```json ... ``` pattern
  local json_block
  json_block=$(echo "$result_text" | sed -n '/```json/,/```/p' | sed '1d;$d' | tr '\n' ' ')

  if [[ -n "$json_block" ]]; then
    # Validate it's valid JSON
    if echo "$json_block" | jq empty 2>/dev/null; then
      echo "$json_block"
      return 0
    fi
  fi

  # Try to find raw JSON object in text (fallback)
  local raw_json
  raw_json=$(echo "$result_text" | grep -oE '\{[^}]*"status"[^}]*\}' | head -1)

  if [[ -n "$raw_json" ]] && echo "$raw_json" | jq empty 2>/dev/null; then
    echo "$raw_json"
    return 0
  fi

  # No valid JSON found
  return 1
}

# Process standard step result and update PROGRESS.yaml
# Args: transcript_file, phase_idx, step_idx, sub_phase_idx, start_iso, end_iso
process_standard_result() {
  local transcript_file="$1"
  local phase_idx="$2"
  local step_idx="$3"
  local sub_phase_idx="$4"
  local start_iso="$5"
  local end_iso="$6"

  # Try to extract JSON result
  local json_result
  json_result=$(extract_json_result "$transcript_file")

  if [[ -z "$json_result" ]]; then
    echo "Warning: No JSON result found in transcript. Assuming success based on exit code."
    # Default to completed if no JSON but CLI succeeded
    json_result='{"status": "completed", "summary": "Task completed (no JSON result provided)"}'
  fi

  # Parse JSON fields
  local status summary error human_reason human_details
  status=$(echo "$json_result" | jq -r '.status // "completed"')
  summary=$(echo "$json_result" | jq -r '.summary // "No summary provided"')
  error=$(echo "$json_result" | jq -r '.error // ""')
  human_reason=$(echo "$json_result" | jq -r '.humanNeeded.reason // ""')
  human_details=$(echo "$json_result" | jq -r '.humanNeeded.details // ""')

  # Build path to current phase/step/sub-phase
  local base_path=".phases[$phase_idx]"
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")

  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]] && [[ -n "$step_idx" ]]; then
    base_path="$base_path.steps[$step_idx]"
    if [[ "$sub_phase_idx" != "null" ]] && [[ -n "$sub_phase_idx" ]]; then
      base_path="$base_path.phases[$sub_phase_idx]"
    fi
  fi

  # Update PROGRESS.yaml based on status
  case "$status" in
    completed)
      echo "Step completed: $summary"

      # Mark current item as completed
      yq -i "$base_path.status = \"completed\"" "$PROGRESS_FILE"
      yq -i "$base_path.\"started-at\" = \"$start_iso\"" "$PROGRESS_FILE"
      yq -i "$base_path.\"completed-at\" = \"$end_iso\"" "$PROGRESS_FILE"

      # Advance the pointer
      advance_pointer "$phase_idx" "$step_idx" "$sub_phase_idx"
      ;;

    failed)
      echo "Step failed: $summary"
      echo "Error: $error"

      # Store error, keep status as in-progress for retry
      yq -i "$base_path.error = \"$error\"" "$PROGRESS_FILE"

      # Return non-zero to trigger retry handling
      return 1
      ;;

    needs-human)
      echo "Human intervention needed: $human_reason"

      yq -i "$base_path.status = \"needs-human\"" "$PROGRESS_FILE"
      yq -i ".status = \"needs-human\"" "$PROGRESS_FILE"
      yq -i ".human-needed.reason = \"$human_reason\"" "$PROGRESS_FILE"
      yq -i ".human-needed.details = \"$human_details\"" "$PROGRESS_FILE"

      # Return special code for human intervention
      return 2
      ;;

    *)
      echo "Warning: Unknown status '$status', treating as completed"
      yq -i "$base_path.status = \"completed\"" "$PROGRESS_FILE"
      yq -i "$base_path.\"completed-at\" = \"$end_iso\"" "$PROGRESS_FILE"
      advance_pointer "$phase_idx" "$step_idx" "$sub_phase_idx"
      ;;
  esac

  return 0
}

# Advance the current pointer to next phase/step/sub-phase
advance_pointer() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_phase_idx="$3"

  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")

  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]]; then
    # Phase with steps
    local total_sub_phases=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases | length" "$PROGRESS_FILE")
    local total_steps=$(yq -r ".phases[$phase_idx].steps | length" "$PROGRESS_FILE")
    local total_phases=$(yq -r '.phases | length' "$PROGRESS_FILE")

    local next_sub=$((sub_phase_idx + 1))

    if [[ "$next_sub" -ge "$total_sub_phases" ]]; then
      # All sub-phases done, move to next step
      yq -i ".phases[$phase_idx].steps[$step_idx].status = \"completed\"" "$PROGRESS_FILE"

      local next_step=$((step_idx + 1))
      if [[ "$next_step" -ge "$total_steps" ]]; then
        # All steps done, move to next phase
        yq -i ".phases[$phase_idx].status = \"completed\"" "$PROGRESS_FILE"

        local next_phase=$((phase_idx + 1))
        yq -i ".current.phase = $next_phase" "$PROGRESS_FILE"
        yq -i ".current.step = 0" "$PROGRESS_FILE"
        yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"

        # Check if sprint is complete
        if [[ "$next_phase" -ge "$total_phases" ]]; then
          yq -i '.status = "completed"' "$PROGRESS_FILE"
          yq -i ".stats.\"completed-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
        fi
      else
        # Move to next step
        yq -i ".current.step = $next_step" "$PROGRESS_FILE"
        yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"
      fi
    else
      # Move to next sub-phase
      yq -i ".current.\"sub-phase\" = $next_sub" "$PROGRESS_FILE"
    fi
  else
    # Simple phase (no steps)
    local total_phases=$(yq -r '.phases | length' "$PROGRESS_FILE")
    local next_phase=$((phase_idx + 1))

    yq -i ".phases[$phase_idx].status = \"completed\"" "$PROGRESS_FILE"
    yq -i ".current.phase = $next_phase" "$PROGRESS_FILE"
    yq -i ".current.step = 0" "$PROGRESS_FILE"
    yq -i '.current."sub-phase" = 0' "$PROGRESS_FILE"

    # Check if sprint is complete
    if [[ "$next_phase" -ge "$total_phases" ]]; then
      yq -i '.status = "completed"' "$PROGRESS_FILE"
      yq -i ".stats.\"completed-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
    fi
  fi
}

# Process Ralph mode result and update PROGRESS.yaml
# Args: transcript_file, iteration
process_ralph_result() {
  local transcript_file="$1"
  local iteration="$2"

  # Try to extract JSON result
  local json_result
  json_result=$(extract_json_result "$transcript_file")

  if [[ -z "$json_result" ]]; then
    echo "Warning: No JSON result found in Ralph transcript."
    return 1
  fi

  # Parse JSON fields
  local status summary goal_summary
  status=$(echo "$json_result" | jq -r '.status // "continue"')
  summary=$(echo "$json_result" | jq -r '.summary // "No summary provided"')
  goal_summary=$(echo "$json_result" | jq -r '.goalCompleteSummary // ""')

  echo "Ralph result: status=$status, summary=$summary"

  case "$status" in
    continue)
      # 1. Mark completed steps
      local completed_ids
      completed_ids=$(echo "$json_result" | jq -r '.completedStepIds // [] | .[]' 2>/dev/null)

      for cid in $completed_ids; do
        echo "Marking step $cid as completed"
        yq -i "(.dynamic-steps[] | select(.id == \"$cid\")).status = \"completed\"" "$PROGRESS_FILE"
        yq -i "(.dynamic-steps[] | select(.id == \"$cid\")).\"completed-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
      done

      # 2. Process pending steps (complete replacement of pending order)
      local pending_steps
      pending_steps=$(echo "$json_result" | jq -c '.pendingSteps // []')

      if [[ "$pending_steps" != "[]" ]] && [[ "$pending_steps" != "null" ]]; then
        # Get next available step ID
        local max_id
        max_id=$(yq -r '[.dynamic-steps[].id | select(. != null) | ltrimstr("step-") | tonumber] | max // -1' "$PROGRESS_FILE")
        local next_id=$((max_id + 1))

        # First, mark all current pending steps as "reordered" (will be updated or removed)
        # We'll rebuild the pending list from the agent's specification

        # Process each step from agent's pending list
        echo "$pending_steps" | jq -c '.[]' | while read -r step; do
          local step_id step_prompt
          step_id=$(echo "$step" | jq -r '.id // empty')
          step_prompt=$(echo "$step" | jq -r '.prompt')

          if [[ -z "$step_id" ]] || [[ "$step_id" == "null" ]]; then
            # New step - generate ID and add
            local new_id="step-$next_id"
            next_id=$((next_id + 1))
            echo "Adding new step: $new_id"

            yq -i ".dynamic-steps += [{
              \"id\": \"$new_id\",
              \"prompt\": \"$step_prompt\",
              \"status\": \"pending\",
              \"added-at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
              \"added-in-iteration\": $iteration
            }]" "$PROGRESS_FILE"
          else
            # Existing step - ensure it stays pending (agent wants it in this order)
            echo "Keeping existing step: $step_id"
            # Note: Order is determined by array position in dynamic-steps
            # For now we trust the agent hasn't reordered existing steps incorrectly
          fi
        done
      fi

      return 0
      ;;

    goal-complete)
      echo "Goal complete: $goal_summary"

      # Mark any completed steps from this iteration
      local completed_ids
      completed_ids=$(echo "$json_result" | jq -r '.completedStepIds // [] | .[]' 2>/dev/null)

      for cid in $completed_ids; do
        yq -i "(.dynamic-steps[] | select(.id == \"$cid\")).status = \"completed\"" "$PROGRESS_FILE"
        yq -i "(.dynamic-steps[] | select(.id == \"$cid\")).\"completed-at\" = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$PROGRESS_FILE"
      done

      # Special return code to signal goal completion
      return 100
      ;;

    needs-human)
      local human_reason human_details
      human_reason=$(echo "$json_result" | jq -r '.humanNeeded.reason // "No reason provided"')
      human_details=$(echo "$json_result" | jq -r '.humanNeeded.details // ""')

      echo "Human intervention needed: $human_reason"

      yq -i '.status = "needs-human"' "$PROGRESS_FILE"
      yq -i ".human-needed.reason = \"$human_reason\"" "$PROGRESS_FILE"
      yq -i ".human-needed.details = \"$human_details\"" "$PROGRESS_FILE"

      return 2
      ;;

    *)
      echo "Warning: Unknown Ralph status '$status'"
      return 1
      ;;
  esac
}

# =============================================================================
# RALPH MODE FUNCTIONS
# =============================================================================

# Record Ralph mode completion
record_ralph_completion() {
  local iteration="$1"
  local summary="$2"
  local completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Update ralph-exit section
  yq -i ".ralph-exit.\"detected-at\" = \"$completed_at\"" "$PROGRESS_FILE"
  yq -i ".ralph-exit.iteration = $iteration" "$PROGRESS_FILE"
  yq -i ".ralph-exit.\"final-summary\" = \"$summary\"" "$PROGRESS_FILE"

  # Set sprint status
  yq -i '.status = "completed"' "$PROGRESS_FILE"
  yq -i ".stats.\"completed-at\" = \"$completed_at\"" "$PROGRESS_FILE"

  # Calculate elapsed time
  local started_at=$(yq -r '.stats."started-at" // "null"' "$PROGRESS_FILE")
  if [[ "$started_at" != "null" ]]; then
    local elapsed=$(calculate_elapsed "$started_at" "$completed_at")
    yq -i ".stats.elapsed = \"$elapsed\"" "$PROGRESS_FILE"
  fi

  echo ""
  echo "============================================================"
  echo "RALPH MODE COMPLETED"
  echo "============================================================"
  echo "Iteration: $iteration"
  echo "Summary: $summary"
}

# Spawn per-iteration hooks for Ralph mode
spawn_per_iteration_hooks() {
  local iteration=$1

  # Check if per-iteration-hooks section exists
  local hooks_exist=$(yq -r '.per-iteration-hooks // "null"' "$PROGRESS_FILE")
  if [[ "$hooks_exist" == "null" ]]; then
    return
  fi

  # Read enabled hooks count
  local hooks_count=$(yq -r '.per-iteration-hooks // [] | map(select(.enabled == true)) | length' "$PROGRESS_FILE")

  if [[ "$hooks_count" -eq 0 ]]; then
    return
  fi

  echo "Spawning $hooks_count per-iteration hook(s)..."

  for ((h=0; h<hooks_count; h++)); do
    local hook_id=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].id" "$PROGRESS_FILE")
    local workflow=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].workflow // \"\"" "$PROGRESS_FILE")
    local prompt=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].prompt // \"\"" "$PROGRESS_FILE")
    local parallel=$(yq -r ".per-iteration-hooks | map(select(.enabled == true))[$h].parallel // false" "$PROGRESS_FILE")

    # Register task in hook-tasks array
    local spawned_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    yq -i ".hook-tasks += [{\"iteration\": $iteration, \"hook-id\": \"$hook_id\", \"status\": \"in-progress\", \"spawned-at\": \"$spawned_at\"}]" "$PROGRESS_FILE"

    # Export iteration transcript path for prompt substitution
    local ITERATION_TRANSCRIPT="$SPRINT_DIR/transcripts/iteration-$iteration.jsonl"
    export ITERATION_TRANSCRIPT

    # Build hook prompt
    local HOOK_PROMPT=""
    if [[ -n "$workflow" ]] && [[ "$workflow" != "null" ]] && [[ "$workflow" != "" ]]; then
      # Workflow reference (e.g., "m42-signs:learning-extraction")
      HOOK_PROMPT="/$workflow $ITERATION_TRANSCRIPT"
    elif [[ -n "$prompt" ]] && [[ "$prompt" != "null" ]] && [[ "$prompt" != "" ]]; then
      # Inline prompt - substitute variables
      HOOK_PROMPT=$(echo "$prompt" | envsubst)
    else
      echo "Warning: Hook $hook_id has no workflow or prompt defined, skipping"
      yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"skipped\"" "$PROGRESS_FILE"
      continue
    fi

    if [[ "$parallel" == "true" ]]; then
      # Non-blocking: spawn in background
      echo "  Spawning hook '$hook_id' in background (parallel)"
      (
        claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
        yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
      ) &
    else
      # Blocking: wait for completion
      echo "  Running hook '$hook_id' (blocking)"
      claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
      yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
    fi
  done
}

# Ralph Loop - Autonomous goal-driven execution
run_ralph_loop() {
  local iteration=0
  local idle_count=0
  local IDLE_THRESHOLD=$(yq -r '.ralph."idle-threshold" // 3' "$PROGRESS_FILE")

  echo ""
  echo "============================================================"
  echo "RALPH MODE - Autonomous Goal-Driven Execution"
  echo "============================================================"
  echo "Idle threshold: $IDLE_THRESHOLD iterations"
  echo ""

  # Ensure transcripts directory exists
  mkdir -p "$SPRINT_DIR/transcripts"

  while true; do
    iteration=$((iteration + 1))

    echo ""
    echo "=== Ralph Iteration $iteration ==="

    # Update iteration counter in PROGRESS.yaml
    yq -i ".stats.\"current-iteration\" = $iteration" "$PROGRESS_FILE"

    # 1. Determine mode based on pending dynamic steps
    local PENDING_COUNT=$(yq -r '[.dynamic-steps // [] | .[] | select(.status == "pending")] | length' "$PROGRESS_FILE")
    local LOOP_MODE=""

    if [[ "$PENDING_COUNT" -eq 0 ]]; then
      idle_count=$((idle_count + 1))
      if [[ $idle_count -ge $IDLE_THRESHOLD ]]; then
        LOOP_MODE="reflecting"
      else
        LOOP_MODE="planning"
      fi
    else
      LOOP_MODE="executing"
      idle_count=0
    fi

    echo "Mode: $LOOP_MODE (pending steps: $PENDING_COUNT, idle count: $idle_count)"

    # 2. Build prompt via build-ralph-prompt.sh
    local PROMPT=""
    if [[ -x "$SCRIPT_DIR/build-ralph-prompt.sh" ]]; then
      PROMPT=$("$SCRIPT_DIR/build-ralph-prompt.sh" "$SPRINT_DIR" "$LOOP_MODE" "$iteration")
    else
      echo "Error: build-ralph-prompt.sh not found or not executable" >&2
      yq -i '.status = "blocked"' "$PROGRESS_FILE"
      yq -i '.error = "build-ralph-prompt.sh not found"' "$PROGRESS_FILE"
      exit 1
    fi

    if [[ -z "$PROMPT" ]]; then
      echo "Error: Empty prompt from build-ralph-prompt.sh" >&2
      yq -i '.status = "blocked"' "$PROGRESS_FILE"
      yq -i '.error = "Empty prompt from build-ralph-prompt.sh"' "$PROGRESS_FILE"
      exit 1
    fi

    # 3. Spawn per-iteration hooks (parallel tasks)
    spawn_per_iteration_hooks "$iteration"

    # 4. Execute Claude with transcript capture
    local TRANSCRIPT_FILE="$SPRINT_DIR/transcripts/iteration-$iteration.jsonl"
    echo "Transcript: $TRANSCRIPT_FILE"
    echo ""
    echo "Invoking Claude CLI..."

    claude -p "$PROMPT" \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --verbose \
      > "$TRANSCRIPT_FILE" 2>&1
    local CLI_EXIT_CODE=$?

    if [[ "$CLI_EXIT_CODE" -ne 0 ]]; then
      echo "Warning: Claude CLI returned non-zero exit code: $CLI_EXIT_CODE"
      # Continue to next iteration (don't exit on individual failures)
    fi

    # 5. DETERMINISTIC STATE UPDATE: Parse JSON result and update PROGRESS.yaml
    # The agent no longer modifies PROGRESS.yaml directly - we do it here
    local RESULT_CODE=0
    process_ralph_result "$TRANSCRIPT_FILE" "$iteration" || RESULT_CODE=$?

    case "$RESULT_CODE" in
      0)
        # Continue - steps updated, keep iterating
        idle_count=0  # Reset idle count since we made progress
        ;;
      100)
        # Goal complete - record and exit
        local goal_summary
        goal_summary=$(extract_json_result "$TRANSCRIPT_FILE" | jq -r '.goalCompleteSummary // .summary // "Goal completed"')
        record_ralph_completion "$iteration" "$goal_summary"
        wait  # Wait for all parallel hooks to complete
        exit 0
        ;;
      2)
        # Needs human - already set in process_ralph_result
        echo ""
        echo "============================================================"
        echo "RALPH MODE - HUMAN INTERVENTION REQUIRED"
        echo "============================================================"
        wait
        exit 2
        ;;
      *)
        # Other error - log and continue
        echo "Warning: process_ralph_result returned $RESULT_CODE"
        ;;
    esac

    # 6. Check for status changes (may have been set by process_ralph_result or other means)
    local STATUS=$(yq -r '.status' "$PROGRESS_FILE")
    case "$STATUS" in
      completed)
        echo ""
        echo "============================================================"
        echo "RALPH MODE COMPLETED"
        echo "============================================================"
        wait
        exit 0
        ;;
      blocked)
        echo ""
        echo "============================================================"
        echo "RALPH MODE BLOCKED"
        echo "============================================================"
        wait
        exit 1
        ;;
      needs-human)
        echo ""
        echo "============================================================"
        echo "RALPH MODE - HUMAN INTERVENTION REQUIRED"
        echo "============================================================"
        wait
        exit 2
        ;;
      paused)
        echo ""
        echo "============================================================"
        echo "RALPH MODE PAUSED"
        echo "============================================================"
        wait
        exit 0
        ;;
    esac

    # Small delay between iterations
    sleep 2
  done
}

# =============================================================================
# PARALLEL TASK MANAGEMENT FUNCTIONS
# =============================================================================

# Check if current sub-phase has parallel flag
# Returns: "true" or "false" (string for bash comparison)
is_parallel_subphase() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_idx="$3"

  # Check if indices are valid
  if [[ -z "$phase_idx" ]] || [[ -z "$step_idx" ]] || [[ -z "$sub_idx" ]]; then
    echo "false"
    return
  fi
  if [[ "$step_idx" == "null" ]] || [[ "$sub_idx" == "null" ]]; then
    echo "false"
    return
  fi

  local parallel_flag
  parallel_flag=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].parallel // false" "$PROGRESS_FILE" 2>/dev/null)
  echo "$parallel_flag"
}

# Spawn a parallel task in background and register in PROGRESS.yaml
spawn_parallel_task() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_idx="$3"

  # Get step and phase identifiers
  local step_id
  local phase_id
  step_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].id // \"step-$step_idx\"" "$PROGRESS_FILE")
  phase_id=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].id // \"phase-$sub_idx\"" "$PROGRESS_FILE")

  # Generate unique task ID
  local timestamp
  timestamp=$(date +%s)
  local task_id="${step_id}-${phase_id}-${timestamp}"
  local log_file="$SPRINT_DIR/logs/${task_id}.log"
  local transcript_file="$SPRINT_DIR/transcripts/${task_id}.jsonl"

  # Ensure directories exist
  mkdir -p "$SPRINT_DIR/logs"
  mkdir -p "$SPRINT_DIR/transcripts"

  # Build prompt for parallel task using dedicated script
  local prompt
  prompt=$("$SCRIPT_DIR/build-parallel-prompt.sh" "$SPRINT_DIR" "$phase_idx" "$step_idx" "$sub_idx" "$task_id")

  # Get current ISO timestamp
  local spawned_at
  spawned_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Spawn Claude in background with JSON streaming
  (claude -p "$prompt" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --verbose \
    > "$transcript_file" 2>&1) &
  local pid=$!

  # Register task in PROGRESS.yaml parallel-tasks array
  yq -i ".[\"parallel-tasks\"] += [{
    \"id\": \"$task_id\",
    \"step-id\": \"$step_id\",
    \"phase-id\": \"$phase_id\",
    \"status\": \"spawned\",
    \"pid\": $pid,
    \"log-file\": \"$log_file\",
    \"spawned-at\": \"$spawned_at\"
  }]" "$PROGRESS_FILE"

  # Mark sub-phase as spawned and link to parallel task
  yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].status = \"spawned\"" "$PROGRESS_FILE"
  yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].\"parallel-task-id\" = \"$task_id\"" "$PROGRESS_FILE"
  yq -i ".phases[$phase_idx].steps[$step_idx].phases[$sub_idx].\"started-at\" = \"$spawned_at\"" "$PROGRESS_FILE"

  echo "Spawned parallel task: $task_id (PID: $pid)"
  echo "  Log file: $log_file"
}

# Check if phase has wait-for-parallel flag
# Returns: "true" or "false" (string for bash comparison)
is_wait_for_parallel_phase() {
  local phase_idx="$1"

  if [[ -z "$phase_idx" ]]; then
    echo "false"
    return
  fi

  local wait_flag
  wait_flag=$(yq -r ".phases[$phase_idx].\"wait-for-parallel\" // false" "$PROGRESS_FILE" 2>/dev/null)
  echo "$wait_flag"
}

# Wait for all parallel tasks to complete
# Blocks until no tasks have 'spawned' or 'running' status
wait_for_parallel_tasks() {
  echo "Checking for parallel tasks to wait for..."

  local running
  local check_interval=5

  while true; do
    # Update statuses of running tasks
    update_parallel_task_statuses

    # Count tasks still in progress
    running=$(yq -r '."parallel-tasks" // [] | map(select(.status == "spawned" or .status == "running")) | length' "$PROGRESS_FILE" 2>/dev/null)

    if [[ -z "$running" ]] || [[ "$running" -eq 0 ]]; then
      echo "All parallel tasks completed."

      # Check for any failures
      local failed
      failed=$(yq -r '."parallel-tasks" // [] | map(select(.status == "failed")) | length' "$PROGRESS_FILE" 2>/dev/null)
      if [[ -n "$failed" ]] && [[ "$failed" -gt 0 ]]; then
        echo "Warning: $failed parallel task(s) failed. Check logs for details."
      fi
      break
    fi

    echo "Waiting for $running parallel task(s)..."
    sleep "$check_interval"
  done
}

# Poll and update status of running parallel tasks
# Checks each task's PID and updates PROGRESS.yaml when processes complete
update_parallel_task_statuses() {
  # Get list of active tasks (spawned or running)
  local tasks
  tasks=$(yq -r '."parallel-tasks" // [] | .[] | select(.status == "spawned" or .status == "running") | .id + ":" + (.pid | tostring)' "$PROGRESS_FILE" 2>/dev/null)

  if [[ -z "$tasks" ]]; then
    return
  fi

  local completed_at
  completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Process each active task
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue

    local task_id="${entry%%:*}"
    local pid="${entry##*:}"

    # Check if process is still running using kill -0
    if ! kill -0 "$pid" 2>/dev/null; then
      # Process has exited - get exit code
      wait "$pid" 2>/dev/null
      local exit_code=$?

      local status="completed"
      if [[ "$exit_code" -ne 0 ]]; then
        status="failed"
      fi

      # Update task status in PROGRESS.yaml
      yq -i "(.[\"parallel-tasks\"][] | select(.id == \"$task_id\")) |= . + {
        \"status\": \"$status\",
        \"completed-at\": \"$completed_at\",
        \"exit-code\": $exit_code
      }" "$PROGRESS_FILE"

      # Also update the linked sub-phase status
      local step_id
      local phase_id
      step_id=$(yq -r ".[\"parallel-tasks\"][] | select(.id == \"$task_id\") | .[\"step-id\"]" "$PROGRESS_FILE")
      phase_id=$(yq -r ".[\"parallel-tasks\"][] | select(.id == \"$task_id\") | .[\"phase-id\"]" "$PROGRESS_FILE")

      echo "Parallel task $task_id completed with status: $status (exit code: $exit_code)"

      # Extract result text from transcript to log file if transcript exists
      local log_file
      log_file=$(yq -r ".[\"parallel-tasks\"][] | select(.id == \"$task_id\") | .[\"log-file\"]" "$PROGRESS_FILE")
      local transcript_file="${log_file%.log}.jsonl"
      transcript_file="${transcript_file/logs/transcripts}"
      if [[ -f "$transcript_file" ]]; then
        jq -r 'select(.type=="result") | .result // empty' "$transcript_file" > "$log_file" 2>/dev/null || true
      fi
    else
      # Process still running - update status to 'running' if it was 'spawned'
      local current_status
      current_status=$(yq -r ".[\"parallel-tasks\"][] | select(.id == \"$task_id\") | .status" "$PROGRESS_FILE")
      if [[ "$current_status" == "spawned" ]]; then
        yq -i "(.[\"parallel-tasks\"][] | select(.id == \"$task_id\")).status = \"running\"" "$PROGRESS_FILE"
      fi
    fi
  done <<< "$tasks"
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

# Helper function to build log filename from explicit indices (internal use)
_build_log_filename_for_position() {
  local phase_idx="$1"
  local step_idx="$2"
  local sub_phase_idx="$3"

  # Get phase name
  local phase_name=$(yq -r ".phases[$phase_idx].id // \"phase-$phase_idx\"" "$PROGRESS_FILE")
  local log_name="$phase_name"

  # Check if phase has steps
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")
  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]] && [[ "$step_idx" != "-1" ]]; then
    local step_name=$(yq -r ".phases[$phase_idx].steps[$step_idx].id // \"step-$step_idx\"" "$PROGRESS_FILE")
    log_name="${log_name}-${step_name}"

    if [[ "$sub_phase_idx" != "null" ]] && [[ "$sub_phase_idx" != "-1" ]]; then
      local sub_name=$(yq -r ".phases[$phase_idx].steps[$step_idx].phases[$sub_phase_idx].id // \"subphase-$sub_phase_idx\"" "$PROGRESS_FILE")
      log_name="${log_name}-${sub_name}"
    fi
  fi

  # Sanitize filename
  log_name=$(echo "$log_name" | tr ' ' '-' | tr -cd 'a-zA-Z0-9_-')
  echo "$SPRINT_DIR/logs/${log_name}.log"
}

# Helper function to get previous step's log filename (deterministic from current position)
get_previous_log_filename() {
  local phase_idx=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
  local step_idx=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
  local sub_phase_idx=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

  # Calculate previous position
  local prev_phase_idx=""
  local prev_step_idx=""
  local prev_sub_idx=""

  # Check if current phase has steps
  local has_steps=$(yq -r ".phases[$phase_idx].steps // \"null\"" "$PROGRESS_FILE")

  if [[ "$has_steps" != "null" ]] && [[ "$step_idx" != "null" ]]; then
    # Phase with steps - check sub-phase position
    if [[ "$sub_phase_idx" != "null" ]] && [[ "$sub_phase_idx" -gt 0 ]]; then
      # Previous is same phase, same step, previous sub-phase
      prev_phase_idx="$phase_idx"
      prev_step_idx="$step_idx"
      prev_sub_idx=$((sub_phase_idx - 1))
    elif [[ "$step_idx" -gt 0 ]]; then
      # Previous is same phase, previous step, last sub-phase of that step
      prev_phase_idx="$phase_idx"
      prev_step_idx=$((step_idx - 1))
      local total_subs=$(yq -r ".phases[$phase_idx].steps[$prev_step_idx].phases | length // 0" "$PROGRESS_FILE")
      if [[ "$total_subs" -gt 0 ]]; then
        prev_sub_idx=$((total_subs - 1))
      else
        prev_sub_idx="null"
      fi
    elif [[ "$phase_idx" -gt 0 ]]; then
      # Previous is previous phase, last step, last sub-phase
      prev_phase_idx=$((phase_idx - 1))
      local prev_has_steps=$(yq -r ".phases[$prev_phase_idx].steps // \"null\"" "$PROGRESS_FILE")
      if [[ "$prev_has_steps" != "null" ]]; then
        local total_steps=$(yq -r ".phases[$prev_phase_idx].steps | length // 0" "$PROGRESS_FILE")
        prev_step_idx=$((total_steps - 1))
        local total_subs=$(yq -r ".phases[$prev_phase_idx].steps[$prev_step_idx].phases | length // 0" "$PROGRESS_FILE")
        if [[ "$total_subs" -gt 0 ]]; then
          prev_sub_idx=$((total_subs - 1))
        else
          prev_sub_idx="null"
        fi
      else
        # Previous phase is simple (no steps)
        prev_step_idx="null"
        prev_sub_idx="null"
      fi
    else
      # First position - no previous
      echo ""
      return
    fi
  else
    # Simple phase (no steps)
    if [[ "$phase_idx" -gt 0 ]]; then
      prev_phase_idx=$((phase_idx - 1))
      local prev_has_steps=$(yq -r ".phases[$prev_phase_idx].steps // \"null\"" "$PROGRESS_FILE")
      if [[ "$prev_has_steps" != "null" ]]; then
        local total_steps=$(yq -r ".phases[$prev_phase_idx].steps | length // 0" "$PROGRESS_FILE")
        prev_step_idx=$((total_steps - 1))
        local total_subs=$(yq -r ".phases[$prev_phase_idx].steps[$prev_step_idx].phases | length // 0" "$PROGRESS_FILE")
        if [[ "$total_subs" -gt 0 ]]; then
          prev_sub_idx=$((total_subs - 1))
        else
          prev_sub_idx="null"
        fi
      else
        prev_step_idx="null"
        prev_sub_idx="null"
      fi
    else
      # First phase - no previous
      echo ""
      return
    fi
  fi

  _build_log_filename_for_position "$prev_phase_idx" "$prev_step_idx" "$prev_sub_idx"
}

# Helper function to get previous step's transcript filename
get_previous_transcript_filename() {
  local prev_log=$(get_previous_log_filename)
  if [[ -z "$prev_log" ]]; then
    echo ""
    return
  fi
  local base_name=$(basename "$prev_log" .log)
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

# =============================================================================
# STANDARD LOOP FUNCTION
# =============================================================================

# Standard Loop - Hierarchical phase-based workflow execution
run_standard_loop() {
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
  # Pass previous step paths as environment variables for context
  PREV_LOG_FILE=$(get_previous_log_filename)
  PREV_TRANSCRIPT_FILE=$(get_previous_transcript_filename)
  export PREV_LOG_FILE PREV_TRANSCRIPT_FILE
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

  # Check if current top-level phase has wait-for-parallel flag
  if [[ "$(is_wait_for_parallel_phase "$PREV_PHASE_IDX")" == "true" ]]; then
    wait_for_parallel_tasks
  fi

  # Check if current sub-phase is marked as parallel
  if [[ "$(is_parallel_subphase "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX")" == "true" ]]; then
    spawn_parallel_task "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX"

    # Advance pointer to next sub-phase/step (skip normal Claude invocation)
    # The prompt builder will handle advancing the pointer on next iteration
    # by detecting spawned status

    # Delay between iterations
    if [[ $DELAY -gt 0 ]]; then
      sleep "$DELAY"
    fi
    continue
  fi

  # Update parallel task statuses periodically
  update_parallel_task_statuses

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

  # DETERMINISTIC STATE UPDATE: Parse JSON result and update PROGRESS.yaml
  # The agent no longer modifies PROGRESS.yaml directly - we do it here
  RESULT_CODE=0
  process_standard_result "$TRANSCRIPT_FILE" "$PREV_PHASE_IDX" "$PREV_STEP_IDX" "$PREV_SUB_IDX" "$PHASE_START_ISO" "$PHASE_END_ISO" || RESULT_CODE=$?

  case "$RESULT_CODE" in
    0)
      # Success - pointer was advanced by process_standard_result
      ;;
    1)
      # Failed - handle with retry logic
      ERROR_MSG="Agent reported failure in JSON result"
      if ! handle_phase_failure "1" "$ERROR_MSG"; then
        echo ""
        echo "============================================================"
        echo "SPRINT BLOCKED - Phase failed"
        echo "Check intervention queue: $SPRINT_DIR/intervention-queue.jsonl"
        echo "============================================================"
        exit 1
      fi
      if [[ $DELAY -gt 0 ]]; then
        sleep "$DELAY"
      fi
      continue
      ;;
    2)
      # Needs human - already set in process_standard_result
      echo ""
      echo "============================================================"
      echo "HUMAN INTERVENTION REQUIRED"
      echo "============================================================"
      exit 2
      ;;
  esac

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
}

# =============================================================================
# MODE DETECTION AND DISPATCH
# =============================================================================

# Detect mode from PROGRESS.yaml and dispatch to appropriate loop
SPRINT_MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

case "$SPRINT_MODE" in
  "ralph") run_ralph_loop ;;
  *) run_standard_loop ;;
esac
