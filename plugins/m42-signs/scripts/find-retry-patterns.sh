#!/bin/bash
# Find retry patterns in JSONL session transcripts
# Detects: error -> retry -> success sequences
# Usage: find-retry-patterns.sh <session.jsonl> [--json|--summary]
set -euo pipefail

SESSION_FILE="${1:-}"
OUTPUT_FORMAT="${2:---json}"

if [[ -z "$SESSION_FILE" ]] || [[ ! -f "$SESSION_FILE" ]]; then
  echo "Error: Valid JSONL session file required" >&2
  echo "Usage: find-retry-patterns.sh <session.jsonl> [--json|--summary]" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# ============================================================================
# HEURISTIC PATTERNS
# Categories for classifying retry fixes
# ============================================================================

# Heuristic 1: Command syntax fixes - quoting and escaping
classify_syntax_fix() {
  local before="$1"
  local after="$2"

  # Check for added quotes
  if [[ "$after" =~ \"[^\"]+\" ]] && ! [[ "$before" =~ \"[^\"]+\" ]]; then
    echo "quoting_fix"
    return 0
  fi

  # Check for added escaping
  if [[ "$after" =~ \\ ]] && ! [[ "$before" =~ \\ ]]; then
    echo "escaping_fix"
    return 0
  fi

  return 1
}

# Heuristic 2: File path corrections
classify_path_fix() {
  local before="$1"
  local after="$2"

  # Extract paths and compare
  local before_path after_path
  before_path=$(echo "$before" | grep -oE '/[a-zA-Z0-9_./-]+' | head -1 || true)
  after_path=$(echo "$after" | grep -oE '/[a-zA-Z0-9_./-]+' | head -1 || true)

  if [[ -n "$before_path" && -n "$after_path" && "$before_path" != "$after_path" ]]; then
    echo "path_correction"
    return 0
  fi

  return 1
}

# Heuristic 3: Permission/access fixes
classify_permission_fix() {
  local before="$1"
  local after="$2"
  local error_msg="$3"

  # Check if error mentions permission
  if [[ "$error_msg" =~ [Pp]ermission|denied|EACCES ]]; then
    if [[ "$after" =~ sudo|chmod|chown ]] && ! [[ "$before" =~ sudo|chmod|chown ]]; then
      echo "permission_fix"
      return 0
    fi
  fi

  return 1
}

# Heuristic 4: API rate limiting
classify_rate_limit_fix() {
  local before="$1"
  local after="$2"
  local error_msg="$3"

  # Check if error mentions rate limit
  if [[ "$error_msg" =~ rate|limit|429|throttle|[Tt]oo.many ]]; then
    # If inputs are identical, it's likely a rate limit retry
    if [[ "$before" == "$after" ]]; then
      echo "rate_limit_retry"
      return 0
    fi
  fi

  return 1
}

# ============================================================================
# CONFIDENCE SCORING
# High: Clear fix, obvious pattern, immediate retry
# Medium: Plausible fix, some changes, moderate gap
# Low: Unclear causation, many changes, large gap
# ============================================================================

calculate_confidence() {
  local heuristic="$1"
  local input_similarity="$2"  # 0-100
  local sequence_gap="$3"      # number of messages between error and success

  local confidence="low"

  # High confidence patterns
  if [[ -n "$heuristic" ]]; then
    case "$heuristic" in
      quoting_fix|escaping_fix|path_correction|rate_limit_retry)
        confidence="high"
        ;;
      permission_fix|syntax_fix)
        confidence="medium"
        ;;
    esac
  fi

  # Adjust based on sequence gap
  if [[ "$sequence_gap" -gt 10 ]]; then
    # Large gap reduces confidence
    if [[ "$confidence" == "high" ]]; then
      confidence="medium"
    elif [[ "$confidence" == "medium" ]]; then
      confidence="low"
    fi
  elif [[ "$sequence_gap" -le 2 ]]; then
    # Immediate retry increases confidence
    if [[ "$confidence" == "low" && "$input_similarity" -gt 70 ]]; then
      confidence="medium"
    fi
  fi

  echo "$confidence"
}

# ============================================================================
# MAIN PROCESSING
# ============================================================================

# Create temp files for lookups
TOOL_USE_FILE=$(mktemp)
TOOL_RESULT_FILE=$(mktemp)
PATTERNS_FILE=$(mktemp)
trap "rm -f $TOOL_USE_FILE $TOOL_RESULT_FILE $PATTERNS_FILE" EXIT

# Extract all tool_use entries with sequence numbers
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
' "$SESSION_FILE" 2>/dev/null | nl -ba > "$TOOL_USE_FILE"

# Extract all tool_result entries
jq -c '
  select(.type == "user") |
  select(.message.content | type == "array") |
  .sourceToolAssistantUUID as $srcUuid |
  .uuid as $resultUuid |
  .message.content[] |
  select(.type == "tool_result") |
  {
    result_uuid: $resultUuid,
    source_uuid: $srcUuid,
    tool_use_id: .tool_use_id,
    is_error: (.is_error // false),
    content: .content
  }
' "$SESSION_FILE" 2>/dev/null | nl -ba > "$TOOL_RESULT_FILE"

# Statistics
total_errors=0
patterns_found=0
declare -A by_tool
declare -A by_confidence

# Find retry patterns: error followed by success for same tool type
while IFS=$'\t' read -r error_seq error_json; do
  error_tool_use_id=$(echo "$error_json" | jq -r '.tool_use_id')
  error_source_uuid=$(echo "$error_json" | jq -r '.source_uuid')
  error_is_error=$(echo "$error_json" | jq -r '.is_error')
  error_content=$(echo "$error_json" | jq -r '.content // ""')

  [[ "$error_is_error" != "true" ]] && continue
  ((total_errors++)) || true

  # Find the tool_use that caused this error
  error_tool_info=$(grep "\"tool_use_id\":\"$error_tool_use_id\"" "$TOOL_USE_FILE" 2>/dev/null | head -1 || true)
  [[ -z "$error_tool_info" ]] && continue

  error_tool_seq=$(echo "$error_tool_info" | awk '{print $1}')
  error_tool_json=$(echo "$error_tool_info" | cut -f2-)
  error_tool_name=$(echo "$error_tool_json" | jq -r '.tool_name')
  error_input=$(echo "$error_tool_json" | jq -c '.input')

  # Look for subsequent tool_use of same type that succeeded
  while IFS=$'\t' read -r success_seq success_json; do
    [[ "$success_seq" -le "$error_tool_seq" ]] && continue

    success_tool_name=$(echo "$success_json" | jq -r '.tool_name')
    [[ "$success_tool_name" != "$error_tool_name" ]] && continue

    success_tool_use_id=$(echo "$success_json" | jq -r '.tool_use_id')
    success_input=$(echo "$success_json" | jq -c '.input')

    # Check if this tool_use succeeded
    success_result=$(grep "\"tool_use_id\":\"$success_tool_use_id\"" "$TOOL_RESULT_FILE" 2>/dev/null | head -1 || true)
    [[ -z "$success_result" ]] && continue

    success_is_error=$(echo "$success_result" | cut -f2- | jq -r '.is_error')
    [[ "$success_is_error" == "true" ]] && continue

    # Found a retry pattern!
    sequence_gap=$((success_seq - error_tool_seq))

    # Calculate input diff/change
    error_input_str=$(echo "$error_input" | jq -r 'if type == "object" then (.command // .file_path // .old_string // (. | tostring)) else . end' 2>/dev/null || echo "$error_input")
    success_input_str=$(echo "$success_input" | jq -r 'if type == "object" then (.command // .file_path // .old_string // (. | tostring)) else . end' 2>/dev/null || echo "$success_input")

    # Apply heuristics to classify the pattern
    heuristic=""
    if classify_permission_fix "$error_input_str" "$success_input_str" "$error_content" >/dev/null 2>&1; then
      heuristic=$(classify_permission_fix "$error_input_str" "$success_input_str" "$error_content")
    elif classify_rate_limit_fix "$error_input_str" "$success_input_str" "$error_content" >/dev/null 2>&1; then
      heuristic=$(classify_rate_limit_fix "$error_input_str" "$success_input_str" "$error_content")
    elif classify_path_fix "$error_input_str" "$success_input_str" >/dev/null 2>&1; then
      heuristic=$(classify_path_fix "$error_input_str" "$success_input_str")
    elif classify_syntax_fix "$error_input_str" "$success_input_str" >/dev/null 2>&1; then
      heuristic=$(classify_syntax_fix "$error_input_str" "$success_input_str")
    else
      heuristic="unknown_pattern"
    fi

    # Calculate input similarity (simple approach)
    if [[ "$error_input" == "$success_input" ]]; then
      input_similarity=100
    elif [[ "$error_tool_name" == "$success_tool_name" ]]; then
      input_similarity=50
    else
      input_similarity=0
    fi

    # Calculate confidence score
    confidence=$(calculate_confidence "$heuristic" "$input_similarity" "$sequence_gap")

    # Build the diff/change object
    diff_json=$(jq -n \
      --arg type "$heuristic" \
      --arg before "$error_input_str" \
      --arg after "$success_input_str" \
      '{type: $type, before: $before, after: $after}')

    # Record the pattern
    pattern_json=$(jq -n \
      --arg tool_name "$error_tool_name" \
      --arg error_tool_use_id "$error_tool_use_id" \
      --arg success_tool_use_id "$success_tool_use_id" \
      --argjson error_input "$error_input" \
      --argjson success_input "$success_input" \
      --arg error_message "${error_content:0:200}" \
      --argjson diff "$diff_json" \
      --arg confidence "$confidence" \
      --arg heuristic_match "$heuristic" \
      '{
        tool_name: $tool_name,
        error_tool_use_id: $error_tool_use_id,
        success_tool_use_id: $success_tool_use_id,
        error_input: $error_input,
        success_input: $success_input,
        error_message: $error_message,
        diff: $diff,
        confidence: $confidence,
        heuristic_match: $heuristic_match
      }')

    echo "$pattern_json" >> "$PATTERNS_FILE"
    ((patterns_found++)) || true

    # Track statistics
    by_tool[$error_tool_name]=$((${by_tool[$error_tool_name]:-0} + 1))
    by_confidence[$confidence]=$((${by_confidence[$confidence]:-0} + 1))

    # Only match first successful retry
    break
  done < "$TOOL_USE_FILE"

done < <(grep '"is_error":true' "$TOOL_RESULT_FILE" || true)

# Build by_tool JSON object
by_tool_json="{"
first=true
for tool in "${!by_tool[@]}"; do
  [[ "$first" != "true" ]] && by_tool_json+=","
  by_tool_json+="\"$tool\":${by_tool[$tool]}"
  first=false
done
by_tool_json+="}"
[[ "$by_tool_json" == "{}" ]] && by_tool_json="{}"

# Build by_confidence JSON object
by_conf_json="{"
first=true
for conf in "${!by_confidence[@]}"; do
  [[ "$first" != "true" ]] && by_conf_json+=","
  by_conf_json+="\"$conf\":${by_confidence[$conf]}"
  first=false
done
by_conf_json+="}"
[[ "$by_conf_json" == "{}" ]] && by_conf_json="{}"

# Output results
if [[ "$OUTPUT_FORMAT" == "--summary" ]]; then
  echo "Retry Pattern Summary"
  echo "===================="
  echo "Total errors: $total_errors"
  echo "Retry patterns found: $patterns_found"
  echo ""
  echo "By tool type:"
  for tool in "${!by_tool[@]}"; do
    echo "  $tool: ${by_tool[$tool]}"
  done
  echo ""
  echo "By confidence level:"
  for conf in "${!by_confidence[@]}"; do
    echo "  $conf: ${by_confidence[$conf]}"
  done
else
  # JSON output
  patterns_array="["
  if [[ -s "$PATTERNS_FILE" ]]; then
    patterns_array+=$(cat "$PATTERNS_FILE" | paste -sd, -)
  fi
  patterns_array+="]"

  jq -n \
    --argjson patterns "$patterns_array" \
    --argjson total_errors "$total_errors" \
    --argjson patterns_found "$patterns_found" \
    --argjson by_tool "$by_tool_json" \
    --argjson by_confidence "$by_conf_json" \
    '{
      patterns: $patterns,
      summary: {
        total_errors: $total_errors,
        retry_patterns_found: $patterns_found,
        by_tool: $by_tool,
        by_confidence: $by_confidence
      }
    }'
fi
