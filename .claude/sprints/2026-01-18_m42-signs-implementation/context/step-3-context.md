# Step Context: step-3

## Task
Phase 2.1: Transcript Parsing Logic - Implement session transcript parsing:

1. Create `scripts/parse-transcript.sh` - Parse JSONL session files, extract errors, correlate tool calls
2. Create `skills/managing-signs/references/transcript-format.md` - Document transcript format with examples
3. Test parsing with real session files

## Related Code Patterns

### Similar Implementation: sprint-loop.sh (JSON streaming)
```bash
# From plugins/m42-sprint/scripts/sprint-loop.sh:847-860
# Invoke Claude with JSON streaming to capture full transcript
claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose \
  > "$TRANSCRIPT_FILE" 2>&1
CLI_EXIT_CODE=$?

# Extract final result text for legacy log file
jq -r 'select(.type=="result") | .result // empty' "$TRANSCRIPT_FILE" > "$LOG_FILE" 2>/dev/null || true

# Also extract CLI_OUTPUT for error handling
CLI_OUTPUT=$(jq -r 'select(.type=="result") | .result // empty' "$TRANSCRIPT_FILE" 2>/dev/null || cat "$TRANSCRIPT_FILE")
```

### Similar Implementation: preflight-check.sh (script structure)
```bash
# From plugins/m42-sprint/scripts/preflight-check.sh:1-18
#!/bin/bash
# Preflight Check - Validate sprint environment before execution
set -euo pipefail

SPRINT_DIR="$1"

if [[ -z "$SPRINT_DIR" ]] || [[ ! -d "$SPRINT_DIR" ]]; then
  echo "Error: Valid sprint directory required" >&2
  exit 1
fi

# Check 1: Required tools are available
if ! command -v jq &> /dev/null; then
  ERRORS+=("Required tool 'jq' is not installed")
fi
```

### Reference File Pattern (frontmatter)
```yaml
# From plugins/m42-meta-toolkit/skills/creating-skills/references/reference-frontmatter-guide.md
---
title: Reference File Frontmatter Guide
description: Specification for YAML frontmatter in skill reference files, including required fields, validation rules, and examples for programmatic discovery
keywords: frontmatter, metadata, discovery, reference files, yaml, validation
file-type: reference
skill: creating-skills
---
```

## JSONL Session File Structure

Session files are stored in `~/.claude/projects/<project-path>/` as JSONL.

### Message Types (from real session analysis)
| Type | Description | Key Fields |
|------|-------------|------------|
| `queue-operation` | Session queue events | `operation`, `sessionId` |
| `user` | User messages or tool results | `message.role`, `message.content` |
| `assistant` | Assistant responses or tool calls | `message.role`, `message.content` |

### User Message with Tool Result Structure
```json
{
  "type": "user",
  "uuid": "string",
  "parentUuid": "string",
  "sessionId": "string",
  "timestamp": "ISO-8601",
  "sourceToolAssistantUUID": "string",
  "toolUseResult": {
    "stdout": "string",
    "stderr": "string",
    "interrupted": false,
    "isImage": false
  },
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_xxx",
      "content": "result text",
      "is_error": false
    }]
  }
}
```

### Assistant Message with Tool Use Structure
```json
{
  "type": "assistant",
  "uuid": "string",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_xxx",
      "name": "Bash",
      "input": { "command": "..." }
    }]
  }
}
```

### Error Correlation Pattern
1. Assistant sends `tool_use` with `id: "toolu_xxx"` and `name: "ToolName"`
2. User responds with `tool_result` containing `tool_use_id: "toolu_xxx"`
3. When `is_error: true`, the error message is in the `content` field
4. `sourceToolAssistantUUID` in user message points to the assistant message UUID

### jq Query Examples for Parsing

```bash
# Extract all tool results with errors
jq -c 'select(.message.content[]?.is_error == true)' session.jsonl

# Extract tool_use_id from error results
jq -r '.message.content[] | select(.is_error == true) | .tool_use_id' session.jsonl

# Find assistant message by UUID (for correlation)
jq -c 'select(.uuid == "TARGET_UUID")' session.jsonl

# Extract tool name and input from assistant message
jq -r '.message.content[] | select(.type == "tool_use") | "\(.name): \(.input | tostring)"' session.jsonl
```

## Required Imports
### Internal
- None (standalone bash script)

### External
- `jq`: JSON parsing (must be validated in preflight)

## Types/Interfaces to Use
N/A - bash script output format is structured text or JSON

### Suggested Output Format (TSV or JSON)
```bash
# TSV format: tool_name<TAB>tool_use_id<TAB>error_message
Bash	toolu_01xxx	Exit code 1: Command not found

# JSON format
{"tool_name":"Bash","tool_use_id":"toolu_01xxx","error":"Exit code 1: Command not found"}
```

## Integration Points
- **Called by**: Future `analyze-session` command, sign detection workflows
- **Calls**: jq for JSON parsing
- **Tests**: Will test with real session files from `~/.claude/projects/`

## Directory Structure for Outputs

```
plugins/m42-signs/
├── scripts/
│   └── parse-transcript.sh       # NEW: Parse JSONL transcripts
└── skills/
    └── managing-signs/
        └── references/
            └── transcript-format.md  # NEW: Document format
```

## Implementation Notes
- Script must handle both single-item and array content in messages
- Use `select()` with null-safe access (`?.`) to handle missing fields
- Error messages may be wrapped in `<tool_use_error>` tags
- The `sourceToolAssistantUUID` field links tool_result to its tool_use
- Prefer `--slurp` with careful memory for large files, or stream processing for efficiency
- Test with real session file: `~/.claude/projects/-home-konstantin-projects-m42-claude-plugins/*.jsonl`

## Reference File Requirements
- Must have YAML frontmatter with: `title`, `description`, `skill: managing-signs`
- Should include jq query examples for common operations
- Document the correlation logic between tool_use and tool_result
- Keep content LLM-dense (tables, code examples, minimal prose)
