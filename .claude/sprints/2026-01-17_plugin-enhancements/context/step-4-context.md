# Step Context: step-4

## Task
Phase 2 - Step 2: Add EventEmitter Pattern to StatusServer

Implement ready signal using EventEmitter pattern to eliminate race condition.

Requirements:
- Import EventEmitter from 'events' in server.ts
- Make StatusServer extend EventEmitter (or add as property)
- Emit 'ready' event AFTER server.listen() callback fires
- Add `waitForReady(): Promise<void>` method that resolves on 'ready' event
- Write port file ONLY after server is confirmed listening
- Add timeout handling (fail after 10 seconds if server doesn't start)

Verification:
- Call waitForReady() before sprint loop starts
- Verify port file exists only after server is ready
- Verify timeout triggers if server fails to start

File to modify:
- plugins/m42-sprint/compiler/src/status-server/server.ts

## Related Code Patterns

### Similar Implementation: watcher.ts (ProgressWatcher)
The `ProgressWatcher` class already implements the EventEmitter pattern that should be followed:

```typescript
// From plugins/m42-sprint/compiler/src/status-server/watcher.ts:6-18
import { EventEmitter } from 'events';

/**
 * Events emitted by ProgressWatcher
 */
export interface ProgressWatcherEvents {
  change: [filePath: string];
  error: [error: Error];
  ready: [];
  close: [];
}

export class ProgressWatcher extends EventEmitter {
  constructor(filePath: string, options: ProgressWatcherOptions = {}) {
    super();
    // ...
  }
}
```

Key patterns from watcher.ts:
- Extends EventEmitter directly via `extends`
- Calls `super()` in constructor
- Defines event types interface for documentation
- Emits 'ready' event after setup completes (line 84-88)

### Similar Implementation: watcher.ts (ready emission)
```typescript
// From plugins/m42-sprint/compiler/src/status-server/watcher.ts:84-89
// Emit ready after watcher is set up
process.nextTick(() => {
  if (!this.isClosing) {
    this.emit('ready');
  }
});
```

## Required Imports

### Internal
- No new internal imports needed

### External
- `events`: Import `EventEmitter` - Node.js built-in, already used in watcher.ts

## Types/Interfaces to Use

### New Interface for StatusServer Events
```typescript
// Define similar to ProgressWatcherEvents
export interface StatusServerEvents {
  ready: [];
  error: [error: Error];
  close: [];
}
```

### Timeout Constant
```typescript
/**
 * Default timeout for server ready signal in milliseconds
 */
const DEFAULT_READY_TIMEOUT = 10_000; // 10 seconds
```

## Integration Points

### Called by: index.ts (CLI entry point)
The CLI in `index.ts` (lines 54-86) creates and starts the server:
```typescript
// Current usage (server.ts:150-158)
await server.start();
// Write port to discovery file (line 85)
fs.writeFileSync(portFilePath, port.toString(), 'utf-8');
```

After implementation, usage will be:
```typescript
await server.start();
await server.waitForReady(); // NEW: Wait for server to be ready
// Then safe to write port file
```

### Calls: Node.js http.Server.listen()
The `server.listen()` callback in `start()` method (line 155) is where we emit 'ready':
```typescript
// Current implementation (server.ts:150-158)
return new Promise((resolve, reject) => {
  this.server!.on('error', (error) => {
    reject(error);
  });

  this.server!.listen(this.config.port, this.config.host, () => {
    resolve();
  });
});
```

### Tests: No existing tests
The status-server module doesn't have dedicated tests currently. The Gherkin scenarios define verification patterns.

## Implementation Notes

1. **Extend vs Composition**: The codebase uses `extends EventEmitter` pattern (see `ProgressWatcher`), so follow the same approach for consistency.

2. **Ready State Tracking**: Add a `private isReady: boolean = false` flag to track if server started successfully. This allows `waitForReady()` to resolve immediately if already ready.

3. **Emit Location**: Emit 'ready' INSIDE the `server.listen()` callback, after the promise resolves. The server is only truly ready when the listen callback fires.

4. **Timeout Pattern**: Use `Promise.race()` to implement timeout:
   ```typescript
   waitForReady(): Promise<void> {
     if (this.isReady) return Promise.resolve();

     return Promise.race([
       new Promise<void>((resolve) => this.once('ready', resolve)),
       new Promise<void>((_, reject) =>
         setTimeout(() => reject(new Error('Server failed to start within timeout')), DEFAULT_READY_TIMEOUT)
       )
     ]);
   }
   ```

5. **Port File Timing**: The port file is written in `index.ts`, NOT in `server.ts`. The server only emits the ready event; the CLI handles writing the port file after `waitForReady()` resolves.

6. **Error Handling**: If server fails to start (port in use, etc.), the `start()` method already rejects. The timeout in `waitForReady()` handles cases where `start()` hangs without resolving.

7. **No Breaking Changes**: The `start()` method signature and behavior remain the same - it still returns a Promise that resolves when listening. The new `waitForReady()` is additive.
