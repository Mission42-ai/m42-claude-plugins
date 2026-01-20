# Scripts Reference

Helper scripts for transcript preprocessing and analysis. Used automatically by `/m42-signs:extract` for large transcripts.

---

## Quick Reference

### Active Scripts

| Script | Purpose |
|--------|---------|
| `transcript-summary.sh` | Generate transcript statistics |
| `find-learning-lines.sh` | Find high-value learning indicators |
| `extract-reasoning.sh` | Extract assistant text blocks |
| `validate-backlog.sh` | Validate backlog YAML schema |

### Deprecated Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `find-retry-patterns.sh` | Detect error→success sequences | Deprecated - LLM analysis preferred |
| `infer-target.sh` | Determine target CLAUDE.md file | Deprecated - LLM analysis preferred |
| `parse-transcript.sh` | Parse transcript for tool errors | Deprecated - LLM analysis preferred |

> **Note**: Deprecated scripts are kept for reference. The `/m42-signs:extract` command now uses LLM-based analysis which provides richer learnings including architectural insights, not just error patterns.

---

## transcript-summary.sh

Generate statistics for Claude Code session transcripts.

### Synopsis

```
transcript-summary.sh <session-file.jsonl>
```

### Description

Produces a JSON summary of the transcript including line count, message types, error count, and tool usage sequence. Useful for quickly assessing transcript size and content.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-file.jsonl>` | Yes | Path to JSONL transcript file |

### Output

Returns JSON object:

```json
{
  "total_lines": 150,
  "assistant_messages": 45,
  "text_blocks": 78,
  "error_count": 3,
  "tool_sequence": ["Read", "Grep", "Read", "Edit", "Bash", ...]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_lines` | number | Total JSONL entries in transcript |
| `assistant_messages` | number | Count of assistant message blocks |
| `text_blocks` | number | Count of text blocks (reasoning content) |
| `error_count` | number | Count of tool results with `is_error: true` |
| `tool_sequence` | array | First 30 tool names in call order |

### Example

```bash
plugins/m42-signs/scripts/transcript-summary.sh ~/.claude/projects/myproject/session.jsonl
# Output: {"total_lines": 150, "assistant_messages": 45, ...}
```

### Dependencies

- `jq` - JSON processor

---

## find-learning-lines.sh

Find lines in transcript that indicate learning-worthy content.

### Synopsis

```
find-learning-lines.sh <session-file.jsonl>
```

### Description

Pattern-matches assistant text blocks for phrases that typically indicate insights or learnings. Outputs JSONL with truncated snippets for quick review.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-file.jsonl>` | Yes | Path to JSONL transcript file |

### Output

JSONL with snippet objects (max 150 chars each, max 30 lines):

```json
{"snippet": "I notice that the validation must complete before..."}
{"snippet": "The pattern here is to always check file existence..."}
{"snippet": "Actually, this requires updating both files together..."}
```

### Pattern Matching

Searches for these learning indicator phrases (case-insensitive):

- "I notice"
- "I see that"
- "This means"
- "Actually"
- "The issue"
- "This works because"
- "The pattern"
- "must change together"
- "requires"

### Example

```bash
plugins/m42-signs/scripts/find-learning-lines.sh session.jsonl | jq -r '.snippet'
```

### Dependencies

- `jq` - JSON processor

---

## extract-reasoning.sh

Extract assistant text blocks from transcripts for focused analysis.

### Synopsis

```
extract-reasoning.sh <session-file.jsonl>
```

### Description

Filters the transcript to output only assistant text blocks with meaningful content (>50 characters). Creates a condensed file containing the reasoning content where learnings typically reside.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-file.jsonl>` | Yes | Path to JSONL transcript file |

### Output

JSONL with text objects:

```json
{"text": "Let me analyze this component. I notice that the validation..."}
{"text": "The build failed because TypeScript couldn't find..."}
```

### Filtering Criteria

- Only `assistant` message types
- Only `text` content blocks (not tool_use)
- Text length > 50 characters

### Example

```bash
# Extract reasoning to file
plugins/m42-signs/scripts/extract-reasoning.sh session.jsonl > reasoning.jsonl

# Check size
wc -l reasoning.jsonl

# Preview content
head -5 reasoning.jsonl | jq -r '.text[:100]'
```

### Dependencies

- `jq` - JSON processor

---

## find-retry-patterns.sh

> **DEPRECATED**: This script is no longer used by `/m42-signs:extract`. The extraction command now uses LLM-based analysis which provides much richer learnings including architectural insights, not just retry patterns. Kept for reference.

Detect error→success retry sequences in transcripts.

### Synopsis

```
find-retry-patterns.sh <session-file.jsonl>
```

### Description

Identifies patterns where a tool fails, is retried (possibly with modifications), and then succeeds. These patterns indicate high-confidence learnings.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-file.jsonl>` | Yes | Path to JSONL transcript file |

### Output

JSON array of retry pattern objects:

```json
[
  {
    "tool": "Bash",
    "error_command": "npm test",
    "error_message": "Cannot find module...",
    "success_command": "npm install && npm test",
    "confidence": "high"
  }
]
```

### Pattern Detection

Looks for sequences like:
1. Tool call with error result
2. Same tool called again (possibly modified)
3. Success result

### Example

```bash
plugins/m42-signs/scripts/find-retry-patterns.sh session.jsonl | jq '.[0]'
```

### Dependencies

- `jq` - JSON processor

---

## infer-target.sh

> **DEPRECATED**: This script is no longer used by `/m42-signs:extract`. The extraction command now uses LLM-based analysis which infers targets based on semantic understanding of what the learning is about. Kept for reference.

Determine appropriate target CLAUDE.md file for a learning.

### Synopsis

```
infer-target.sh [--json] <path1> [path2] [path3] ...
```

### Description

Given file paths from tool calls, determines the most appropriate CLAUDE.md file for learnings related to those files. Finds the common directory prefix and walks up the tree looking for existing CLAUDE.md files.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--json` | No | Output as JSON with reasoning |
| `<path1>` | Yes | First file path from tool call |
| `[path2] ...` | No | Additional file paths |

### Output

Plain text (default):
```
./plugins/m42-signs/CLAUDE.md
```

JSON (with `--json`):
```json
{
  "target": "./plugins/m42-signs/CLAUDE.md",
  "reasoning": "Common prefix is plugins/m42-signs/, existing CLAUDE.md found"
}
```

### Target Resolution

1. Find common directory prefix across all paths
2. Check for existing CLAUDE.md in that directory
3. Walk up directory tree checking each level
4. Fall back to project root `./CLAUDE.md`

### Example

```bash
# Find target for a specific file
plugins/m42-signs/scripts/infer-target.sh src/api/handlers/user.ts
# Output: ./src/api/CLAUDE.md or ./CLAUDE.md

# Multiple files - finds common prefix
plugins/m42-signs/scripts/infer-target.sh src/api/user.ts src/api/auth.ts

# JSON output with reasoning
plugins/m42-signs/scripts/infer-target.sh --json src/api/user.ts
```

### Dependencies

- `jq` (optional) - for proper JSON escaping with `--json` flag

---

## parse-transcript.sh

> **DEPRECATED**: This script is no longer used by `/m42-signs:extract`. The extraction command now uses LLM-based analysis which provides much richer learnings from assistant reasoning, not just tool errors. Kept for reference.

Parse transcript for tool errors with context.

### Synopsis

```
parse-transcript.sh <session-file.jsonl>
```

### Description

Parses Claude Code session transcript to extract tool errors with their associated context. Correlates `tool_use` blocks with `tool_result` blocks to provide complete error information.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<session-file.jsonl>` | Yes | Path to JSONL file to validate |

### Output

JSON array of error objects with tool context:

```json
[
  {
    "tool": "Bash",
    "input": {"command": "npm test"},
    "error": "Cannot find module 'express'",
    "tool_use_id": "toolu_abc123"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name that produced the error |
| `input` | object | Original tool input parameters |
| `error` | string | Error message content |
| `tool_use_id` | string | Correlation ID for the tool call |

### Dependencies

- `jq` - JSON processor

---

## validate-backlog.sh

Validate backlog YAML schema and content.

### Synopsis

```
validate-backlog.sh [backlog-path]
```

### Description

Validates that a backlog file conforms to the expected schema, checking required fields, valid status values, and proper formatting.

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `[backlog-path]` | No | `.claude/learnings/backlog.yaml` | Path to backlog file |

### Output

Validation result:

```
✓ Backlog valid
  Version: 1
  Learnings: 12
  Status counts: pending(5), approved(3), rejected(2), applied(2)
```

Or error details:

```
✗ Backlog invalid
  Line 15: Missing required field 'title'
  Line 23: Invalid status 'unknown'
```

### Validation Checks

- Schema version is present and supported
- All learnings have required fields (id, status, title, problem, solution, target)
- Status values are valid (pending, approved, rejected, applied)
- IDs are unique
- Targets end with `CLAUDE.md`

### Dependencies

- `yq` or `python3` with PyYAML

---

## Common Requirements

All scripts require:

- **bash** 4.0+ with `set -euo pipefail`
- **jq** for JSON processing (except `infer-target.sh`)

Install jq:

```bash
# macOS
brew install jq

# Ubuntu/Debian
apt-get install jq

# RHEL/CentOS
yum install jq
```

---

## See Also

- [Commands Reference](./commands.md) - All available commands
- [Handle Large Transcripts](../how-to/handle-large-transcripts.md) - Preprocessing workflow
- [Backlog Format Reference](./backlog-format.md) - Backlog YAML schema

---

[Back to Getting Started](../getting-started.md)
