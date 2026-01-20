# Shared Sprint Context

## Sprint Overview
**Sprint ID**: 2026-01-20_dashboard-improvements
**Goal**: Enhance the m42-sprint dashboard with chat-like activity display, timing improvements, stale detection, model selection, workflow composition, and operator request system.

---

## Project Architecture

### Plugin Structure
```
plugins/m42-sprint/
├── compiler/           # Workflow compilation (SPRINT.yaml → PROGRESS.yaml)
│   ├── src/
│   │   ├── compile.ts              # Main compiler logic
│   │   ├── types.ts                # TypeScript interfaces
│   │   ├── expand-foreach.ts       # for-each expansion
│   │   ├── resolve-workflows.ts    # Workflow resolution
│   │   ├── validate.ts             # Schema validation
│   │   └── status-server/          # Dashboard web server
│   │       ├── activity-types.ts   # Activity event types
│   │       ├── transcription-watcher.ts  # NDJSON transcript parser
│   │       ├── transforms.ts       # Data transformations
│   │       ├── page.ts             # HTML page generation
│   │       └── server.ts           # HTTP/SSE server
├── runtime/            # Sprint execution loop
│   ├── src/
│   │   ├── loop.ts                 # Main execution loop
│   │   ├── claude-runner.ts        # Claude CLI wrapper
│   │   ├── transition.ts           # State machine transitions
│   │   ├── executor.ts             # Action execution
│   │   ├── yaml-ops.ts             # YAML file operations
│   │   ├── prompt-builder.ts       # Prompt construction
│   │   └── cli.ts                  # CLI entry point
├── docs/               # User documentation
├── skills/             # Plugin skills
└── commands/           # Slash commands
```

### Key Type Definitions (from types.ts)

**Sprint States**:
```typescript
type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
```

**Activity Events**:
```typescript
interface ActivityEvent {
  ts: string;
  type: 'tool';  // Currently only 'tool', will add 'assistant'
  tool: string;
  level: VerbosityLevel;
  file?: string;
  params?: string;
}
```

**Compiled Progress Structure**:
```typescript
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}
```

---

## Test Patterns

### Test Framework
- **Framework**: Native Node.js test runner (no external framework)
- **Test file location**: Same directory as source (`*.test.ts`)
- **Naming convention**: `[module-name].test.ts`
- **Run tests**: `npm run test` (builds first, then runs all test files)

### Test Utilities Pattern
```typescript
function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => console.log(`✓ ${name}`))
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
```

### TDD Pattern
1. **RED**: Write failing tests first (define expected behavior)
2. **GREEN**: Implement minimum code to pass tests
3. **REFACTOR**: Clean up while keeping tests green
4. **QA**: Run full test suite + build

### Mocking Pattern
- Inject dependencies via constructor or function parameters
- Use interface-based dependencies for testability
```typescript
interface LoopDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}
```

---

## Commands

### Compiler Package
```bash
cd plugins/m42-sprint/compiler
npm run build        # Compile TypeScript
npm run typecheck    # Type-check without emitting
npm run test         # Build and run tests
npm run clean        # Remove dist/
```

### Runtime Package
```bash
cd plugins/m42-sprint/runtime
npm run build        # Compile TypeScript
npm run typecheck    # Type-check without emitting
npm run test         # Build and run all test files
npm run test:integration  # Run integration tests
npm run clean        # Remove dist/
```

### Full Project
```bash
# From project root
npm run build        # Build all packages
npm run test         # Run all tests
npm run lint         # Run ESLint
npm run typecheck    # Type-check all
```

---

## Documentation Structure

| Document | Path | Status |
|----------|------|--------|
| User Guide | `docs/USER-GUIDE.md` | Exists |
| Quick Start | `docs/getting-started/quick-start.md` | Exists |
| First Sprint Tutorial | `docs/getting-started/first-sprint.md` | Exists |
| Commands Reference | `docs/reference/commands.md` | Exists |
| API Reference | `docs/reference/api.md` | Exists |
| SPRINT.yaml Schema | `docs/reference/sprint-yaml-schema.md` | Exists |
| PROGRESS.yaml Schema | `docs/reference/progress-yaml-schema.md` | Exists |
| Workflow YAML Schema | `docs/reference/workflow-yaml-schema.md` | Exists |
| Writing Sprints Guide | `docs/guides/writing-sprints.md` | Exists |
| Writing Workflows Guide | `docs/guides/writing-workflows.md` | Exists |
| Troubleshooting | `docs/troubleshooting/common-issues.md` | Exists |
| README | `README.md` | Exists |

---

## Dependencies

### Internal Modules

| Module | Purpose |
|--------|---------|
| `transition.ts` | XState-inspired state machine for sprint state transitions |
| `yaml-ops.ts` | Atomic YAML read/write with checksum validation |
| `claude-runner.ts` | Claude CLI wrapper with JSON schema validation |
| `transcription-watcher.ts` | NDJSON stream parser for Claude transcripts |
| `transforms.ts` | Transform PROGRESS.yaml to dashboard display format |

### External Packages

| Package | Version | Usage |
|---------|---------|-------|
| `commander` | ^12.0.0 | CLI argument parsing |
| `js-yaml` | ^4.1.0 | YAML parsing/serialization |
| `typescript` | ^5.3.0 | TypeScript compiler (dev) |
| `@types/node` | ^20.11.0 | Node.js type definitions (dev) |

---

## Key Patterns

### State Machine Pattern
Sprint uses XState-inspired discriminated unions for type-safe state handling:
```typescript
type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; current: CurrentPointer; iteration: number; startedAt: string }
  | { status: 'completed'; summary?: string; completedAt: string; elapsed: string }
  // ... other states
```

### Atomic File Operations
PROGRESS.yaml writes use backup + atomic rename to prevent corruption:
```typescript
// 1. Create backup
// 2. Write to temp file
// 3. Rename temp to target (atomic)
// 4. Clean up backup on success
```

### SSE Event Streaming
Dashboard uses Server-Sent Events for real-time updates:
- `status-update`: Sprint status changes
- `activity-event`: Tool/assistant activity
- `phase-complete`: Phase transitions

### Transcription Parsing
Claude CLI outputs NDJSON with these relevant event types:
```typescript
// Tool use (current support)
{ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use', name: '...', input: {} } } }

// Text content (to be added)
{ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'text' } } }
{ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } } }
```

---

## Important Notes

1. **ES Modules**: Runtime uses `"type": "module"` - use `.js` extensions in imports
2. **Checksum Validation**: PROGRESS.yaml has companion `.checksum` file for integrity
3. **Fresh Context**: Each sprint iteration runs in fresh Claude session
4. **Hook Deprecation**: Hook system being replaced with transcription-based activity tracking

---

## Files Modified in This Sprint

### Phase 1 (Chat-Like UI)
- `compiler/src/status-server/activity-types.ts`
- `compiler/src/status-server/transcription-watcher.ts`
- `compiler/src/status-server/page.ts`

### Phase 2 (Elapsed Time & Progress)
- `compiler/src/status-server/transforms.ts`
- `compiler/src/status-server/page.ts`
- `compiler/src/status-server/status-types.ts`

### Phase 3 (Dropdown & Stale Detection)
- `compiler/src/status-server/page.ts`
- `compiler/src/status-server/server.ts`
- `runtime/src/loop.ts`

### Phase 4-5 (Workflow Reference & Model Selection)
- `compiler/src/compile.ts`
- `compiler/src/types.ts`
- `compiler/src/workflow-loader.ts` (may need creation)
- `runtime/src/loop.ts`
- `runtime/src/claude-runner.ts`

### Phase 6-8 (Operator System)
- `runtime/src/claude-runner.ts`
- `runtime/src/loop.ts`
- `runtime/src/operator.ts` (NEW)
- `runtime/src/backlog.ts` (NEW)
- `runtime/src/progress-injector.ts` (NEW)
- `compiler/src/status-server/operator-queue-page.ts` (NEW)
- `skills/sprint-operator/skill.md` (NEW)

### Phase 9 (Hook Removal)
- `hooks/` directory (DELETE)
- `runtime/src/cli.ts`
- Skills and commands referencing hooks
