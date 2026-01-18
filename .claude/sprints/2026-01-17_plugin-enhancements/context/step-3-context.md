# Step Context: step-3

## Task
Phase 2 - Step 1: Create Cross-Platform Browser Opener Utility

Create a new utility module for opening browsers across different platforms.

Requirements:
- Create browser.ts with `openBrowser(url: string): Promise<void>` function
- Detect platform: darwin (macOS), win32 (Windows), linux
- Use appropriate command: `open` (macOS), `start` (Windows), `xdg-open` (Linux)
- Handle errors gracefully (browser not found, etc.)
- Export function for use in index.ts
- Add fallback message to console if browser fails to open

New file to create:
- plugins/m42-sprint/compiler/src/status-server/browser.ts

## Related Code Patterns

### Similar Implementation: Node.js child_process
No existing child process patterns in this codebase's TypeScript sources. The browser opener will be the first module using `child_process` in the compiler.

### File Structure Pattern: status-server modules
```typescript
// From plugins/m42-sprint/compiler/src/status-server/watcher.ts
// Pattern: Single-purpose utility module with export
import * as fs from 'fs';
import { EventEmitter } from 'events';

export class ProgressWatcher extends EventEmitter {
  // Implementation
}
```

### Error Handling Pattern: try-catch with console logging
```typescript
// From server.ts - error handling with [ComponentName] prefix
try {
  // operation
} catch (error) {
  console.error('[StatusServer] Watcher error:', error.message);
}
```

### Console Output Pattern: informative messages
```typescript
// From index.ts - informative console output
console.log(`Sprint Status Server started`);
console.log(`  URL: ${url}`);
```

## Required Imports

### Internal
None - this is a standalone utility module

### External (Node.js built-ins)
- `child_process`: `spawn` for executing platform commands
- `process`: `platform` for OS detection (available as global)

### No new npm packages needed
The `child_process` module is a Node.js built-in, no additional dependencies required.

## Types/Interfaces to Use

```typescript
// No complex types needed - simple function signature
export async function openBrowser(url: string): Promise<void>
```

## Integration Points

- **Called by**: `index.ts` (CLI entry point) - will import and call after server starts
- **Calls**: Node.js `child_process.spawn()` with platform-specific commands
- **Tests**: No existing test framework in status-server; manual verification required

## Implementation Notes

1. **Platform Detection**
   - Use `process.platform` which returns 'darwin', 'win32', or 'linux'
   - Handle each platform with appropriate command

2. **Command Selection**
   ```
   darwin  → 'open'
   win32   → 'start' (via cmd.exe: ['cmd', '/c', 'start', '', url])
   linux   → 'xdg-open'
   ```

3. **Windows Special Case**
   - `start` is a shell built-in, must invoke via `cmd.exe /c start "" url`
   - Empty string after start is required for URLs with special characters

4. **Error Handling Strategy**
   - Wrap spawn in try-catch
   - Listen for 'error' event on child process
   - Print fallback message with URL if browser fails to open
   - Do not throw - gracefully degrade with console message

5. **File Naming Convention**
   - Follows kebab-case: `browser.ts`
   - Matches existing files: `watcher.ts`, `server.ts`, `page.ts`

6. **Import Extension**
   - Use `.js` extension in imports (NodeNext module resolution)
   - Example: `import { openBrowser } from './browser.js';`

7. **Async Pattern**
   - Return Promise<void> to allow awaiting
   - Resolve immediately after spawning (don't wait for browser to close)
   - Reject or log on spawn error

## Gherkin Scenarios to Satisfy

1. File exists at `plugins/m42-sprint/compiler/src/status-server/browser.ts`
2. Function exported with `export.*openBrowser` pattern
3. Signature matches `openBrowser(url: string): Promise<void>`
4. Contains platform detection for `darwin`, `win32`, `linux`
5. Contains `catch` and `console` for error handling/fallback
6. TypeScript compiles without errors (`npx tsc --noEmit`)
