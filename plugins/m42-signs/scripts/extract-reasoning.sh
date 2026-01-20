#!/bin/bash
set -euo pipefail

# Extract assistant text blocks from Claude Code session transcripts
# Outputs JSONL with {text: "..."} objects for reasoning extraction
#
# Usage: extract-reasoning.sh <session-file.jsonl>
# Output: JSONL with assistant text blocks (>50 chars)

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: extract-reasoning.sh <session-file.jsonl>" >&2
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

# Extract assistant text blocks with meaningful content (>50 chars)
jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text" and .text != null and (.text | length) > 50) |
  {text: .text}
' "$FILE"
