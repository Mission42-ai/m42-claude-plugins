# Session Tracking & Conversation Analysis

> Research findings from 2026-01-17 exploring Claude Code's session storage and JSON streaming capabilities.

## Purpose

Understanding session storage is critical for m42-signs because:
1. **Failure analysis** - Parse past sessions to identify what went wrong
2. **Sign generation** - Extract patterns from successful retries
3. **Context resumption** - Resume work with full history awareness

---

## Session Storage Locations

### User Messages (Input History)

```
~/.claude/history.jsonl
```

Format per line:
```json
{
  "display": "user message text",
  "pastedContents": {},
  "timestamp": 1768689397852,
  "project": "/path/to/project",
  "sessionId": "e8411bdc-4a21-4070-944c-76acb850a62d"
}
```

**Use case**: Quick lookup of session IDs, search by project/timestamp.

### Full Conversations (Including Assistant Responses)

```
~/.claude/projects/{encoded-project-path}/{session-id}.jsonl
```

Example:
```
~/.claude/projects/-home-konstantin-projects-m42-claude-plugins/e8411bdc-4a21-4070-944c-76acb850a62d.jsonl
```

**Contains**: User messages, assistant responses, tool calls, tool results, thinking blocks, timestamps.

### Session Index

```
~/.claude/projects/{encoded-project-path}/sessions-index.json
```

**Use case**: List all sessions for a project with metadata.

### Related Storage

| Location | Content |
|----------|---------|
| `~/.claude/todos/{agent-id}.json` | Todo lists per agent/session |
| `~/.claude/plans/*.md` | Planning mode outputs |
| `~/.claude/file-history/` | File change tracking |

---

## CLI Options for Session Management

### Resume Sessions

```bash
# Continue most recent session in current directory
claude -c

# Resume specific session by ID
claude -r "e8411bdc-4a21-4070-944c-76acb850a62d"

# Resume by name (if named)
claude -r "auth-refactor"

# Use specific session ID (must be valid UUID)
claude --session-id "550e8400-e29b-41d4-a716-446655440000"

# Fork session (new ID, preserves history)
claude --resume abc123 --fork-session
```

### JSON Streaming Output

```bash
# Stream JSON to stdout (requires --verbose in print mode)
claude -p "your query" --output-format stream-json --verbose

# Include partial streaming events
claude -p "your query" --output-format stream-json --verbose --include-partial-messages

# Pipe to file
claude -p "your query" --output-format stream-json --verbose > session.jsonl
```

---

## Stream JSON Format

### Message Types

| Type | Subtype | Description |
|------|---------|-------------|
| `system` | `init` | Session initialization with metadata |
| `assistant` | - | Claude's responses (text or tool_use) |
| `user` | - | User input or tool results |
| `result` | `success`/`error` | Final outcome with stats |

### 1. Init Message

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "c50ae4d2-32d7-4e1e-ba5f-e6bdec6c19f2",
  "cwd": "/home/user/project",
  "model": "claude-opus-4-5-20251101",
  "tools": ["Task", "Bash", "Read", "Edit", "..."],
  "skills": ["crafting-agentic-prompts", "..."],
  "agents": ["Bash", "Explore", "Plan", "..."],
  "plugins": [{"name": "playwright", "path": "..."}],
  "permissionMode": "bypassPermissions",
  "claude_code_version": "2.1.12"
}
```

### 2. Assistant Message (Tool Use)

```json
{
  "type": "assistant",
  "session_id": "c50ae4d2-...",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01FJQtQQkwEiq2fVu3sk3QEn",
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_019Zib79YJcMPVu5AQ4Ug3hs",
      "name": "Bash",
      "input": {
        "command": "ls -la",
        "description": "List files"
      }
    }],
    "usage": {
      "input_tokens": 3,
      "output_tokens": 1,
      "cache_read_input_tokens": 26032
    }
  }
}
```

### 3. Tool Result (Success)

```json
{
  "type": "user",
  "session_id": "c50ae4d2-...",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_019Zib79YJcMPVu5AQ4Ug3hs",
    "content": "total 32\ndrwxr-xr-x  6 user user 4096...",
    "is_error": false
  }],
  "tool_use_result": {
    "stdout": "total 32\n...",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

### 4. Tool Result (Failure)

```json
{
  "type": "user",
  "session_id": "c50ae4d2-...",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_019bFz5icc5ktw5awAS59CwR",
    "content": "Exit code 2\nls: cannot access '/nonexistent': No such file or directory",
    "is_error": true
  }],
  "tool_use_result": "Error: Exit code 2\nls: cannot access '/nonexistent': No such file or directory"
}
```

### 5. Assistant Message (Text)

```json
{
  "type": "assistant",
  "session_id": "c50ae4d2-...",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "text",
      "text": "The command failed because the path doesn't exist."
    }]
  }
}
```

### 6. Result Message

```json
{
  "type": "result",
  "subtype": "success",
  "session_id": "c50ae4d2-...",
  "is_error": false,
  "duration_ms": 6590,
  "duration_api_ms": 6290,
  "num_turns": 2,
  "total_cost_usd": 0.112,
  "result": "The command failed because...",
  "usage": {
    "input_tokens": 4,
    "output_tokens": 124,
    "cache_read_input_tokens": 43865
  }
}
```

---

## Detecting Errors in Session Logs

### Quick Detection

```bash
# Find all tool errors in a session
grep '"is_error":true' session.jsonl

# Count errors
grep -c '"is_error":true' session.jsonl
```

### Structured Analysis with jq

```bash
# Extract all failed tool calls
jq 'select(.type=="user") | .content[]? | select(.is_error==true)' session.jsonl

# Get tool name and error for each failure
jq -r '
  select(.type=="user" and .content[0].is_error==true) |
  "\(.content[0].tool_use_id): \(.content[0].content | split("\n")[0])"
' session.jsonl

# Find which Bash commands failed
jq -r '
  select(.type=="assistant") |
  .message.content[]? |
  select(.type=="tool_use" and .name=="Bash") |
  {id: .id, command: .input.command}
' session.jsonl
```

### Correlating Failures with Tool Calls

```bash
# Full pipeline: match tool_use with its result
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

---

## Integration with m42-signs

### Proposed Workflow

```
Session Logs → Failure Detection → Pattern Extraction → Sign Proposal → Human Review → Sign Storage
```

### Implementation Ideas

#### 1. Post-Sprint Analysis Hook

```bash
# Hook: after-sprint-complete
# Analyze session for failures that were later resolved

SESSION_FILE="$HOME/.claude/projects/.../$SESSION_ID.jsonl"

# Find retry patterns (failure followed by success for same operation)
./analyze-retries.sh "$SESSION_FILE" | \
  ./propose-signs.sh | \
  ./signs add --draft
```

#### 2. Real-time Error Capture

```bash
# Stream session and capture errors as they happen
claude -p "task" --output-format stream-json --verbose | \
  tee session.jsonl | \
  jq --unbuffered 'select(.content[0].is_error==true)' | \
  ./record-failure.sh
```

#### 3. Sign Query by Session Context

```bash
# Before executing a step, query relevant signs
TOOLS=$(jq -r '.tools[]' < init.json | tr '\n' ',')
RECENT_ERRORS=$(grep '"is_error":true' session.jsonl | tail -3)

./signs query \
  --tools "$TOOLS" \
  --recent-errors "$RECENT_ERRORS" \
  --limit 5
```

---

## Useful Scripts

### find-session.sh

```bash
#!/bin/bash
# Find session by partial ID or timestamp
QUERY="$1"
PROJECT_PATH=$(pwd | sed 's|/|-|g')

grep -l "$QUERY" ~/.claude/projects/"$PROJECT_PATH"/*.jsonl 2>/dev/null | \
  while read f; do
    echo "$(basename "$f" .jsonl): $(jq -r 'select(.type=="system") | .cwd' "$f" | head -1)"
  done
```

### session-errors.sh

```bash
#!/bin/bash
# Summarize errors in a session
SESSION_FILE="$1"

echo "=== Session Errors ==="
jq -r '
  select(.type=="user" and .content[0].is_error==true) |
  .content[0].content | split("\n")[0]
' "$SESSION_FILE" | sort | uniq -c | sort -rn
```

### session-cost.sh

```bash
#!/bin/bash
# Get cost summary for session
SESSION_FILE="$1"

jq -r 'select(.type=="result") | "Cost: $\(.total_cost_usd | tostring | .[0:6]) | Turns: \(.num_turns) | Duration: \(.duration_ms/1000)s"' "$SESSION_FILE"
```

---

## Open Questions

1. **Session persistence** - Can we prevent `--no-session-persistence` sessions from being lost?
2. **Thinking blocks** - Full session files include thinking - useful for understanding reasoning
3. **Cross-session linking** - How to track a task across multiple sessions (e.g., sprint steps)?
4. **Privacy** - Session files may contain sensitive data; consider before sharing/analyzing

---

## References

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference.md)
- Session ID discovered: `e8411bdc-4a21-4070-944c-76acb850a62d` (this research session)
- Related: Ralph Loop pattern, m42-sprint execution tracking
