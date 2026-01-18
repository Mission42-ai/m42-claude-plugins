# Step Context: step-3

## Task
Implement session transcript parsing logic:
1. Create `scripts/parse-transcript.sh`
2. Create `skills/managing-signs/references/transcript-format.md`
3. Test with real session files

## Related Code Patterns

### Similar Implementation: scripts/validate-backlog.sh
```bash
#!/bin/bash
set -euo pipefail

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Backlog file path required" >&2
  echo "Usage: validate-backlog.sh <backlog-file>" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Check required tool
if ! command -v yq &> /dev/null; then
  echo "Error: Required tool 'yq' is not installed" >&2
  exit 1
fi
```

### Reference File Pattern: references/backlog-schema.md
```yaml
---
title: Backlog Schema Reference
description: Complete YAML schema for learning backlog files...
keywords: backlog, schema, yaml, learnings, signs, validation
skill: managing-signs
---
```

## Session File Format

### Location
```
~/.claude/projects/{encoded-project-path}/{session-id}.jsonl
~/.claude/projects/{encoded-project-path}/{session-id}/subagents/agent-{id}.jsonl
```

### Message Types

| Type | Subtype | Key Fields |
|------|---------|------------|
| `system` | `init` | `session_id`, `tools`, `model`, `cwd` |
| `assistant` | - | `message.content[].type` (tool_use/text) |
| `user` | - | `content[].type` (tool_result), `is_error` |
| `result` | success/error | `total_cost_usd`, `num_turns` |

### Tool Use Structure (in assistant message)
```json
{
  "type": "tool_use",
  "id": "toolu_019Zib79YJcMPVu5AQ4Ug3hs",
  "name": "Bash",
  "input": {
    "command": "ls -la",
    "description": "List files"
  }
}
```

### Tool Result Structure (in user message)
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_019Zib79YJcMPVu5AQ4Ug3hs",
  "content": "EISDIR: illegal operation on a directory, read",
  "is_error": true
}
```

### Real Error Example
```json
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"EISDIR: illegal operation on a directory, read","is_error":true,"tool_use_id":"toolu_016EYjsz7p6LmzX3NNGzemRm"}]}}
```

## Required Imports

### External Tools
- `jq`: JSON processing (required for JSONL parsing)
- `bash`: Shell execution

## jq Correlation Logic

### Find All Errors
```bash
jq 'select(.type=="user") | .content[]? | select(.is_error==true)' session.jsonl
```

### Correlate Tool Use with Tool Result
```bash
jq -s '
  [.[] | select(.type=="assistant" or .type=="user")] |
  group_by(.message.content[0].id // .content[0].tool_use_id) |
  .[] | select(length == 2) |
  {
    tool: .[0].message.content[0].name,
    input: .[0].message.content[0].input,
    is_error: .[1].content[0].is_error,
    result: .[1].content[0].content
  } | select(.is_error == true)
' session.jsonl
```

**Important**: The correlation uses `.message.content[0].id` for tool_use and `.content[0].tool_use_id` for tool_result.

## Integration Points

### Called by
- `/signs extract <session-id>` command (not yet implemented)
- Future sprint workflow integration

### Output Format
Script should output valid JSON array with:
```json
[
  {
    "tool": "Bash",
    "input": {"command": "...", "description": "..."},
    "error": "error message",
    "tool_use_id": "toolu_..."
  }
]
```

### Tests
- Manual verification using real session files from `~/.claude/projects/`

## Implementation Notes

1. **Handle both message formats**: Regular sessions use `message.content`, subagent sessions may vary slightly
2. **Multiple content blocks**: A single message can have multiple tool_use blocks - iterate over `.content[]`
3. **Empty arrays OK**: If no errors found, output empty JSON array `[]`
4. **Tool use ID is key**: The `tool_use_id` links requests to responses
5. **Input varies by tool**: Bash has `command`/`description`, Read has `file_path`, Edit has `old_string`/`new_string` etc.
6. **Use `-s` flag**: Need `jq -s` (slurp) to correlate across lines
