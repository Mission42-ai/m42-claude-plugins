---
title: Claude Code Transcript Format
description: JSONL message types and jq patterns for parsing Claude Code session transcripts. Used by parse-transcript.sh for error extraction.
keywords: transcript, jsonl, session, tool_use, tool_result, error, jq, parsing
skill: managing-signs
---

# Claude Code Transcript Format

## File Locations

| Location | Content |
|----------|---------|
| `~/.claude/projects/{encoded-path}/{session-id}.jsonl` | Full session transcript |
| `~/.claude/projects/{encoded-path}/sessions-index.json` | Session metadata index |
| `~/.claude/history.jsonl` | User input history with session IDs |

Path encoding: `/home/user/project` → `-home-user-project`

## Message Types

| Type | Subtype | Description | Key Fields |
|------|---------|-------------|------------|
| `system` | `init` | Session start | `session_id`, `tools[]`, `model`, `cwd` |
| `assistant` | - | Claude response | `message.content[]` (text/tool_use) |
| `user` | - | User input or tool result | `content[]` (tool_result) |
| `result` | success/error | Session end | `total_cost_usd`, `num_turns`, `duration_ms` |

## Message Structures

### system/init

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "uuid-string",
  "cwd": "/path/to/project",
  "model": "claude-opus-4-5-20251101",
  "tools": ["Task", "Bash", "Read", "Edit", "..."]
}
```

### assistant (tool_use)

```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_xxxxx",
      "name": "Bash",
      "input": {"command": "ls -la", "description": "List files"}
    }]
  }
}
```

### user (tool_result - success)

```json
{
  "type": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_xxxxx",
    "content": "output text...",
    "is_error": false
  }]
}
```

### user (tool_result - error)

```json
{
  "type": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_xxxxx",
    "content": "EISDIR: illegal operation on a directory",
    "is_error": true
  }]
}
```

### result

```json
{
  "type": "result",
  "subtype": "success",
  "total_cost_usd": 0.112,
  "num_turns": 5,
  "duration_ms": 6590
}
```

## Tool Input Variations

| Tool | Input Fields |
|------|--------------|
| `Bash` | `command`, `description`, `timeout` |
| `Read` | `file_path`, `offset`, `limit` |
| `Edit` | `file_path`, `old_string`, `new_string` |
| `Write` | `file_path`, `content` |
| `Glob` | `pattern`, `path` |
| `Grep` | `pattern`, `path`, `type` |
| `Task` | `prompt`, `subagent_type`, `description` |

## Correlation Logic

Tool use ID links request → response:

```
assistant.message.content[].id  ←→  user.content[].tool_use_id
```

## jq Query Examples

### Extract All Errors

```bash
jq 'select(.type=="user") | .content[]? | select(.is_error==true)' session.jsonl
```

### Count Errors

```bash
jq -s '[.[] | select(.type=="user") | .content[]? | select(.is_error==true)] | length' session.jsonl
```

### Correlate Tool Use with Error Result

```bash
jq -s '
  # Build tool_use index
  ([.[] | select(.type=="assistant") | .message.content[]? | select(.type=="tool_use")] |
   map({(.id): {tool: .name, input: .input}}) | add // {}) as $idx |

  # Find errors and join
  [.[] | select(.type=="user") | .content[]? | select(.is_error==true) |
   {error: .content, tool_use_id: .tool_use_id} + ($idx[.tool_use_id] // {})]
' session.jsonl
```

### Get Bash Command Failures

```bash
jq -s '
  [.[] | select(.type=="assistant") | .message.content[]? |
   select(.type=="tool_use" and .name=="Bash")] as $bash |
  [.[] | select(.type=="user") | .content[]? | select(.is_error==true)] |
  map(. as $err | $bash[] | select(.id == $err.tool_use_id) |
      {command: .input.command, error: $err.content})
' session.jsonl
```

### List Session Errors Summary

```bash
jq -r 'select(.type=="user" and .content[0].is_error==true) |
       .content[0].content | split("\n")[0]' session.jsonl |
  sort | uniq -c | sort -rn
```

## Quick Grep Patterns

```bash
# Find sessions with errors
grep -l '"is_error":true' ~/.claude/projects/*/*.jsonl

# Count errors in session
grep -c '"is_error":true' session.jsonl

# Extract error messages
grep '"is_error":true' session.jsonl | jq -r '.content[0].content | split("\n")[0]'
```

## parse-transcript.sh Output

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

Empty array `[]` if no errors found.
