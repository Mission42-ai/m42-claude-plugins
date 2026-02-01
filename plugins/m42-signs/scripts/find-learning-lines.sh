#!/bin/bash
set -euo pipefail

# Find high-value reasoning lines in Claude Code session transcripts
# Pattern-matches text blocks for learning indicators
#
# Usage: find-learning-lines.sh <session-file.jsonl>
# Output: JSONL with {snippet: "..."} objects (max 150 chars, max 30 lines)

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: find-learning-lines.sh <session-file.jsonl>" >&2
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

# Find learning patterns and output snippets (max 150 chars, max 30 lines)
OUTPUT=$(jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text") |
  select(.text | test("I notice|I see that|This means|Actually|The issue|This works because|The pattern|must change together|requires"; "i")) |
  {snippet: (.text | .[0:150])}
' "$FILE" | head -30)

if [[ -z "$OUTPUT" ]]; then
  echo "No learning patterns found in: $FILE" >&2
else
  echo "$OUTPUT"
fi
