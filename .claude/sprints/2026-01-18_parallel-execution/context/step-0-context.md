# Step Context: step-0

## Task
Add parallel execution types to compiler/src/types.ts:

1. Add `parallel?: boolean` to WorkflowPhase interface (lines 68-77)
2. Add `wait-for-parallel?: boolean` to WorkflowPhase interface
3. Create new ParallelTask interface with fields:
   - id, step-id, phase-id
   - status: 'spawned' | 'running' | 'completed' | 'failed'
   - pid, log-file, spawned-at, completed-at, exit-code, error
4. Add `parallel-tasks?: ParallelTask[]` to CompiledProgress (lines 202-211)
5. Add `parallel?: boolean` and `parallel-task-id?: string` to CompiledPhase (lines 101-119)
6. Add `wait-for-parallel?: boolean` to CompiledTopPhase (lines 148-168)

## Related Code Patterns

### Similar Implementation: Optional Properties in WorkflowPhase
```typescript
// plugins/m42-sprint/compiler/src/types.ts:68-77
export interface WorkflowPhase {
  /** Unique identifier for this phase */
  id: string;
  /** The prompt to execute for this phase */
  prompt?: string;
  /** If set to 'step', iterates over all steps from SPRINT.yaml */
  'for-each'?: 'step';
  /** Reference to another workflow to use for each iteration */
  workflow?: string;
  // NEW: parallel execution properties go here
}
```

### Similar Implementation: Optional Properties in CompiledPhase
```typescript
// plugins/m42-sprint/compiler/src/types.ts:101-119
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  /** Timing information */
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  /** Any notes or summary from execution */
  summary?: string;
  /** Error message if phase failed */
  error?: string;
  /** Number of retry attempts made */
  'retry-count'?: number;
  // NEW: parallel and parallel-task-id go here
}
```

### Similar Implementation: Status Union Types
```typescript
// plugins/m42-sprint/compiler/src/types.ts:95-96
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
// NEW: ParallelTaskStatus type can follow this pattern
```

## Required Imports
### Internal
- No new imports required - this is the types module itself

### External
- No new external packages needed

## Types/Interfaces to Use
```typescript
// Existing types to reference:
type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

// NEW type to create:
export type ParallelTaskStatus = 'spawned' | 'running' | 'completed' | 'failed';

// NEW interface to create:
export interface ParallelTask {
  /** Unique identifier for this parallel task */
  id: string;
  /** Reference to the step this task belongs to */
  'step-id': string;
  /** Reference to the phase within the step */
  'phase-id': string;
  /** Current status of the parallel task */
  status: ParallelTaskStatus;
  /** Process ID of the spawned task */
  pid?: number;
  /** Path to the log file for this task */
  'log-file'?: string;
  /** ISO timestamp when task was spawned */
  'spawned-at'?: string;
  /** ISO timestamp when task completed */
  'completed-at'?: string;
  /** Exit code from the process */
  'exit-code'?: number;
  /** Error message if task failed */
  error?: string;
}
```

## Integration Points
- **Called by**:
  - `compile.ts` - creates CompiledProgress with potential parallel-tasks array
  - `expand-foreach.ts` - handles WorkflowPhase with parallel property
- **Calls**: Nothing (types module has no runtime dependencies)
- **Tests**: `validate.test.ts` - may need to be extended if validation logic changes

## Implementation Notes
- Follow existing naming conventions: kebab-case for YAML keys (e.g., `'step-id'`, `'phase-id'`)
- All new properties should be optional (`?:`) to maintain backward compatibility
- Add JSDoc comments to all new properties following existing patterns
- Place ParallelTask interface after PhaseStatus/SprintStatus definitions (around line 97)
- Place ParallelTaskStatus type next to other status types (line 97)
- The status union type for ParallelTask is different from PhaseStatus - uses 'spawned' instead of 'pending'
- Properties should be exported to be accessible from other modules

## Verification Commands
```bash
# After implementation, verify with:
cd plugins/m42-sprint/compiler && npx tsc --noEmit

# Run gherkin scenarios (from artifacts/step-0-gherkin.md)
grep -Pzo "interface WorkflowPhase \{[^}]*parallel\?: boolean" plugins/m42-sprint/compiler/src/types.ts
```

## File Locations Summary
- **Target file**: `plugins/m42-sprint/compiler/src/types.ts`
- **Test file**: `plugins/m42-sprint/compiler/src/validate.test.ts`
- **Consumer modules**:
  - `plugins/m42-sprint/compiler/src/compile.ts`
  - `plugins/m42-sprint/compiler/src/expand-foreach.ts`
