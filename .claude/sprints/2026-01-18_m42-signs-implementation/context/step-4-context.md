# Step Context: step-4

## Task
## Phase 2.2: Error Pattern Detection

Implement retry pattern identification:

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

### Success Criteria
- Script detects at least 80% of retry patterns
- Confidence scores are reasonable
- False positives are < 20%

## Related Code Patterns

### Similar Implementation: plugins/m42-signs/scripts/parse-transcript.sh
```bash
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
```
**Key patterns**:
- `set -euo pipefail` for safe script execution
- Argument validation with usage message
- File existence check
- Tool dependency check (jq)
- jq -s for slurping JSONL into array

### Similar Implementation: plugins/m42-signs/scripts/validate-backlog.sh
```bash
ERRORS=()
WARNINGS=()

# Validation logic...

# Report results
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "Warnings:"
  for warn in "${WARNINGS[@]}"; do
    echo "  - $warn"
  done
fi

if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "Validation passed."
  exit 0
else
  echo "Validation FAILED:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
```
**Key patterns**:
- Array collection for errors/warnings
- Graceful reporting with structured output
- Exit codes: 0 = success, 1 = failure

### JSON Correlation Pattern: parse-transcript.sh
```bash
jq -s '
  # Build tool_use index from assistant messages
  (
    [.[] | select(.type == "assistant") | .message.content[]? // empty | select(.type == "tool_use")] |
    map({(.id): {tool: .name, input: .input}}) |
    add // {}
  ) as $tool_use_index |

  # Find all error tool_results
  [
    .[] |
    select(.type == "user") |
    (.content // .message.content | if type == "array" then . else [] end)[] |
    select(.type == "tool_result" and .is_error == true) |
    {tool_use_id: .tool_use_id, error: .content}
  ] |

  # Join with tool_use index
  map(. + ($tool_use_index[.tool_use_id] // {tool: "unknown", input: null}))
' "$FILE"
```
**Key pattern**: Build index of tool_use by ID, then join with results by tool_use_id.

## Required Imports
### Internal
- None - shell script, uses parse-transcript.sh output

### External
- `jq`: JSON processing (critical for transcript parsing)
- `diff`: Compare inputs between retry attempts

## Types/Interfaces to Use

### Input: Parsed Transcript (from parse-transcript.sh)
```json
[
  {
    "tool": "Bash",
    "input": {"command": "ls /nonexistent", "description": "List directory"},
    "error": "ls: cannot access '/nonexistent': No such file or directory",
    "tool_use_id": "toolu_xxxxx"
  }
]
```

### Output: Retry Patterns JSON
```json
{
  "session_id": "abc123",
  "analyzed_at": "2026-01-18T10:00:00Z",
  "patterns": [
    {
      "tool": "Bash",
      "pattern_type": "command_syntax",
      "confidence": "high",
      "failed_input": {"command": "yq '.phases[$IDX].status'"},
      "success_input": {"command": "yq '.phases['\"$IDX\"'].status'"},
      "error_message": "returned empty string",
      "diff": {
        "field": "command",
        "change": "added shell quoting around variable"
      }
    }
  ],
  "summary": {
    "total_errors": 5,
    "retry_patterns_found": 3,
    "by_tool": {"Bash": 2, "Edit": 1},
    "by_pattern_type": {"command_syntax": 2, "file_path": 1}
  }
}
```

### Pattern Types
| Type | Description | Confidence Basis |
|------|-------------|------------------|
| `command_syntax` | Quoting, escaping, flag fixes | High if same command base |
| `file_path` | Path corrections | High if only path differs |
| `permission` | Chmod, sudo, access fixes | Medium - may not be causal |
| `api_retry` | Rate limit, timeout retry | Low - may be timing |
| `unknown` | Unclear fix pattern | Low |

## Integration Points

### Called by
- `/signs extract` command (future) - will run this script
- `parse-transcript.sh` output piped to this script
- Sprint transcript analysis workflows

### Calls
- Takes raw JSONL transcript file as input
- Outputs JSON to stdout
- Uses jq for all JSON processing

### Tests
- Verification via gherkin scenarios in artifacts/step-4-gherkin.md
- Manual testing with real transcript files in `~/.claude/projects/`

## Implementation Notes

1. **Transcript Structure Complexity**
   - Main sessions: `.message.content[]` for assistant, `.content[]` for user
   - Subagent sessions: `.message.content[]` for both (when array)
   - Progress messages: Nested structure in `.data.normalizedMessages[]`
   - Handle both `type: "user"` direct messages and `type: "progress"` subagent messages

2. **Retry Pattern Detection Algorithm**
   ```
   For each error:
   1. Get tool_use_id and tool name
   2. Find all tool_use blocks with same tool name after the error
   3. Find the first successful result (is_error != true)
   4. If found within N messages, check if inputs are similar
   5. If similar (same tool, similar structure), extract diff
   6. Score confidence based on diff type
   ```

3. **Common Error Patterns from Real Transcripts**
   - "EISDIR: illegal operation on a directory" → Read tool on directory
   - "File does not exist" → Wrong path, needs correction
   - "Exit code 128" → Git push without upstream branch
   - User rejection → Tool use blocked by permission

4. **Confidence Scoring Heuristics**
   - **High**: Same tool, same file/command base, only parameter changed
   - **Medium**: Same tool, different target, similar operation
   - **Low**: Different tool, unclear relationship, timing-based

5. **Edge Cases**
   - Multiple parallel tool calls (same assistant message)
   - User-rejected tool uses (not really an error to learn from)
   - Errors in subagent vs main session
   - No retry found for error (learning might still be useful)

6. **Sample Session Files**
   ```
   ~/.claude/projects/-home-konstantin-projects-m42-claude-plugins/*.jsonl
   ```
   High-error sessions for testing:
   - `4edb875a-a5f4-4ca9-8cfd-4419f57288f0.jsonl` (125 errors)
   - `aa3194c6-4e92-4dda-b057-26e20b7a3f08.jsonl` (94 errors)
