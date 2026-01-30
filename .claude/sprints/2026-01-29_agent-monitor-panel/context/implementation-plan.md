# Agent Monitor Panel for Sprint Status Server

## Overview

Add a playful agent monitoring panel to the sprint status dashboard that shows running Claude instances as animated "agents" with thinking bubbles, tool emojis, and spawn/completion animations.

## Key Discovery: Claude Code Hooks

**See `agent-streaming-research.md` for full details.**

Claude Code provides native hooks for agent lifecycle and tool usage:
- `SubagentStart` - Fires when spawning a subagent (provides `agent_id`, `agent_type`)
- `SubagentStop` - Fires when subagent finishes
- `PreToolUse` / `PostToolUse` - Fires before/after tool execution

This means we can get **real-time, structured events** directly from Claude without parsing transcripts!

## Architecture

### Data Model

```typescript
// New types in status-types.ts
interface AgentState {
  sessionId: string;             // Primary identifier (from session_id in hooks)
  name: string;                  // "Agent 1", "Agent 2", etc. (or step name)
  avatar: string;                // Rotating avatars: 🤖 🧠 ⚡ 💻 🔮
  status: 'spawned' | 'thinking' | 'tool-active' | 'completed' | 'failed';
  currentTool?: string;          // Active tool name (from PreToolUse)
  currentFile?: string;          // File being worked on
  spawnedAt: string;             // From SessionStart hook
  completedAt?: string;          // From Stop/SessionEnd hook
  subagents: SubagentState[];    // Nested subagents (from SubagentStart)
}

interface SubagentState {
  agentId: string;               // From agent_id in SubagentStart
  agentType: string;             // "Explore", "Plan", etc.
  status: 'active' | 'completed';
  spawnedAt: string;
  completedAt?: string;
}

interface AgentSignal {
  type: 'spawn' | 'tool-start' | 'tool-end' | 'thinking' | 'text' | 'complete' | 'fail';
  agentId: string;
  tool?: string;
  file?: string;
  timestamp: string;
}
```

### Visual Design

```
┌─ Agent Monitor ──────────────────────────────────────────┐
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │   🤖     │  │   🧠     │  │   ⚡     │               │
│  │ Agent 1  │  │ Agent 2  │  │ Agent 3  │               │
│  │ ┌─────┐  │  │  💭...   │  │  ✅      │               │
│  │ │📝Edit│ │  │ thinking │  │  done    │               │
│  │ └─────┘  │  │          │  │          │               │
│  │ step-1   │  │ step-2   │  │ step-3   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Agent Card States:**
- **Spawned**: Pulsing blue border, entrance animation (scale + rotate)
- **Thinking**: Purple glow, animated "💭..." thought bubble
- **Tool-active**: Green border, tool emoji badge (📖 Read, ✏️ Edit, ⚡ Bash, etc.)
- **Completed**: Fade-out exit animation with ✅
- **Failed**: Red border, shake animation with ❌

### Tool Emoji Mapping

```javascript
const TOOL_EMOJIS = {
  Read: '📖', Write: '📝', Edit: '✏️', Bash: '⚡',
  Grep: '🔍', Glob: '📂', Task: '🔄', WebFetch: '🌐',
  WebSearch: '🔎', TodoWrite: '📋', AskUserQuestion: '❓',
  default: '🔧'
};
```

### Signal System (Extensible)

```javascript
// Client-side signal handler registry
const signalHandlers = new Map([
  ['spawn', handleSpawnSignal],
  ['tool-start', handleToolStartSignal],
  ['tool-end', handleToolEndSignal],
  ['thinking', handleThinkingSignal],
  ['complete', handleCompleteSignal],
  ['fail', handleFailSignal],
]);

// Extensibility: add new signals without modifying core logic
function registerSignalHandler(type, handler) {
  signalHandlers.set(type, handler);
}
```

## Files to Modify

### 1. `status-types.ts`
- Add `AgentState` interface
- Add `AgentSignal` type
- Add new SSE event type: `'agent-update'`

### 2. `transforms.ts`
- Add `toAgentStates(progress: CompiledProgress): AgentState[]`
- Map `parallel-tasks` and `hook-tasks` to agent states
- Generate agent signals from status changes

### 3. `page.ts`
- Add HTML section for agent monitor panel (after hook status, before current task)
- Add CSS animations (keyframes for spawn, complete, thinking, tool-flash)
- Add JavaScript state management for agents
- Add signal handler registry and rendering logic

### 4. `server.ts`
- Track agent state changes between updates
- Broadcast `agent-update` events on state transitions
- Correlate activity events to agents by log-file path

## CSS Animations

```css
/* Spawn entrance */
@keyframes agent-spawn {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(10deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/* Completion exit */
@keyframes agent-complete {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1) translateY(-8px); }
  100% { transform: scale(0.9) translateY(-16px); opacity: 0; }
}

/* Thinking dots */
@keyframes thinking-dots {
  0%, 33% { content: '💭.'; }
  34%, 66% { content: '💭..'; }
  67%, 100% { content: '💭...'; }
}

/* Tool flash */
@keyframes tool-flash {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 12px var(--accent-green); }
}

/* Avatar bounce */
@keyframes avatar-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Fail shake */
@keyframes agent-fail {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
```

## Implementation Steps

### Phase 1: Hook Infrastructure
1. Create hook script: `plugins/m42-sprint/hooks/agent-monitor-hook.sh`
   - Receives JSON from stdin (SubagentStart, SubagentStop, PreToolUse, PostToolUse)
   - Writes standardized events to `.agent-events.jsonl`
2. Create `AgentEventWatcher` in status-server (similar to ActivityWatcher)
3. Add hook configuration to sprint settings

### Phase 2: Types & Server Integration
1. Add `AgentState` and `AgentEvent` to `status-types.ts`
2. Add `agent-event` SSE event type
3. Track agent state in `StatusServer`
4. Broadcast agent events via SSE

### Phase 3: UI Panel
1. Add agent monitor HTML section in `page.ts`
2. Add CSS variables and animations
3. Add JavaScript rendering functions

### Phase 4: Real-time Updates
1. Connect SSE `agent-event` stream to UI
2. Update agent status on tool events
3. Show real-time tool badges and thinking states

### Phase 5: Polish
1. Add collapse/expand toggle
2. Add agent count badge in header
3. Smooth transitions between states
4. Handle edge cases (reconnection, stale agents)

## Verification

1. **Unit tests**: Add tests for `toAgentStates()` transform
2. **Manual testing**:
   - Run a sprint with parallel execution enabled
   - Verify agents appear when spawned with entrance animation
   - Verify tool emojis flash when tools are used
   - Verify thinking bubble shows during processing
   - Verify completion animation plays when agent finishes
   - Verify failed agents show shake animation
3. **Build verification**: `npm run build && npm run typecheck`

## Critical Files

### New Files
- `plugins/m42-sprint/hooks/agent-monitor-hook.sh` - Hook script for agent events
- `plugins/m42-sprint/compiler/src/status-server/agent-event-watcher.ts` - Watch .agent-events.jsonl
- `plugins/m42-sprint/compiler/src/status-server/agent-types.ts` - Agent state types

### Modified Files
- `plugins/m42-sprint/compiler/src/status-server/status-types.ts` - Add agent event types
- `plugins/m42-sprint/compiler/src/status-server/page.ts` - UI implementation
- `plugins/m42-sprint/compiler/src/status-server/server.ts` - SSE broadcast & watcher integration

### Reference Files
- `plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts` - Pattern for file watcher
- `plugins/m42-sprint/compiler/src/types.ts` - ParallelTask reference
