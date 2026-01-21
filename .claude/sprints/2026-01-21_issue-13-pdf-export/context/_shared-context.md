# Shared Sprint Context

## Project Architecture

The m42-sprint plugin is structured as:
```
plugins/m42-sprint/
├── compiler/          # SPRINT.yaml → PROGRESS.yaml compilation
│   └── src/
│       ├── types.ts   # TypeScript interfaces (SprintDefinition, CompiledProgress, etc.)
│       ├── compile.ts # Compiler logic
│       └── status-server/  # Dashboard web UI
├── runtime/           # Sprint execution loop
│   └── src/
│       ├── loop.ts    # Main execution loop
│       ├── transition.ts  # State machine transitions
│       ├── yaml-ops.ts    # YAML file operations
│       └── *.test.ts      # Unit tests
└── e2e/               # End-to-end tests
```

## Key Data Structures

### CompiledProgress (PROGRESS.yaml)
```typescript
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;  // 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused'
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}

interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;  // 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed'
  prompt?: string;
  steps?: CompiledStep[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
}
```

## Test Patterns

- **Test framework**: Native Node.js with custom test harness (no Jest/Mocha)
- **Test file location**: Same directory as source, e.g., `loop.ts` → `loop.test.ts`
- **Test naming**: `test('description', async () => { ... })`
- **Assertions**: Custom `assert()`, `assertEqual()`, `assertDeepEqual()` functions

### Test Template
```typescript
import * as fs from 'fs';
import * as path from 'path';

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  if (actual !== expected) throw new Error(msg);
}

// Tests go here...

setTimeout(() => {
  console.log(`\nTests: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) process.exitCode = 1;
}, 0);
```

## Commands

- **Build**: `npm run build` (in compiler/ or runtime/ directory)
- **Test**: `npm run test` (runs all unit tests)
- **TypeCheck**: `npm run typecheck`
- **Test specific**: `node dist/[file].test.js`

## Documentation Structure

- Plugin README: `plugins/m42-sprint/README.md`
- Reference docs: `plugins/m42-sprint/docs/reference/`
- Concepts: `plugins/m42-sprint/docs/concepts/`

## Dependencies

### Internal Modules
- `js-yaml`: YAML parsing/dumping
- `commander`: CLI argument parsing

### For PDF Generation (to be added)
- `pdfkit`: PDF document generation
- `canvas` or `sharp`: Image/chart generation (optional)
