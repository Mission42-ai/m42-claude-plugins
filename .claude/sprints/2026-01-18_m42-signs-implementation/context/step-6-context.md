# Step Context: step-6

## Task
Implement /m42-signs:extract command that:
1. Accepts session ID or transcript file path
2. Finds session file in ~/.claude/projects/ if ID given
3. Runs parsing -> retry detection -> target inference pipeline
4. Generates learning entries in backlog format
5. Writes to .claude/learnings/backlog.yaml (append mode)
6. Supports --dry-run, --confidence-min, --auto-approve options

## Related Code Patterns

### Similar Implementation: plugins/m42-signs/commands/add.md
```markdown
---
allowed-tools: Bash(test:*, mkdir:*, ls:*), Read(*), Edit(*), Write(*), Glob(**/CLAUDE.md)
argument-hint: "[--direct] [title]"
description: Add a new learning sign manually to the backlog or directly to CLAUDE.md
model: sonnet
---

# Add Learning Sign

## Preflight Checks
1. Check if backlog directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. Check if backlog file exists:
   !`test -f .claude/learnings/backlog.yaml && echo "EXISTS" || echo "NOT_EXISTS"`
```

Key patterns:
- Frontmatter structure with allowed-tools, argument-hint, description, model
- Preflight checks using `!` backtick syntax
- $ARGUMENTS parsing for flags
- mkdir -p for directory creation
- Backlog YAML append logic

### Similar Implementation: plugins/m42-signs/commands/status.md
```markdown
---
allowed-tools: Bash(test:*, ls:*), Read(*)
argument-hint: ""
description: Show backlog status summary with counts by status
model: haiku
---
```

Key patterns:
- Read-only operations can use haiku model
- Handle missing backlog gracefully with helpful messages
- Reference other commands in suggestions

### Similar Implementation: plugins/m42-signs/commands/list.md
```markdown
---
allowed-tools: Bash(ls:*, test:*), Read(*), Glob(**/CLAUDE.md), Grep(*)
argument-hint: "[--format json]"
description: List all signs across CLAUDE.md files in the project
model: haiku
---
```

Key patterns:
- Argument parsing for output format
- Edge case documentation

## Required Imports
### Internal Scripts
- `scripts/parse-transcript.sh`: Parse JSONL, correlate tool_use with tool_result errors
- `scripts/find-retry-patterns.sh`: Detect error->success sequences, confidence scoring
- `scripts/infer-target.sh`: Find appropriate CLAUDE.md from file paths
- `scripts/validate-backlog.sh`: Validate backlog YAML structure

### External Tools
- `jq`: JSON processing (used by parse-transcript.sh, find-retry-patterns.sh)
- `yq`: YAML processing (for backlog manipulation)
- `find`: Session file location

## Types/Interfaces to Use

### Backlog Schema (from shared context)
```yaml
version: 1
extracted-from: <session-id or sprint-id>
extracted-at: <ISO timestamp>

learnings:
  - id: kebab-case-id
    status: pending | approved | rejected | applied
    title: Short description
    problem: |
      Multi-line description of what went wrong
    solution: |
      Multi-line description of how to fix/avoid
    target: path/to/CLAUDE.md
    confidence: low | medium | high
    source:
      tool: <tool name>
      command: <command that failed>
      error: <error message>
```

### Session File Location Pattern
```bash
# Project path encoding
PROJECT_PATH=$(pwd | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_PATH"

# Session file
SESSION_FILE="$SESSION_DIR/$SESSION_ID.jsonl"
```

### find-retry-patterns.sh Output Format
```json
{
  "session_id": "abc123",
  "analyzed_at": "2026-01-18T12:00:00Z",
  "patterns": [
    {
      "tool": "Bash",
      "pattern_type": "command_syntax",
      "confidence": "high",
      "failed_input": {"command": "yq '.phases[$IDX].status'"},
      "success_input": {"command": "yq '.phases['\"$IDX\"'].status'"},
      "error_message": "returned empty string",
      "diff": {"field": "command", "from": "...", "to": "..."}
    }
  ],
  "summary": {
    "total_errors": 5,
    "retry_patterns_found": 3,
    "by_tool": {"Bash": 2, "Read": 1},
    "by_confidence": {"high": 1, "medium": 2}
  }
}
```

## Integration Points
- **Called by**: User via `/m42-signs:extract <session-id|path>`
- **Calls**: parse-transcript.sh, find-retry-patterns.sh, infer-target.sh
- **Outputs to**: .claude/learnings/backlog.yaml (append mode)
- **Related commands**: /m42-signs:status (to view results), /m42-signs:review (to process)

## Implementation Notes

### Session File Resolution
1. Check if argument is a file path (contains `/` or ends in `.jsonl`)
2. If file path: use directly, validate exists
3. If session ID:
   - Get encoded project path: `$(pwd | sed 's|/|-|g')`
   - Build path: `~/.claude/projects/$PROJECT_PATH/$SESSION_ID.jsonl`
   - Also try partial ID matching with find/glob

### Pipeline Orchestration
```bash
# Step 1: Parse transcript for errors
ERRORS=$(scripts/parse-transcript.sh "$SESSION_FILE")

# Step 2: Find retry patterns with confidence
PATTERNS=$(scripts/find-retry-patterns.sh "$SESSION_FILE")

# Step 3: For each pattern, infer target CLAUDE.md
# Extract file paths from pattern inputs, call infer-target.sh

# Step 4: Generate learning entries
# Transform patterns to backlog format

# Step 5: Write/append to backlog.yaml
```

### Flag Handling
- `--dry-run`: Run pipeline but only print proposed learnings, don't write
- `--confidence-min <level>`: Filter patterns where confidence >= level (low < medium < high)
- `--auto-approve`: Set status to "approved" for high confidence, skip for low

### Edge Cases
1. **No errors found**: Output "No errors found in session - nothing to extract"
2. **Session file not found**: Clear error with search suggestions
3. **Malformed JSONL**: Graceful failure, report which line failed
4. **Empty patterns**: "Errors found but no retry patterns detected"
5. **Backlog doesn't exist**: Create with template structure
6. **Append mode**: Read existing backlog, append new learnings, preserve existing

### ID Generation
```bash
# From pattern title/error message
# Lowercase, replace spaces with hyphens, remove special chars, truncate
ID=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -dc 'a-z0-9-' | cut -c1-50)
```

### Success Output Format
```
## Extraction Summary

Session: abc123def
Analyzed at: 2026-01-18T12:00:00Z

### Errors Found: 5
### Retry Patterns: 3

| ID | Confidence | Tool | Target |
|----|------------|------|--------|
| quote-yq-variables | high | Bash | scripts/CLAUDE.md |
| check-file-exists | medium | Read | CLAUDE.md |
| use-glob-pattern | medium | Glob | src/CLAUDE.md |

Written 3 learnings to .claude/learnings/backlog.yaml

Next: Review with /m42-signs:review
```
