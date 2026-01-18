---
title: Claude Session Transcript Format
description: JSONL transcript structure, message types, tool correlation, and jq query patterns for parsing Claude Code session files
keywords: transcript, jsonl, session, tool_use, tool_result, is_error, parsing, jq
file-type: reference
skill: managing-signs
---

## File Location

| Path Pattern | Example |
|-------------|---------|
| `~/.claude/projects/<encoded-path>/*.jsonl` | `~/.claude/projects/-home-user-project/abc123.jsonl` |

## Message Types

| Type | Role | Description | Key Fields |
|------|------|-------------|------------|
| `queue-operation` | - | Session lifecycle events | `operation`, `sessionId`, `timestamp` |
| `user` | `user` | User text or tool results | `message.content[]`, `sourceToolAssistantUUID` |
| `assistant` | `assistant` | LLM responses or tool calls | `message.content[]`, `uuid` |

## Common Fields (All Messages)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"user"` \| `"assistant"` \| `"queue-operation"` |
| `uuid` | string | Unique message identifier |
| `parentUuid` | string\|null | Parent message UUID |
| `sessionId` | string | Session identifier |
| `timestamp` | string | ISO-8601 timestamp |
| `cwd` | string | Working directory |
| `gitBranch` | string | Active git branch |

## Content Block Types

### Tool Use (Assistant)

```json
{
  "type": "tool_use",
  "id": "toolu_01xxx",
  "name": "Bash",
  "input": { "command": "ls -la" }
}
```

### Tool Result (User)

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01xxx",
  "content": "result or error text",
  "is_error": false
}
```

### Text Block

```json
{
  "type": "text",
  "text": "Assistant response text"
}
```

## Error Correlation

```
Assistant (uuid: A)                     User (sourceToolAssistantUUID: A)
├── tool_use                            ├── tool_result
│   ├── id: "toolu_xxx"        ────────────► tool_use_id: "toolu_xxx"
│   ├── name: "Read"                    │   ├── is_error: true
│   └── input: {file_path: "..."}       │   └── content: "<tool_use_error>..."
└── uuid: "A" ◄─────────────────────────└── sourceToolAssistantUUID: "A"
```

## jq Query Examples

### Extract All Errors

```bash
jq -c 'select(.message.content | type == "array") |
  select(.message.content[] | .is_error == true)' session.jsonl
```

### Get Error Tool IDs

```bash
jq -r '.message.content[] | select(.is_error == true) | .tool_use_id' session.jsonl
```

### Find Tool Use by UUID

```bash
jq -c 'select(.uuid == "TARGET_UUID") | .message.content[] |
  select(.type == "tool_use")' session.jsonl
```

### Extract Tool Name and Input

```bash
jq -r '.message.content[] | select(.type == "tool_use") |
  "\(.name): \(.input | tostring)"' session.jsonl
```

### Build Error Report

```bash
jq -c '
  select(.type == "user") |
  select(.message.content | type == "array") |
  .sourceToolAssistantUUID as $src |
  .message.content[] |
  select(.is_error == true) |
  {tool_use_id, error: .content, source: $src}
' session.jsonl
```

### Count Errors by Type

```bash
jq -s '[.[] | select(.message.content[]?.is_error == true)] |
  group_by(.message.content[0].content | split(">")[0]) |
  map({error_type: .[0].message.content[0].content | split(">")[0], count: length})' session.jsonl
```

## Error Message Patterns

| Pattern | Tool | Typical Cause |
|---------|------|---------------|
| `<tool_use_error>File does not exist.</tool_use_error>` | Read | Invalid file path |
| `<tool_use_error>Exit code 1</tool_use_error>` | Bash | Command failed |
| `<tool_use_error>Permission denied</tool_use_error>` | Write | File permissions |
| `<tool_use_error>Directory not found</tool_use_error>` | Glob | Invalid path |

## Full Error Object Example

```json
{
  "type": "user",
  "uuid": "367a4c21-a44c-4c21-877b-e00528422911",
  "parentUuid": "145252a3-a51d-4fd9-9212-f2258b04e278",
  "sessionId": "02c29593-0a92-4207-9fd8-455a9021c715",
  "timestamp": "2026-01-16T13:47:42.610Z",
  "sourceToolAssistantUUID": "145252a3-a51d-4fd9-9212-f2258b04e278",
  "toolUseResult": "Error: File does not exist.",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_019RgS4vCN1L3tc2sPCgCrh1",
      "content": "<tool_use_error>File does not exist.</tool_use_error>",
      "is_error": true
    }]
  }
}
```

## Related Tool Use (via sourceToolAssistantUUID)

```json
{
  "type": "assistant",
  "uuid": "145252a3-a51d-4fd9-9212-f2258b04e278",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_019RgS4vCN1L3tc2sPCgCrh1",
      "name": "Read",
      "input": {"file_path": "/path/to/missing/file.sh"}
    }]
  }
}
```
