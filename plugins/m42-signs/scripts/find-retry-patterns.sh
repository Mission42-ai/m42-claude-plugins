#!/bin/bash
set -euo pipefail

# DEPRECATED: This script is no longer used by /m42-signs:extract
# The extraction command now uses LLM-based analysis which provides
# much richer learnings including architectural insights, not just retry patterns.
#
# Kept for reference - shows complex jq patterns for correlating events.
#
# Find retry patterns in Claude Code session transcripts
# Detects error -> retry -> success sequences and extracts what changed
#
# Usage: find-retry-patterns.sh <session-file.jsonl>
# Output: JSON with patterns array including confidence scores

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: find-retry-patterns.sh <session-file.jsonl>" >&2
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

# Extract session ID from filename (without extension)
SESSION_ID=$(basename "$FILE" .jsonl)

# Current timestamp in ISO format
ANALYZED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Process the transcript to find retry patterns
# Algorithm:
# 1. Build ordered list of all tool_use and tool_result events
# 2. For each error, look for same tool success within next N messages
# 3. Compare inputs to detect what changed
# 4. Classify pattern type and score confidence
jq -s --arg session_id "$SESSION_ID" --arg analyzed_at "$ANALYZED_AT" '
# Build ordered list of events with indices for tracking
def build_events:
  to_entries | map(
    .key as $idx |
    .value |
    if .type == "assistant" then
      [.message.content[]? // empty | select(.type == "tool_use") | {
        idx: $idx,
        event_type: "tool_use",
        tool_use_id: .id,
        tool: .name,
        input: .input
      }]
    elif .type == "user" then
      # Handle both .content and .message.content formats
      (
        if .content then .content
        elif (.message.content | type) == "array" then .message.content
        else []
        end
      ) | map(select(.type == "tool_result") | {
        idx: $idx,
        event_type: "tool_result",
        tool_use_id: .tool_use_id,
        is_error: (.is_error // false),
        content: .content
      })
    else
      []
    end
  ) | flatten;

# Classify pattern type based on input differences
def classify_pattern(failed; success; tool):
  if tool == "Bash" then
    # Check for command syntax fixes
    if (failed.command // "" | test("\\$[A-Za-z_]")) and
       (success.command // "" | test("\"\\$")) then
      "command_syntax"
    elif (failed.command // "") != (success.command // "") and
         ((failed.command // "" | length) - (success.command // "" | length) | fabs) < 10 then
      "command_syntax"
    else
      "command_fix"
    end
  elif tool == "Read" or tool == "Write" or tool == "Edit" then
    if (failed.file_path // failed.path // "") != (success.file_path // success.path // "") then
      "file_path"
    else
      "file_operation"
    end
  elif tool == "Glob" or tool == "Grep" then
    if (failed.pattern // "") != (success.pattern // "") then
      "pattern_fix"
    else
      "search_fix"
    end
  else
    "unknown"
  end;

# Score confidence based on pattern characteristics
def score_confidence(pattern_type; failed; success; tool):
  # High: Clear, obvious pattern with minimal change
  # Medium: Plausible fix but moderate evidence
  # Low: Unclear if fix was causal

  if pattern_type == "command_syntax" then
    # Same command base, just syntax fix = high confidence
    "high"
  elif pattern_type == "file_path" then
    # Path correction = high confidence
    "high"
  elif pattern_type == "command_fix" then
    # General command fix = medium
    "medium"
  elif pattern_type == "file_operation" then
    # Same path but different operation = medium
    "medium"
  elif pattern_type == "pattern_fix" then
    "medium"
  elif pattern_type == "search_fix" then
    "medium"
  else
    "low"
  end;

# Extract meaningful diff between inputs
def extract_diff(failed; success; tool):
  if tool == "Bash" then
    {
      field: "command",
      from: (failed.command // null),
      to: (success.command // null)
    }
  elif tool == "Read" or tool == "Write" then
    {
      field: "file_path",
      from: (failed.file_path // failed.path // null),
      to: (success.file_path // success.path // null)
    }
  elif tool == "Edit" then
    {
      field: "file_path",
      from: (failed.file_path // null),
      to: (success.file_path // null)
    }
  elif tool == "Glob" or tool == "Grep" then
    {
      field: "pattern",
      from: (failed.pattern // null),
      to: (success.pattern // null)
    }
  else
    {
      field: "input",
      from: (failed | tostring | .[0:100]),
      to: (success | tostring | .[0:100])
    }
  end;

# Main processing
build_events as $events |

# Build lookup table: tool_use_id -> tool info
($events | map(select(.event_type == "tool_use") | {(.tool_use_id): .}) | add // {}) as $tool_use_lookup |

# Find all errors
[$events | .[] | select(.event_type == "tool_result" and .is_error == true)] as $errors |

# For each error, find retry patterns
[
  $errors | .[] |
  . as $error |
  ($tool_use_lookup[$error.tool_use_id] // {tool: "unknown", input: null}) as $error_tool_info |

  # Find successful uses of same tool after this error
  [
    $events | .[] |
    select(
      .event_type == "tool_result" and
      .is_error != true and
      .idx > $error.idx and
      .idx < ($error.idx + 20)  # Look within next 20 message blocks
    ) |
    . as $result |
    ($tool_use_lookup[$result.tool_use_id] // null) as $success_tool_info |
    select(
      $success_tool_info != null and
      $success_tool_info.tool == $error_tool_info.tool
    ) |
    {
      result: $result,
      tool_info: $success_tool_info
    }
  ] | first // null |

  # If we found a retry, build the pattern
  if . != null then
    .tool_info.input as $success_input |
    $error_tool_info.input as $failed_input |
    $error_tool_info.tool as $tool |

    classify_pattern($failed_input; $success_input; $tool) as $pattern_type |
    score_confidence($pattern_type; $failed_input; $success_input; $tool) as $confidence |
    extract_diff($failed_input; $success_input; $tool) as $diff |

    {
      tool: $tool,
      pattern_type: $pattern_type,
      confidence: $confidence,
      failed_input: $failed_input,
      success_input: $success_input,
      error_message: ($error.content | if type == "string" then .[0:500] else tostring | .[0:500] end),
      diff: $diff
    }
  else
    empty
  end
] as $patterns |

# Build summary
{
  session_id: $session_id,
  analyzed_at: $analyzed_at,
  patterns: $patterns,
  summary: {
    total_errors: ($errors | length),
    retry_patterns_found: ($patterns | length),
    by_tool: ($patterns | group_by(.tool) | map({(.[0].tool): length}) | add // {}),
    by_pattern_type: ($patterns | group_by(.pattern_type) | map({(.[0].pattern_type): length}) | add // {}),
    by_confidence: ($patterns | group_by(.confidence) | map({(.[0].confidence): length}) | add // {})
  }
}
' "$FILE"
