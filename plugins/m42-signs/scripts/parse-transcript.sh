#!/bin/bash
# Parse JSONL session transcript to extract tool errors with correlation
# Usage: parse-transcript.sh <session.jsonl> [--json|--tsv]
set -euo pipefail

SESSION_FILE="${1:-}"
OUTPUT_FORMAT="${2:---tsv}"

if [[ -z "$SESSION_FILE" ]] || [[ ! -f "$SESSION_FILE" ]]; then
  echo "Error: Valid JSONL session file required" >&2
  echo "Usage: parse-transcript.sh <session.jsonl> [--json|--tsv]" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Build lookup table of tool_use messages by UUID
# Then correlate with tool_result messages that have is_error: true
#
# Strategy:
# 1. Extract all assistant messages with tool_use into associative array
# 2. Extract all user messages with tool_result where is_error: true
# 3. Correlate via sourceToolAssistantUUID -> uuid mapping

# Create temp file for tool_use lookup
TOOL_USE_LOOKUP=$(mktemp)
trap "rm -f $TOOL_USE_LOOKUP" EXIT

# Extract tool_use entries: uuid -> {tool_name, tool_use_id, input}
jq -c '
  select(.type == "assistant") |
  select(.message.content | type == "array") |
  .uuid as $uuid |
  .message.content[] |
  select(.type == "tool_use") |
  {
    uuid: $uuid,
    tool_use_id: .id,
    tool_name: .name,
    input: .input
  }
' "$SESSION_FILE" > "$TOOL_USE_LOOKUP" 2>/dev/null || true

# Extract errors and correlate with tool_use
# Output format depends on --json or --tsv flag
if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  jq -c '
    select(.type == "user") |
    select(.message.content | type == "array") |
    .sourceToolAssistantUUID as $srcUuid |
    .message.content[] |
    select(.is_error == true) |
    {
      tool_use_id: .tool_use_id,
      error: .content,
      source_uuid: $srcUuid
    }
  ' "$SESSION_FILE" 2>/dev/null | while read -r error_line; do
    tool_use_id=$(echo "$error_line" | jq -r '.tool_use_id')
    error_content=$(echo "$error_line" | jq -r '.error')
    source_uuid=$(echo "$error_line" | jq -r '.source_uuid')

    # Find matching tool_use by source_uuid
    tool_info=$(jq -c "select(.uuid == \"$source_uuid\") | select(.tool_use_id == \"$tool_use_id\")" "$TOOL_USE_LOOKUP" 2>/dev/null | head -1)

    if [[ -n "$tool_info" ]]; then
      tool_name=$(echo "$tool_info" | jq -r '.tool_name')
      tool_input=$(echo "$tool_info" | jq -c '.input')
    else
      tool_name="unknown"
      tool_input="{}"
    fi

    jq -n \
      --arg tool_name "$tool_name" \
      --arg tool_use_id "$tool_use_id" \
      --arg error "$error_content" \
      --argjson input "$tool_input" \
      '{tool_name: $tool_name, tool_use_id: $tool_use_id, error: $error, input: $input}'
  done
else
  # TSV format: tool_name<TAB>tool_use_id<TAB>error_message (truncated)
  printf "tool_name\ttool_use_id\terror_message\n"

  jq -c '
    select(.type == "user") |
    select(.message.content | type == "array") |
    .sourceToolAssistantUUID as $srcUuid |
    .message.content[] |
    select(.is_error == true) |
    {
      tool_use_id: .tool_use_id,
      error: .content,
      source_uuid: $srcUuid
    }
  ' "$SESSION_FILE" 2>/dev/null | while read -r error_line; do
    tool_use_id=$(echo "$error_line" | jq -r '.tool_use_id')
    error_content=$(echo "$error_line" | jq -r '.error' | tr '\n' ' ' | cut -c1-100)
    source_uuid=$(echo "$error_line" | jq -r '.source_uuid')

    # Find matching tool_use by source_uuid
    tool_info=$(jq -c "select(.uuid == \"$source_uuid\") | select(.tool_use_id == \"$tool_use_id\")" "$TOOL_USE_LOOKUP" 2>/dev/null | head -1)

    if [[ -n "$tool_info" ]]; then
      tool_name=$(echo "$tool_info" | jq -r '.tool_name')
    else
      tool_name="unknown"
    fi

    printf "%s\t%s\t%s\n" "$tool_name" "$tool_use_id" "$error_content"
  done
fi
