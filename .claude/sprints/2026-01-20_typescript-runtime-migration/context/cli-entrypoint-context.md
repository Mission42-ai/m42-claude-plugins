# Step Context: cli-entrypoint

## Task
GIVEN the TypeScript runtime modules
WHEN creating the CLI entry point
THEN provide commands matching current bash interface

## Scope
- Create CLI entry point
- Set up runtime package.json
- Configure build and test scripts

## Acceptance Criteria

### Package Setup
- [x] Create plugins/m42-sprint/runtime/package.json (already exists)
- [x] Dependencies: js-yaml, commander
- [x] DevDependencies: typescript, vitest, @types/*
- [x] Scripts: build, test, typecheck

### CLI Entry Point
- [ ] Create plugins/m42-sprint/runtime/src/cli.ts
- [ ] `sprint run <dir>` - run sprint loop
- [ ] `--max-iterations <n>` option
- [ ] `--delay <ms>` option
- [ ] `-v, --verbose` option
- [ ] Exit code 0 on success, 1 on failure

### Build Setup
- [x] tsconfig.json for runtime (already exists)
- [x] Output to dist/
- [ ] Shebang for CLI: #!/usr/bin/env node

### Integration
- [ ] Update root package.json with workspace reference
- [ ] npm run build works from root
- [ ] npm run test works from root

## Files to Create
- plugins/m42-sprint/runtime/src/cli.ts
- plugins/m42-sprint/runtime/src/index.ts (exports)


## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Create `src/index.ts`** - Public API exports (runLoop, LoopOptions, LoopResult)
2. **Create `src/cli.ts`** - CLI entry point with:
   - `parseArgs()` function for argument parsing
   - `runCommand()` function for command execution
   - `CLI_VERSION` constant
   - Main entry point with shebang
3. **Verify tests pass** - All 8 scenarios from gherkin

## Related Code Patterns

### Pattern from: compiler/package.json (bin configuration)
```json
{
  "bin": {
    "sprint-compile": "./dist/index.js",
    "sprint-status-server": "./dist/status-server/index.js"
  }
}
```

### Pattern from: scripts/sprint-loop.sh (CLI interface)
```bash
# Original bash interface to match:
#   sprint-loop.sh <sprint-dir> [OPTIONS]
#   --max-iterations <n>    Maximum iterations (default: unlimited, 0 = unlimited)
#   --delay <seconds>       Delay between iterations (default: 2)
#   -h, --help              Show this help message

# Exit codes:
#   0 - Sprint completed successfully or paused
#   1 - Sprint blocked or max iterations reached
#   2 - Human intervention required
```

### Pattern from: runtime/src/loop.ts (LoopOptions interface)
```typescript
export interface LoopOptions {
  /** Max iterations (0 = unlimited, default 0) */
  maxIterations?: number;
  /** Delay between iterations in ms (default 2000) */
  delay?: number;
  /** Enable verbose logging (default false) */
  verbose?: boolean;
}

export interface LoopResult {
  finalState: SprintState;
  iterations: number;
  elapsedMs: number;
}

export async function runLoop(
  sprintDir: string,
  options: LoopOptions = {},
  deps?: LoopDependencies
): Promise<LoopResult>
```

### Pattern from: cli.test.ts (expected API)
```typescript
// Imports expected from cli.ts:
import {
  parseArgs,
  runCommand,
  CLI_VERSION,
} from './cli.js';

// Imports expected from index.ts:
import {
  runLoop,
  LoopOptions,
  LoopResult,
} from './index.js';

// parseArgs return type:
interface ParseResult {
  command: 'run' | 'help' | string;
  directory?: string;
  options: {
    maxIterations: number;  // default 0
    delay: number;          // default 2000
    verbose: boolean;       // default false
  };
  showHelp?: boolean;
  showVersion?: boolean;
  error?: string;
}

// runCommand signature:
async function runCommand(
  command: string,
  directory: string,
  options: LoopOptions,
  loopFn?: (dir: string, opts: LoopOptions) => Promise<LoopResult>
): Promise<number>  // Returns exit code 0 or 1
```

## Required Imports

### Internal
- `loop.js`: `runLoop`, `LoopOptions`, `LoopResult`
- No commander import needed (use custom parsing per test expectations)

### External
- `path`: Path manipulation for directory handling
- `process`: For exit codes and argv

## Types/Interfaces to Use

### From loop.ts (re-export in index.ts)
```typescript
export interface LoopOptions {
  maxIterations?: number;
  delay?: number;
  verbose?: boolean;
}

export interface LoopResult {
  finalState: SprintState;
  iterations: number;
  elapsedMs: number;
}
```

### New types for cli.ts
```typescript
export interface ParseResult {
  command: string;
  directory?: string;
  options: {
    maxIterations: number;
    delay: number;
    verbose: boolean;
  };
  showHelp?: boolean;
  showVersion?: boolean;
  error?: string;
}
```

## Integration Points
- **Called by**: Direct CLI invocation via `sprint run <dir>`
- **Calls**: `runLoop()` from loop.ts

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| plugins/m42-sprint/runtime/src/index.ts | Create | Export public API (runLoop, LoopOptions, LoopResult) |
| plugins/m42-sprint/runtime/src/cli.ts | Create | CLI entry point with parseArgs, runCommand, CLI_VERSION |
| package.json (root) | Modify | Add workspace reference (optional) |

## Key Implementation Details

### Shebang Requirement
The cli.ts must compile to cli.js with shebang:
```typescript
#!/usr/bin/env node
```

### Argument Parsing
Based on test expectations, `parseArgs` must handle:
- `['node', 'cli.js', 'run', '/path/to/sprint']` → command: 'run', directory: '/path/to/sprint'
- `--max-iterations` / `-n` → number option
- `--delay` / `-d` → number option
- `--verbose` / `-v` → boolean flag
- `--help` → showHelp: true, command: 'help'
- `--version` → showVersion: true
- Missing directory → error: 'directory required'
- Unknown command → error set

### Exit Codes
- 0: completed successfully OR paused
- 1: blocked, needs-human, or error

### Delay Unit Difference
- Bash uses seconds: `--delay 2` means 2 seconds
- TypeScript uses milliseconds: `delay: 2000` means 2 seconds
- CLI should accept milliseconds to match LoopOptions interface

## Notes from Gherkin

Tests expect:
- `parseArgs` to be a pure function (no side effects)
- `runCommand` to accept optional mock `loopFn` for testing
- `CLI_VERSION` as exported constant
- Default `maxIterations: 0`, `delay: 2000`, `verbose: false`
