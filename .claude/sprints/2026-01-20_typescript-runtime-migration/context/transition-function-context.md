# Step Context: transition-function

## Task
GIVEN the discriminated union types from Step 0
WHEN implementing transition logic
THEN create testable pure function returning state + actions

## Scope
Create NEW file: plugins/m42-sprint/runtime/src/transition.ts
Create runtime directory structure if needed.

## Acceptance Criteria

### Core Function
- [ ] `transition(state: SprintState, event: SprintEvent, context: CompiledProgress): TransitionResult`
- [ ] Pure function - NO side effects
- [ ] Returns { nextState, actions, context }

### Event Handling (exhaustive matching)
- [ ] START → in-progress + SPAWN_CLAUDE action
- [ ] PHASE_COMPLETE → advance pointer or completed + WRITE_PROGRESS
- [ ] PHASE_FAILED + retryable → same state + SCHEDULE_RETRY
- [ ] PHASE_FAILED + not retryable → blocked + WRITE_PROGRESS
- [ ] PAUSE → paused + WRITE_PROGRESS
- [ ] RESUME → in-progress + SPAWN_CLAUDE
- [ ] PROPOSE_STEPS + autoApprove → INSERT_STEP actions
- [ ] PROPOSE_STEPS + !autoApprove → update step-queue context
- [ ] MAX_ITERATIONS_REACHED → blocked
- [ ] HUMAN_NEEDED → needs-human

### Helper Functions
- [ ] `advancePointer(current, context)` → { nextPointer, hasMore }
- [ ] `calculateBackoff(context)` → delay in ms
- [ ] `getCurrentPhase/Step/SubPhase(progress)` → current item

### Guards Integration
- [ ] Use guards from types.ts for conditions
- [ ] TypeScript enforces exhaustive switch

### Tests
- [ ] Unit test for each state × event combination
- [ ] Test: invalid transitions return unchanged state
- [ ] Test: actions are correct for each transition
- [ ] 100% code coverage

## Files to Create
- plugins/m42-sprint/runtime/src/transition.ts
- plugins/m42-sprint/runtime/src/transition.test.ts (already created in RED phase)

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Type Re-exports** - Re-export types from compiler for test compatibility
2. **Helper Functions** - `advancePointer`, `calculateBackoff`, `getCurrentPhase/Step/SubPhase`
3. **ID Generation** - `generateId()` for step queue items
4. **START Event Handler** - Simplest transition
5. **PAUSE/RESUME Handlers** - State preservation pair
6. **HUMAN_NEEDED/MAX_ITERATIONS** - Terminal state transitions
7. **PHASE_COMPLETE Handler** - Pointer advancement logic
8. **PHASE_FAILED Handler** - Retry/block branching
9. **PROPOSE_STEPS Handler** - Orchestration logic
10. **TICK/GOAL_COMPLETE** - No-op and terminal handlers

## Related Code Patterns

### Pattern from: compiler/src/error-classifier.ts
```typescript
// Pure function with exhaustive switch
export function getRecoveryAction(category: ErrorCategory): 'auto-retry' | 'skip' | 'human-intervention' {
  switch (category) {
    case 'network':
    case 'rate-limit':
    case 'timeout':
      return 'auto-retry';
    case 'validation':
      return 'skip';
    case 'logic':
    default:
      return 'human-intervention';
  }
}
```

### Pattern from: compiler/src/expand-foreach.ts
```typescript
// Spread operator for immutable updates
const stepContext: TemplateContext = {
  ...context,
  step: {
    prompt: step.prompt,
    id: stepId,
    index: stepIndex
  }
};
```

### Pattern from: compiler/src/types.ts (Guards)
```typescript
// Guard functions for conditional transitions
export const guards: Record<string, GuardFn> = {
  hasMorePhases: (_state, ctx, _event) =>
    ctx.current.phase < (ctx.phases?.length ?? 0) - 1,

  isRetryable: (_state, ctx, event) => {
    if (event.type !== 'PHASE_FAILED' && event.type !== 'STEP_FAILED') return false;
    if (!ctx.retry?.retryOn) return false;
    return ctx.retry.retryOn.includes(event.category);
  },
};
```

## Required Imports

### Internal (from compiler)
- `SprintState` - Discriminated union for state
- `SprintEvent` - Discriminated union for events
- `SprintAction` - Discriminated union for actions
- `TransitionResult` - Return type
- `CompiledProgress` - Context type
- `CurrentPointer` - Pointer type
- `CompiledTopPhase` - Phase type
- `CompiledStep` - Step type
- `CompiledPhase` - Sub-phase type
- `StepQueueItem` - Queue item type
- `guards` - Guard functions

### External
- Node.js `crypto` module - For `randomUUID()` (ID generation)

## Types/Interfaces to Use

### From compiler/src/types.ts

```typescript
// State discriminated union
export type SprintState =
  | { status: 'not-started' }
  | { status: 'in-progress'; current: CurrentPointer; iteration: number; startedAt: string }
  | { status: 'paused'; pausedAt: CurrentPointer; pauseReason: string }
  | { status: 'blocked'; error: string; failedPhase: string; blockedAt: string }
  | { status: 'needs-human'; reason: string; details?: string }
  | { status: 'completed'; summary?: string; completedAt: string; elapsed: string };

// Event discriminated union
export type SprintEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'MAX_ITERATIONS_REACHED' }
  | { type: 'PHASE_COMPLETE'; summary: string; phaseId: string }
  | { type: 'PHASE_FAILED'; error: string; category: ErrorCategory; phaseId: string }
  | { type: 'STEP_COMPLETE'; summary: string; stepId: string }
  | { type: 'STEP_FAILED'; error: string; category: ErrorCategory; stepId: string }
  | { type: 'PROPOSE_STEPS'; steps: ProposedStep[]; proposedBy: string }
  | { type: 'PAUSE'; reason: string }
  | { type: 'RESUME' }
  | { type: 'HUMAN_NEEDED'; reason: string; details?: string }
  | { type: 'GOAL_COMPLETE'; summary: string };

// Action discriminated union
export type SprintAction =
  | { type: 'LOG'; level: LogLevel; message: string }
  | { type: 'SPAWN_CLAUDE'; prompt: string; phaseId: string; onComplete: SprintEvent['type'] }
  | { type: 'WRITE_PROGRESS' }
  | { type: 'UPDATE_STATS'; updates: Partial<SprintStats> }
  | { type: 'EMIT_ACTIVITY'; activity: string; data: unknown }
  | { type: 'SCHEDULE_RETRY'; phaseId: string; delayMs: number }
  | { type: 'INSERT_STEP'; step: StepQueueItem; position: InsertPosition };

// Transition result
export interface TransitionResult {
  nextState: SprintState;
  actions: SprintAction[];
  context: Partial<CompiledProgress>;
}
```

## Integration Points

### Called by
- `runtime/src/loop.ts` - Main sprint loop (Phase 9)
- `runtime/src/executor.ts` - Action executor (Phase 3)

### Calls
- `guards.hasMorePhases` - Check if more phases exist
- `guards.hasMoreSteps` - Check if more steps exist
- `guards.hasMoreSubPhases` - Check if more sub-phases exist
- `guards.isRetryable` - Check if error should trigger retry
- `guards.orchestrationEnabled` - Check orchestration config
- `guards.autoApproveEnabled` - Check auto-approve config

### Test File
- `runtime/src/transition.test.ts` - 49 test cases already written (RED phase)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/runtime/src/transition.ts` | Create | Pure transition function implementation |

## Key Implementation Notes

### 1. Timestamp Handling
Tests expect consistent timestamps. For pure function testing, timestamps should be generated at call time:
```typescript
const now = new Date().toISOString();
```

### 2. Exhaustive Event Matching
Use TypeScript exhaustive switch pattern:
```typescript
switch (event.type) {
  case 'START': // ...
  case 'PHASE_COMPLETE': // ...
  // ... all cases
  default:
    // TypeScript will error if any case is missed
    const _exhaustive: never = event;
    return { nextState: state, actions: [], context: {} };
}
```

### 3. State-Event Matrix
Valid transitions (other combinations return unchanged state):

| State | Valid Events |
|-------|--------------|
| not-started | START |
| in-progress | PHASE_COMPLETE, PHASE_FAILED, PAUSE, PROPOSE_STEPS, MAX_ITERATIONS_REACHED, HUMAN_NEEDED, TICK, GOAL_COMPLETE |
| paused | RESUME |
| blocked | (none - terminal) |
| needs-human | (none - terminal) |
| completed | (none - terminal) |

### 4. Pointer Advancement Logic
The `advancePointer` function must handle the 3-level hierarchy:
1. If `sub-phase` can advance → advance it
2. Else if `step` can advance → advance it, reset `sub-phase` to 0
3. Else if `phase` can advance → advance it, reset `step` and `sub-phase`
4. Else → `hasMore = false`

### 5. Module Path Resolution
Use `.js` extension for ESM imports:
```typescript
import { guards } from '../../compiler/src/types.js';
```

### 6. ID Generation
Use `crypto.randomUUID()` for unique step queue IDs:
```typescript
import { randomUUID } from 'crypto';
const id = randomUUID();
```

## Verification Commands

### Build
```bash
cd plugins/m42-sprint/runtime && npm run build
```

### Type Check
```bash
cd plugins/m42-sprint/runtime && npm run typecheck
```

### Run Tests
```bash
cd plugins/m42-sprint/runtime && npm run test
```

### Expected Results (GREEN phase)
- Build: success
- Type check: success
- Tests: 49/49 passing
