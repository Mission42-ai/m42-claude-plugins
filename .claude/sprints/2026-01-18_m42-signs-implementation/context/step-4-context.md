# Step Context: step-4

## Task
Phase 2.2: Error Pattern Detection - Implement retry pattern identification:

### Tasks
1. Create scripts/find-retry-patterns.sh:
   - Input: parsed transcript with errors
   - Detect sequences: error -> retry -> success
   - Extract the diff (what changed between attempts)
   - Group by tool type (Bash, Edit, etc.)

2. Add heuristics for common patterns:
   - Command syntax fixes (quoting, escaping)
   - File path corrections
   - Permission/access fixes
   - API retry with rate limiting

3. Create confidence scoring:
   - High: Clear fix, obvious pattern
   - Medium: Plausible fix, moderate evidence
   - Low: Unclear if fix was causal


## Related Code Patterns

### Similar Implementation: parse-transcript.sh (input handling & jq patterns)
```bash
# From plugins/m42-signs/scripts/parse-transcript.sh:1-18
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
```

### Similar Implementation: parse-transcript.sh (tool_use lookup table)
```bash
# From plugins/m42-signs/scripts/parse-transcript.sh:28-45
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
```

### Similar Implementation: sprint-loop.sh (retry handling patterns)
```bash
# From plugins/m42-sprint/scripts/sprint-loop.sh:57-58
# Retryable error types (auto-retry with backoff)
RETRY_ON=("network" "rate-limit" "timeout")

# From sprint-loop.sh:409-417 - Retry classification
is_retryable() {
  local error_type="$1"
  for retryable_type in "${RETRY_ON[@]}"; do
    if [[ "$error_type" == "$retryable_type" ]]; then
      return 0
    fi
  done
  return 1
}
```

## Required Imports
### Internal
- None (standalone bash script)
- May optionally call `parse-transcript.sh` for initial error extraction

### External
- `jq`: JSON parsing and manipulation (required)
- `diff`: For comparing tool inputs between attempts (standard unix)

## JSONL Session Structure (for retry detection)

### Key Fields for Retry Pattern Detection
| Field | Location | Purpose |
|-------|----------|---------|
| `uuid` | Root of each message | Unique message identifier |
| `parentUuid` | Root of user messages | Links to parent message (for sequence tracking) |
| `type` | Root | "assistant" or "user" |
| `sourceToolAssistantUUID` | User messages | Links tool_result to its tool_use |
| `tool_use_id` | message.content[] | Matches tool_use.id to tool_result |
| `is_error` | tool_result content | Boolean indicating error |
| `name` | tool_use content | Tool name (Bash, Edit, Read, Write) |
| `input` | tool_use content | Tool parameters (command, file_path, etc.) |

### Retry Sequence Detection Logic
1. Find all tool_results with `is_error: true`
2. For each error, find the next tool_use of same type
3. Compare inputs between error call and subsequent call
4. If subsequent call succeeds (`is_error: false`), record as retry pattern

```
Timeline: [tool_use A] -> [error result] -> [tool_use B] -> [success result]
                                              ^
                                              |-- If same tool_name and similar context
                                                  = potential retry pattern
```

## Types/Interfaces to Use

### Output JSON Structure
```json
{
  "patterns": [
    {
      "tool_name": "Bash",
      "error_tool_use_id": "toolu_error_xxx",
      "success_tool_use_id": "toolu_success_xxx",
      "error_input": {"command": "ls /nonexistent"},
      "success_input": {"command": "ls /existing"},
      "error_message": "No such file or directory",
      "diff": {
        "type": "path_correction",
        "before": "/nonexistent",
        "after": "/existing"
      },
      "confidence": "high",
      "heuristic_match": "path_correction"
    }
  ],
  "summary": {
    "total_errors": 10,
    "retry_patterns_found": 7,
    "by_tool": {"Bash": 4, "Edit": 2, "Write": 1},
    "by_confidence": {"high": 3, "medium": 3, "low": 1}
  }
}
```

## Heuristic Categories

### 1. Command Syntax Fixes (Bash)
- **Pattern**: Quoting/escaping changes
- **Detection**: Check for added quotes, escaped characters
- **Examples**: `$VAR` → `"$VAR"`, `file name` → `"file name"`
- **Confidence**: High (clear mechanical fix)

### 2. File Path Corrections (Bash, Read, Write, Edit)
- **Pattern**: Path components changed
- **Detection**: Compare file_path or path in command
- **Examples**: `/wrong/path` → `/correct/path`, typo fixes
- **Confidence**: High if only path differs

### 3. Permission/Access Fixes (Bash)
- **Pattern**: sudo added, chmod before operation
- **Detection**: Error contains "permission denied", retry has sudo/chmod
- **Examples**: `rm file` → `sudo rm file`
- **Confidence**: Medium (may be coincidental)

### 4. Edit Content Fixes (Edit)
- **Pattern**: old_string/new_string changed
- **Detection**: Compare edit parameters
- **Examples**: Wrong match string → correct match string
- **Confidence**: High if old_string differs, same file

### 5. API Rate Limiting (Bash with curl/API calls)
- **Pattern**: Same command retried after delay
- **Detection**: Identical inputs, error mentions rate/limit/429
- **Confidence**: High (classic retry pattern)

## Integration Points
- **Called by**: Future `analyze-session` command, sign proposal workflow
- **Calls**: jq for JSON parsing, optionally diff for input comparison
- **Input from**: parse-transcript.sh output or raw session.jsonl
- **Output to**: Sign proposal pipeline, statistics dashboard

## Implementation Notes
- Script should handle sessions with no retry patterns gracefully (empty output)
- Use temporal ordering (uuid/parentUuid chain) to establish sequence
- Limit comparison to tool calls within reasonable proximity (not across entire session)
- The `sourceToolAssistantUUID` field provides the UUID link for correlation
- Consider memory efficiency for large sessions (streaming vs slurp)
- Confidence scoring based on:
  - **High**: Single clear change, known pattern category, immediate retry
  - **Medium**: Multiple small changes, plausible fix, some gap between calls
  - **Low**: Many changes, unclear causation, large temporal gap

## jq Query Examples

### Find consecutive tool calls of same type
```bash
# Extract all tool_use with their sequence
jq -c '
  select(.type == "assistant") |
  select(.message.content[]?.type == "tool_use") |
  {uuid, content: .message.content}
' "$SESSION_FILE"
```

### Correlate error with subsequent success
```bash
# After getting error tool_use_id, find next tool_use of same name
# and check if its result is success
```

## Directory Structure
```
plugins/m42-signs/
├── scripts/
│   ├── parse-transcript.sh       # EXISTING: Parse errors
│   └── find-retry-patterns.sh    # NEW: Detect retry patterns
```
