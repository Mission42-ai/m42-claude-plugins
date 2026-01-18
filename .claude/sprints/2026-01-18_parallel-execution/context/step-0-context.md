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

Reference: context/implementation-plan.md sections 4.A and 5

## Related Code Patterns

### Similar Implementation: ErrorCategory union type (types.ts:24)
```typescript
// Key pattern: string literal union types
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
```

### Similar Implementation: Optional timing fields (types.ts:105-108)
```typescript
// Key pattern: optional properties with kebab-case YAML names
/** Timing information */
'started-at'?: string;
'completed-at'?: string;
elapsed?: string;
```

### Similar Implementation: Interface with status tracking (CompiledPhase, types.ts:101-119)
```typescript
// Key pattern: status field with union type, optional metadata
export interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
  error?: string;
  'retry-count'?: number;
  'next-retry-at'?: string;
  'error-category'?: ErrorCategory;
}
```

## Required Imports
### Internal
- No new imports needed - all types are defined in this file

### External
- No external packages needed - pure TypeScript interfaces

## Types/Interfaces to Use
```typescript
// Existing status types (types.ts:95-96)
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
```

## Integration Points
- **Called by**:
  - `expand-foreach.ts` - will use `parallel` from WorkflowPhase when creating CompiledPhase
  - `compile.ts` - will initialize `parallel-tasks: []` in CompiledProgress
  - `validate.ts` - will validate new `parallel` and `wait-for-parallel` properties
- **Calls**: N/A (pure type definitions)
- **Tests**: No formal test files - verification via `npm run typecheck`

## Precise Edit Locations

| Interface | Current Lines | New Properties |
|-----------|---------------|----------------|
| WorkflowPhase | 68-77 | `parallel?: boolean`, `'wait-for-parallel'?: boolean` |
| CompiledPhase | 101-119 | `parallel?: boolean`, `'parallel-task-id'?: string` |
| CompiledTopPhase | 148-168 | `'wait-for-parallel'?: boolean` |
| CompiledProgress | 202-211 | `'parallel-tasks'?: ParallelTask[]` |
| ParallelTask | **NEW** | Insert after line 96 (after SprintStatus type) |

## Implementation Notes
- **Property naming**: Use kebab-case with quotes for YAML compatibility (e.g., `'wait-for-parallel'`)
- **All new properties are optional** (`?:`) to maintain backward compatibility
- **ParallelTask status union**: Different from PhaseStatus - uses `'spawned' | 'running' | 'completed' | 'failed'`
- **Insert ParallelTask interface** after line 96 before CompiledPhase section (keeps runtime types grouped)
- **JSDoc comments**: Follow existing pattern with `/** description */` for properties
- **Property order**: Add new properties at the end of each interface to minimize diff noise

## Verification Commands
After implementation, run gherkin scenarios:
```bash
# Scenario 1: WorkflowPhase parallel
grep -E "parallel\?.*:.*boolean" plugins/m42-sprint/compiler/src/types.ts | grep -v "wait-for-parallel" | grep -v "parallel-task" | head -1

# Scenario 2: WorkflowPhase wait-for-parallel
grep -E "'wait-for-parallel'\?.*:.*boolean" plugins/m42-sprint/compiler/src/types.ts

# Scenario 3-4: ParallelTask interface
grep -A 15 "export interface ParallelTask" plugins/m42-sprint/compiler/src/types.ts

# Scenario 5: CompiledProgress parallel-tasks
grep -A 15 "export interface CompiledProgress" plugins/m42-sprint/compiler/src/types.ts | grep -E "'parallel-tasks'\?.*:.*ParallelTask\[\]"

# Scenario 6: CompiledPhase fields
grep -A 25 "export interface CompiledPhase" plugins/m42-sprint/compiler/src/types.ts | grep -E "(parallel\?.*boolean|'parallel-task-id'\?.*string)"

# Scenario 7: CompiledTopPhase wait-for-parallel
grep -A 25 "export interface CompiledTopPhase" plugins/m42-sprint/compiler/src/types.ts | grep -E "'wait-for-parallel'\?.*:.*boolean"

# Scenario 8: TypeScript compiles
cd plugins/m42-sprint/compiler && npm run typecheck
```
