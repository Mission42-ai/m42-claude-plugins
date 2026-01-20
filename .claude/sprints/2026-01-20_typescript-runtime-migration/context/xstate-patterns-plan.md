# TypeScript Runtime Migration Plan

## Executive Summary

This document outlines a **full migration from bash scripts to TypeScript** for the m42-sprint runtime, adopting XState's architectural patterns **without adding XState as a dependency**. The goal is to:

1. **Eliminate 2,900+ lines of bash** (keep only test scripts)
2. **Strengthen type safety** with discriminated unions
3. **Improve testability** with pure transition functions
4. **Create single-language codebase** (TypeScript only)

### Migration Scope

| Script | Lines | Action |
|--------|-------|--------|
| `sprint-loop.sh` | 2,464 | **REPLACE** with `runtime/loop.ts` |
| `build-sprint-prompt.sh` | 354 | **REPLACE** with `runtime/prompt-builder.ts` |
| `build-parallel-prompt.sh` | 82 | **MERGE** into `runtime/prompt-builder.ts` |
| `preflight-check.sh` | 100 | **REPLACE** with `runtime/preflight.ts` |
| `test-*.sh` | 429 | **KEEP** as integration tests |

## Background

After analyzing XState v5's architecture, we identified 8 key patterns that can be applied to m42-sprint:

1. **Explicit State Schema with Discriminated Unions**
2. **Event-Driven Transitions with Exhaustive Matching**
3. **Snapshot Pattern for Persistence**
4. **Actions as Separate from Transitions**
5. **Hierarchical State via Nested Pointers**
6. **Guard Functions for Conditional Transitions**
7. **Actor Spawning Pattern for Parallel Tasks**
8. **Interpretation Loop Pattern**

## Current State Analysis

### What We Have

```typescript
// types.ts - Current approach
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';

interface CompiledProgress {
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
}
```

**Problems:**
- Status is just a string - invalid combinations are possible
- Transitions are implicit in bash script logic
- No type safety for state-specific data
- Side effects mixed with state updates

### What XState Does Differently

```typescript
// XState approach - discriminated unions
type State =
  | { status: 'idle' }
  | { status: 'executing'; current: CurrentPointer; iteration: number }
  | { status: 'paused'; pausedAt: CurrentPointer; reason: string }
  | { status: 'blocked'; error: string; failedPhase: string }
  | { status: 'completed'; summary: string; elapsed: string };

// Pure transition function
function transition(state: State, event: Event): TransitionResult {
  return { nextState: State, actions: Action[] };
}
```

**Benefits:**
- TypeScript enforces valid state combinations
- Transitions are explicit and testable
- Side effects separated from state logic

## Integration Plan

### Phase 1: Type System Enhancement (Compiler-Only)

**Scope:** Strengthen types in `plugins/m42-sprint/compiler/src/types.ts` without changing runtime behavior.

**Changes:**

```typescript
// 1. Discriminated union for sprint state
export type SprintState =
  | { status: 'not-started' }
  | {
      status: 'in-progress';
      current: CurrentPointer;
      iteration: number;
      startedAt: string;
    }
  | {
      status: 'paused';
      pausedAt: CurrentPointer;
      pauseReason: string;
      pausedAt: string;
    }
  | {
      status: 'blocked';
      error: string;
      failedPhase: string;
      blockedAt: string;
    }
  | {
      status: 'needs-human';
      reason: string;
      details?: string;
    }
  | {
      status: 'completed';
      summary?: string;
      completedAt: string;
      elapsed: string;
    };

// 2. Event types for all transitions
export type SprintEvent =
  | { type: 'START' }
  | { type: 'PHASE_COMPLETE'; summary: string; phaseId: string }
  | { type: 'PHASE_FAILED'; error: string; category: ErrorCategory; phaseId: string }
  | { type: 'STEP_COMPLETE'; summary: string; stepId: string }
  | { type: 'STEP_FAILED'; error: string; category: ErrorCategory; stepId: string }
  | { type: 'PROPOSE_STEPS'; steps: ProposedStep[]; proposedBy: string }
  | { type: 'PAUSE'; reason: string }
  | { type: 'RESUME' }
  | { type: 'HUMAN_NEEDED'; reason: string; details?: string }
  | { type: 'GOAL_COMPLETE'; summary: string }
  | { type: 'MAX_ITERATIONS_REACHED' };

// 3. Actions as data (not execution)
export type SprintAction =
  | { type: 'LOG'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: 'after-current' | 'end-of-phase' }
  | { type: 'SPAWN_ORCHESTRATION'; stepQueue: StepQueueItem[] };

// 4. Transition result type
export interface TransitionResult {
  nextState: SprintState;
  actions: SprintAction[];
  context: Partial<CompiledProgress>;  // Context updates
}

// 5. Guard functions
export type GuardFn = (
  state: SprintState,
  context: CompiledProgress,
  event: SprintEvent
) => boolean;

export const guards: Record<string, GuardFn> = {
  hasMorePhases: (state, ctx) =>
    ctx.current.phase < (ctx.phases?.length ?? 0) - 1,

  hasMoreSteps: (state, ctx) => {
    const phase = ctx.phases?.[ctx.current.phase];
    return !!phase?.steps &&
           ctx.current.step !== null &&
           ctx.current.step < phase.steps.length - 1;
  },

  isRetryable: (state, ctx, event) =>
    event.type === 'PHASE_FAILED' &&
    ctx.retry?.retryOn.includes(event.category) ?? false,

  hasStepQueue: (state, ctx) =>
    (ctx['step-queue']?.length ?? 0) > 0,

  orchestrationEnabled: (state, ctx) =>
    ctx.orchestration?.enabled === true,

  autoApproveEnabled: (state, ctx) =>
    ctx.orchestration?.autoApprove === true,
};
```

**Impact:**
- Compiler gains stronger type checking
- No runtime changes yet
- Prepares for Phase 2 implementation

**Files Modified:**
- `plugins/m42-sprint/compiler/src/types.ts`

**Verification:**
```bash
cd plugins/m42-sprint/compiler
npm run typecheck  # Should pass with new types
```

---

### Phase 2: Transition Function (Pure Logic)

**Scope:** Create a pure `transition()` function that encapsulates all state transition logic.

**Changes:**

Create new file: `plugins/m42-sprint/compiler/src/transition.ts`

```typescript
import { SprintState, SprintEvent, TransitionResult, guards } from './types';

/**
 * Pure transition function - no side effects
 * Returns next state and actions to execute
 */
export function transition(
  state: SprintState,
  event: SprintEvent,
  context: CompiledProgress
): TransitionResult {

  // START event
  if (state.status === 'not-started' && event.type === 'START') {
    return {
      nextState: {
        status: 'in-progress',
        current: { phase: 0, step: null, 'sub-phase': null },
        iteration: 1,
        startedAt: new Date().toISOString()
      },
      actions: [
        { type: 'LOG', level: 'info', message: 'Sprint started' },
        { type: 'UPDATE_STATS', updates: { 'started-at': new Date().toISOString() } },
        { type: 'SPAWN_CLAUDE', prompt: buildPrompt(context), phaseId: '...', onComplete: 'PHASE_COMPLETE' }
      ],
      context: {}
    };
  }

  // PHASE_COMPLETE event
  if (state.status === 'in-progress' && event.type === 'PHASE_COMPLETE') {
    const { nextPointer, hasMore } = advancePointer(context.current, context);

    if (!hasMore) {
      return {
        nextState: {
          status: 'completed',
          summary: event.summary,
          completedAt: new Date().toISOString(),
          elapsed: calculateElapsed(state.startedAt, new Date().toISOString())
        },
        actions: [
          { type: 'LOG', level: 'info', message: 'Sprint completed' },
          { type: 'WRITE_PROGRESS' },
          { type: 'UPDATE_STATS', updates: { 'completed-at': new Date().toISOString() } }
        ],
        context: { current: nextPointer }
      };
    }

    return {
      nextState: { ...state, current: nextPointer, iteration: state.iteration + 1 },
      actions: [
        { type: 'LOG', level: 'info', message: `Phase ${event.phaseId} complete` },
        { type: 'WRITE_PROGRESS' },
        { type: 'SPAWN_CLAUDE', prompt: buildPrompt({ ...context, current: nextPointer }), phaseId: '...', onComplete: 'PHASE_COMPLETE' }
      ],
      context: { current: nextPointer }
    };
  }

  // PHASE_FAILED event with retry
  if (state.status === 'in-progress' && event.type === 'PHASE_FAILED') {
    if (guards.isRetryable(state, context, event)) {
      return {
        nextState: state,  // Keep same state
        actions: [
          { type: 'LOG', level: 'warn', message: `Phase ${event.phaseId} failed, retrying` },
          { type: 'SCHEDULE_RETRY', phaseId: event.phaseId, delayMs: calculateBackoff(context) }
        ],
        context: {}
      };
    }

    return {
      nextState: {
        status: 'blocked',
        error: event.error,
        failedPhase: event.phaseId,
        blockedAt: new Date().toISOString()
      },
      actions: [
        { type: 'LOG', level: 'error', message: `Phase ${event.phaseId} blocked: ${event.error}` },
        { type: 'WRITE_PROGRESS' }
      ],
      context: {}
    };
  }

  // PROPOSE_STEPS event (orchestration)
  if (state.status === 'in-progress' && event.type === 'PROPOSE_STEPS') {
    if (!guards.orchestrationEnabled(state, context)) {
      return { nextState: state, actions: [], context: {} };
    }

    if (guards.autoApproveEnabled(state, context)) {
      // Auto-approve: insert steps directly
      return {
        nextState: state,
        actions: event.steps.map(step => ({
          type: 'INSERT_STEP' as const,
          step: { ...step, id: generateId(), proposedBy: event.proposedBy, proposedAt: new Date().toISOString() },
          position: context.orchestration!.insertStrategy
        })),
        context: {}
      };
    }

    // Queue for orchestration
    return {
      nextState: state,
      actions: [
        { type: 'LOG', level: 'info', message: `${event.steps.length} steps queued for orchestration` }
      ],
      context: {
        'step-queue': [
          ...(context['step-queue'] ?? []),
          ...event.steps.map(s => ({
            id: generateId(),
            prompt: s.prompt,
            proposedBy: event.proposedBy,
            proposedAt: new Date().toISOString(),
            reasoning: s.reasoning,
            priority: s.priority ?? 'medium'
          }))
        ]
      }
    };
  }

  // PAUSE event
  if (state.status === 'in-progress' && event.type === 'PAUSE') {
    return {
      nextState: {
        status: 'paused',
        pausedAt: state.current,
        pauseReason: event.reason,
        pausedAt: new Date().toISOString()
      },
      actions: [
        { type: 'LOG', level: 'info', message: `Sprint paused: ${event.reason}` },
        { type: 'WRITE_PROGRESS' }
      ],
      context: {}
    };
  }

  // RESUME event
  if (state.status === 'paused' && event.type === 'RESUME') {
    return {
      nextState: {
        status: 'in-progress',
        current: state.pausedAt,
        iteration: 1,
        startedAt: new Date().toISOString()
      },
      actions: [
        { type: 'LOG', level: 'info', message: 'Sprint resumed' },
        { type: 'SPAWN_CLAUDE', prompt: buildPrompt({ ...context, current: state.pausedAt }), phaseId: '...', onComplete: 'PHASE_COMPLETE' }
      ],
      context: {}
    };
  }

  // Default: no transition
  return { nextState: state, actions: [], context: {} };
}

// Helper functions
function advancePointer(current: CurrentPointer, context: CompiledProgress): { nextPointer: CurrentPointer; hasMore: boolean } {
  // Implementation of pointer advancement logic
  // Returns next pointer and whether there are more items
}

function calculateBackoff(context: CompiledProgress): number {
  // Exponential backoff calculation
}

function buildPrompt(context: CompiledProgress): string {
  // Prompt building logic
}
```

**Benefits:**
- All transition logic in one pure function
- Easy to test without side effects
- TypeScript enforces exhaustive handling

**Files Created:**
- `plugins/m42-sprint/compiler/src/transition.ts`

**Verification:**
```typescript
// Unit test
describe('transition', () => {
  it('should start sprint on START event', () => {
    const state: SprintState = { status: 'not-started' };
    const event: SprintEvent = { type: 'START' };
    const result = transition(state, event, mockContext);

    expect(result.nextState.status).toBe('in-progress');
    expect(result.actions).toContainEqual({ type: 'LOG', level: 'info', message: 'Sprint started' });
  });
});
```

---

### Phase 3: Action Executor (Shell Bridge)

**Scope:** Create an action executor that bridges TypeScript actions to bash scripts.

**Changes:**

Create new file: `plugins/m42-sprint/compiler/src/executor.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { SprintAction, SprintEvent } from './types';

const execAsync = promisify(exec);

/**
 * Executes actions and returns resulting events
 */
export async function executeAction(action: SprintAction): Promise<SprintEvent | null> {
  switch (action.type) {
    case 'LOG':
      console[action.level](action.message);
      return null;

    case 'SPAWN_CLAUDE': {
      // Execute Claude via bash script
      const result = await execAsync(
        `bash plugins/m42-sprint/scripts/build-sprint-prompt.sh && claude ...`
      );

      // Parse result and return event
      const parsed = parseClaudeResult(result.stdout);
      if (parsed.status === 'completed') {
        return { type: 'PHASE_COMPLETE', summary: parsed.summary, phaseId: action.phaseId };
      } else if (parsed.status === 'failed') {
        return { type: 'PHASE_FAILED', error: parsed.error, category: 'logic', phaseId: action.phaseId };
      }
      return null;
    }

    case 'WRITE_PROGRESS': {
      // Write PROGRESS.yaml atomically
      await execAsync('yq ... > PROGRESS.yaml');
      return null;
    }

    case 'UPDATE_STATS':
      // Update stats in memory (written by WRITE_PROGRESS)
      return null;

    case 'EMIT_ACTIVITY': {
      // Emit to activity log
      await execAsync(`echo '${JSON.stringify(action.data)}' >> .sprint-activity.jsonl`);
      return null;
    }

    case 'SCHEDULE_RETRY': {
      // Sleep and return retry event
      await sleep(action.delayMs);
      return { type: 'PHASE_COMPLETE', summary: 'Retrying', phaseId: action.phaseId };
    }

    case 'INSERT_STEP': {
      // Insert step via yq
      await execAsync(`yq '.phases[...].steps += ...' PROGRESS.yaml`);
      return null;
    }

    case 'SPAWN_ORCHESTRATION': {
      // Run orchestration iteration
      const result = await execAsync('bash run-orchestration.sh');
      // Parse decisions and return events
      return null;
    }

    default:
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${JSON.stringify(action)}`);
  }
}

/**
 * Execute all actions in sequence, collecting events
 */
export async function executeActions(actions: SprintAction[]): Promise<SprintEvent[]> {
  const events: SprintEvent[] = [];

  for (const action of actions) {
    const event = await executeAction(action);
    if (event) events.push(event);
  }

  return events;
}
```

**Files Created:**
- `plugins/m42-sprint/compiler/src/executor.ts`

---

### Phase 4: Interpretation Loop (Node.js Orchestrator)

**Scope:** Replace bash loop with Node.js interpretation loop using transition + executor.

**Changes:**

Create new file: `plugins/m42-sprint/runtime/sprint-loop.ts`

```typescript
import { readFileSync, writeFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { transition } from '../compiler/src/transition';
import { executeActions } from '../compiler/src/executor';
import { SprintState, SprintEvent, CompiledProgress } from '../compiler/src/types';

/**
 * Main sprint loop - replaces sprint-loop.sh
 */
export async function runSprintLoop(sprintDir: string, maxIterations: number = 0) {
  // Load initial state
  let progress: CompiledProgress = yaml.load(
    readFileSync(`${sprintDir}/PROGRESS.yaml`, 'utf8')
  ) as CompiledProgress;

  let state: SprintState = restoreState(progress);
  let iteration = 0;

  // Start the loop
  if (state.status === 'not-started') {
    const result = transition(state, { type: 'START' }, progress);
    state = result.nextState;
    progress = { ...progress, ...result.context };
    const events = await executeActions(result.actions);
    // Process resulting events...
  }

  // Main interpretation loop
  while (state.status === 'in-progress') {
    iteration++;

    // Check limits
    if (maxIterations > 0 && iteration > maxIterations) {
      const result = transition(state, { type: 'MAX_ITERATIONS_REACHED' }, progress);
      state = result.nextState;
      await executeActions(result.actions);
      break;
    }

    // Check for pause signal
    if (await checkPauseSignal(sprintDir)) {
      const result = transition(state, { type: 'PAUSE', reason: 'User requested' }, progress);
      state = result.nextState;
      progress = { ...progress, ...result.context };
      await executeActions(result.actions);
      break;
    }

    // Persist snapshot
    await writeProgress(sprintDir, progress, state);

    // Wait for next event (from actions or external)
    await sleep(2000);

    // Check for completed Claude invocation
    // This would poll or wait for the SPAWN_CLAUDE action to complete
  }

  return { finalState: state, progress };
}

function restoreState(progress: CompiledProgress): SprintState {
  // Convert flat status to discriminated union
  switch (progress.status) {
    case 'not-started':
      return { status: 'not-started' };
    case 'in-progress':
      return {
        status: 'in-progress',
        current: progress.current,
        iteration: progress.stats['current-iteration'] ?? 1,
        startedAt: progress.stats['started-at'] ?? new Date().toISOString()
      };
    // ... other cases
  }
}

async function writeProgress(sprintDir: string, progress: CompiledProgress, state: SprintState) {
  // Flatten state back to progress format
  const flatProgress: CompiledProgress = {
    ...progress,
    status: state.status,
    // ... map state fields back
  };

  writeFileSync(
    `${sprintDir}/PROGRESS.yaml`,
    yaml.dump(flatProgress)
  );
}
```

**Files Created:**
- `plugins/m42-sprint/runtime/sprint-loop.ts`
- `plugins/m42-sprint/runtime/index.ts` (entry point)

**Integration:**
- Add npm script: `"sprint:run": "node runtime/sprint-loop.js"`
- Or keep bash wrapper that calls Node.js runtime

---

### Phase 5: Snapshot/Restore for Persistence

**Scope:** Implement XState-style snapshot/restore for crash recovery.

**Changes:**

Add to `types.ts`:

```typescript
/**
 * Persistable snapshot (minimal format for recovery)
 */
export interface SprintSnapshot {
  version: number;  // Schema version for migrations
  state: SprintState;
  context: CompiledProgress;
  checksum: string;  // For corruption detection
}

/**
 * Get snapshot for persistence
 */
export function getSnapshot(state: SprintState, context: CompiledProgress): SprintSnapshot {
  const snapshot = {
    version: 1,
    state,
    context,
    checksum: ''
  };

  snapshot.checksum = calculateChecksum(JSON.stringify(snapshot));
  return snapshot;
}

/**
 * Restore from snapshot with version migration
 */
export function restoreSnapshot(snapshot: SprintSnapshot): { state: SprintState; context: CompiledProgress } {
  // Verify checksum
  const expectedChecksum = calculateChecksum(JSON.stringify({ ...snapshot, checksum: '' }));
  if (snapshot.checksum !== expectedChecksum) {
    throw new Error('Snapshot corrupted: checksum mismatch');
  }

  // Handle version migrations
  if (snapshot.version < 1) {
    // Migrate from v0 to v1
  }

  return { state: snapshot.state, context: snapshot.context };
}
```

**Benefits:**
- Explicit versioning for schema migrations
- Checksum validation prevents corruption
- Clean separation of persistence logic

---

---

## Full TypeScript Runtime Migration

This section details the **complete migration** from bash to TypeScript.

### Target Architecture

```
plugins/m42-sprint/
├── compiler/src/           # Compilation (existing)
│   ├── types.ts           # Enhanced with discriminated unions
│   ├── compile.ts         # SPRINT.yaml → PROGRESS.yaml
│   └── ...
├── runtime/src/            # NEW: Runtime execution
│   ├── index.ts           # Entry point
│   ├── loop.ts            # Main sprint loop (replaces sprint-loop.sh)
│   ├── transition.ts      # Pure state transitions
│   ├── executor.ts        # Action execution
│   ├── prompt-builder.ts  # Prompt generation (replaces build-*.sh)
│   ├── preflight.ts       # Pre-run checks
│   ├── yaml-ops.ts        # Atomic YAML operations
│   ├── claude-runner.ts   # Claude CLI invocation
│   └── snapshot.ts        # Snapshot/restore
├── scripts/                # Reduced to integration tests only
│   └── test-*.sh          # Integration tests (kept)
└── bin/
    └── sprint             # CLI entry point
```

### Phase 6: Prompt Builder Migration

**Scope:** Replace `build-sprint-prompt.sh` (354 lines) and `build-parallel-prompt.sh` (82 lines) with TypeScript.

**Files to Create:** `runtime/src/prompt-builder.ts`

```typescript
import { CompiledProgress, CurrentPointer, CompiledPhase, SprintPrompts } from '../../compiler/src/types';
import * as fs from 'fs';
import * as path from 'path';

interface PromptContext {
  sprintId: string;
  sprintDir: string;
  iteration: number;
  phase: { id: string; index: number };
  step?: { id: string; prompt: string; index: number };
  subPhase?: { id: string; index: number };
  retryCount: number;
  isParallel: boolean;
}

/**
 * Build prompt for current phase/step/sub-phase
 */
export function buildPrompt(
  progress: CompiledProgress,
  sprintDir: string,
  customPrompts?: SprintPrompts
): string {
  const ctx = buildPromptContext(progress, sprintDir);
  const phase = getCurrentPhase(progress);

  if (!phase) {
    throw new Error('No current phase to build prompt for');
  }

  const sections: string[] = [];

  // 1. Header
  sections.push(customPrompts?.header ?? buildDefaultHeader(ctx));

  // 2. Position indicator
  sections.push(customPrompts?.position ?? buildPositionIndicator(ctx));

  // 3. Retry warning (if applicable)
  if (ctx.retryCount > 0) {
    sections.push(customPrompts?.['retry-warning'] ?? buildRetryWarning(ctx));
  }

  // 4. Context files
  const contextContent = loadContextFiles(sprintDir);
  if (contextContent) {
    sections.push('## Context\n' + contextContent);
  }

  // 5. Main prompt
  sections.push('## Task\n' + phase.prompt);

  // 6. Instructions
  sections.push(customPrompts?.instructions ?? buildDefaultInstructions(ctx));

  // 7. Result reporting
  sections.push(customPrompts?.['result-reporting'] ?? buildResultReporting(ctx));

  return sections.join('\n\n');
}

function buildDefaultHeader(ctx: PromptContext): string {
  return `# Sprint: ${ctx.sprintId}
Iteration: ${ctx.iteration}`;
}

function buildPositionIndicator(ctx: PromptContext): string {
  const parts = [`Phase: ${ctx.phase.id} (${ctx.phase.index + 1})`];
  if (ctx.step) {
    parts.push(`Step: ${ctx.step.id} (${ctx.step.index + 1})`);
  }
  if (ctx.subPhase) {
    parts.push(`Sub-phase: ${ctx.subPhase.id} (${ctx.subPhase.index + 1})`);
  }
  return '## Position\n' + parts.join(' → ');
}

function buildRetryWarning(ctx: PromptContext): string {
  return `⚠️ **RETRY ATTEMPT ${ctx.retryCount}**
Previous attempt failed. Please review and try again.`;
}

function buildDefaultInstructions(ctx: PromptContext): string {
  return `## Instructions
- Complete the task described above
- Make atomic commits as you work
- Report your result in JSON format at the end`;
}

function buildResultReporting(ctx: PromptContext): string {
  return `## Result Reporting
When complete, output a JSON block:
\`\`\`json
{
  "status": "completed" | "failed" | "needs-human",
  "summary": "Brief description of what was done",
  "error": "Error message if failed"
}
\`\`\``;
}

function loadContextFiles(sprintDir: string): string | null {
  const contextDir = path.join(sprintDir, 'context');
  if (!fs.existsSync(contextDir)) return null;

  const files = fs.readdirSync(contextDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  if (files.length === 0) return null;

  return files.map(f => {
    const content = fs.readFileSync(path.join(contextDir, f), 'utf8');
    return `### ${f}\n${content}`;
  }).join('\n\n');
}
```

**Key Features:**
- Template variable substitution (`{{sprint.id}}`, etc.)
- Custom prompt overrides from SPRINT.yaml
- Context file loading
- Parallel prompt support

---

### Phase 7: YAML Operations Migration

**Scope:** Replace all `yq` operations with TypeScript using `js-yaml`.

**Files to Create:** `runtime/src/yaml-ops.ts`

```typescript
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as crypto from 'crypto';
import { CompiledProgress } from '../../compiler/src/types';

const CHECKSUM_ALGORITHM = 'sha256';

/**
 * Atomic YAML write with checksum
 */
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });

  const tempPath = `${filePath}.tmp.${process.pid}`;
  const checksumPath = `${filePath}.checksum`;

  try {
    // Write to temp file
    fs.writeFileSync(tempPath, content, 'utf8');

    // Atomic rename
    fs.renameSync(tempPath, filePath);

    // Update checksum
    const checksum = calculateChecksum(content);
    fs.writeFileSync(checksumPath, checksum, 'utf8');
  } finally {
    // Cleanup temp file if it exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * Read PROGRESS.yaml with checksum validation
 */
export function readProgress(filePath: string): CompiledProgress {
  const content = fs.readFileSync(filePath, 'utf8');
  const checksumPath = `${filePath}.checksum`;

  if (fs.existsSync(checksumPath)) {
    const storedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
    const actualChecksum = calculateChecksum(content);

    if (storedChecksum !== actualChecksum) {
      throw new Error(`PROGRESS.yaml checksum mismatch - file may be corrupted`);
    }
  }

  return yaml.load(content) as CompiledProgress;
}

/**
 * Create backup before critical operations
 */
export function backupProgress(filePath: string): void {
  const backupPath = `${filePath}.backup`;
  const checksumPath = `${filePath}.checksum`;
  const checksumBackup = `${checksumPath}.backup`;

  fs.copyFileSync(filePath, backupPath);
  if (fs.existsSync(checksumPath)) {
    fs.copyFileSync(checksumPath, checksumBackup);
  }
}

/**
 * Restore from backup
 */
export function restoreProgress(filePath: string): boolean {
  const backupPath = `${filePath}.backup`;
  if (!fs.existsSync(backupPath)) return false;

  fs.renameSync(backupPath, filePath);

  const checksumBackup = `${filePath}.checksum.backup`;
  if (fs.existsSync(checksumBackup)) {
    fs.renameSync(checksumBackup, `${filePath}.checksum`);
  }

  return true;
}

function calculateChecksum(content: string): string {
  return crypto.createHash(CHECKSUM_ALGORITHM).update(content).digest('hex');
}
```

---

### Phase 8: Claude Runner

**Scope:** Create TypeScript wrapper for Claude CLI invocation.

**Files to Create:** `runtime/src/claude-runner.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ClaudeRunOptions {
  prompt: string;
  outputFile?: string;
  maxTurns?: number;
  model?: string;
  allowedTools?: string[];
  continueSession?: string;
}

interface ClaudeResult {
  success: boolean;
  output: string;
  exitCode: number;
  jsonResult?: unknown;
}

/**
 * Run Claude CLI and capture output
 */
export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeResult> {
  const args = buildClaudeArgs(options);

  return new Promise((resolve, reject) => {
    const process = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send prompt via stdin
    process.stdin.write(options.prompt);
    process.stdin.end();

    process.on('close', (code) => {
      const result: ClaudeResult = {
        success: code === 0,
        output: stdout,
        exitCode: code ?? 1
      };

      // Try to extract JSON result
      const jsonMatch = stdout.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          result.jsonResult = JSON.parse(jsonMatch[1]);
        } catch (e) {
          // JSON parsing failed, leave undefined
        }
      }

      resolve(result);
    });

    process.on('error', reject);
  });
}

function buildClaudeArgs(options: ClaudeRunOptions): string[] {
  const args: string[] = ['--print'];

  if (options.outputFile) {
    args.push('--output-format', 'json');
  }

  if (options.maxTurns) {
    args.push('--max-turns', options.maxTurns.toString());
  }

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.allowedTools) {
    args.push('--allowedTools', options.allowedTools.join(','));
  }

  if (options.continueSession) {
    args.push('--continue', options.continueSession);
  }

  return args;
}
```

---

### Phase 9: Main Loop Migration

**Scope:** Replace `sprint-loop.sh` (2,464 lines) with TypeScript.

**Files to Create:** `runtime/src/loop.ts`

```typescript
import { transition } from './transition';
import { executeActions } from './executor';
import { buildPrompt } from './prompt-builder';
import { readProgress, writeProgressAtomic, backupProgress, restoreProgress } from './yaml-ops';
import { SprintState, SprintEvent, CompiledProgress } from '../../compiler/src/types';
import * as fs from 'fs';
import * as path from 'path';

interface LoopOptions {
  maxIterations?: number;
  delay?: number;
  verbose?: boolean;
}

/**
 * Main sprint loop - FULL REPLACEMENT for sprint-loop.sh
 */
export async function runLoop(sprintDir: string, options: LoopOptions = {}): Promise<SprintState> {
  const { maxIterations = 0, delay = 2000, verbose = false } = options;

  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');

  // Recover from any interrupted transaction
  await recoverFromInterrupt(progressPath);

  // Load initial state
  let progress = readProgress(progressPath);
  let state = restoreState(progress);
  let iteration = 0;

  log(verbose, `Starting sprint loop: ${progress['sprint-id']}`);

  // Main loop
  while (!isTerminalState(state)) {
    iteration++;

    // Check iteration limit
    if (maxIterations > 0 && iteration > maxIterations) {
      log(verbose, `Max iterations (${maxIterations}) reached`);
      const result = transition(state, { type: 'MAX_ITERATIONS_REACHED' }, progress);
      state = result.nextState;
      progress = applyContextUpdates(progress, result.context);
      await writeProgressAtomic(progressPath, progress);
      break;
    }

    // Check for pause signal
    if (await checkPauseSignal(sprintDir)) {
      log(verbose, 'Pause signal detected');
      const result = transition(state, { type: 'PAUSE', reason: 'User requested' }, progress);
      state = result.nextState;
      progress = applyContextUpdates(progress, result.context);
      await writeProgressAtomic(progressPath, progress);
      break;
    }

    // Start transaction
    backupProgress(progressPath);

    try {
      // Determine what to do based on current state
      const event = await determineNextEvent(state, progress, sprintDir);

      // Apply transition
      const result = transition(state, event, progress);
      state = result.nextState;
      progress = applyContextUpdates(progress, result.context);

      // Execute actions
      const resultingEvents = await executeActions(result.actions);

      // Process resulting events
      for (const resultEvent of resultingEvents) {
        const nextResult = transition(state, resultEvent, progress);
        state = nextResult.nextState;
        progress = applyContextUpdates(progress, nextResult.context);
        await executeActions(nextResult.actions);
      }

      // Persist state
      await writeProgressAtomic(progressPath, progress);

      // Transaction complete
      cleanupBackup(progressPath);

    } catch (error) {
      log(verbose, `Error in iteration ${iteration}: ${error}`);
      restoreProgress(progressPath);
      throw error;
    }

    // Delay between iterations
    if (delay > 0) {
      await sleep(delay);
    }
  }

  log(verbose, `Sprint loop completed with status: ${state.status}`);
  return state;
}

function isTerminalState(state: SprintState): boolean {
  return ['completed', 'blocked', 'paused', 'needs-human'].includes(state.status);
}

async function determineNextEvent(
  state: SprintState,
  progress: CompiledProgress,
  sprintDir: string
): Promise<SprintEvent> {
  if (state.status === 'not-started') {
    return { type: 'START' };
  }

  if (state.status === 'in-progress') {
    // Build prompt and run Claude
    const prompt = buildPrompt(progress, sprintDir, progress.prompts);
    const result = await runClaudeForPhase(prompt, progress);
    return result;
  }

  // Default: no event
  return { type: 'TICK' };
}

function log(verbose: boolean, message: string): void {
  if (verbose) {
    console.log(`[sprint-loop] ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### Phase 10: CLI Entry Point

**Scope:** Create CLI that wraps the TypeScript runtime.

**Files to Create:** `bin/sprint`

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { runLoop } from '../runtime/src/loop';
import { compile } from '../compiler/src/compile';

program
  .name('sprint')
  .description('M42 Sprint - TypeScript Runtime')
  .version('2.0.0');

program
  .command('run <sprint-dir>')
  .description('Run sprint loop')
  .option('--max-iterations <n>', 'Maximum iterations', parseInt)
  .option('--delay <ms>', 'Delay between iterations', parseInt, 2000)
  .option('-v, --verbose', 'Verbose output')
  .action(async (sprintDir, options) => {
    try {
      // Compile if needed
      await compile(sprintDir);

      // Run loop
      const finalState = await runLoop(sprintDir, {
        maxIterations: options.maxIterations,
        delay: options.delay,
        verbose: options.verbose
      });

      console.log(`Sprint finished: ${finalState.status}`);
      process.exit(finalState.status === 'completed' ? 0 : 1);
    } catch (error) {
      console.error('Sprint failed:', error);
      process.exit(1);
    }
  });

program.parse();
```

---

## Revised Rollout Strategy

### Step 1: Type System (Foundation)
- Add discriminated unions to `types.ts`
- Add `@deprecated` to old types
- **No runtime changes**

### Step 2: Transition Function (Pure Logic)
- Create `runtime/src/transition.ts`
- 100% test coverage
- **No runtime changes yet**

### Step 3: Support Modules
- `yaml-ops.ts` - Atomic YAML operations
- `prompt-builder.ts` - Prompt generation
- `claude-runner.ts` - Claude CLI wrapper
- **Can test in isolation**

### Step 4: Executor (Action Bridge)
- Create `runtime/src/executor.ts`
- Maps actions to implementations
- Integration tests with mock Claude

### Step 5: Main Loop
- Create `runtime/src/loop.ts`
- **Parallel run with bash** for validation
- Flag: `--runtime=typescript`

### Step 6: Switch Default
- TypeScript becomes default runtime
- Bash kept as `--runtime=bash` fallback

### Step 7: Remove Bash
- Delete `sprint-loop.sh`, `build-*.sh`
- Keep `test-*.sh` as integration tests

## Benefits Summary

| Before | After |
|--------|-------|
| 2,900 lines bash | ~1,500 lines TypeScript |
| Status strings | Discriminated unions |
| Implicit transitions | Explicit event-driven |
| yq operations | js-yaml with atomic writes |
| Hard to test | Pure functions + 100% coverage |
| No IDE support | Full TypeScript IntelliSense |
| Scattered logic | Centralized transition function |

## Migration Impact

### Breaking Changes
- **None** - YAML formats unchanged
- CLI commands work the same
- Workflows work the same

### User Impact
- Faster execution (no bash overhead)
- Better error messages
- Same commands, same behavior

### Developer Impact
- Single language codebase
- Type-safe state transitions
- Easy to test and debug
- IDE autocomplete for everything

## Success Metrics

1. **LOC Reduction**: 2,900 bash → ~1,500 TypeScript
2. **Type Safety**: Zero `any` types in state logic
3. **Test Coverage**: 100% on transition + executor
4. **Performance**: ≤ bash latency
5. **Reliability**: Crash recovery via snapshots

---

**Document Version:** 2.0
**Created:** 2026-01-19
**Updated:** 2026-01-19
**Author:** TypeScript Migration Planning
**Status:** Proposal - Ready for Sprint
