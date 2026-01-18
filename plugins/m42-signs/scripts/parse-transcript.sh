#!/bin/bash
set -euo pipefail

# Parse Claude Code session transcript for tool errors
# Correlates tool_use with tool_result to extract error context
#
# Usage: parse-transcript.sh <session-file.jsonl>
# Output: JSON array of errors with tool info

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: parse-transcript.sh <session-file.jsonl>" >&2
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

# Parse transcript and correlate tool_use with tool_result
# 1. Build index of tool_use blocks by ID
# 2. Find all tool_result blocks with is_error=true
# 3. Join to get full error context
#
# Handles two formats:
# - Main sessions: .content[] for user messages
# - Subagent sessions: .message.content[] for user messages
# Note: .message.content can be string (user input) or array (tool results)
jq -s '
  # Build tool_use index from assistant messages
  (
    [.[] | select(.type == "assistant") | .message.content[]? // empty | select(.type == "tool_use")] |
    map({(.id): {tool: .name, input: .input}}) |
    add // {}
  ) as $tool_use_index |

  # Find all error tool_results
  # Handle both formats and type variations
  [
    .[] |
    select(.type == "user") |
    # Get content array from either .content or .message.content (if array)
    (
      if .content then .content
      elif (.message.content | type) == "array" then .message.content
      else []
      end
    )[] |
    select(.type == "tool_result" and .is_error == true) |
    {
      tool_use_id: .tool_use_id,
      error: .content
    }
  ] |

  # Join with tool_use index
  map(
    . + ($tool_use_index[.tool_use_id] // {tool: "unknown", input: null})
  ) |

  # Output format
  map({
    tool: .tool,
    input: .input,
    error: .error,
    tool_use_id: .tool_use_id
  })
' "$FILE"
