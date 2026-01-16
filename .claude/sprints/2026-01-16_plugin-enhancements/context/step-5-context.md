# Step Context: step-5

## Task
Track C - Step 2: Implement Activity Watcher in Status Server

Add activity log watching and SSE streaming to status server.

Requirements:
- Create compiler/src/status-server/activity-watcher.ts module
- Create compiler/src/status-server/activity-types.ts with TypeScript types
- Watch .sprint-activity.jsonl file for changes using fs.watch or chokidar
- Parse JSONL events and validate against activity types
- Stream activity events via SSE to status page clients
- Filter events based on verbosity level (stored in client preference)
- Handle log rotation and large files efficiently
- Add error recovery for corrupted log entries
- Export ActivityWatcher class for integration with server.ts

New files to create:
- compiler/src/status-server/activity-watcher.ts
- compiler/src/status-server/activity-types.ts

Files to modify:
- compiler/src/status-server/server.ts (integrate ActivityWatcher)

## Related Code Patterns

### Similar Implementation: ProgressWatcher (watcher.ts:37-156)
```typescript
// File watching pattern using fs.watch with directory monitoring and debounce
export class ProgressWatcher extends EventEmitter {
  private readonly filePath: string;
  private readonly debounceDelay: number;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  constructor(filePath: string, options: ProgressWatcherOptions = {}) {
    super();
    this.filePath = path.resolve(filePath);
    this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
  }

  start(): void {
    // Watch directory, not file, for robust detection
    const dir = path.dirname(this.filePath);
    const filename = path.basename(this.filePath);
    this.watcher = fs.watch(dir, { persistent: true }, (eventType, changedFile) => {
      if (changedFile === filename) {
        this.handleFileEvent(eventType);
      }
    });
  }

  close(): void {
    this.isClosing = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.watcher) this.watcher.close();
  }
}
```

### SSE Client Management Pattern (server.ts:25-49)
```typescript
interface SSEClient {
  id: string;
  response: http.ServerResponse;
  connectedAt: Date;
}

// In StatusServer class:
private clients: Map<string, SSEClient> = new Map();
private clientIdCounter = 0;

// Sending events
private sendEvent<T>(client: SSEClient, type: string, data: T): void {
  const event: AnySSEEvent = {
    type: type as AnySSEEvent['type'],
    data: data as any,
    timestamp: new Date().toISOString(),
  };
  const message = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  client.response.write(message);
}

private broadcast<T>(type: string, data: T): void {
  for (const client of this.clients.values()) {
    this.sendEvent(client, type, data);
  }
}
```

### Type Definition Pattern (status-types.ts)
```typescript
// Generic SSE event wrapper
export interface SSEEvent<T extends SSEEventType, D> {
  type: T;
  data: D;
  timestamp: string;
}

// Log entry types already defined
export type LogEntryType = 'info' | 'start' | 'complete' | 'error' | 'warning' | 'skip';

export interface LogEntry {
  id: string;
  type: LogEntryType;
  message: string;
  timestamp: string;
  context?: string;
}
```

## Required Imports

### Internal
- `EventEmitter` from `events`: For event-based architecture
- `fs` from `fs`: For fs.watch file watching
- `path` from `path`: For path resolution

### External
- None required (uses Node.js built-ins only)

## Types/Interfaces to Create

### activity-types.ts
```typescript
// Verbosity levels matching sprint-activity-hook.sh
export type VerbosityLevel = 'minimal' | 'basic' | 'detailed' | 'verbose';

// Activity event from .sprint-activity.jsonl
export interface ActivityEvent {
  ts: string;           // ISO-8601 timestamp
  type: 'tool';         // Event type
  tool: string;         // Tool name (Read, Write, Bash, etc.)
  level: VerbosityLevel;// Verbosity level of this event
  file?: string;        // File path (for file operations)
  params?: string;      // Additional params (for Bash, Grep patterns)
  input?: unknown;      // Full tool input (verbose level only)
  response?: unknown;   // Full tool response (verbose level only)
}

// Watcher configuration
export interface ActivityWatcherOptions {
  debounceDelay?: number;
  tailLines?: number;   // Initial lines to read from end
}
```

## Integration Points

- **Called by**: `StatusServer` class in `server.ts`
  - Instantiated alongside ProgressWatcher in constructor
  - Started in `start()` method
  - Events broadcast to SSE clients

- **Calls**:
  - Uses Node.js `fs.watch` for file monitoring
  - Reads file with `fs.readFileSync` or streams for JSONL parsing

- **Tests**: No existing test files in status-server directory

## Activity Log Format (from sprint-activity-hook.sh)

The `.sprint-activity.jsonl` file contains one JSON object per line:

```jsonl
{"ts":"2026-01-16T10:00:00Z","type":"tool","tool":"Read","file":"/path/to/file","level":"basic"}
{"ts":"2026-01-16T10:00:01Z","type":"tool","tool":"Bash","params":"npm run build","level":"detailed"}
{"ts":"2026-01-16T10:00:02Z","type":"tool","tool":"Write","file":"/path/to/file","level":"basic"}
```

## Implementation Notes

1. **File Watching Strategy**
   - Use same pattern as ProgressWatcher: watch directory, filter by filename
   - File path: `${sprintDir}/.sprint-activity.jsonl`
   - Debounce rapid updates (100ms default like ProgressWatcher)

2. **JSONL Parsing**
   - Track file position to only read new lines (tail -f behavior)
   - Parse each line independently, skip corrupted entries
   - Emit events for each valid ActivityEvent

3. **Verbosity Filtering**
   - Filter should happen client-side or with client preference
   - Server can send all events or filter based on SSE client preference
   - Levels: minimal < basic < detailed < verbose

4. **Large File Handling**
   - On initial connect, read only last N lines (configurable)
   - Track byte offset to avoid re-reading entire file
   - Consider log rotation detection (file truncation/deletion)

5. **Error Recovery**
   - Invalid JSON lines: log warning, skip to next line
   - File not found: wait for creation, don't error
   - Read errors: emit error event, continue watching

6. **SSE Integration**
   - New event type: `'activity-event'` (extend SSEEventType)
   - Add `/api/activity` endpoint for API access
   - Add `activity-event` SSE handler in frontend page.ts

7. **Server Integration Pattern**
```typescript
// In StatusServer constructor:
this.activityWatcher = new ActivityWatcher(activityFilePath, {
  debounceDelay: this.config.debounceDelay,
});

// In start():
this.activityWatcher.on('activity', (event: ActivityEvent) => {
  this.broadcast('activity-event', event);
});
this.activityWatcher.start();

// In stop():
this.activityWatcher?.close();
```
