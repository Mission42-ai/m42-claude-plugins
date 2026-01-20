#!/bin/bash
set -euo pipefail

# Generate quick statistics for Claude Code session transcripts
# Outputs JSON with line count, errors, tool sequence
#
# Usage: transcript-summary.sh <session-file.jsonl>
# Output: JSON object with summary stats

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: transcript-summary.sh <session-file.jsonl>" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Check required tool
if ! command -v jq &> /dev/null; then
  echo "Error: Required tool 'jq' is not installed" >&2
  exit 1
fi

# Generate summary statistics using slurp mode
jq -s '
{
  total_lines: length,
  assistant_messages: [.[] | select(.type == "assistant")] | length,
  text_blocks: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "text")] | length,
  error_count: [.[] | select(.type == "user") | .message.content[]? | select(.is_error == true)] | length,
  tool_sequence: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name][0:30]
}
' "$FILE"
