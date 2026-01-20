# Step Context: main-loop

## Task
GIVEN all support modules (transition, yaml-ops, prompt-builder, claude-runner, executor)
WHEN implementing the main sprint loop
THEN replace sprint-loop.sh (2,464 lines) with TypeScript

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/loop.ts

## Implementation Plan
Based on gherkin scenarios and existing tests, implement in this order:

1. **Define interfaces** (`LoopOptions`, `LoopResult`, `LoopDependencies`)
2. **Implement `isTerminalState()`** - helper to check if state is terminal
3. **Implement `recoverFromInterrupt()`** - crash recovery from backup files
4. **Implement `checkPauseSignal()`** - detect PAUSE file in sprint directory
5. **Implement `restoreStateFromProgress()`** - convert CompiledProgress to SprintState
6. **Implement `runLoop()`** - main loop function with full lifecycle

## Related Code Patterns

### Pattern from: transition.ts - State Type
```typescript
// SprintState discriminated union
export type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; current: CurrentPointer; iteration: number; startedAt: string }
  | { status: 'paused'; pausedAt: CurrentPointer; pauseReason: string }
  | { status: 'blocked'; error: string; failedPhase: string; blockedAt: string }
  | { status: 'needs-human'; reason: string; details?: string }
  | { status: 'completed'; summary?: string; completedAt: string; elapsed: string };
```

### Pattern from: transition.ts - Pure Transition
```typescript
export function transition(
  state: SprintState,
  event: SprintEvent,
  context: CompiledProgress
): TransitionResult {
  // Returns { nextState, actions, context }
}
```

### Pattern from: yaml-ops.ts - Atomic Operations
```typescript
// Read with checksum validation
export function readProgress(filePath: string): CompiledProgress;

// Atomic write with temp+rename
export async function writeProgressAtomic(filePath: string, progress: CompiledProgress): Promise<void>;

// Backup/restore for transactions
export function backupProgress(filePath: string): void;
export function restoreProgress(filePath: string): boolean;
export function cleanupBackup(filePath: string): void;
```

### Pattern from: executor.ts - Action Execution
```typescript
export interface ExecutorContext {
  sprintDir: string;
  progress: CompiledProgress;
  verbose: boolean;
}

export interface ExecutorDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}

export async function executeAction(
  action: SprintAction,
  context: ExecutorContext,
  deps: ExecutorDependencies
): Promise<SprintEvent | null>;

export async function executeActions(
  actions: SprintAction[],
  context: ExecutorContext,
  deps: ExecutorDependencies
): Promise<SprintEvent[]>;
```

### Pattern from: claude-runner.ts - Claude Invocation
```typescript
export interface ClaudeResult {
  success: boolean;
  output: string;
  exitCode: number;
  jsonResult?: unknown;
  error?: string;
}

export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeResult>;
export function categorizeError(errorText: string): ErrorCategory;
```

### Pattern from: sprint-loop.sh - Main Loop Logic
```bash
# Key patterns from bash implementation:

# 1. Recovery on startup
recover_from_interrupted_transaction

# 2. Set initial status
if [[ "$CURRENT_STATUS" == "not-started" ]]; then
  yq -i '.status = "in-progress"' "$PROGRESS_FILE"
fi

# 3. Main loop structure
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  # Check pause signal
  # Backup progress (transaction start)
  # Build prompt
  # Invoke Claude
  # Process result (update PROGRESS.yaml)
  # Cleanup backup (transaction end)
  # Check terminal status
  # Sleep delay
done
```

## Required Imports

### Internal
- `transition.ts`: `SprintState`, `SprintEvent`, `SprintAction`, `CompiledProgress`, `CurrentPointer`, `transition`
- `yaml-ops.ts`: `readProgress`, `writeProgressAtomic`, `backupProgress`, `restoreProgress`, `cleanupBackup`
- `executor.ts`: `ExecutorContext`, `ExecutorDependencies`, `executeAction`, `executeActions`
- `prompt-builder.ts`: `buildPrompt`
- `claude-runner.ts`: `ClaudeResult`, `runClaude`

### External
- `fs`: File existence checks, reading PAUSE file
- `path`: Path joining for progress file

## Types/Interfaces to Implement

```typescript
/** Options for the main loop */
export interface LoopOptions {
  /** Max iterations (0 = unlimited, default 0) */
  maxIterations?: number;
  /** Delay between iterations in ms (default 2000) */
  delay?: number;
  /** Enable verbose logging (default false) */
  verbose?: boolean;
}

/** Result from loop execution */
export interface LoopResult {
  /** Final sprint state */
  finalState: SprintState;
  /** Number of iterations run */
  iterations: number;
  /** Total elapsed time in ms */
  elapsedMs: number;
}

/** Dependencies that can be injected for testing */
export interface LoopDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}
```

## Integration Points

### Called by
- CLI entry point (future `cli.ts`)
- `/run-sprint` command handler

### Calls
- `transition()` from transition.ts
- `readProgress()`, `writeProgressAtomic()`, `backupProgress()`, `restoreProgress()`, `cleanupBackup()` from yaml-ops.ts
- `executeActions()` from executor.ts
- `buildPrompt()` from prompt-builder.ts

## Terminal States (from gherkin)
- `'completed'` - Sprint finished successfully
- `'blocked'` - Sprint hit unrecoverable error or max iterations
- `'paused'` - PAUSE file detected
- `'needs-human'` - Human intervention required

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/runtime/src/loop.ts` | Create | Main loop implementation |
| `plugins/m42-sprint/runtime/src/loop.test.ts` | Exists | Tests already exist (RED phase) |

## Key Algorithm: Main Loop

```typescript
async function runLoop(sprintDir: string, options: LoopOptions, deps?: LoopDependencies): Promise<LoopResult> {
  const startTime = Date.now();
  let iterations = 0;

  // 1. Recover from any interrupted transaction
  await recoverFromInterrupt(progressPath);

  // 2. Load progress and restore state
  const progress = readProgress(progressPath);
  let state = restoreStateFromProgress(progress);

  // 3. If not-started, send START event
  if (state.status === 'not-started') {
    const result = transition(state, { type: 'START' }, progress);
    state = result.nextState;
    await executeActions(result.actions, context, deps);
    await writeProgressAtomic(progressPath, progress);
  }

  // 4. Main loop
  while (!isTerminalState(state) && (maxIterations === 0 || iterations < maxIterations)) {
    iterations++;

    // Check pause signal
    if (checkPauseSignal(sprintDir)) {
      const result = transition(state, { type: 'PAUSE', reason: 'PAUSE file detected' }, progress);
      state = result.nextState;
      await writeProgressAtomic(progressPath, progress);
      break;
    }

    // Transaction: backup before Claude
    backupProgress(progressPath);

    // Execute current phase via Claude
    const events = await executeActions(state.actions, context, deps);

    // Process resulting events
    for (const event of events) {
      const result = transition(state, event, progress);
      state = result.nextState;
      await executeActions(result.actions, context, deps);
    }

    // Commit transaction
    await writeProgressAtomic(progressPath, progress);
    cleanupBackup(progressPath);

    // Check max iterations
    if (maxIterations > 0 && iterations >= maxIterations && !isTerminalState(state)) {
      const result = transition(state, { type: 'MAX_ITERATIONS_REACHED' }, progress);
      state = result.nextState;
      await writeProgressAtomic(progressPath, progress);
    }

    // Delay between iterations
    if (delay > 0 && !isTerminalState(state)) {
      await sleep(delay);
    }
  }

  return { finalState: state, iterations, elapsedMs: Date.now() - startTime };
}
```

## Test Expectations from loop.test.ts

The tests expect these exports:
- `runLoop(sprintDir, options, deps?)` - main function
- `recoverFromInterrupt(progressPath)` - recovery function
- `isTerminalState(state)` - helper function
- `LoopOptions` - type for options
- `LoopResult` - type for result

All tests use dependency injection with a mock `runClaude` function to avoid actual Claude CLI calls.
