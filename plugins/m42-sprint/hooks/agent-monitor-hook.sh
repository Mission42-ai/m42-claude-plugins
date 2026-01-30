#!/usr/bin/env bash
#
# Agent Monitor Hook for Sprint Status Dashboard
#
# This hook captures Claude Code lifecycle events and writes them to
# .agent-events.jsonl for the status server's workflow visualization.
#
# Events captured:
#   - SessionStart: Agent spawn (maps to step via CURRENT_STEP_ID env var)
#   - PreToolUse: Tool activity start
#   - PostToolUse: Tool activity end
#   - Stop/SessionEnd: Agent completion
#   - SubagentStart/SubagentStop: Nested subagent lifecycle
#
# Environment:
#   - SPRINT_DIR: Sprint directory path (required, set by sprint runner)
#   - CURRENT_STEP_ID: Current step ID being executed (set by sprint runner)
#
# Input: JSON event data via stdin (Claude Code hook format)
# Output: Appends JSONL to $SPRINT_DIR/.agent-events.jsonl
#

set -euo pipefail

# Exit early if not in a sprint context
if [[ -z "${SPRINT_DIR:-}" ]]; then
  exit 0
fi

# Read JSON input from stdin
INPUT=$(cat)

# Parse event details using jq
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Exit if missing required fields
if [[ -z "$HOOK_EVENT" ]] || [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Output file
EVENTS_FILE="$SPRINT_DIR/.agent-events.jsonl"

# Timestamp
TS=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

# Helper to write an event
write_event() {
  local json="$1"
  echo "$json" >> "$EVENTS_FILE"
}

case "$HOOK_EVENT" in
  "SessionStart")
    # Agent spawn event
    STEP_ID="${CURRENT_STEP_ID:-unknown}"
    write_event "{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"spawn\",\"stepId\":\"$STEP_ID\"}"
    ;;

  "PreToolUse")
    # Tool start event
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
    TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty')

    # Extract file path for file operations
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

    # Extract command for Bash
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' | head -c 100)

    EVENT="{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"tool_start\",\"tool\":\"$TOOL_NAME\""
    [[ -n "$FILE_PATH" ]] && EVENT="$EVENT,\"file\":\"$FILE_PATH\""
    [[ -n "$COMMAND" ]] && EVENT="$EVENT,\"command\":$(echo "$COMMAND" | jq -Rs '.')"
    [[ -n "$TOOL_USE_ID" ]] && EVENT="$EVENT,\"toolUseId\":\"$TOOL_USE_ID\""
    EVENT="$EVENT}"

    write_event "$EVENT"
    ;;

  "PostToolUse")
    # Tool end event
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
    TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty')

    EVENT="{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"tool_end\",\"tool\":\"$TOOL_NAME\",\"success\":true"
    [[ -n "$TOOL_USE_ID" ]] && EVENT="$EVENT,\"toolUseId\":\"$TOOL_USE_ID\""
    EVENT="$EVENT}"

    write_event "$EVENT"
    ;;

  "PostToolUseFailure")
    # Tool end event (failed)
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
    TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty')

    EVENT="{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"tool_end\",\"tool\":\"$TOOL_NAME\",\"success\":false"
    [[ -n "$TOOL_USE_ID" ]] && EVENT="$EVENT,\"toolUseId\":\"$TOOL_USE_ID\""
    EVENT="$EVENT}"

    write_event "$EVENT"
    ;;

  "Stop"|"SessionEnd")
    # Agent completion event
    # Determine status based on how the session ended
    # TODO: Extract actual exit status when available
    STATUS="success"

    write_event "{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"complete\",\"status\":\"$STATUS\"}"
    ;;

  "SubagentStart")
    # Subagent spawn event
    AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
    AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

    EVENT="{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"subagent_spawn\",\"agentId\":\"$AGENT_ID\""
    [[ -n "$AGENT_TYPE" ]] && EVENT="$EVENT,\"agentType\":\"$AGENT_TYPE\""
    EVENT="$EVENT}"

    write_event "$EVENT"
    ;;

  "SubagentStop")
    # Subagent completion event
    AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')

    write_event "{\"ts\":\"$TS\",\"sessionId\":\"$SESSION_ID\",\"type\":\"subagent_complete\",\"agentId\":\"$AGENT_ID\"}"
    ;;

  *)
    # Unknown event type, ignore
    ;;
esac

exit 0
