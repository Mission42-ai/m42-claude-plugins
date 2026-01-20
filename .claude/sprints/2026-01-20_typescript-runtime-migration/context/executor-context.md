# Step Context: executor

## Task
GIVEN the SprintAction types and support modules (yaml-ops, prompt-builder, claude-runner)
WHEN implementing the executor
THEN map each action type to its implementation

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/executor.ts

## Acceptance Criteria

### Main Functions
- [ ] `executeAction(action: SprintAction, context: ExecutorContext)` → Promise<SprintEvent | null>
- [ ] `executeActions(actions: SprintAction[], context)` → Promise<SprintEvent[]>

### Action Implementations
- [ ] LOG → console.log/warn/error based on level
- [ ] SPAWN_CLAUDE → call claude-runner, return PHASE_COMPLETE or PHASE_FAILED
- [ ] WRITE_PROGRESS → call yaml-ops.writeProgressAtomic
- [ ] UPDATE_STATS → update in-memory context (will be persisted by WRITE_PROGRESS)
- [ ] EMIT_ACTIVITY → append to .sprint-activity.jsonl
- [ ] SCHEDULE_RETRY → sleep for delayMs, return event to retry
- [ ] INSERT_STEP → update progress.phases with new step

### ExecutorContext Interface
- [ ] sprintDir: string
- [ ] progress: CompiledProgress (mutable reference)
- [ ] verbose: boolean

### Type Safety
- [ ] Exhaustive switch with `never` check
- [ ] TypeScript error if action type missing

### Tests
- [ ] Unit test for each action type
- [ ] Mock claude-runner for SPAWN_CLAUDE tests
- [ ] Mock fs for WRITE_PROGRESS tests
- [ ] Test: executeActions runs in sequence

## Implementation Plan
Based on gherkin scenarios in artifacts/executor-gherkin.md, implement in this order:

1. **ExecutorContext Interface** - Define the context shape first
2. **LOG action** - Simplest action, just console output based on level
3. **UPDATE_STATS action** - In-memory mutation of progress.stats
4. **WRITE_PROGRESS action** - Call yaml-ops.writeProgressAtomic
5. **EMIT_ACTIVITY action** - Append JSONL to .sprint-activity.jsonl
6. **SCHEDULE_RETRY action** - Sleep and return retry event (TICK or similar)
7. **INSERT_STEP action** - Mutate progress.phases to add step
8. **SPAWN_CLAUDE action** - Call claude-runner with dependency injection for mocking
9. **executeActions function** - Sequential execution collecting non-null events
10. **Exhaustive switch** - Add `never` check in default case

## Related Code Patterns

### Pattern from: yaml-ops.ts (Atomic Write)
```typescript
// Atomic write pattern with temp file + rename
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, { lineWidth: -1, noRefs: true, sortKeys: false });
  const tempPath = `${filePath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
    // ... checksum handling
  } finally {
    // cleanup temp file
  }
}
```

### Pattern from: claude-runner.ts (Result Interface)
```typescript
export interface ClaudeResult {
  success: boolean;      // exit code 0
  output: string;        // stdout
  exitCode: number;
  jsonResult?: unknown;  // parsed from ```json block
  error?: string;        // stderr or error description
}

export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
```

### Pattern from: types.ts (Discriminated Union + Exhaustive Switch)
```typescript
// SprintAction discriminated union
export type SprintAction =
  | { type: 'LOG'; level: LogLevel; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: InsertPosition };

// Exhaustive switch pattern
switch (action.type) {
  case 'LOG': /* ... */ break;
  // ... all cases
  default:
    const _exhaustive: never = action;
    throw new Error(`Unhandled action type: ${JSON.stringify(action)}`);
}
```

### Pattern from: claude-runner.test.ts (Test Structure)
```typescript
function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => { console.log(`✓ ${name}`); })
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
```

## Required Imports

### Internal
- `yaml-ops.ts`: `writeProgressAtomic`, `CompiledProgress` types
- `claude-runner.ts`: `runClaude`, `ClaudeResult`, `categorizeError`, `ErrorCategory`
- `types.ts` (compiler): `SprintAction`, `SprintEvent`, `StepQueueItem`, `InsertPosition`, `LogLevel`, `SprintStats`

### External
- `fs`: `appendFileSync`, `mkdirSync`, `existsSync`
- `path`: `join`

## Types/Interfaces to Use

### From types.ts (compiler)
```typescript
export type SprintAction =
  | { type: 'LOG'; level: LogLevel; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: InsertPosition };

export type SprintEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'MAX_ITERATIONS_REACHED' }
  | { type: 'PHASE_COMPLETE'; summary: string; phaseId: string }
  | { type: 'PHASE_FAILED'; error: string; category: ErrorCategory; phaseId: string }
  // ... other events

export interface StepQueueItem {
  id: string;
  prompt: string;
  proposedBy: string;
  proposedAt: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### To Define (executor.ts)
```typescript
export interface ExecutorContext {
  sprintDir: string;              // Path to sprint directory
  progress: CompiledProgress;     // Mutable reference to progress state
  verbose: boolean;               // Enable verbose logging
}
```

## Integration Points

### Called by
- `loop.ts` (main sprint loop) - will call `executeActions(result.actions, context)` after each transition

### Calls (dependencies)
- `yaml-ops.writeProgressAtomic` - for WRITE_PROGRESS action
- `claude-runner.runClaude` - for SPAWN_CLAUDE action
- `claude-runner.categorizeError` - to categorize errors from Claude

### Dependency Injection Pattern
For testability, SPAWN_CLAUDE should use dependency injection:
```typescript
// Allow injecting mock runClaude for tests
export interface ExecutorDependencies {
  runClaude: typeof runClaude;
}

// Default to real implementation
const defaultDeps: ExecutorDependencies = {
  runClaude: runClaude,
};

export async function executeAction(
  action: SprintAction,
  context: ExecutorContext,
  deps: ExecutorDependencies = defaultDeps
): Promise<SprintEvent | null> {
  // ...
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/runtime/src/executor.ts` | Create | Main executor implementation |
| `plugins/m42-sprint/runtime/src/executor.test.ts` | Exists | Tests already created in RED phase |

## Implementation Notes

### SPAWN_CLAUDE Action Logic
```typescript
case 'SPAWN_CLAUDE': {
  const result = await deps.runClaude({
    prompt: action.prompt,
    cwd: context.sprintDir,
  });

  if (result.success) {
    // Extract summary from jsonResult if available
    const summary = (result.jsonResult as any)?.summary || 'Phase completed';
    return { type: 'PHASE_COMPLETE', summary, phaseId: action.phaseId };
  } else {
    const category = categorizeError(result.error || 'Unknown error');
    return { type: 'PHASE_FAILED', error: result.error || 'Unknown error', category, phaseId: action.phaseId };
  }
}
```

### INSERT_STEP Action Logic
```typescript
case 'INSERT_STEP': {
  const { step, position } = action;
  const currentPhase = context.progress.phases?.[context.progress.current.phase];

  if (!currentPhase?.steps) {
    // Handle simple phase (no steps) - skip or create steps array
    return null;
  }

  // Create CompiledStep from StepQueueItem
  const newStep: CompiledStep = {
    id: step.id,
    prompt: step.prompt,
    status: 'pending',
    phases: [], // Sub-phases would be added by compiler or transition
  };

  if (position === 'after-current') {
    const insertIdx = (context.progress.current.step ?? 0) + 1;
    currentPhase.steps.splice(insertIdx, 0, newStep);
  } else { // 'end-of-phase'
    currentPhase.steps.push(newStep);
  }

  return null;
}
```

### SCHEDULE_RETRY Action Logic
```typescript
case 'SCHEDULE_RETRY': {
  await sleep(action.delayMs);
  // Return TICK event to signal retry iteration
  return { type: 'TICK' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### EMIT_ACTIVITY Action Logic
```typescript
case 'EMIT_ACTIVITY': {
  const activityPath = path.join(context.sprintDir, '.sprint-activity.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    activity: action.activity,
    data: action.data,
  };

  // Ensure directory exists
  const dir = path.dirname(activityPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append JSONL line
  fs.appendFileSync(activityPath, JSON.stringify(entry) + '\n');
  return null;
}
```

## Test Strategy

### Mocking Console for LOG tests
```typescript
const capturedLogs: { level: string; message: string }[] = [];
function mockConsole() {
  console.log = (msg) => capturedLogs.push({ level: 'info', message: msg });
  console.warn = (msg) => capturedLogs.push({ level: 'warn', message: msg });
  console.error = (msg) => capturedLogs.push({ level: 'error', message: msg });
}
```

### Mock claude-runner for SPAWN_CLAUDE tests
```typescript
const mockRunClaude = async (options: ClaudeRunOptions): Promise<ClaudeResult> => {
  return {
    success: true,
    output: '```json\n{"status": "completed", "summary": "Mock success"}\n```',
    exitCode: 0,
    jsonResult: { status: 'completed', summary: 'Mock success' },
  };
};

const deps: ExecutorDependencies = { runClaude: mockRunClaude };
const result = await executeAction(action, context, deps);
```

### Test file isolation for EMIT_ACTIVITY/WRITE_PROGRESS
Use temp directories created with `Date.now()` suffix and clean up in finally block.
