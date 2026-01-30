# Agent Streaming Research

## Key Discovery: Claude Code Hooks System

Claude Code has a powerful hooks system that fires at specific lifecycle points. This is the ideal mechanism for streaming agent updates to our status dashboard.

## Relevant Hook Events

### Agent Lifecycle Hooks

| Hook | When it fires | Data provided |
|------|--------------|---------------|
| `SubagentStart` | When spawning a subagent | `agent_id`, `agent_type` |
| `SubagentStop` | When subagent finishes | `agent_id`, `agent_transcript_path` |

**SubagentStart Input:**
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"  // Built-in: "Bash", "Explore", "Plan", or custom names
}
```

**SubagentStop Input:**
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "hook_event_name": "SubagentStop",
  "agent_id": "def456",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl"
}
```

### Tool Usage Hooks

| Hook | When it fires | Data provided |
|------|--------------|---------------|
| `PreToolUse` | Before tool execution | `tool_name`, `tool_input`, `tool_use_id` |
| `PostToolUse` | After tool succeeds | `tool_name`, `tool_input`, `tool_response`, `tool_use_id` |
| `PostToolUseFailure` | After tool fails | Same as PostToolUse with error info |

**PreToolUse Example (Bash):**
```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

**PostToolUse Example (Edit):**
```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "old_string": "original",
    "new_string": "modified"
  },
  "tool_response": {
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

### Session Hooks

| Hook | When it fires |
|------|--------------|
| `SessionStart` | Session begins or resumes |
| `Stop` | Claude finishes responding |
| `SessionEnd` | Session terminates |

## Hook Configuration

Hooks are configured in settings files or skill/agent frontmatter:

**settings.json:**
```json
{
  "hooks": {
    "SubagentStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "/path/to/agent-monitor-hook.sh"
        }]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [{
          "type": "command",
          "command": "/path/to/agent-monitor-hook.sh"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": "/path/to/tool-monitor-hook.sh"
        }]
      }
    ]
  }
}
```

**Skills/Agents Frontmatter:**
```yaml
---
name: my-skill
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/monitor.sh"
---
```

## CLI Streaming Output

For watching real-time Claude output:

```bash
claude -p "query" --output-format stream-json --include-partial-messages
```

This outputs newline-delimited JSON events during execution.

## Implementation Strategy

### Option A: Hook-Based (Recommended)

1. Create hook scripts that write to a shared events file:
   - `.claude/sprints/{sprint-id}/.agent-events.jsonl`

2. Hook script writes standardized events:
   ```json
   {"type": "agent-spawn", "agentId": "abc123", "agentType": "Explore", "ts": "..."}
   {"type": "tool-start", "agentId": "abc123", "tool": "Read", "file": "/path", "ts": "..."}
   {"type": "tool-end", "agentId": "abc123", "tool": "Read", "ts": "..."}
   {"type": "agent-complete", "agentId": "abc123", "ts": "..."}
   ```

3. Status server watches this file and broadcasts via SSE

### Option B: Direct HTTP to Status Server

1. Hook scripts POST events directly to status server:
   ```bash
   curl -X POST http://localhost:3100/api/agent-event -d @-
   ```

2. Status server maintains agent state and broadcasts

### Advantages of Hook-Based Approach

1. **Explicit agent lifecycle** - No need to correlate by log-file path
2. **Real-time tool events** - PreToolUse fires BEFORE execution
3. **Session correlation** - `session_id` links events together
4. **No parsing required** - Structured JSON input
5. **Works with all modes** - Interactive, print, subagents

## Environment Variables

Available in hooks:
- `CLAUDE_PROJECT_DIR` - Project root directory
- `CLAUDE_PLUGIN_ROOT` - Plugin directory (for plugin hooks)
- `CLAUDE_ENV_FILE` - File for persisting env vars (SessionStart only)

## Verified: Agent Hierarchy and Correlation

**Tested and confirmed** - see test results below.

### Two-Level Hierarchy

```
Sprint Runner
├── Step 1: claude -p → session_id: "abc123" (AGENT 1)
│   ├── Tool events → session_id: "abc123" ✅ Attributable to Agent 1
│   └── Task subagent → agent_id: "sub1" (SUBAGENT of Agent 1)
│       └── Tool events → session_id: "abc123" (shares parent session)
│
├── Step 2: claude -p → session_id: "def456" (AGENT 2)
│   └── Tool events → session_id: "def456" ✅ Attributable to Agent 2
```

### Correlation Rules

| Level | Identifier | What it represents |
|-------|-----------|-------------------|
| **Agent** (Claude process) | `session_id` | Each `claude -p` call from sprint runner |
| **Subagent** (Task tool) | `agent_id` | Nested agent within a session |

### What We Can Track

**✅ Fully trackable:**
- Agent spawn: `SessionStart` with unique `session_id`
- Agent completion: `Stop` / `SessionEnd`
- Tool usage per agent: All tool events include `session_id`
- Subagent lifecycle: `SubagentStart`/`SubagentStop` with `agent_id`

**⚠️ Limited (subagent level):**
- When Task subagents run in parallel WITHIN a session, tool events share the same `session_id`
- We can show "Agent X has 2 active subagents" but can't attribute individual tools to specific subagents

### Visual Model

```
┌─────────────────────────────────────────────────────┐
│ Agent Monitor                                        │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 🤖 abc12 │  │ 🧠 def45 │  │ ⚡ ghi78 │          │
│  │ Step 1   │  │ Step 2   │  │ Step 3   │          │
│  │ 📖 Read  │  │ 💭...    │  │ ✅ done  │          │
│  │ ┌──────┐ │  │          │  │          │          │
│  │ │sub-1 │ │  │          │  │          │          │
│  │ │sub-2 │ │  │          │  │          │          │
│  │ └──────┘ │  │          │  │          │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

### Test Results (2026-01-29)

Parallel `claude -p` calls get **different session_ids**:
- Session `064b15ab`: Tool events → all have `session_id: 064b15ab`
- Session `81515db1`: Tool events → all have `session_id: 81515db1`

Within a session, Task subagents share session but have unique `agent_id`:
```
SubagentStart: session=81515db1, agent_id=a26c6fc
SubagentStart: session=81515db1, agent_id=afdb46b
PreToolUse:    session=81515db1, agent_id=null (can't attribute to subagent)
```

## Implementation Strategy

### Hook-Based Agent Tracking

1. **SessionStart** → Agent spawned (new `session_id`)
   - Create agent card with unique avatar
   - Show "spawning" animation

2. **PreToolUse/PostToolUse** → Tool activity (keyed by `session_id`)
   - Flash tool emoji on the agent card
   - Show file being accessed

3. **SubagentStart/SubagentStop** → Nested subagents (keyed by `agent_id`)
   - Show nested badges on parent agent card
   - "Agent X + 2 subagents"

4. **Stop/SessionEnd** → Agent finished
   - Show completion animation
   - Fade out or mark as done

### Data Flow

```
Sprint Runner → spawns claude -p processes
     ↓
Hook fires (SessionStart, tool events, etc.)
     ↓
Hook script writes to .agent-events.jsonl
     ↓
AgentEventWatcher reads file changes
     ↓
StatusServer broadcasts via SSE
     ↓
Dashboard UI renders agent cards
```

## Next Steps

1. Create hook script that writes events to `.agent-events.jsonl`
2. Add `AgentEventWatcher` to status server (watch the events file)
3. Add `agent-event` SSE event type
4. Update UI with agent panel (cards, animations)
5. Configure hooks in sprint settings or as plugin hooks
