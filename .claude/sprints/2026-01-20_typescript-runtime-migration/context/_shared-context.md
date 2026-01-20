# Shared Sprint Context

## Project Architecture

M42 Claude Plugins is a monorepo containing plugins for Claude Code CLI. The sprint being executed lives in `plugins/m42-sprint/` and provides sprint orchestration with "fresh context per task" execution.

### Directory Structure
```
plugins/m42-sprint/
├── compiler/          # TypeScript compiler: SPRINT.yaml → PROGRESS.yaml
│   ├── src/          # Source TypeScript files
│   │   ├── types.ts  # Type definitions (discriminated unions)
│   │   ├── compile.ts
│   │   ├── validate.ts
│   │   └── ...
│   ├── dist/         # Compiled JavaScript
│   └── package.json  # @m42/sprint-compiler
├── runtime/          # NEW: TypeScript runtime (this sprint creates it)
│   └── src/          # Will contain: transition.ts, loop.ts, executor.ts, etc.
├── scripts/          # Bash scripts (to be replaced)
│   ├── sprint-loop.sh           # 86,483 bytes - MAIN TARGET
│   ├── build-sprint-prompt.sh   # 11,605 bytes - REPLACE
│   ├── build-parallel-prompt.sh # 2,336 bytes - MERGE
│   ├── preflight-check.sh       # 2,855 bytes - REPLACE
│   └── test-*.sh                # KEEP as integration tests
├── commands/         # Slash command definitions
├── docs/            # Documentation
├── skills/          # Skill definitions
└── README.md
```

### Key Files

| File | Purpose | Size |
|------|---------|------|
| `compiler/src/types.ts` | Type definitions - ENHANCE with discriminated unions | 509 lines |
| `scripts/sprint-loop.sh` | Main execution loop - REPLACE entirely | ~2,464 lines |
| `scripts/build-sprint-prompt.sh` | Prompt generation - REPLACE | 354 lines |

## Test Patterns

- **Test framework**: Custom simple test runner (no external framework)
- **Test file location**: Same directory as source, e.g., `validate.test.ts`
- **Test naming**: `*.test.ts`
- **Test execution**: `npm run test` → builds then runs `node dist/validate.test.js`
- **Mocking patterns**: None currently - tests use real implementations
- **Assertion style**: Custom `assert(condition, message)` function

### Test File Template
```typescript
/**
 * Tests for [module]
 */

import { functionUnderTest } from './module.js';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

test('should do something', () => {
  const result = functionUnderTest(input);
  assert(result === expected, `Expected ${expected}, got ${result}`);
});

console.log('\nTests completed.');
```

## Key Patterns

### XState-Inspired State Machine Pattern
Apply discriminated unions for type-safe state transitions:
```typescript
// State as discriminated union
type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; current: CurrentPointer; iteration: number }
  | { status: 'paused'; pausedAt: CurrentPointer; pauseReason: string }
  | { status: 'blocked'; error: string; failedPhase: string }
  | { status: 'completed'; summary?: string; completedAt: string };

// Pure transition function
function transition(state: SprintState, event: SprintEvent, context: CompiledProgress): TransitionResult;
```

### Action Pattern (Effects Separated)
Actions describe side effects but don't execute them:
```typescript
type SprintAction =
  | { type: 'LOG'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string }
  | { type: 'WRITE_PROGRESS' }
  // ...
```

### Atomic YAML Operations
Use temp file + rename for atomic writes:
```typescript
// Write to temp file
fs.writeFileSync(`${path}.tmp`, content);
// Atomic rename
fs.renameSync(`${path}.tmp`, path);
```

### ES Module Pattern
```typescript
// Always use .js extension in imports (NodeNext resolution)
import { SomeType } from './types.js';
```

## Commands

- **Build**: `npm run build` (in compiler directory)
- **Test**: `npm run test` (builds then runs tests)
- **Test (watch)**: Not available (run manually)
- **Lint**: Not configured
- **TypeCheck**: `npm run typecheck` → `tsc --noEmit`

### From Root Directory
```bash
cd plugins/m42-sprint/compiler && npm run build
cd plugins/m42-sprint/compiler && npm run test
cd plugins/m42-sprint/compiler && npm run typecheck
```

## Documentation Structure

| Document | Path | Status |
|----------|------|--------|
| User Guide | `docs/USER-GUIDE.md` | EXISTS - Update with TypeScript runtime |
| Getting Started | `docs/getting-started/quick-start.md` | EXISTS |
| First Sprint | `docs/getting-started/first-sprint.md` | EXISTS |
| Commands Reference | `docs/reference/commands.md` | EXISTS - Update commands |
| API Reference | `docs/reference/api.md` | EXISTS |
| SPRINT.yaml Schema | `docs/reference/sprint-yaml-schema.md` | EXISTS |
| PROGRESS.yaml Schema | `docs/reference/progress-yaml-schema.md` | EXISTS |
| Workflow Schema | `docs/reference/workflow-yaml-schema.md` | EXISTS |
| Troubleshooting | `docs/troubleshooting/common-issues.md` | EXISTS |
| README | `README.md` | EXISTS - Update installation |

## Dependencies

### Internal Modules (Compiler)
- `types.ts`: All TypeScript interfaces
- `compile.ts`: SPRINT.yaml → PROGRESS.yaml compilation
- `validate.ts`: Workflow validation

### External Packages (Compiler)
- `js-yaml@4.1.0`: YAML parsing/dumping
- `commander@12.0.0`: CLI argument parsing
- `typescript@5.3.0`: TypeScript compiler

### Runtime Dependencies (To Add)
- `js-yaml@4.1.0`: Same as compiler
- `commander@12.0.0`: CLI argument parsing
- Node built-ins: `crypto`, `child_process`, `fs`, `path`

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## YAML Format Reference

### PROGRESS.yaml (Runtime State)
```yaml
sprint-id: "2026-01-20_example"
status: "in-progress"  # not-started | in-progress | completed | blocked | paused | needs-human
current:
  phase: 0      # 0-based index
  step: null    # or 0-based index
  sub-phase: null
phases:
  - id: "phase-id"
    status: "pending"
    prompt: "..."
    steps:  # Only for for-each phases
      - id: "step-id"
        prompt: "..."
        status: "pending"
        phases:
          - id: "sub-phase-id"
            status: "pending"
            prompt: "..."
stats:
  started-at: "2026-01-20T10:00:00Z"
  total-phases: 3
  completed-phases: 1
```

### Error Categories
```typescript
type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
```

## Phase-Specific Notes

### For Step 0 (Type System)
- Location: `plugins/m42-sprint/compiler/src/types.ts`
- DO NOT change existing types - ADD new discriminated unions
- Mark old SprintStatus with `@deprecated`
- Keep backward compatibility

### For Steps 1-6 (Runtime Modules)
- Create new directory: `plugins/m42-sprint/runtime/`
- New package.json for runtime
- Each module gets its own test file

### For Step 7 (CLI)
- Entry point: `plugins/m42-sprint/runtime/src/cli.ts`
- Shebang: `#!/usr/bin/env node`
- Commands mirror existing bash interface

### For Step 8 (Bash Removal)
- Delete: sprint-loop.sh, build-sprint-prompt.sh, build-parallel-prompt.sh, preflight-check.sh
- KEEP: test-*.sh (integration tests)
- Update: commands/run-sprint.md, README.md
