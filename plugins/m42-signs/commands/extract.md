---
allowed-tools: Bash(test:*, mkdir:*, ls:*, find:*), Read(*), Write(*), Edit(*), Glob(*)
argument-hint: "<session-id|path> [--dry-run] [--confidence-min <level>] [--auto-approve]"
description: Extract learnings from session transcript to backlog
model: sonnet
---

# Extract Learnings from Session

Extract learning signs from a Claude Code session transcript. Analyzes errors, detects retry patterns, infers target CLAUDE.md files, and writes proposed learnings to the backlog.

## Preflight Checks

1. Check if scripts directory exists:
   !`test -d plugins/m42-signs/scripts && echo "EXISTS" || echo "NOT_EXISTS"`

2. Check if parse-transcript.sh exists:
   !`test -f plugins/m42-signs/scripts/parse-transcript.sh && echo "EXISTS" || echo "NOT_EXISTS"`

3. Check if find-retry-patterns.sh exists:
   !`test -f plugins/m42-signs/scripts/find-retry-patterns.sh && echo "EXISTS" || echo "NOT_EXISTS"`

4. Check if infer-target.sh exists:
   !`test -f plugins/m42-signs/scripts/infer-target.sh && echo "EXISTS" || echo "NOT_EXISTS"`

## Context

Parse `$ARGUMENTS` to determine:
- Session identifier (first non-flag argument): Either session ID or file path
- `--dry-run`: Preview what would be extracted without writing to backlog
- `--confidence-min <level>`: Filter to only include patterns with confidence >= level (low, medium, high)
- `--auto-approve`: Automatically set status to "approved" for high-confidence learnings

### Session File Resolution

The argument can be:
1. **File path** (contains `/` or ends in `.jsonl`): Use directly
2. **Session ID**: Find in `~/.claude/projects/` using encoded project path

For session IDs, the file location follows this pattern:
```bash
PROJECT_PATH=$(pwd | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_PATH"
SESSION_FILE="$SESSION_DIR/$SESSION_ID.jsonl"
```

If exact match not found, try partial ID matching with find/glob.

## Task Instructions

### 1. Parse Arguments

Extract from `$ARGUMENTS`:
- First non-flag argument: session ID or file path
- Check for `--dry-run` flag
- Check for `--confidence-min` followed by level (low/medium/high)
- Check for `--auto-approve` flag

### 2. Resolve Session File

**If argument contains `/` or ends in `.jsonl`**:
- Treat as direct file path
- Verify file exists

**If argument is a session ID**:
- Compute encoded project path: `$(pwd | sed 's|/|-|g')`
- Build path: `~/.claude/projects/$PROJECT_PATH/$SESSION_ID.jsonl`
- If exact file not found, try:
  - Glob pattern: `~/.claude/projects/*/$SESSION_ID.jsonl`
  - Partial match: `find ~/.claude/projects/ -name "$SESSION_ID*" -type f`

**If session file not found**:
- Output clear error: "Session file not found: <attempted paths>"
- Suggest: "Use `ls ~/.claude/projects/$(pwd | sed 's|/|-|g')/` to see available sessions"

### 3. Parse Transcript for Errors

Run the parse-transcript.sh script to extract errors:
```bash
plugins/m42-signs/scripts/parse-transcript.sh "$SESSION_FILE"
```

This returns JSON array of errors with tool info.

**If parsing fails** (malformed JSONL):
- Output graceful error: "Failed to parse transcript: invalid JSONL format"
- Include specific line that failed if available

**If no errors found**:
- Output: "No errors found in session - nothing to extract"
- Exit successfully (this is not a failure state)

### 4. Find Retry Patterns

Run the find-retry-patterns.sh script to detect error→success sequences:
```bash
plugins/m42-signs/scripts/find-retry-patterns.sh "$SESSION_FILE"
```

This returns JSON with:
- `session_id`: Session identifier
- `analyzed_at`: Timestamp
- `patterns[]`: Array of detected patterns with confidence scores
- `summary`: Counts by tool, pattern type, and confidence

**If no retry patterns found** but errors exist:
- Output: "Errors found but no retry patterns detected - manual review needed"
- Optionally list the errors for manual inspection

### 5. Filter by Confidence (if --confidence-min)

If `--confidence-min` was specified, filter patterns:
- `low`: Include all patterns (low, medium, high)
- `medium`: Include medium and high only
- `high`: Include high only

### 6. Infer Target CLAUDE.md for Each Pattern

For each pattern, extract file paths from the input and run infer-target.sh:
```bash
plugins/m42-signs/scripts/infer-target.sh "$FILE_PATH1" "$FILE_PATH2"
```

Extract paths from:
- Bash: `command` field (look for file paths in command)
- Read/Write/Edit: `file_path` or `path` field
- Glob/Grep: `path` field or inferred from pattern

If no paths can be extracted, default to `CLAUDE.md` (project root).

### 7. Generate Learning Entries

For each pattern, create a learning entry:

```yaml
- id: <generated-kebab-case-id>
  status: pending  # or "approved" if --auto-approve and high confidence
  title: <Generated title from pattern type and tool>
  problem: |
    <Error message and context>
  solution: |
    <What changed from failed to success>
  target: <inferred CLAUDE.md path>
  confidence: <low|medium|high>
  source:
    tool: <tool name>
    command: <failed input summary>
    error: <error message excerpt>
```

**ID Generation**:
```bash
ID=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -dc 'a-z0-9-' | cut -c1-50)
```

**Title Generation** based on pattern_type:
- `command_syntax`: "Fix [tool] command syntax"
- `file_path`: "Correct file path for [tool]"
- `command_fix`: "Fix [tool] command"
- `pattern_fix`: "Fix [tool] search pattern"
- `file_operation`: "Handle [tool] file operation"
- Default: "Fix [tool] usage"

### 8. Handle --dry-run Mode

If `--dry-run` is set:
- Show all proposed learnings in formatted table
- Do NOT write to backlog
- Output: "Dry run complete - no changes written"

### 9. Write to Backlog

If NOT `--dry-run`:

1. Ensure directory exists:
   ```bash
   mkdir -p .claude/learnings
   ```

2. If backlog.yaml doesn't exist, create with template:
   ```yaml
   version: 1
   extracted-from: null
   extracted-at: null

   learnings: []
   ```

3. Read existing backlog.yaml

4. Update metadata:
   - `extracted-from`: session ID or file path
   - `extracted-at`: current ISO timestamp

5. Append new learnings to the `learnings:` array

6. Write updated backlog.yaml

### 10. Output Summary

Display extraction results:

```
## Extraction Summary

Session: <session-id>
Analyzed at: <timestamp>

### Errors Found: <count>
### Retry Patterns: <count>

| ID | Confidence | Tool | Target |
|----|------------|------|--------|
| <id> | <confidence> | <tool> | <target> |
...

Written <count> learnings to .claude/learnings/backlog.yaml

Next: Review with /m42-signs:review
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No errors found | Output "No learnings to extract" and exit cleanly |
| Session file not found | Clear error with search suggestions |
| Malformed JSONL | Graceful failure with specific error details |
| No retry patterns | Report errors exist but no patterns detected |
| Backlog doesn't exist | Create with template structure |
| Empty patterns after filtering | Report filter removed all patterns |

## Success Criteria

- Session file is correctly resolved (by ID or path)
- parse-transcript.sh, find-retry-patterns.sh, and infer-target.sh are called correctly
- Proposed learnings have valid structure matching backlog schema
- For `--dry-run`: Only preview shown, no files modified
- For normal mode: Backlog updated with new learnings
- Summary table clearly shows extracted learnings
- User directed to `/m42-signs:review` for next steps
