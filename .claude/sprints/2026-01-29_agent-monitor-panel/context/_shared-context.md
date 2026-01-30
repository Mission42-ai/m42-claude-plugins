# Sprint Context

## Project Info

| Item | Value |
|------|-------|
| Test framework | Custom sync/async runner (no vitest/jest) |
| Test pattern | `test(name, fn)` with `assert(condition, message)` |
| Test location | Co-located `*.test.ts` files alongside source |
| Build command | `npm run build` (runs `tsc`) |
| Test command | `npm test` (builds then runs test files via node) |
| Typecheck command | `npm run typecheck` (runs `tsc --noEmit`) |
| Working directory | `plugins/m42-sprint/compiler/` |

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- Declaration files generated

## Patterns to Follow

### EventEmitter Pattern
All watchers extend EventEmitter with typed events:
```typescript
interface AgentWatcherEvents {
  agent: [event: AgentEvent];
  error: [error: Error];
  ready: [];
  close: [];
}
```

### File Watcher Pattern
```typescript
private debounceTimer: ReturnType<typeof setTimeout> | null = null;
private handleFileEvent(eventType: string): void {
  if (this.debounceTimer) clearTimeout(this.debounceTimer);
  this.debounceTimer = setTimeout(() => {
    this.emit('change', this.filePath);
  }, this.debounceDelay);
}
```

### Tail-Reading Pattern (for JSONL files)
```typescript
private readInitialContent(): void {
  const content = fs.readFileSync(this.filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const startIndex = Math.max(0, lines.length - this.tailLines);
  // Process last N lines
}
```

### Test Pattern
```typescript
import { test, assert } from './test-framework';
test('should do something', () => {
  const result = doSomething();
  assert(result === expected, `Expected ${expected}, got ${result}`);
});
```

### Type Guard Pattern
```typescript
function isAgentEvent(obj: unknown): obj is AgentEvent {
  return typeof obj === 'object' && obj !== null && 'type' in obj;
}
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `server.ts` | Main StatusServer class (HTTP, SSE, file watching) |
| `status-types.ts` | Complete type definitions for status system |
| `activity-types.ts` | Activity event types with type guards |
| `activity-watcher.ts` | JSONL file watcher for activity events |
| `watcher.ts` | PROGRESS.yaml file watcher |
| `page.ts` | HTML page generation for dashboard |

## SSE Event Pattern
```typescript
type AnySSEEvent = StatusUpdateEvent | LogEntryEvent | KeepAliveEvent | ActivityEventSSE

// Sending SSE events
res.write(`data: ${JSON.stringify(event)}\n\n`);
```

## Constants
```typescript
const DEFAULT_PORT = 3100;
const DEFAULT_HOST = 'localhost';
const DEFAULT_KEEP_ALIVE_INTERVAL = 15000;
const DEFAULT_ACTIVITY_TAIL_LINES = 50;
```

## Sprint Steps Overview

This sprint has a single comprehensive step that implements n8n-style workflow visualization with agent avatars.

### Step 1: Agent Monitor Panel Implementation

**Goal**: Replace/enhance tree view with visual workflow node graph showing agents on steps.

**Files to Create**:
- `plugins/m42-sprint/hooks/agent-monitor-hook.sh` - Hook script for agent events
- `plugins/m42-sprint/compiler/src/status-server/agent-watcher.ts` - Event file watcher
- `plugins/m42-sprint/compiler/src/status-server/agent-types.ts` - Agent event types

**Files to Modify**:
- `plugins/m42-sprint/compiler/src/status-server/page.ts` - Workflow UI
- `plugins/m42-sprint/compiler/src/status-server/server.ts` - Watcher integration
- `plugins/m42-sprint/compiler/src/status-server/status-types.ts` - Event types

**Key Requirements**:
1. Hook-based events only (no streaming to preserve transcripts)
   - Use PreToolUse/PostToolUse hooks
   - Write to `.agent-events.jsonl`
2. Workflow node visualization
   - Nodes for each step/phase
   - Connection lines between nodes
   - Glow animations for in-progress
3. Agent integration
   - Avatar emoji on in-progress nodes
   - Name label below
   - Activity text (e.g., "Editing auth.ts")

**Node States**:
| State | Border Color | Icon | Agent Avatar |
|-------|-------------|------|--------------|
| Pending | Gray | - | - |
| In Progress | Green glow | - | Working/Thinking |
| Completed | Green solid | Checkmark | - |
| Failed | Red | X | - |

**Agent Names** (deterministic from session_id):
Klaus, Luna, Max, Mia, Felix, Emma, Leo, Sophie, Finn, Lara

**Agent Emotions**:
- Working (tool in use)
- Thinking (between tools)
- Reading (Read tool)
- Success
- Failed

## Dependencies

No inter-step dependencies for this sprint - single comprehensive step.

## Verification Criteria

1. Build passes: `npm run build && npm run typecheck`
2. Tests pass: `npm test`
3. Manual verification: nodes display correctly with agent avatars
4. Transcripts still work (critical - hooks must not break streaming)
