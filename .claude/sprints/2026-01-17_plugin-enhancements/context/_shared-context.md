# Shared Sprint Context

## Project Architecture

The m42-sprint plugin provides a sprint execution system for Claude Code with workflow compilation and live status monitoring.

### Directory Structure
```
plugins/m42-sprint/
├── commands/           # Slash command definitions (*.md)
├── compiler/           # TypeScript workflow compiler
│   ├── src/
│   │   ├── index.ts          # CLI entry point
│   │   ├── compile.ts        # Workflow compilation logic
│   │   ├── types.ts          # Core type definitions
│   │   ├── validate.ts       # YAML validation
│   │   └── status-server/    # Live status web UI
│   │       ├── index.ts      # CLI entry (sprint-status-server)
│   │       ├── server.ts     # HTTP server with SSE
│   │       ├── page.ts       # HTML/CSS/JS generator
│   │       ├── status-types.ts   # SSE event types
│   │       ├── transforms.ts     # Progress to StatusUpdate
│   │       ├── watcher.ts        # PROGRESS.yaml file watcher
│   │       ├── activity-watcher.ts   # Activity feed watcher
│   │       ├── activity-types.ts     # Activity event types
│   │       └── timing-tracker.ts     # Timing estimation
│   └── package.json
├── docs/               # User documentation
├── hooks/              # Event hooks (sprint-activity-hook.sh)
├── scripts/            # Shell scripts (sprint-loop.sh)
└── workflows/          # Default workflow templates
```

### Core Components
1. **Workflow Compiler** (`compile.ts`): Transforms SPRINT.yaml + workflows into PROGRESS.yaml
2. **Status Server** (`server.ts`): HTTP server with SSE for real-time updates
3. **Page Generator** (`page.ts`): Single-file HTML/CSS/JS status dashboard
4. **Sprint Loop** (`sprint-loop.sh`): Bash loop executing claude -p per task

## Key Patterns

### Single-File HTML Generation
- **Pattern**: `page.ts` generates complete HTML with embedded CSS/JS as template literals
- **Location**: `compiler/src/status-server/page.ts`
- **Usage**: `getPageHtml()` returns full document, `getStyles()` returns CSS, `getScript()` returns JS

### Server-Sent Events (SSE)
- **Pattern**: Real-time updates via EventSource connection to `/events` endpoint
- **Location**: `server.ts` handles `/events`, `page.ts` subscribes via EventSource
- **Event Types**: `status-update`, `log-entry`, `activity-event`, `keep-alive`

### File Watching with Debounce
- **Pattern**: `ProgressWatcher` extends EventEmitter, watches PROGRESS.yaml for changes
- **Location**: `watcher.ts` for progress, `activity-watcher.ts` for activity feed
- **Usage**: Emits 'change' event after debounce period (default 100ms)

### Type-Safe YAML Parsing
- **Pattern**: Load YAML with `js-yaml`, cast to TypeScript interfaces
- **Location**: Types in `types.ts`, parsing in `server.ts` `loadProgress()`
- **Dependencies**: `js-yaml ^4.1.0`

### Signal File Communication
- **Pattern**: Sprint loop communicates via signal files (`.pause-requested`, `.stop-requested`)
- **Location**: Server writes signals in `handlePauseRequest()`, loop checks in `sprint-loop.sh`

## Conventions

### Naming
- **Files**: kebab-case (e.g., `status-types.ts`, `timing-tracker.ts`)
- **Classes**: PascalCase (e.g., `StatusServer`, `ProgressWatcher`)
- **Functions**: camelCase (e.g., `getPageHtml`, `toStatusUpdate`)
- **Types**: PascalCase with descriptive suffixes (e.g., `CompiledProgress`, `StatusUpdate`)
- **CSS classes**: kebab-case (e.g., `.control-btn`, `.phase-tree`)

### File Structure
- Export types separately from implementations
- Use `.js` extension in imports (NodeNext module resolution)
- Collocate related types with their implementations

### Error Handling
- Wrap async operations in try-catch
- Return error objects with `success: boolean` and `error?: string`
- Log errors to console with `[ComponentName]` prefix

### CSS Conventions (page.ts)
- GitHub dark theme colors (`#0d1117` background, `#c9d1d9` text)
- Status colors: green (`#238636`), red (`#da3633`), yellow (`#f0883e`), blue (`#58a6ff`)
- Consistent padding/margins: `1rem`, `0.75rem`, `0.5rem`
- Border radius: `0.5rem` for cards, `0.25rem` for small elements

## Commands

### Build
```bash
cd plugins/m42-sprint/compiler && npm run build
```

### Type Check
```bash
cd plugins/m42-sprint/compiler && npm run typecheck
# Note: tsconfig doesn't have explicit typecheck script, use:
cd plugins/m42-sprint/compiler && npx tsc --noEmit
```

### Test
```bash
cd plugins/m42-sprint/compiler && npm test
```

### Development Watch
```bash
cd plugins/m42-sprint/compiler && npm run dev
```

### Start Status Server Manually
```bash
node plugins/m42-sprint/compiler/dist/status-server/index.js <sprint-dir>
```

## Dependencies

### Internal Modules
- `types.ts`: Core type definitions (CompiledProgress, PhaseStatus, etc.)
- `status-types.ts`: SSE event types and server config
- `activity-types.ts`: Activity event structure
- `transforms.ts`: Progress-to-StatusUpdate conversion utilities

### External Packages
- `js-yaml ^4.1.0`: YAML parsing
- `commander ^12.0.0`: CLI argument parsing
- `@types/node ^20.11.0`: Node.js type definitions
- `typescript ^5.3.0`: TypeScript compiler

### Node.js Built-ins Used
- `http`: HTTP server
- `fs`: File system operations
- `path`: Path manipulation
- `zlib`: Gzip compression for log downloads
- `events`: EventEmitter for watchers

## Types and Interfaces

### Core Status Types
```typescript
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

### SSE Event Structure
```typescript
interface SSEEvent<T extends SSEEventType, D> {
  type: T;
  data: D;
  timestamp: string;
}
```

### Status Update Payload
```typescript
interface StatusUpdate {
  header: SprintHeader;
  phaseTree: PhaseTreeNode[];
  currentTask: CurrentTask | null;
  raw?: CompiledProgress;
}
```

### Server Configuration
```typescript
interface ServerConfig {
  port: number;          // default: 3100
  host: string;          // default: 'localhost'
  sprintDir: string;     // required
  keepAliveInterval?: number;  // default: 15000ms
  debounceDelay?: number;      // default: 100ms
}
```

## Important Notes for This Sprint

1. **page.ts is large (~3000+ lines)**: Contains all HTML, CSS, and JavaScript. Functions are organized by section (styles, script, HTML structure).

2. **No React/Vue**: Pure vanilla JavaScript with DOM manipulation. State managed via global variables.

3. **CSS is embedded**: All styles in `getStyles()` function as template literal. No external stylesheets.

4. **Browser APIs used**: EventSource (SSE), Notification API, AudioContext, localStorage

5. **TypeScript strict mode**: All types must be explicit, no implicit any.

6. **ES2022 target**: Modern JavaScript features available (optional chaining, nullish coalescing, etc.)
