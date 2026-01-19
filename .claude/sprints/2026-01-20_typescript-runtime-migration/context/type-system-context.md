# Step Context: type-system

## Task
GIVEN the current string-based status types in m42-sprint
WHEN applying XState-inspired patterns for type safety
THEN create discriminated unions and event types

## Scope
Enhance `plugins/m42-sprint/compiler/src/types.ts` only.
NO runtime changes - types only.

## Acceptance Criteria

### Discriminated Union: SprintState
- [ ] `{ status: 'not-started' }`
- [ ] `{ status: 'in-progress'; current: CurrentPointer; iteration: number; startedAt: string }`
- [ ] `{ status: 'paused'; pausedAt: CurrentPointer; pauseReason: string }`
- [ ] `{ status: 'blocked'; error: string; failedPhase: string; blockedAt: string }`
- [ ] `{ status: 'needs-human'; reason: string; details?: string }`
- [ ] `{ status: 'completed'; summary?: string; completedAt: string; elapsed: string }`

### Event Union: SprintEvent
- [ ] START, TICK, MAX_ITERATIONS_REACHED
- [ ] PHASE_COMPLETE { summary, phaseId }
- [ ] PHASE_FAILED { error, category, phaseId }
- [ ] STEP_COMPLETE { summary, stepId }
- [ ] STEP_FAILED { error, category, stepId }
- [ ] PROPOSE_STEPS { steps, proposedBy }
- [ ] PAUSE { reason }, RESUME
- [ ] HUMAN_NEEDED { reason, details? }
- [ ] GOAL_COMPLETE { summary }

### Action Union: SprintAction
- [ ] LOG { level, message }
- [ ] SPAWN_CLAUDE { prompt, phaseId, onComplete }
- [ ] WRITE_PROGRESS
- [ ] UPDATE_STATS { updates }
- [ ] EMIT_ACTIVITY { activity, data }
- [ ] SCHEDULE_RETRY { phaseId, delayMs }
- [ ] INSERT_STEP { step, position }

### TransitionResult Interface
- [ ] { nextState: SprintState; actions: SprintAction[]; context: Partial<CompiledProgress> }

### Guard Functions
- [ ] Create `guards` object with: hasMorePhases, hasMoreSteps, hasMoreSubPhases
- [ ] isRetryable, hasStepQueue, orchestrationEnabled, autoApproveEnabled

### Backwards Compatibility
- [ ] Add @deprecated JSDoc to old SprintStatus type
- [ ] Keep old types working for now
- [ ] npm run typecheck passes
- [ ] npm run build passes

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Add SprintState discriminated union** (lines after existing SprintStatus)
   - 6 variants with status discriminant
   - Each variant has state-specific required fields

2. **Add SprintEvent discriminated union**
   - 12 event types with `type` discriminant
   - Events reference existing types like ErrorCategory, ProposedStep

3. **Add SprintAction discriminated union**
   - 7 action types with `type` discriminant
   - Reference existing StepQueueItem for INSERT_STEP

4. **Add TransitionResult interface**
   - Combines SprintState, SprintAction[], and Partial<CompiledProgress>

5. **Add GuardFn type and guards object**
   - Type alias for guard function signature
   - Exported object with 7 guard implementations

6. **Add @deprecated JSDoc to SprintStatus**
   - Preserve backwards compatibility
   - Add deprecation notice with migration guidance

## Related Code Patterns

### Pattern from: types.ts (existing discriminated structure)
```typescript
// Current string union pattern
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

### Pattern from: xstate-patterns-plan.md (target pattern)
```typescript
// Discriminated union pattern
export type SprintState =
  | { status: 'not-started' }
  | {
      status: 'in-progress';
      current: CurrentPointer;
      iteration: number;
      startedAt: string;
    }
  // ... more variants
```

### Pattern from: types.test.ts (test expectations)
```typescript
// Tests expect exact field names and types
const state: SprintState = {
  status: 'in-progress',
  current: pointer,
  iteration: 1,
  startedAt: '2026-01-19T10:00:00Z'
};
```

## Required Imports
### Internal
- All types are self-contained in types.ts
- New types reference existing types:
  - `CurrentPointer` - for state position
  - `CompiledProgress` - for context updates
  - `ErrorCategory` - for error classification
  - `ProposedStep` - for step proposals
  - `StepQueueItem` - for queued steps
  - `SprintStats` - for stats updates

### External
- None required - pure TypeScript types

## Types/Interfaces to Use
```typescript
// From types.ts (existing)
interface CurrentPointer {
  phase: number;
  step: number | null;
  'sub-phase': number | null;
}

interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  retry?: RetryConfig;
  'step-queue'?: StepQueueItem[];
  orchestration?: OrchestrationConfig;
  // ... other fields
}

type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';

interface ProposedStep {
  prompt: string;
  reasoning?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  insertAfter?: string;
}

interface StepQueueItem {
  id: string;
  prompt: string;
  proposedBy: string;
  proposedAt: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

## Integration Points
- **Called by**: Future `transition.ts` module (Phase 2 of migration)
- **Calls**: None - pure type definitions
- **Exported to**: All runtime modules will import these types
- **Test coverage**: 38 tests in `types.test.ts`

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/compiler/src/types.ts` | Modify | Add discriminated unions, TransitionResult, guards |

## Insertion Points in types.ts

### 1. SprintState (after line 11, after SprintStatus)
Add the new discriminated union immediately after the existing SprintStatus type.

### 2. SprintEvent (after SprintState)
Add after SprintState, before any interfaces that might use it.

### 3. SprintAction (after SprintEvent)
Add after SprintEvent, references SprintEvent for onComplete field.

### 4. TransitionResult (after SprintAction)
Add interface that combines the above types.

### 5. GuardFn and guards (after TransitionResult)
Add type alias and exported object with guard implementations.

### 6. @deprecated JSDoc (modify line 10)
Add deprecation comment to existing SprintStatus.

## Test Verification Commands
```bash
# Build compiler
cd plugins/m42-sprint/compiler && npm run build

# Type check
cd plugins/m42-sprint/compiler && npm run typecheck

# Run tests
cd plugins/m42-sprint/compiler && npm run test
```

## Expected Test Outcomes After Implementation
- All 38 tests in types.test.ts should pass
- No TypeScript compilation errors
- `dist/types.js` generated with exported guards object
- `dist/types.d.ts` includes all new type definitions

## Notes
- Guard functions need runtime implementations, not just types
- Guards are exported as a const object, not individual exports
- INSERT_STEP position uses same values as OrchestrationConfig.insertStrategy ('after-current' | 'end-of-phase')
- SprintEvent onComplete field should be SprintEvent['type'] to allow any event type

---

## Document Metadata
- **Phase**: context (2/6)
- **Step**: type-system (1/9)
- **Sprint**: 2026-01-20_typescript-runtime-migration
- **Created**: 2026-01-20
- **Author**: Sprint Automation
