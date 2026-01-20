# Step Context: step-0

## Task
Create preprocessing scripts for m42-signs plugin to handle large transcripts.

Create these 3 bash scripts in plugins/m42-signs/scripts/:

1. extract-reasoning.sh - Extract assistant text blocks using jq
2. transcript-summary.sh - Generate quick stats (line count, errors, tool sequence)
3. find-learning-lines.sh - Pattern-match high-value reasoning lines

All scripts should:
- Use jq for JSON processing
- Check for jq availability with clear error
- Follow the patterns in parse-transcript.sh (deprecated reference)
- Be executable (chmod +x)

## Implementation Plan
Based on gherkin scenarios (8 total), implement in this order:
1. Create extract-reasoning.sh (Scenarios 1, 2, 3, 8)
2. Create transcript-summary.sh (Scenarios 4, 5, 8)
3. Create find-learning-lines.sh (Scenarios 6, 7, 8)
4. Make all scripts executable with chmod +x

## Related Code Patterns

### Pattern from: plugins/m42-signs/scripts/parse-transcript.sh
```bash
#!/bin/bash
set -euo pipefail

# DEPRECATED: but shows jq patterns for parsing transcripts

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

# jq processing follows...
```

### Pattern from: plugins/m42-signs/scripts/find-retry-patterns.sh
Shows complex jq with slurp mode for multi-line analysis:
```bash
jq -s '
  # Build tool_use index from assistant messages
  (
    [.[] | select(.type == "assistant") | .message.content[]? // empty | select(.type == "tool_use")] |
    ...
  )
' "$FILE"
```

### Pattern from: plugins/m42-signs/scripts/validate-backlog.sh
Shows ERRORS/WARNINGS array pattern for validation reporting.

## Required Imports
### Internal
- None (standalone bash scripts)

### External
- `jq`: JSON processor - required for all scripts

## Transcript JSONL Format
Each line is one of these types:
- `system/init`: Session metadata (`{type: "system", subtype: "init", ...}`)
- `assistant`: Claude responses with `message.content[]` array containing:
  - `{type: "text", text: "..."}` - reasoning blocks (TARGET for extraction)
  - `{type: "tool_use", name: "...", input: {...}}` - tool calls
- `user`: User input or tool results with `message.content[]` array containing:
  - `{type: "tool_result", is_error: true/false, content: "..."}`
- `result`: Session end stats

## jq Patterns for Implementation

### Extract assistant text blocks
```bash
jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text" and .text != null and (.text | length) > 50) |
  {text: .text}
' "$TRANSCRIPT"
```

### Generate summary with slurp (-s)
```bash
jq -s '
{
  total_lines: length,
  assistant_messages: [.[] | select(.type == "assistant")] | length,
  text_blocks: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "text")] | length,
  error_count: [.[] | select(.type == "user") | .message.content[]? | select(.is_error == true)] | length,
  tool_sequence: [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name][0:30]
}
' "$TRANSCRIPT"
```

### Find learning patterns with regex
```bash
jq -c '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "text") |
  select(.text | test("I notice|I see that|This means|Actually|The issue|This works because|The pattern|must change together|requires"; "i")) |
  {snippet: (.text | .[0:150])}
' "$TRANSCRIPT"
```

## Integration Points
- Called by: `plugins/m42-signs/commands/extract.md` (in Step 2)
- Calls: `jq` (external tool)
- Output used by: chunk-analyzer subagent (Step 1), extract command (Step 2)

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-signs/scripts/extract-reasoning.sh` | Create | Extract assistant text blocks |
| `plugins/m42-signs/scripts/transcript-summary.sh` | Create | Generate quick stats |
| `plugins/m42-signs/scripts/find-learning-lines.sh` | Create | Pattern-match high-value lines |

## Test Files (Already Created in RED Phase)
| Test File | Scenarios Covered |
|-----------|-------------------|
| `tests/test-extract-reasoning.sh` | 1, 2, 3, 8 |
| `tests/test-transcript-summary.sh` | 4, 5, 8 |
| `tests/test-find-learning-lines.sh` | 6, 7, 8 |
| `tests/run-all-tests.sh` | all |

## Test Transcript for Verification
- Path: `.claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl`
- 82 lines
- Contains assistant text blocks, tool_use, and tool_result entries

## Verification Commands
```bash
# After implementation, all should PASS:
./tests/test-extract-reasoning.sh
./tests/test-transcript-summary.sh
./tests/test-find-learning-lines.sh
./tests/run-all-tests.sh  # Expected: 8/8 tests pass
```
