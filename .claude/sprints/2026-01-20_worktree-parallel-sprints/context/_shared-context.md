# Sprint Context: Worktree-Parallel Sprints

## Project Info

| Item | Value |
|------|-------|
| **Test Framework** | Custom minimal framework (no vitest/jest) |
| **Test Pattern** | `*.test.ts` colocated with source files |
| **Test Location** | `runtime/src/*.test.ts`, `compiler/src/**/*.test.ts` |
| **Build Command** | `npm run build` (per subpackage) |
| **Test Command** | `npm test` (per subpackage) |
| **Typecheck** | `npm run typecheck` |
| **Package Manager** | npm |
| **TypeScript Target** | ES2022, NodeNext modules |

### Key Directories
```
plugins/m42-sprint/
├── runtime/           # Main execution runtime (TypeScript)
│   ├── src/
│   │   ├── loop.ts    # Main execution loop (650 LOC) - KEY FILE
│   │   ├── transition.ts   # State machine (853 LOC)
│   │   └── yaml-ops.ts     # Atomic YAML operations
├── compiler/          # Workflow compilation and status server
│   ├── src/
│   │   ├── types.ts   # Shared type definitions (850+ LOC) - KEY FILE
│   │   └── status-server/
│   │       └── worktree.ts  # EXISTING worktree detection - KEY FILE
├── commands/          # CLI command definitions (markdown)
└── docs/              # Documentation
```

## Patterns to Follow

### 1. Discriminated Unions for Type Safety
```typescript
export type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; current: CurrentPointer; iteration: number }
  | { status: 'paused'; pausedAt: CurrentPointer; pauseReason: string }
  // ... exhaustive cases
```

### 2. Pure State Machine Transitions
```typescript
// transition.ts pattern - pure function, no side effects
export function transition(state: SprintState, event: SprintEvent): TransitionResult {
  // Returns { nextState, actions }
}
```

### 3. Dependency Injection for Testing
```typescript
export interface LoopDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}

export async function runLoop(
  sprintDir: string,
  options?: LoopOptions,
  deps: LoopDependencies = defaultLoopDeps  // Inject for testing
): Promise<LoopResult> { }
```

### 4. Custom Test Framework Pattern
```typescript
// Each test file defines its own test() function
function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });
  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

async function runTests(): Promise<void> {
  for (const { name, fn } of testQueue) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
    }
  }
}
```

### 5. Atomic File Operations with Backup
```typescript
// yaml-ops.ts pattern
backupProgress(filePath);    // Creates .backup before critical ops
writeProgressAtomic(filePath, content);  // Temp + rename
// On failure: restoreProgress(filePath)
// On success: cleanupBackup(filePath)
```

### 6. Existing Worktree Detection (Foundation)
```typescript
// compiler/src/status-server/worktree.ts - REUSE THIS
export interface WorktreeInfo {
  root: string;      // Absolute path
  name: string;      // Basename
  branch: string;    // Current git branch
  commit: string;    // Abbreviated SHA
  isMain: boolean;   // Main vs linked worktree
}

export function detectWorktree(targetPath: string): WorktreeInfo | null;
export function listWorktrees(targetPath: string): WorktreeList | null;
export function isInWorktree(targetPath: string): boolean;
```

## Sprint Steps Overview

This sprint implements worktree-based parallel sprint execution in 8 steps:

### Step 0: worktree-config-schema
**Goal**: Define schema for worktree configuration
- Add `WorktreeConfig` interface to types.ts
- Support at both workflow and sprint levels
- Variable substitution: `{sprint-id}`, `{date}`, etc.
- Files: `compiler/src/types.ts`, `compiler/src/schema.ts`

### Step 1: auto-worktree-creation
**Goal**: Automatic worktree creation at sprint start
- Create branch and worktree via `git worktree add`
- Copy SPRINT.yaml to worktree's sprint directory
- Add worktree metadata to PROGRESS.yaml
- Files: `commands/start-sprint.md`, `runtime/src/worktree.ts` (new)
- **Depends on**: Step 0 (schema)

### Step 2: runtime-working-dir (CRITICAL)
**Goal**: Execute Claude from project/worktree root, not sprint dir
- **Current problem**: `cwd: sprintDir` in loop.ts
- **Solution**: `cwd: progress.worktree?.['working-dir'] ?? getProjectRoot()`
- Add `working-dir` field to PROGRESS.yaml
- Files: `runtime/src/loop.ts`, `runtime/src/worktree.ts`, `compiler/src/types.ts`
- **Depends on**: Step 0, Step 1

### Step 3: worktree-detection
**Goal**: Detect and isolate sprints by worktree
- Enhance existing worktree.ts detection
- Add `worktree-id` and `worktree-path` to PROGRESS.yaml
- Ensure `.claude/sprints/` is local to each worktree
- Files: `compiler/src/types.ts`, `runtime/src/worktree.ts`
- **Depends on**: Step 2

### Step 4: status-multi-worktree
**Goal**: Unified status view across all worktrees
- Add `--all-worktrees` flag to /sprint-status
- Discover and display sprints from all worktrees
- Files: `commands/sprint-status.md`, `runtime/src/status.ts`
- **Depends on**: Step 3

### Step 5: conflict-prevention
**Goal**: Prevent conflicts between parallel sprints
- Lock mechanism for git operations
- Detect branch name collisions
- Files: `runtime/src/locks.ts` (new)
- **Depends on**: Step 3

### Step 6: worktree-cleanup
**Goal**: Handle worktree lifecycle on sprint completion
- Cleanup modes: `never`, `on-complete`, `on-merge`
- Safety checks for uncommitted changes
- Files: `commands/cleanup-sprint.md` (new), `runtime/src/cleanup.ts` (new)
- **Depends on**: Steps 0-5

### Step 7: documentation
**Goal**: User documentation for worktree-parallel feature
- Guide: `docs/guides/worktree-sprints.md`
- Configuration reference updates
- Files: `docs/guides/worktree-sprints.md` (new)
- **Depends on**: Steps 0-6

### Step 8: integration-tests
**Goal**: End-to-end tests for worktree-parallel scenarios
- Test worktree creation, runtime cwd, cleanup
- Files: `scripts/test-worktree-*.sh` (new)
- **Depends on**: Steps 0-7

## Dependency Graph

```
Step 0 (schema) ──┬──> Step 1 (creation) ──> Step 2 (runtime-cwd) ──> Step 3 (detection)
                  │                                                         │
                  │                                                         ├──> Step 4 (status)
                  │                                                         │
                  │                                                         └──> Step 5 (locks)
                  │                                                                   │
                  └───────────────────────────────────────────────────────────────────┴──> Step 6 (cleanup)
                                                                                                 │
                                                                                                 v
                                                                            Step 7 (docs) ──> Step 8 (e2e tests)
```

## Key Files to Modify

| File | Steps | Changes |
|------|-------|---------|
| `compiler/src/types.ts` | 0, 2, 3 | WorktreeConfig interface, working-dir, worktree-id |
| `compiler/src/schema.ts` | 0 | Validation rules |
| `runtime/src/loop.ts` | 2 | Change cwd to working-dir |
| `runtime/src/worktree.ts` | 1, 2, 3 | New file: worktree helpers |
| `runtime/src/locks.ts` | 5 | New file: conflict prevention |
| `runtime/src/cleanup.ts` | 6 | New file: worktree cleanup |
| `commands/start-sprint.md` | 1 | Worktree creation logic |
| `commands/sprint-status.md` | 4 | Multi-worktree view |
| `commands/cleanup-sprint.md` | 6 | New command |

## Running Tests

```bash
# Runtime tests
cd plugins/m42-sprint/runtime && npm test

# Compiler tests
cd plugins/m42-sprint/compiler && npm test

# E2E tests
cd plugins/m42-sprint/e2e && npm test

# Type checking (no emit)
cd plugins/m42-sprint/runtime && npm run typecheck
cd plugins/m42-sprint/compiler && npm run typecheck
```

## Important Notes

1. **No external test framework** - Use the custom `test()` pattern shown above
2. **Atomic file operations** - Always use backup/restore for YAML writes
3. **Discriminated unions** - Ensure exhaustive switch statements
4. **Existing worktree code** - Reuse `compiler/src/status-server/worktree.ts`
5. **working-dir is critical** - Step 2 fixes the fundamental cwd issue
