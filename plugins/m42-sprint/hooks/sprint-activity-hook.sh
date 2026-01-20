#!/usr/bin/env bash
# Sprint Activity Hook - PostToolUse event handler
# Parses Claude Code tool events and writes to JSONL activity log
#
# Usage: echo '<json>' | ./sprint-activity-hook.sh <sprint-dir>
# Environment: SPRINT_ACTIVITY_VERBOSITY (minimal|basic|detailed|verbose)

# Don't use set -e - we must exit 0 even on errors (non-blocking hook)
set -uo pipefail

# Get sprint directory from first argument
SPRINT_DIR="${1:-}"

# Validate sprint directory argument
if [[ -z "$SPRINT_DIR" ]]; then
  exit 0  # Non-blocking: exit cleanly if no sprint dir
fi

# Get verbosity level from environment, default to "basic"
VERBOSITY="${SPRINT_ACTIVITY_VERBOSITY:-basic}"

# Validate verbosity level
case "$VERBOSITY" in
  minimal|basic|detailed|verbose) ;;
  *) VERBOSITY="basic" ;;
esac

# Read JSON from stdin
INPUT=$(cat)

# Validate JSON input using jq
if ! echo "$INPUT" | jq -e '.' >/dev/null 2>&1; then
  # Invalid JSON - exit cleanly without writing (non-blocking)
  exit 0
fi

# Extract tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# If no tool name, exit cleanly
if [[ -z "$TOOL_NAME" ]]; then
  exit 0
fi

# Generate ISO-8601 timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract file path based on tool type
FILE_PATH=""
case "$TOOL_NAME" in
  Read|Write|Edit)
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    ;;
  Glob|Grep)
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
    ;;
  NotebookEdit)
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.notebook_path // empty')
    ;;
esac

# Build output event based on verbosity level
case "$VERBOSITY" in
  minimal)
    # Only tool name and timestamp
    OUTPUT=$(jq -cn \
      --arg ts "$TIMESTAMP" \
      --arg type "tool" \
      --arg tool "$TOOL_NAME" \
      --arg level "$VERBOSITY" \
      '{ts: $ts, type: $type, tool: $tool, level: $level}')
    ;;
  basic)
    # Tool name, file path (if applicable), timestamp
    if [[ -n "$FILE_PATH" ]]; then
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg file "$FILE_PATH" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, file: $file, level: $level}')
    else
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, level: $level}')
    fi
    ;;
  detailed)
    # Includes key parameters
    PARAMS=""
    case "$TOOL_NAME" in
      Bash)
        PARAMS=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
        ;;
      Grep)
        PARAMS=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        ;;
      Glob)
        PARAMS=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        ;;
    esac

    if [[ -n "$FILE_PATH" ]] && [[ -n "$PARAMS" ]]; then
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg file "$FILE_PATH" \
        --arg params "$PARAMS" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, file: $file, params: $params, level: $level}')
    elif [[ -n "$FILE_PATH" ]]; then
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg file "$FILE_PATH" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, file: $file, level: $level}')
    elif [[ -n "$PARAMS" ]]; then
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg params "$PARAMS" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, params: $params, level: $level}')
    else
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg level "$VERBOSITY" \
        '{ts: $ts, type: $type, tool: $tool, level: $level}')
    fi
    ;;
  verbose)
    # Full tool_input and tool_response
    TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
    TOOL_RESPONSE=$(echo "$INPUT" | jq -c '.tool_response // {}')

    if [[ -n "$FILE_PATH" ]]; then
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg file "$FILE_PATH" \
        --arg level "$VERBOSITY" \
        --argjson input "$TOOL_INPUT" \
        --argjson response "$TOOL_RESPONSE" \
        '{ts: $ts, type: $type, tool: $tool, file: $file, level: $level, input: $input, response: $response}')
    else
      OUTPUT=$(jq -cn \
        --arg ts "$TIMESTAMP" \
        --arg type "tool" \
        --arg tool "$TOOL_NAME" \
        --arg level "$VERBOSITY" \
        --argjson input "$TOOL_INPUT" \
        --argjson response "$TOOL_RESPONSE" \
        '{ts: $ts, type: $type, tool: $tool, level: $level, input: $input, response: $response}')
    fi
    ;;
esac

# Ensure output directory exists
mkdir -p "$SPRINT_DIR" 2>/dev/null || exit 0

# Write to activity log using atomic write pattern (temp file + mv)
ACTIVITY_FILE="$SPRINT_DIR/.sprint-activity.jsonl"
TEMP_FILE=$(mktemp -p "$SPRINT_DIR" .sprint-activity.tmp.XXXXXX 2>/dev/null) || exit 0

# Append new event: copy existing + new line to temp, then atomically replace
{
  if [[ -f "$ACTIVITY_FILE" ]]; then
    cat "$ACTIVITY_FILE"
  fi
  echo "$OUTPUT"
} > "$TEMP_FILE" 2>/dev/null || { rm -f "$TEMP_FILE" 2>/dev/null; exit 0; }

# Atomic move
mv "$TEMP_FILE" "$ACTIVITY_FILE" 2>/dev/null || { rm -f "$TEMP_FILE" 2>/dev/null; exit 0; }

exit 0
