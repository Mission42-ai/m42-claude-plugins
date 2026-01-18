# Step Context: step-5

## Task
Phase 2 - Step 3: Integrate Browser Auto-Open in Status Server Startup

Make browser auto-open the default behavior when starting status server.

Requirements:
- Import openBrowser from browser.ts in index.ts
- Call waitForReady() before proceeding (blocking startup)
- Auto-open browser after server is ready (use openBrowser utility)
- Add `--no-browser` flag support to disable auto-open
- Pass browser preference through function parameters
- Log status server URL to console regardless of browser open

Verification:
- Start sprint, verify browser opens automatically within 3 seconds
- Start with --no-browser flag, verify browser does NOT open
- Verify sprint loop only starts after server is ready

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/index.ts
- plugins/m42-sprint/commands/run-sprint.md (add --no-browser flag documentation)


## Related Code Patterns

### Similar Implementation: CLI Option Pattern (index.ts:21-24)
```typescript
program
  .argument('<sprint-dir>', 'Path to the sprint directory containing PROGRESS.yaml')
  .option('-p, --port <number>', 'Port to listen on', '3100')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
```

### Similar Implementation: Server Startup and URL Display (index.ts:81-94)
```typescript
// Start server
await server.start();

// Write port to discovery file
fs.writeFileSync(portFilePath, port.toString(), 'utf-8');

// Display server URL
const url = server.getUrl();
console.log(`Sprint Status Server started`);
console.log(`  URL: ${url}`);
console.log(`  Watching: ${progressYamlPath}`);
console.log(`  Port file: ${portFilePath}`);
```

### waitForReady Pattern (server.ts:224-242)
```typescript
/**
 * Wait for the server to be ready to accept connections
 * Resolves immediately if already ready, otherwise waits for 'ready' event
 * @throws Error if server doesn't become ready within timeout (10 seconds)
 */
waitForReady(): Promise<void> {
  const timeout = DEFAULT_READY_TIMEOUT;
  if (this.isReady) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise<void>((resolve) => {
      this.once('ready', resolve);
    }),
    new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Server failed to start within ${timeout}ms timeout`));
      }, timeout);
    }),
  ]);
}
```

### Browser Opener Pattern (browser.ts:19-64)
```typescript
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  // Platform-specific commands...

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}
```

## Required Imports

### Internal
- `./browser.js`: `openBrowser` - cross-platform browser opener utility

### External
- None (all dependencies already present in index.ts)

## Types/Interfaces to Use

### CLI Options Interface
```typescript
// Extend existing options type
interface CLIOptions {
  port: string;
  host: string;
  noBrowser?: boolean;  // New: --no-browser flag
}
```

### StatusServer (from server.ts)
- `waitForReady(): Promise<void>` - blocks until server is ready
- `getUrl(): string` - returns the server URL

## Integration Points

### Called by:
- `sprint-loop.sh` - launches status server via node command
- `run-sprint.md` command - starts status server in background

### Calls:
- `StatusServer.start()` - existing server startup
- `StatusServer.waitForReady()` - NEW: ensures server is ready before continuing
- `openBrowser(url)` - NEW: opens browser with server URL

### Documentation to Update:
- `plugins/m42-sprint/commands/run-sprint.md` - add --no-browser flag

## Implementation Notes

1. **Import Statement**: Add `openBrowser` import at top of index.ts:
   ```typescript
   import { openBrowser } from './browser.js';
   ```

2. **CLI Option**: Add `--no-browser` option using Commander pattern:
   ```typescript
   .option('--no-browser', 'Disable automatic browser opening')
   ```
   Note: Commander converts `--no-browser` to `noBrowser: boolean` in options

3. **Startup Sequence**: After `server.start()`:
   ```typescript
   await server.start();
   await server.waitForReady();  // Block until ready

   // Always log URL
   const url = server.getUrl();
   console.log(`  URL: ${url}`);

   // Conditionally open browser
   if (!options.noBrowser) {
     openBrowser(url);
   }
   ```

4. **URL Logging**: URL must be logged REGARDLESS of browser flag - for manual access and script parsing

5. **Error Handling**: `waitForReady()` has built-in 10-second timeout - no additional timeout handling needed

6. **Documentation Update**: In run-sprint.md, add `--no-browser` to:
   - Argument hint line (line 3)
   - Options section (after --no-status)
   - Usage examples

## Gherkin Scenarios Summary

| Scenario | Verification Pattern |
|----------|---------------------|
| openBrowser import | `grep "import.*openBrowser.*from.*browser"` |
| waitForReady called | `grep "server\\.waitForReady()"` |
| openBrowser invocation | `grep "openBrowser(.*url"` |
| --no-browser option | `grep "\\.option.*--no-browser"` |
| Conditional open | `grep "if.*!.*noBrowser"` |
| URL console log | `grep "console\\.log.*URL"` |
| TypeScript compiles | `npx tsc --noEmit` exits 0 |
